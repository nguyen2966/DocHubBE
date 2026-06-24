import {  ApiPropertyOptional } from '@nestjs/swagger';
import { MaxLength, IsString, MinLength, IsOptional} from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'New Name', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string
 
  @ApiPropertyOptional({ example: 'Updated description', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}
 
