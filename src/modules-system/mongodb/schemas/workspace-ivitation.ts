import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { type WorkspaceMemberRole } from './workspace-member';

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

@Schema({ timestamps: true })
export class WorkspaceInvitation extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Workspace' })
  workspaceId: Types.ObjectId

  @Prop({ required: true, lowercase: true })
  invitedEmail: string

  /**
   * null  → user chưa đăng ký tại thời điểm invite
   * ObjectId → đã có account (hoặc đã accept)
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedUserId: Types.ObjectId | null

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  invitedBy: Types.ObjectId

  @Prop({ required: true, enum: ['admin', 'member'] })
  role: WorkspaceMemberRole

  @Prop({ required: true })
  token: string

  @Prop({ required: true, enum: ['pending', 'accepted', 'expired'], default: 'pending' })
  status: InvitationStatus

  @Prop({ required: true })
  expiresAt: Date
}

export const WorkspaceInvitationSchema = SchemaFactory.createForClass(WorkspaceInvitation)

WorkspaceInvitationSchema.index({ token: 1 }, { unique: true })
WorkspaceInvitationSchema.index({ invitedEmail: 1, workspaceId: 1 })
// TTL index: MongoDB tự xoá document khi expiresAt đến (chỉ khi status vẫn pending)
WorkspaceInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })