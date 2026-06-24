import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkspaceRole } from 'src/common/constants/enum';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: WorkspaceRole,
    example: WorkspaceRole.MEMBER,
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}