import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator'

export class ResendVerificationDto {
  @ApiProperty({example:"nguyen@gmail.com"})
  @IsEmail()
  email: string;
}