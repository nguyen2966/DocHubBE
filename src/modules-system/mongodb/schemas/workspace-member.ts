import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkspaceMemberRole = 'admin' | 'member';

@Schema({ timestamps: true })
export class WorkspaceMember extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId

  @Prop({ required: true, type: Types.ObjectId, ref: 'Role' })
  roleId: Types.ObjectId

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  invitedBy: Types.ObjectId

  @Prop({ required: true })
  joinedAt: Date

  // ─── Soft delete ──────────────────────────────────────────
  @Prop({ default: false })
  isDeleted: boolean

  @Prop({ default: null, type: Date })
  deletedAt: Date | null

  @Prop({ default: null, type: Types.ObjectId, ref: 'User' })
  deletedBy: Types.ObjectId | null
}

export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMember);

// unique chỉ áp dụng cho bản ghi đang active
WorkspaceMemberSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
)
WorkspaceMemberSchema.index({ userId: 1 })
WorkspaceMemberSchema.index({ isDeleted: 1 })

// WorkspaceMemberSchema.pre(/^find/, function (next) {
//   const query = this as any
//   if (!query.getOptions()._includeDeleted) {
//     query.where({ isDeleted: { $ne: true } })
//   }
//   next()
// })