import 'dotenv/config'
import { mongo } from 'mongoose'

type CollectionPlan = {
  names: string[]
  fields: string[]
}

type ResolvedCollectionPlan = {
  name: string
  fields: string[]
}

const COLLECTION_PLANS: CollectionPlan[] = [
  { names: ['documents'], fields: ['workspaceId', 'ownerId'] },
  {
    names: ['document_permissions'],
    fields: ['documentId', 'userId', 'grantedBy'],
  },
  { names: ['workspaces'], fields: ['createdBy', 'deletedBy'] },
  {
    names: ['workspace_members', 'workspacemembers'],
    fields: ['workspaceId', 'userId', 'roleId', 'invitedBy', 'deletedBy'],
  },
  {
    names: ['workspace_invitations', 'workspaceinvitations'],
    fields: ['workspaceId', 'invitedUserId', 'invitedBy'],
  },
  {
    names: ['pending_document_shares', 'pendingdocumentshares'],
    fields: ['documentId', 'workspaceId', 'createdBy', 'acceptedBy'],
  },
  { names: ['annotations'], fields: ['documentId', 'createdBy'] },
  { names: ['comments'], fields: ['documentId'] },
  { names: ['refresh_tokens', 'refreshtokens'], fields: ['userId'] },
]

const DUPLICATE_KEYS = [
  {
    names: ['document_permissions'],
    fields: ['documentId', 'userId'],
  },
  {
    names: ['workspace_members', 'workspacemembers'],
    fields: ['workspaceId', 'userId'],
  },
]

const execute = process.argv.includes('--execute')

async function resolvePlans(db: mongo.Db): Promise<ResolvedCollectionPlan[]> {
  const existingNames = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name,
    ),
  )

  return COLLECTION_PLANS.flatMap(({ names, fields }) =>
    names
      .filter((name) => existingNames.has(name))
      .map((name) => ({ name, fields })),
  )
}

async function inventoryField(collection: mongo.Collection, field: string) {
  return collection
    .aggregate([
      { $match: { [field]: { $exists: true } } },
      { $group: { _id: { $type: `$${field}` }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
}

async function findInvalidStrings(collection: mongo.Collection, field: string) {
  return collection
    .aggregate([
      { $match: { [field]: { $type: 'string' } } },
      {
        $set: {
          convertedId: {
            $convert: {
              input: `$${field}`,
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { convertedId: null } },
      { $project: { _id: 1, [field]: 1 } },
      { $limit: 100 },
    ])
    .toArray()
}

async function findUnsupportedTypes(collection: mongo.Collection, field: string) {
  return collection
    .aggregate([
      { $match: { [field]: { $exists: true } } },
      { $set: { fieldType: { $type: `$${field}` } } },
      { $match: { fieldType: { $nin: ['objectId', 'string', 'null'] } } },
      { $project: { _id: 1, [field]: 1, fieldType: 1 } },
      { $limit: 100 },
    ])
    .toArray()
}

function normalizedIdExpression(field: string) {
  return {
    $convert: {
      input: `$${field}`,
      to: 'objectId',
      onError: null,
      onNull: null,
    },
  }
}

async function findDuplicateLogicalKeys(
  collection: mongo.Collection,
  fields: string[],
) {
  const normalizedFields = Object.fromEntries(
    fields.map((field) => [field, normalizedIdExpression(field)]),
  )
  const allFieldsAreValid = Object.fromEntries(
    fields.map((field) => [`normalized.${field}`, { $ne: null }]),
  )

  return collection
    .aggregate([
      { $set: { normalized: normalizedFields } },
      { $match: allFieldsAreValid },
      {
        $group: {
          _id: '$normalized',
          count: { $sum: 1 },
          recordIds: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 100 },
    ])
    .toArray()
}

async function convertField(collection: mongo.Collection, field: string) {
  return collection.updateMany(
    { [field]: { $type: 'string' } },
    [{ $set: { [field]: { $toObjectId: `$${field}` } } }],
  )
}

async function main() {
  const mongoUrl = process.env.MONGO_URL
  if (!mongoUrl) {
    throw new Error('Missing MONGO_URL')
  }

  const client = new mongo.MongoClient(mongoUrl)
  await client.connect()

  try {
    const db = client.db()
    const plans = await resolvePlans(db)
    const resolvedNames = new Set(plans.map(({ name }) => name))

    console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`)

    for (const { names } of COLLECTION_PLANS) {
      if (!names.some((name) => resolvedNames.has(name))) {
        console.log(`[skip] collection not found: ${names.join(' | ')}`)
      }
    }

    let hasBlockers = false

    for (const { name, fields } of plans) {
      const collection = db.collection(name)
      console.log(`\n[collection] ${name}`)

      for (const field of fields) {
        const [inventory, invalidStrings, unsupportedTypes] = await Promise.all([
          inventoryField(collection, field),
          findInvalidStrings(collection, field),
          findUnsupportedTypes(collection, field),
        ])

        console.log(`[inventory] ${name}.${field}`, inventory)

        if (invalidStrings.length > 0) {
          hasBlockers = true
          console.error(`[invalid] ${name}.${field}`, invalidStrings)
        }

        if (unsupportedTypes.length > 0) {
          hasBlockers = true
          console.error(`[unsupported types] ${name}.${field}`, unsupportedTypes)
        }
      }
    }

    for (const { names, fields } of DUPLICATE_KEYS) {
      for (const name of names.filter((candidate) => resolvedNames.has(candidate))) {
        const duplicates = await findDuplicateLogicalKeys(
          db.collection(name),
          fields,
        )

        if (duplicates.length > 0) {
          hasBlockers = true
          console.error(`[duplicates] ${name}(${fields.join(', ')})`, duplicates)
        }
      }
    }

    if (hasBlockers) {
      throw new Error(
        'Migration blocked: resolve invalid ObjectId strings and duplicate logical keys first',
      )
    }

    if (!execute) {
      console.log('\nDry run complete. Re-run with --execute to write changes.')
      return
    }

    for (const { name, fields } of plans) {
      const collection = db.collection(name)
      for (const field of fields) {
        const result = await convertField(collection, field)
        console.log(`[converted] ${name}.${field}: ${result.modifiedCount}`)
      }
    }

    console.log('\nMigration complete.')
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
