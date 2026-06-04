import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({example:"Nguyễn Lê Nguyên"})
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({example: "nguyen@gmail.com"})
  @IsEmail()
  email: string;

  @ApiProperty({example: "12345678"})
  @IsString()
  @MinLength(8)
  password: string
}