import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({
    required: true,
    select: false,
  })
  password: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  fullName: string;

  @Prop({
    default: null,
  })
  avatarUrl?: string;

  @Prop({
    default: '',
  })
  bio?: string;

  @Prop({
    default: false,
  })
  isEmailVerified: boolean;

  @Prop({
    default: true,
  })
  isActive: boolean;

  @Prop({
    default: null,
  })
  lastLoginAt?: Date;

  @Prop({
    default: null,
  })
  passwordChangedAt?: Date;

  @Prop({default: false})
  isDeleted?: Boolean;

  @Prop({
    default: null,
  })
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);