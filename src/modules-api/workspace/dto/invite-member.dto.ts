import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum } from 'class-validator'
import { type WorkspaceRole } from 'src/common/constants/enum'

 
export class InviteMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string
 
  @ApiProperty({ enum: ['admin', 'member'], default: 'member' })
  @IsEnum(['admin', 'member'])
  role!: WorkspaceRole
}
 