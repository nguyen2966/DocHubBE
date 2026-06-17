import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UpdateCommentDto {
  @ApiProperty({
    example: 'Updated comment content.',
    maxLength: 5000,
    description: 'Updated comment content. Only the author can edit a comment.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string
}
