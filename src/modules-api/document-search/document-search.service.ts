import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { toObjectId, toObjectIds, toStringId } from 'src/common/utils/mongo-id.util'
import { Document } from 'src/modules-system/mongodb/schemas/document'
import { DocumentPermission } from 'src/modules-system/mongodb/schemas/document-permission'
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member'
import { SearchDocumentsQueryDto } from './dto/search-documents-query.dto'

type DirectRole = 'viewer' | 'commenter' | 'editor'
type AccessType = 'workspace' | 'direct'

type SearchDocumentResult = {
  documentId: string
  title: string
  workspace: {
    workspaceId: string
    name: string
  }
  sourceType: string
  previewText: string
  updatedAt: Date | null
  accessType: AccessType
  role?: DirectRole
}

type AccessibleScope = {
  memberWorkspaceIds: Types.ObjectId[]
  memberWorkspaceIdSet: Set<string>
  directDocumentIds: Types.ObjectId[]
  directRoleMap: Map<string, DirectRole>
}

const DIRECT_ROLES: DirectRole[] = ['viewer', 'commenter', 'editor']

@Injectable()
export class DocumentSearchService {
  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<Document>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
    @InjectModel(DocumentPermission.name)
    private readonly documentPermissionModel: Model<DocumentPermission>,
  ) {}

  async searchDocuments(userId: string, query: SearchDocumentsQueryDto) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit
    const searchText = query.q?.trim() ?? ''
    const hasSearchText = searchText.length > 0

    const scope = await this.getAccessibleScope(userId)
    const workspaceIds = this.resolveWorkspaceFilter(
      query.workspaceIds,
      scope.memberWorkspaceIdSet,
    )

    const filter = this.buildDocumentFilter(query, scope, workspaceIds)
    const projection = hasSearchText
      ? { score: { $meta: 'textScore' } }
      : {}
    const sort = this.buildSort(query.sort, hasSearchText)

    const [documents, totalItems] = await Promise.all([
      this.documentModel
        .find(filter, projection)
        .populate('workspaceId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.documentModel.countDocuments(filter),
    ])

    const totalPages = Math.ceil(totalItems / limit)

    return {
      items: documents.map((document) =>
        this.toSearchResult(document as any, searchText, scope),
      ),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }
  }

  async getWorkspaceFilterOptions(userId: string) {
    const memberships = await this.memberModel
      .find({
        userId: toObjectId(userId),
        isDeleted: false,
      })
      .populate('workspaceId', 'name isDeleted')
      .populate('roleId', 'name')
      .sort({ _id: -1 })
      .lean()

    return memberships
      .filter((membership) => {
        const workspace = (membership as any).workspaceId
        return workspace && workspace.isDeleted !== true
      })
      .map((membership) => {
        const workspace = (membership as any).workspaceId
        const role = (membership as any).roleId

        return {
          workspaceId: toStringId(workspace),
          name: workspace.name,
          role: role?.name,
        }
      })
  }

  private async getAccessibleScope(userId: string): Promise<AccessibleScope> {
    const userObjectId = toObjectId(userId)

    const [memberships, directPermissions] = await Promise.all([
      this.memberModel
        .find({
          userId: userObjectId,
          isDeleted: false,
        })
        .select('workspaceId')
        .lean(),
      this.documentPermissionModel
        .find({
          userId: userObjectId,
          role: { $in: DIRECT_ROLES },
        })
        .select('documentId role')
        .lean(),
    ])

    const memberWorkspaceIds = toObjectIds(
      memberships.map((membership) => (membership as any).workspaceId),
    )
    const memberWorkspaceIdSet = new Set(memberWorkspaceIds.map(toStringId))
    const directDocumentIds = toObjectIds(
      directPermissions.map((permission) => (permission as any).documentId),
    )
    const directRoleMap = new Map<string, DirectRole>(
      directPermissions.map((permission) => [
        toStringId((permission as any).documentId),
        (permission as any).role as DirectRole,
      ]),
    )

    return {
      memberWorkspaceIds,
      memberWorkspaceIdSet,
      directDocumentIds,
      directRoleMap,
    }
  }

  private resolveWorkspaceFilter(
    workspaceIds: string[] | undefined,
    memberWorkspaceIdSet: Set<string>,
  ) {
    if (!workspaceIds?.length) {
      return undefined
    }

    const uniqueWorkspaceIds = [...new Set(workspaceIds)]
    const unauthorizedWorkspaceId = uniqueWorkspaceIds.find(
      (workspaceId) => !memberWorkspaceIdSet.has(workspaceId),
    )

    if (unauthorizedWorkspaceId) {
      throw new ForbiddenException(
        'You do not belong to one or more selected workspaces',
      )
    }

    return toObjectIds(uniqueWorkspaceIds)
  }

  private buildDocumentFilter(
    query: SearchDocumentsQueryDto,
    scope: AccessibleScope,
    workspaceIds?: Types.ObjectId[],
  ) {
    const filter: any = {
      processingStatus: 'processed',
    }
    const searchText = query.q?.trim() ?? ''

    if (searchText) {
      filter.$text = {
        $search: searchText,
        $caseSensitive: false,
        $diacriticSensitive: false,
      }
    }

    if (workspaceIds?.length) {
      filter.workspaceId = { $in: workspaceIds }
    } else {
      filter.$or = [
        { workspaceId: { $in: scope.memberWorkspaceIds } },
        { _id: { $in: scope.directDocumentIds } },
      ]
    }

    const updatedAt = this.buildUpdatedAtFilter(
      query.updatedFrom,
      query.updatedTo,
    )

    if (updatedAt) {
      filter.updatedAt = updatedAt
    }

    return filter
  }

  private buildUpdatedAtFilter(updatedFrom?: string, updatedTo?: string) {
    const fromDate = updatedFrom
      ? this.parseDate(updatedFrom, 'updatedFrom')
      : undefined
    const toDate = updatedTo
      ? this.parseDate(updatedTo, 'updatedTo', true)
      : undefined

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('updatedFrom must be before updatedTo')
    }

    if (!fromDate && !toDate) {
      return undefined
    }

    return {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lte: toDate } : {}),
    }
  }

  private parseDate(value: string, fieldName: string, endOfDay = false) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`)
    }

    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999)
    }

    return date
  }

  private buildSort(
    requestedSort: SearchDocumentsQueryDto['sort'],
    hasSearchText: boolean,
  ) {
    const sort = requestedSort ?? (hasSearchText ? 'relevance' : 'updated_desc')

    if (sort === 'updated_asc') {
      return { updatedAt: 1, _id: 1 }
    }

    if (sort === 'relevance' && hasSearchText) {
      return { score: { $meta: 'textScore' }, updatedAt: -1, _id: -1 } as any
    }

    return { updatedAt: -1, _id: -1 }
  }

  private toSearchResult(
    document: any,
    query: string,
    scope: AccessibleScope,
  ): SearchDocumentResult {
    const workspace = document.workspaceId
    const workspaceId = toStringId(workspace)
    const documentId = toStringId(document._id)
    const accessType: AccessType = scope.memberWorkspaceIdSet.has(workspaceId)
      ? 'workspace'
      : 'direct'
    const role = scope.directRoleMap.get(documentId)

    return {
      documentId,
      title: document.title,
      workspace: {
        workspaceId,
        name: workspace?.name ?? '',
      },
      sourceType: document.sourceType,
      previewText: this.buildPreviewText(document.extractedTextPreview, query),
      updatedAt: document.updatedAt ?? null,
      accessType,
      ...(accessType === 'direct' && role ? { role } : {}),
    }
  }

  private buildPreviewText(content: string | null | undefined, query: string) {
    const text = (content ?? '').replace(/\s+/g, ' ').trim()
    const terms = this.getSearchTerms(query)

    if (!text) {
      return ''
    }

    if (!terms.length) {
      return text.slice(0, 220)
    }

    const lowerText = text.toLowerCase()
    const firstMatch = terms
      .map((term) => ({
        term,
        index: lowerText.indexOf(term.toLowerCase()),
      }))
      .filter((match) => match.index >= 0)
      .sort((a, b) => a.index - b.index)[0]

    if (!firstMatch) {
      return text.slice(0, 220)
    }

    const start = Math.max(0, firstMatch.index - 80)
    const end = Math.min(
      text.length,
      firstMatch.index + firstMatch.term.length + 80,
    )

    return text.slice(start, end)
  }

  private getSearchTerms(query: string) {
    return [
      ...new Set(
        query
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .map((term) => term.trim())
          .filter(Boolean),
      ),
    ]
  }
}
