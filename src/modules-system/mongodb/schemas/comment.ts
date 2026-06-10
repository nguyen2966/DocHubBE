// src/modules-system/mongodb/schemas/comment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type CommentDocument = Comment & Document

@Schema({ timestamps: true, collection: 'comments' })
export class Comment {
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

  @Prop({ type: Boolean, default: false })
  isEdited: boolean

  @Prop({ type: Boolean, default: false })
  isResolved: boolean
}

export const CommentSchema = SchemaFactory.createForClass(Comment)

CommentSchema.index({ annotationId: 1, createdAt: 1 })
CommentSchema.index({ parentId: 1 })