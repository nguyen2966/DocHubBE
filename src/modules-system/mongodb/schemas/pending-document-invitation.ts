import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PendingDocumentShareDocument = HydratedDocument<PendingDocumentShare>;

@Schema({ timestamps: true })
export class PendingDocumentShare {
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true, index: true })
  documentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({
    required: true,
    enum: ['viewer', 'commenter', 'editor'],
  })
  role: 'viewer' | 'commenter' | 'editor';

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({
    required: true,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending',
  })
  status: 'pending' | 'accepted' | 'expired' | 'revoked';

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  acceptedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  acceptedAt?: Date | null;
}

export const PendingDocumentShareSchema =
  SchemaFactory.createForClass(PendingDocumentShare);

PendingDocumentShareSchema.index(
  { documentId: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);