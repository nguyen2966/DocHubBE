import { IsEnum, IsMongoId, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShareDocumentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  userIds: string[];

  @ApiProperty({ enum: ['editor', 'commenter', 'viewer'] })
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: string;
}

export class UpdateDocumentRoleDto {
  @ApiProperty({ enum: ['editor', 'commenter', 'viewer'] })
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: string;
}