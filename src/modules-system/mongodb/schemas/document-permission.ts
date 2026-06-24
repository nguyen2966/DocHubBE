// src/modules-system/mongodb/schemas/document-permission.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document as MongoDocument, Types } from 'mongoose'

export type DocumentPermissionDocument = DocumentPermission & MongoDocument

@Schema({ timestamps: true, collection: 'document_permissions' })
export class DocumentPermission {
  @Prop({ type: Types.ObjectId, ref: 'Document', required: true })
  documentId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId

  @Prop({ type: String, enum: ['owner', 'editor', 'commenter', 'viewer'], required: true })
  role: string

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  grantedBy: Types.ObjectId
}

export const DocumentPermissionSchema = SchemaFactory.createForClass(DocumentPermission);

DocumentPermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });
DocumentPermissionSchema.index({ documentId: 1 });
DocumentPermissionSchema.index({ userId: 1, role: 1, documentId: 1 });
