import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsEnum, IsMongoId, IsOptional, MinLength, MaxLength } from 'class-validator';
 
export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Workspace', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string
 
  @ApiPropertyOptional({ example: 'Team documents', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}