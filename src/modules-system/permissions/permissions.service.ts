import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { WorkspaceMember } from '../mongodb/schemas/workspace-member'
import { Role } from '../mongodb/schemas/role'
import { WORKSPACE_ROLE_PERMISSIONS, DOCUMENT_ROLE_PERMISSIONS, WORKSPACE_ROLE_TO_DOCUMENT_ROLE } from './roles/role.permissions'
import { DocumentPermission } from '../mongodb/schemas/document-permission'
import {
  toObjectId,
  toObjectIds,
  toStringId,
} from '../../common/utils/mongo-id.util'


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
      .findOne({
        userId: toObjectId(userId),
        workspaceId: toObjectId(workspaceId),
        isDeleted: false,
      })
      .populate<{ roleId: { name: string } }>('roleId', 'name')
      .lean();

    if (!member) return null;
    return member.roleId?.name ?? null;
  }


  async canWorkspace(
    userId: string,
    workspaceId: string,
    permission: string,
  ): Promise<boolean> {
    const membership = await this.workspaceMemberModel
      .findOne({
        workspaceId: toObjectId(workspaceId),
        userId: toObjectId(userId),
        isDeleted: false,
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
    const [docPerm, roleName] = await Promise.all([
      this.documentPermissionModel
        .findOne({
          userId: toObjectId(userId),
          documentId: toObjectId(documentId),
        })
        .lean(),
      this.getWorkspaceRoleName(userId, workspaceId),
    ]);

    // Explicit owner access is valid only while the user is a workspace member.
    if (docPerm && (docPerm.role !== 'owner' || roleName)) {
      const allowed = DOCUMENT_ROLE_PERMISSIONS[docPerm.role] ?? [];
      if (allowed.includes(permission)) return true;
    }

    if (roleName) {
      const impliedDocRole = WORKSPACE_ROLE_TO_DOCUMENT_ROLE[roleName];
      if (impliedDocRole) {
        const impliedPerms = DOCUMENT_ROLE_PERMISSIONS[impliedDocRole] ?? [];
        return impliedPerms.includes(permission);
      }
    }

    // 3. Deny if neither matches
    return false;
  }

  // ─── Lấy effective document role (dùng cho response API) ────────────────────
  async getEffectiveDocumentRole(
    userId: string,
    workspaceId: string,
    documentId: string,
  ): Promise<string | null> {
    const [roleName, docPerm] = await Promise.all([
      this.getWorkspaceRoleName(userId, workspaceId),
      this.documentPermissionModel
        .findOne({
          userId: toObjectId(userId),
          documentId: toObjectId(documentId),
        })
        .lean(),
    ]);

    if (roleName) {
      if (docPerm?.role === 'owner') {
        return 'owner';
      }
      return WORKSPACE_ROLE_TO_DOCUMENT_ROLE[roleName] ?? null;
    }

    return docPerm?.role === 'owner' ? null : (docPerm?.role ?? null);
  }

  // src/modules-system/permissions/permissions.service.ts

  /**
   * Lấy danh sách permission cho NHIỀU document cùng lúc (Tối ưu chống N+1 Query)
   * Dùng cho API lấy danh sách tài liệu (findAll)
   */
  async getBulkDocumentPermissions(
    userId: string,
    workspaceId: string,
    documentIds: string[],
  ): Promise<Record<string, string[]>> {
    if (!documentIds.length) return {};

    // 1. Chỉ query 1 lần lấy Workspace Role của User (Admin hay Member)
    const roleName = await this.getWorkspaceRoleName(userId, workspaceId);
    const impliedDocRole = roleName ? WORKSPACE_ROLE_TO_DOCUMENT_ROLE[roleName] : null;

    // 2. Chỉ query 1 lần lấy toàn bộ Explicit Permissions của User trên các Docs này
    const docPerms = await this.documentPermissionModel.find({
      userId: toObjectId(userId),
      documentId: { $in: toObjectIds(documentIds) }
    }).lean();

    // Tạo Map để tra cứu nhanh (O(1))
    const explicitRoleMap = new Map();
    for (const perm of docPerms) {
      explicitRoleMap.set(toStringId(perm.documentId), perm.role);
    }

    // 3. Phân giải quyền cho từng Document
    const result: Record<string, string[]> = {};
    for (const docId of documentIds) {
      // Ưu tiên quyền trực tiếp (owner, share external), nếu không có thì dùng quyền mặc định từ workspace
      const explicitRole = explicitRoleMap.get(docId);
      const finalRole = roleName
        ? (explicitRole === 'owner' ? 'owner' : impliedDocRole)
        : (explicitRole === 'owner' ? null : explicitRole);

      // Map từ role ra mảng string permissions
      result[docId] = finalRole ? (DOCUMENT_ROLE_PERMISSIONS[finalRole] ?? []) : [];
    }

    return result;
  }

  /**
   * Dành cho API lấy CHÍNH XÁC 1 tài liệu (findOne)
   * Trả về mảng các quyền hạn: ['document:view', 'document:edit', ...]
   */
  async getAvailableDocumentPermissions(
    userId: string,
    workspaceId: string,
    documentId: string,
  ): Promise<string[]> {
    // 1. Tính toán Role cuối cùng của User (owner, editor, commenter, viewer)
    const effectiveRole = await this.getEffectiveDocumentRole(
      userId,
      workspaceId,
      documentId
    );

    // 2. Nếu không có role (không có quyền truy cập), trả về mảng rỗng
    if (!effectiveRole) {
      return [];
    }

    // 3. Ánh xạ từ Role -> Mảng Permissions (Lấy từ file role.permissions.ts)
    return DOCUMENT_ROLE_PERMISSIONS[effectiveRole] ?? [];
  }
}

