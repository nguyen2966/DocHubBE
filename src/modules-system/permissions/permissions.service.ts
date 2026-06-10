import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { WorkspaceMember } from '../mongodb/schemas/workspace-member'
import { Role } from '../mongodb/schemas/role'
import { WORKSPACE_ROLE_PERMISSIONS, DOCUMENT_ROLE_PERMISSIONS, WORKSPACE_ROLE_TO_DOCUMENT_ROLE } from './roles/role.permissions'
import { DocumentPermission } from '../mongodb/schemas/document-permission'


@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(WorkspaceMember.name)
    private readonly workspaceMemberModel: Model<WorkspaceMember>,
    @InjectModel(DocumentPermission.name)
    private documentPermissionModel: Model<DocumentPermission>
  ) { }

  // ─── Helper: lấy role name của user trong workspace ─────────────────────────
  private async getWorkspaceRoleName(
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const member = await this.workspaceMemberModel
      .findOne({ userId, workspaceId, isDeleted: false })
      .populate<{ roleId: { name: string } }>('roleId', 'name')
      .lean()

    if (!member) return null

    // Sau populate: member.roleId là object { name: 'admin' | 'member' }
    return member.roleId?.name ?? null
  }


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

  // ─── Document permission ─────────────────────────────────────────────────────
  async canDocument(
    userId: string,
    workspaceId: string,
    documentId: string,
    permission: string,
  ): Promise<boolean> {
    const roleName = await this.getWorkspaceRoleName(userId, workspaceId)

    if (roleName) {
      const impliedDocRole = WORKSPACE_ROLE_TO_DOCUMENT_ROLE[roleName]
      if (impliedDocRole) {
        const impliedPerms = DOCUMENT_ROLE_PERMISSIONS[impliedDocRole] ?? []

        // Workspace admin / member không thể bị downgrade bởi DocumentPermission
        if (impliedPerms.includes(permission)) return true

        // Member có implied role là editor nhưng permission yêu cầu cao hơn
        // (vd: document:delete, document:manage_access) → từ chối luôn
        // vì workspace member không được leo lên owner bằng DocumentPermission
        if (roleName === 'member') return false
      }
    }

    // Không thuộc workspace → check DocumentPermission (external share)
    const docPerm = await this.documentPermissionModel
      .findOne({ userId, documentId })
      .lean()

    if (!docPerm) return false

    const allowed = DOCUMENT_ROLE_PERMISSIONS[docPerm.role] ?? []
    return allowed.includes(permission)
  }

  // ─── Lấy effective document role (dùng cho response API) ────────────────────
  async getEffectiveDocumentRole(
    userId: string,
    workspaceId: string,
    documentId: string,
  ): Promise<string | null> {
    const roleName = await this.getWorkspaceRoleName(userId, workspaceId)

    if (roleName) {
      return WORKSPACE_ROLE_TO_DOCUMENT_ROLE[roleName] ?? null
    }

    const docPerm = await this.documentPermissionModel
      .findOne({ userId, documentId })
      .lean()

    return docPerm?.role ?? null
  }
}

