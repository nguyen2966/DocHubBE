import { Type } from 'class-transformer'
import {
  IsMongoId,
  IsNumber,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CommentPositionDto {
  @ApiProperty({
    example: 180,
    description:
      'X coordinate in Apryse WebViewer page coordinates, top-left origin.',
  })
  @IsNumber()
  x: number

  @ApiProperty({
    example: 240,
    description:
      'Y coordinate in Apryse WebViewer page coordinates, top-left origin.',
  })
  @IsNumber()
  y: number
}

export class CreateCommentThreadDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'PDF page number where the comment anchor is placed.',
  })
  @IsNumber()
  @Min(1)
  pageNumber: number

  @ApiProperty({
    type: CommentPositionDto,
    description:
      'Anchor position in Apryse WebViewer page coordinates, top-left origin.',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CommentPositionDto)
  position: CommentPositionDto

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Optional Apryse XFDF used only for visual highlight rendering. Leave null to create a point marker.',
  })
  @IsOptional()
  @IsString()
  xfdf?: string | null

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Optional Apryse annotation id for preventing duplicate threads for the same WebViewer annotation.',
  })
  @IsOptional()
  @IsString()
  apryseAnnotationId?: string | null

  @ApiProperty({
    example: 'This paragraph needs a clearer explanation.',
    maxLength: 5000,
    description: 'Root comment content for the new thread.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string
}

export class CreateCommentDto {
  @ApiProperty({
    example: 'Agree. I think we should split this sentence.',
    maxLength: 5000,
    description: 'Reply comment content.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string

  @ApiPropertyOptional({
    example: '665f1234567890abcdef1234',
    nullable: true,
    description:
      'Optional parent comment id. Omit or set null to add a top-level reply in the thread.',
  })
  @IsOptional()
  @IsMongoId()
  parentId?: string | null
}
