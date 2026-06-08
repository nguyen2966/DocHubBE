import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class Role extends Document {
  @Prop({ required: true})
  name: string
  // "owner" | "editor" | "commenter" | "viewer"
  // "admin" | "member"

  @Prop({ required: true })
  scope: string
  // "document" | "workspace"

  @Prop({ type: [String], default: [] })
  permissions: string[]
  // ["document:view", "document:edit", ...]

  @Prop({ default: true })
  isSystem: boolean
}

export const RoleSchema = SchemaFactory.createForClass(Role)
RoleSchema.index({ name: 1 }, { unique: true })
RoleSchema.index({ scope: 1 })