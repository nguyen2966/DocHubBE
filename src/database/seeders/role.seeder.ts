// src/database/seeders/role.seed.ts

import 'dotenv/config'
import mongoose from 'mongoose'
import { RoleSchema } from '../../modules-system/mongodb/schemas/role'

const ROLES = [
  {
    name: 'viewer',
    scope: 'document',
    isSystem: true,
    permissions: ['document:view'],
  },
  {
    name: 'commenter',
    scope: 'document',
    isSystem: true,
    permissions: ['document:view', 'document:comment'],
  },
  {
    name: 'editor',
    scope: 'document',
    isSystem: true,
    permissions: ['document:view', 'document:comment', 'document:edit'],
  },
  {
    name: 'owner',
    scope: 'document',
    isSystem: true,
    permissions: [
      'document:view',
      'document:comment',
      'document:edit',
      'document:delete',
      'document:rename',
      'document:share',
    ],
  },
  {
    name: 'member',
    scope: 'workspace',
    isSystem: true,
    permissions: [],
  },
  {
    name: 'admin',
    scope: 'workspace',
    isSystem: true,
    permissions: ['workspace:manage_members', 'workspace:edit_settings'],
  },
]

async function seedRoles() {
  const mongoUri = process.env.MONGO_URL;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in .env')
  }

  await mongoose.connect(mongoUri)

  const RoleModel = mongoose.model('Role', RoleSchema)

  for (const role of ROLES) {
    await RoleModel.findOneAndUpdate(
      { name: role.name, scope: role.scope },
      { $set: role },
      { upsert: true, new: true },
    )
  }

  console.log(`Seeded ${ROLES.length} roles`)

  await mongoose.disconnect()
}

seedRoles().catch((error) => {
  console.error(error)
  process.exit(1)
})