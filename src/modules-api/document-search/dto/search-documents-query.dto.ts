import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

const normalizeWorkspaceIds = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const values = Array.isArray(value) ? value : [value]

  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

export class SearchDocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string

  @ApiPropertyOptional({
    description:
      'Workspace ids as repeated query params or a comma-separated string',
    type: [String],
  })
  @IsOptional()
  @Transform(normalizeWorkspaceIds)
  @IsMongoId({ each: true })
  workspaceIds?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  updatedFrom?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  updatedTo?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number

  @ApiPropertyOptional({
    enum: ['relevance', 'updated_desc', 'updated_asc'],
  })
  @IsOptional()
  @IsIn(['relevance', 'updated_desc', 'updated_asc'])
  sort?: 'relevance' | 'updated_desc' | 'updated_asc'
}
