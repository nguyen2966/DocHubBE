import {
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type ShareDocumentRole = 'viewer' | 'commenter' | 'editor';

export class ShareDocumentDto {
  @ApiProperty({ type: [String], example: ['external@gmail.com'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];

  @ApiProperty({ enum: ['editor', 'commenter', 'viewer'] })
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: ShareDocumentRole;
}

export class UpdateDocumentRoleDto {
  @ApiProperty({ enum: ['editor', 'commenter', 'viewer'] })
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: ShareDocumentRole;
}

export class UpdatePendingShareRoleDto {
  @ApiProperty({ enum: ['editor', 'commenter', 'viewer'] })
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: ShareDocumentRole;
}