import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator'

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'MongoDB ObjectId of new role' })
  @IsMongoId()
  roleId!: string
}