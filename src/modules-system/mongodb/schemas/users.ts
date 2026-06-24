import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  fullName: string

  @Prop({ required: true, lowercase: true })
  email: string

  @Prop({ type:String, default: null })
  avatarUrl?: string | null

  @Prop({ required: true })
  passwordHash: string

  @Prop({ default: false })
  isEmailVerified: boolean
}

export const UserSchema = SchemaFactory.createForClass(User)
UserSchema.index({ email: 1 }, { unique: true })
