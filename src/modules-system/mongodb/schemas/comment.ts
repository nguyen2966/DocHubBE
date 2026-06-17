// src/modules-system/mongodb/schemas/comment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type CommentDocument = Comment & Document

@Schema({ timestamps: true, collection: 'comments' })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  documentId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Annotation', required: true })
  annotationId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null })
  parentId: Types.ObjectId | null

  @Prop({ type: String, required: true })
  content: string

  @Prop({ type: String, enum: ['active', 'deleted'], default: 'active' })
  status: 'active' | 'deleted'

  @Prop({ type: Boolean, default: false })
  isEdited: boolean

  @Prop({ type: Date, default: null })
  editedAt: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  deletedBy: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  deletedAt: Date | null

  createdAt: Date
  updatedAt: Date
}

export const CommentSchema = SchemaFactory.createForClass(Comment)

CommentSchema.index({ annotationId: 1, createdAt: 1 })
CommentSchema.index({ documentId: 1, createdAt: -1 })
CommentSchema.index({ parentId: 1, createdAt: 1 })
CommentSchema.index({ workspaceId: 1, documentId: 1, status: 1 })
