import { IsString, MinLength, MaxLength, Matches, IsMongoId } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'


export class SearchUserByEmailDto {
  @ApiProperty({example:"nguyen@gmail.com"})
  @IsString()
  @MinLength(3, { message: 'Type in at least 3 characters' })
  @MaxLength(254)
  @Matches(/^[^\s]+$/, { message: 'Email can not contain spaces' })
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email: string;

  @ApiProperty()
  @IsMongoId()
  workspaceId: string;
}