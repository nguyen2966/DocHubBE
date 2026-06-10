import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string

  @ApiProperty()
  @IsEnum(['md_editor', 'file_upload'])
  sourceType: string

  @ApiProperty()
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  markdownContent?: string

  
}