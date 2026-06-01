import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto{
  @ApiProperty({example: "nguyen@gmail.com"})
  email: string;

  @ApiProperty({example: "123456"})
  password: string;

  @ApiProperty({example:"123456"})
  repear_password: string;

}