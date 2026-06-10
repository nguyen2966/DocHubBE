import { IsEnum, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShareDocumentDto {
  @ApiProperty()
  @IsMongoId()
  userId: string

  @ApiProperty()
  @IsEnum(['editor', 'commenter', 'viewer'])
  role: string
}