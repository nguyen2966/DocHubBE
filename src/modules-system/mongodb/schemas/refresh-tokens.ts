import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true })
export class RefreshToken extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId

  @Prop({ required: true })
  tokenHash: string

  @Prop({ required: true })
  familyId: string

  @Prop({ default: false })
  isRevoked: boolean

  @Prop({ type:Date, default: null })
  revokedAt: Date | null

  @Prop({ type: String, default: null })
  revokedReason: string | null
  // "logout" | "reuse_detected" | "manual_revoke"

  @Prop({ type: Object, default: null })
  deviceInfo: { userAgent: string; ipAddress: string } | null

  @Prop({ required: true })
  expiresAt: Date

  @Prop({ type: Types.ObjectId, default: null })
  replacedByTokenId: Types.ObjectId | null
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken)
RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true })
RefreshTokenSchema.index({ userId: 1 })
RefreshTokenSchema.index({ familyId: 1 })
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })