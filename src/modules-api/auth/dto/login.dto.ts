import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString } from 'class-validator'

export class LoginDto {
  @IsEmail()
  @ApiProperty({example:"nguyen@gmail.com"})
  email: string;

  @ApiProperty({example:"123456"})
  @IsString()
  password: string;
}