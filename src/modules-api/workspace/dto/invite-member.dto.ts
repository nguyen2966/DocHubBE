import {
  IsArray,
  IsEmail,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteMemberDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 email is required' })
  @ArrayMaxSize(20, { message: 'Maximum 20 emails' })
  @IsEmail({}, { each: true, message: 'Invalid email' })
  @Transform(({ value }) =>
    (value as string[]).map((e) => e.toLowerCase().trim()),
  )
  emails: string[]

  @IsEnum(['admin', 'member'], { message: 'Role phải là admin hoặc member' })
  role: 'admin' | 'member'
}