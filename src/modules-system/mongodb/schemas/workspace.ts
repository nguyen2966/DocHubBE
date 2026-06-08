import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true })
export class Workspace extends Document {
  @Prop({ required: true, maxlength: 60 })
  name: string

  @Prop({ default: '' })
  description: string

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId

  @Prop({ default: false })
  isDeleted: boolean

  @Prop({ default: null, type: Date })
  deletedAt: Date | null

  @Prop({ default: null, type: Types.ObjectId, ref: 'User' })
  deletedBy: Types.ObjectId | null
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace)
WorkspaceSchema.index({ createdBy: 1 })