import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { toObjectId, toStringId } from '../../common/utils/mongo-id.util'
import { Annotation } from '../../modules-system/mongodb/schemas/annotation'
import { Comment } from '../../modules-system/mongodb/schemas/comment'
import { Document } from '../../modules-system/mongodb/schemas/document'
import { PermissionsService } from '../../modules-system/permissions/permissions.service'
import {
  CreateCommentDto,
  CreateCommentThreadDto,
} from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Annotation.name)
    private readonly annotationModel: Model<Annotation>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<Document>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async getThreads(workspaceId: string, documentId: string) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )

    const annotations = await this.annotationModel
      .find({
        workspaceId: workspaceObjectId,
        documentId: documentObjectId,
        status: 'active',
      })
      .sort({ createdAt: -1 })
      .lean()

    if (!annotations.length) return []

    const annotationIds = annotations.map((annotation) => annotation._id)
    const comments = await this.commentModel
      .find({
        annotationId: { $in: annotationIds },
        status: { $in: ['active', 'deleted'] },
      })
      .sort({ createdAt: 1 })
      .lean()

    const commentsByAnnotation = this.groupNestedCommentsByAnnotation(comments)

    return annotations.map((annotation) => ({
      ...this.serializeAnnotation(annotation),
      comments: commentsByAnnotation.get(toStringId(annotation._id)) ?? [],
    }))
  }

  async createThread(
    workspaceId: string,
    documentId: string,
    actorId: string,
    dto: CreateCommentThreadDto,
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const actorObjectId = toObjectId(actorId)
    const content = this.normalizeContent(dto.content)

    let annotation: any

    try {
      annotation = await this.annotationModel.create({
        workspaceId: workspaceObjectId,
        documentId: documentObjectId,
        createdBy: actorObjectId,
        pageNumber: dto.pageNumber,
        position: dto.position,
        xfdf: dto.xfdf ?? null,
        apryseAnnotationId: dto.apryseAnnotationId ?? null,
        kind: 'comment_anchor',
        visualState: dto.xfdf ? 'highlight' : 'point',
        status: 'active',
        threadStatus: 'open',
      })
    } catch (error) {
      this.handleDuplicateApryseAnnotation(error)
      throw error
    }

    const comment = await this.commentModel.create({
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      annotationId: annotation._id,
      authorId: actorObjectId,
      parentId: null,
      content,
      status: 'active',
      isEdited: false,
    })

    return {
      ...this.serializeAnnotation(annotation.toObject()),
      comments: [{ ...comment.toObject(), replies: [] }],
    }
  }

  async addComment(
    workspaceId: string,
    documentId: string,
    annotationId: string,
    actorId: string,
    dto: CreateCommentDto,
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const annotationObjectId = toObjectId(annotationId)
    const actorObjectId = toObjectId(actorId)
    const content = this.normalizeContent(dto.content)

    const annotation = await this.annotationModel.findOne({
      _id: annotationObjectId,
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      status: 'active',
    })

    if (!annotation) throw new NotFoundException('Annotation not found')

    let parentId: Types.ObjectId | null = null
    if (dto.parentId) {
      parentId = toObjectId(dto.parentId)
      const parent = await this.commentModel.findOne({
        _id: parentId,
        workspaceId: workspaceObjectId,
        documentId: documentObjectId,
        annotationId: annotationObjectId,
        status: 'active',
      })

      if (!parent) throw new NotFoundException('Parent comment not found')
    }

    const comment = await this.commentModel.create({
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      annotationId: annotationObjectId,
      authorId: actorObjectId,
      parentId,
      content,
      status: 'active',
      isEdited: false,
    })

    await this.touchAnnotation(annotationObjectId)

    return comment
  }

  async updateComment(
    workspaceId: string,
    documentId: string,
    commentId: string,
    actorId: string,
    dto: UpdateCommentDto,
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const commentObjectId = toObjectId(commentId)
    const actorObjectId = toObjectId(actorId)
    const content = this.normalizeContent(dto.content)

    const comment = await this.commentModel.findOne({
      _id: commentObjectId,
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      status: 'active',
    })

    if (!comment) throw new NotFoundException('Comment not found')
    if (toStringId(comment.authorId) !== toStringId(actorObjectId)) {
      throw new ForbiddenException('Only the author can edit this comment')
    }

    comment.content = content
    comment.isEdited = true
    comment.editedAt = new Date()
    await comment.save()

    await this.touchAnnotation(comment.annotationId)

    return comment
  }

  async deleteComment(
    workspaceId: string,
    documentId: string,
    commentId: string,
    actorId: string,
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const commentObjectId = toObjectId(commentId)
    const actorObjectId = toObjectId(actorId)

    const comment = await this.commentModel.findOne({
      _id: commentObjectId,
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      status: 'active',
    })

    if (!comment) throw new NotFoundException('Comment not found')

    const isAuthor = toStringId(comment.authorId) === toStringId(actorObjectId)
    const canManage = await this.canManageDocumentAccess(
      actorId,
      workspaceId,
      documentId,
    )

    if (!isAuthor && !canManage) {
      throw new ForbiddenException('You cannot delete this comment')
    }

    comment.status = 'deleted'
    comment.deletedBy = actorObjectId
    comment.deletedAt = new Date()
    await comment.save()

    await this.touchAnnotation(comment.annotationId)

    return { deleted: true }
  }

  async resolveThread(
    workspaceId: string,
    documentId: string,
    annotationId: string,
    actorId: string,
  ) {
    return this.updateThreadStatus(
      workspaceId,
      documentId,
      annotationId,
      actorId,
      'resolved',
    )
  }

  async reopenThread(
    workspaceId: string,
    documentId: string,
    annotationId: string,
  ) {
    return this.updateThreadStatus(
      workspaceId,
      documentId,
      annotationId,
      null,
      'open',
    )
  }

  async deleteThread(
    workspaceId: string,
    documentId: string,
    annotationId: string,
    actorId: string,
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const annotationObjectId = toObjectId(annotationId)
    const actorObjectId = toObjectId(actorId)

    const annotation = await this.annotationModel.findOne({
      _id: annotationObjectId,
      workspaceId: workspaceObjectId,
      documentId: documentObjectId,
      status: 'active',
    })

    if (!annotation) throw new NotFoundException('Annotation not found')

    const isCreator =
      toStringId(annotation.createdBy) === toStringId(actorObjectId)
    const canManage = await this.canManageDocumentAccess(
      actorId,
      workspaceId,
      documentId,
    )

    if (!isCreator && !canManage) {
      throw new ForbiddenException('You cannot delete this thread')
    }

    const deletedAt = new Date()
    annotation.status = 'deleted'
    annotation.deletedBy = actorObjectId
    annotation.deletedAt = deletedAt
    await annotation.save()

    await this.commentModel.updateMany(
      {
        workspaceId: workspaceObjectId,
        documentId: documentObjectId,
        annotationId: annotationObjectId,
        status: 'active',
      },
      {
        status: 'deleted',
        deletedBy: actorObjectId,
        deletedAt,
      },
    )

    return { deleted: true }
  }

  private async updateThreadStatus(
    workspaceId: string,
    documentId: string,
    annotationId: string,
    actorId: string | null,
    threadStatus: 'open' | 'resolved',
  ) {
    const { documentObjectId, workspaceObjectId } = await this.getDocument(
      workspaceId,
      documentId,
    )
    const annotationObjectId = toObjectId(annotationId)

    const patch =
      threadStatus === 'resolved'
        ? {
            threadStatus,
            resolvedBy: actorId ? toObjectId(actorId) : null,
            resolvedAt: new Date(),
          }
        : {
            threadStatus,
            resolvedBy: null,
            resolvedAt: null,
          }

    const annotation = await this.annotationModel
      .findOneAndUpdate(
        {
          _id: annotationObjectId,
          workspaceId: workspaceObjectId,
          documentId: documentObjectId,
          status: 'active',
        },
        patch,
        { new: true },
      )
      .lean()

    if (!annotation) throw new NotFoundException('Annotation not found')
    return this.serializeAnnotation(annotation)
  }

  private async getDocument(workspaceId: string, documentId: string) {
    const workspaceObjectId = toObjectId(workspaceId)
    const documentObjectId = toObjectId(documentId)

    const document = await this.documentModel
      .findOne({
        _id: documentObjectId,
        workspaceId: workspaceObjectId,
      })
      .select('_id workspaceId ownerId')
      .lean()

    if (!document) throw new NotFoundException('Document not found')

    return { document, documentObjectId, workspaceObjectId }
  }

  private async canManageDocumentAccess(
    actorId: string,
    workspaceId: string,
    documentId: string,
  ) {
    return this.permissionsService.canDocument(
      actorId,
      workspaceId,
      documentId,
      'document:manage_access',
    )
  }

  private normalizeContent(content: string) {
    const trimmed = content?.trim()
    if (!trimmed) throw new BadRequestException('Comment content is required')
    return trimmed
  }

  private touchAnnotation(annotationId: Types.ObjectId) {
    return this.annotationModel.updateOne(
      { _id: annotationId },
      { updatedAt: new Date() },
    )
  }

  private groupNestedCommentsByAnnotation(comments: any[]) {
    const commentsByAnnotation = new Map<string, any[]>()

    for (const comment of comments) {
      const annotationId = toStringId(comment.annotationId)
      const items = commentsByAnnotation.get(annotationId) ?? []
      items.push(comment)
      commentsByAnnotation.set(annotationId, items)
    }

    for (const [annotationId, annotationComments] of commentsByAnnotation) {
      commentsByAnnotation.set(
        annotationId,
        this.buildNestedComments(annotationComments),
      )
    }

    return commentsByAnnotation
  }

  private buildNestedComments(comments: any[]) {
    const byId = new Map<string, any>()
    const roots: any[] = []

    for (const comment of comments) {
      byId.set(toStringId(comment._id), {
        ...comment,
        content: comment.status === 'deleted' ? '' : comment.content,
        replies: [],
      })
    }

    for (const comment of byId.values()) {
      const parentId = toStringId(comment.parentId)
      const parent = parentId ? byId.get(parentId) : null

      if (parent) {
        parent.replies.push(comment)
      } else {
        roots.push(comment)
      }
    }

    return roots
  }

  private handleDuplicateApryseAnnotation(error: any) {
    if (error?.code === 11000) {
      throw new ConflictException('Apryse annotation already has a thread')
    }
  }

  private serializeAnnotation(annotation: any) {
    const {
      documentVersion,
      selectedText,
      fallbackPosition,
      anchorStatus,
      staleReason,
      ...serialized
    } = annotation

    return {
      ...serialized,
      visualState:
        serialized.visualState ?? (serialized.xfdf ? 'highlight' : 'point'),
    }
  }
}
