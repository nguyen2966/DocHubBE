// src/modules-system/mongodb/schemas/annotation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type AnnotationDocument = Annotation & Document

@Schema({ timestamps: true, collection: 'annotations' })
export class Annotation {
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  documentId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId

  @Prop({ type: String, required: true })
  apryseAnnotationId: string

  @Prop({ type: Number, required: true })
  pageNumber: number

  @Prop({ type: String, default: null })
  selectedText: string | null

  @Prop({ type: String, required: true })
  xfdf: string

  @Prop({ type: String, enum: ['active', 'deleted'], default: 'active' })
  status: string
}

export const AnnotationSchema = SchemaFactory.createForClass(Annotation)

AnnotationSchema.index({ documentId: 1 });
AnnotationSchema.index({ apryseAnnotationId: 1 });