// src/modules-system/mongodb/schemas/annotation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type AnnotationDocument = Annotation & Document

@Schema({ timestamps: true, collection: 'annotations' })
export class Annotation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  documentId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId

  @Prop({ type: Number, required: true })
  pageNumber: number

  @Prop({
    type: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    required: true,
    _id: false,
  })
  position: { x: number; y: number }

  @Prop({ type: String, default: null })
  xfdf: string | null

  @Prop({ type: String, default: null })
  apryseAnnotationId: string | null

  @Prop({ type: String, enum: ['comment_anchor'], default: 'comment_anchor' })
  kind: 'comment_anchor'

  @Prop({ type: String, enum: ['highlight', 'point'], default: 'point' })
  visualState: 'highlight' | 'point'

  @Prop({ type: String, enum: ['active', 'deleted'], default: 'active' })
  status: 'active' | 'deleted'

  @Prop({ type: String, enum: ['open', 'resolved'], default: 'open' })
  threadStatus: 'open' | 'resolved'

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  resolvedBy: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  deletedBy: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  deletedAt: Date | null

  createdAt: Date
  updatedAt: Date
}

export const AnnotationSchema = SchemaFactory.createForClass(Annotation)

AnnotationSchema.index({ documentId: 1, status: 1, createdAt: -1 })
AnnotationSchema.index({ documentId: 1, pageNumber: 1 })
AnnotationSchema.index({ workspaceId: 1, documentId: 1 })
AnnotationSchema.index({ documentId: 1, threadStatus: 1, updatedAt: -1 })
AnnotationSchema.index(
  { documentId: 1, apryseAnnotationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      apryseAnnotationId: { $type: 'string' },
    },
  },
)
