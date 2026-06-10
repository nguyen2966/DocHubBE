// src/modules-system/mongodb/schemas/document.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';


@Schema({ timestamps: true, collection: 'documents' })
export class Document {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId

  @Prop({ type: String, required: true, maxlength: 255 })
  title: string

  @Prop({ type: String, enum: ['md_editor', 'file_upload'], required: true })
  sourceType: string

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId

  @Prop({ type: String, default: null })
  markdownContent: string | null

  @Prop({ type: String, required: true })
  pdfFileUrl: string

  @Prop({ type: String, required: true })
  pdfStorageKey: string

  @Prop({ type: Number, required: true })
  fileSize: number

  @Prop({ type: String, default: null })
  extractedTextPreview: string | null

  @Prop({ type: Number, default: 0 })
  extractedTextCharCount: number

  @Prop({ type: Number, default: 10000 })
  extractedTextLimit: number

  @Prop({ type: Boolean, default: false })
  isExtractedTextTruncated: boolean

  @Prop({ type: String, enum: ['processed', 'unprocessable'], default: 'processed' })
  processingStatus: string
}

export const DocumentSchema = SchemaFactory.createForClass(Document);

DocumentSchema.index({ workspaceId: 1, updatedAt: -1 });
DocumentSchema.index({ title: 'text', extractedTextPreview: 'text' });