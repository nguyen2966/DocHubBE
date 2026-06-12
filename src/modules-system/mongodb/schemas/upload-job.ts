// src/modules-system/mongodb/schemas/upload-job.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';


export type UploadJobStatus =
  | 'PENDING' | 'UPLOADING' | 'FILE_SAVED'
  | 'EXTRACTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

@Schema({ timestamps: true })
export class UploadJob {
  @Prop({ required: true }) jobId: string;          // uuid
  @Prop({ required: true }) workspaceId: string;
  @Prop() documentId?: string;                      // gán sau khi doc được tạo
  @Prop({ default: 'PENDING' }) status: UploadJobStatus;
  @Prop({ default: 0 }) progress: number;           // 0–100
  @Prop() errorMessage?: string;
  @Prop({ default: false }) isCancelled: boolean;  
  // timestamps: true => createdAt, updatedAt tự động
}

export const UploadJobSchema = SchemaFactory.createForClass(UploadJob);
UploadJobSchema.index({jobId: 1 }, { unique: true })
