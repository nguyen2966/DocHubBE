// src/modules-api/document/dto/upload-pdf.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadPdfDto {
  // Cấu hình Swagger để hiển thị nút Upload File
  @ApiProperty({ 
    type: 'string', 
    format: 'binary', 
    description: 'Upload PDF (max 20MB)' 
  })
  file: any; // Multer sẽ xử lý field này

  @ApiPropertyOptional({ 
    description: 'Optional title or file name will be used' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}