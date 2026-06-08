import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { WorkspaceMember } from '../mongodb/schemas/workspace-member'
import { Role } from '../mongodb/schemas/role'
import { WORKSPACE_ROLE_PERMISSIONS } from './roles/role.permissions'


@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(WorkspaceMember.name)
    private readonly workspaceMemberModel: Model<WorkspaceMember>,
  ) {}

  async canWorkspace(
    userId: string,
    workspaceId: string,
    permission: string,
  ): Promise<boolean> {
    const membership = await this.workspaceMemberModel
      .findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
      })
      .populate<{ roleId: Role }>('roleId')
      .lean();

    if (!membership) return false;

    const roleName = membership.roleId.name;

    const permissions = WORKSPACE_ROLE_PERMISSIONS[roleName] ?? [];

    return permissions.includes(permission);
  }
}