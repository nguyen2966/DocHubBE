import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema()
export class RevokedAccessToken extends Document {
  @Prop({ required: true })
  jti: string

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId

  @Prop({ required: true })
  expiresAt: Date

  @Prop({ required: true })
  revokedAt: Date

  @Prop({ required: true })
  revokedReason: string
  // "logout" | "security_revoke" | "password_changed"
}

export const RevokedAccessTokenSchema =
  SchemaFactory.createForClass(RevokedAccessToken)
RevokedAccessTokenSchema.index({ jti: 1 }, { unique: true })
RevokedAccessTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)