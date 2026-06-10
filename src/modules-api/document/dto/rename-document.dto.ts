import {IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameDocumentDto {
  @ApiProperty()
  @IsString()
  title: string
}