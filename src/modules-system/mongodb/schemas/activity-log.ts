import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Schema as MongooseSchema, Types } from 'mongoose'

@Schema({ timestamps: true, collection: 'activitylogs' })
export class ActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true })
  workspaceId: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId

  @Prop({ type: String, required: true })
  actionType: string

  @Prop({
    type: String,
    enum: ['document', 'workspace', 'member'],
    required: true,
  })
  targetType: 'document' | 'workspace' | 'member'

  @Prop({ type: Types.ObjectId, default: null })
  targetId: Types.ObjectId | null

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, unknown>

  createdAt: Date
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog)

ActivityLogSchema.index({ workspaceId: 1, createdAt: -1 })
ActivityLogSchema.index({ actorId: 1 })
ActivityLogSchema.index({ actionType: 1 })
