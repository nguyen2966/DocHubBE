import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ShareDocumentDto, UpdateDocumentRoleDto } from './dto/share-document.dto';
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member';
import { DocumentPermission } from 'src/modules-system/mongodb/schemas/document-permission';
import { User } from 'src/modules-system/mongodb/schemas/users';

type SkipReason = 'WORKSPACE_MEMBER' | 'OWNER' | 'ALREADY_HAS_ROLE';

@Injectable()
export class ShareDocumentService {
  constructor(
    @InjectModel('DocumentPermission')
    private readonly documentPermissionModel: Model<DocumentPermission>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  // ─── POST /members ──────────────────────────────────────────────────────────

  async shareDocument(
    documentId: string,
    workspaceId: string,
    grantedBy: string,
    dto: ShareDocumentDto,
  ) {
    const { userIds, role } = dto;

    // Fetch workspace members and existing permissions in bulk
    const [workspaceMembers, existingPermissions] = await Promise.all([
      this.memberModel.find({
        workspaceId,
        userId: { $in: userIds },
        isDeleted: false,
      }).lean(),
      this.documentPermissionModel.find({
        documentId,
        userId: { $in: userIds },
      }).lean(),
    ]);

    const workspaceMemberSet = new Set(
      workspaceMembers.map((m) => m.userId.toString()),
    );
    const ownerSet = new Set(
      existingPermissions
        .filter((p) => p.role === 'owner')
        .map((p) => p.userId.toString()),
    );
    const existingRoleMap = new Map(
      existingPermissions.map((p) => [p.userId.toString(), p.role]),
    );

    const added: DocumentPermission[] = [];
    const skipped: Array<{ userId: string; reason: SkipReason }> = [];

    for (const userId of userIds) {
      if (ownerSet.has(userId)) {
        skipped.push({ userId, reason: 'OWNER' });
        continue;
      }

      if (workspaceMemberSet.has(userId)) {
        skipped.push({ userId, reason: 'WORKSPACE_MEMBER' });
        continue;
      }

      const existingRole = existingRoleMap.get(userId);
      if (existingRole && existingRole === role) {
        skipped.push({ userId, reason: 'ALREADY_HAS_ROLE' });
        continue;
      }

      // Upsert — handles both new grants and role updates
      const result = await this.documentPermissionModel.findOneAndUpdate(
        { documentId, userId },
        { role, grantedBy },
        { upsert: true, new: true },
      );
      added.push(result);
    }

    return { added, skipped };
  }

  // ─── PATCH /members/:userId ─────────────────────────────────────────────────

  async updateRole(
    documentId: string,
    userId: string,
    dto: UpdateDocumentRoleDto,
  ) {
    const perm = await this.documentPermissionModel.findOne({ documentId, userId });

    if (!perm) {
      throw new NotFoundException('Permission not found');
    }
    if (perm.role === 'owner') {
      throw new ConflictException('Cannot change role of document owner');
    }

    perm.role = dto.role;
    return perm.save();
  }

  // ─── DELETE /members/:userId ────────────────────────────────────────────────

  async removeAccess(documentId: string, userId: string) {
    const perm = await this.documentPermissionModel.findOne({ documentId, userId });

    if (!perm) {
      throw new NotFoundException('Permission not found');
    }
    if (perm.role === 'owner') {
      throw new ConflictException('Cannot remove document owner');
    }

    await this.documentPermissionModel.deleteOne({ documentId, userId });
  }

  // ─── GET /access ────────────────────────────────────────────────────────────

  async getDocumentAccess(documentId: string, workspaceId: string) {
    const [ownerPerm, externalPerms, memberCount, workspace] = await Promise.all([
      this.documentPermissionModel
        .findOne({ documentId, role: 'owner' })
        .populate<{ userId: Pick<User, '_id' | 'fullName' | 'email'> }>(
          'userId',
          'fullName email avatarUrl',
        )
        .lean(),
      this.documentPermissionModel
        .find({ documentId, role: { $ne: 'owner' } })
        .populate<{ userId: Pick<User, '_id' | 'fullName' | 'email' > }>(
          'userId',
          'fullName email avatarUrl',
        )
        .lean(),
      this.memberModel.countDocuments({ workspaceId, isDeleted: false }),
      // Populate workspace name via ref — adjust if you have a Workspace model injected
      this.memberModel
        .findOne({ workspaceId, isDeleted: false })
        .populate('workspaceId', 'name')
        .lean(),
    ]);

    const workspaceName =
      (workspace?.workspaceId as any)?.name ?? '';

    return {
      workspace: {
        workspaceId,
        workspaceName,
        memberCount,
        role: 'workspace_member' as const,
      },
      owner: ownerPerm
        ? {
            userId: ownerPerm.userId._id.toString(),
            fullName: (ownerPerm.userId as any).fullName,
            email: (ownerPerm.userId as any).email,
            avatarUrl: (ownerPerm.userId as any).avatarUrl ?? null,
            role: 'owner' as const,
          }
        : null,
      externalUsers: externalPerms.map((p) => ({
        userId: p.userId._id.toString(),
        fullName: (p.userId as any).fullName,
        email: (p.userId as any).email,
        avatarUrl: (p.userId as any).avatarUrl ?? null,
        role: p.role,
        permissionId: (p as any)._id.toString(),
        createdAt: (p as any).createdAt?.toISOString() ?? null,
      })),
    };
  }

  // ─── GET /users/search ──────────────────────────────────────────────────────

  async searchUsersWithContext(
    documentId: string,
    workspaceId: string,
    email: string,
  ) {
    // 1. Find users matching the email query
    const users = await this.userModel
      .find({ email: { $regex: email, $options: 'i' } })
      .select('_id fullName email avatarUrl')
      .limit(10)
      .lean();

    if (!users.length) return { results: [] };

    const userIds = users.map((u) => u._id.toString());

    // 2. Batch fetch workspace membership + document permissions
    const [workspaceMembers, docPermissions] = await Promise.all([
      this.memberModel.find({
        workspaceId,
        userId: { $in: userIds },
        isDeleted: false,
      }).lean(),
      this.documentPermissionModel
        .find({ documentId, userId: { $in: userIds } })
        .lean(),
    ]);

    const workspaceMemberSet = new Set(
      workspaceMembers.map((m) => m.userId.toString()),
    );
    const permissionMap = new Map(
      docPermissions.map((p) => [p.userId.toString(), p.role]),
    );

    // 3. Build results
    const results = users.map((user) => {
      const userId = user._id.toString();
      const isWorkspaceMember = workspaceMemberSet.has(userId);
      const explicitDocumentRole = (permissionMap.get(userId) as any) ?? null;
      const isOwner = explicitDocumentRole === 'owner';

      // Effective role: workspace members always get their workspace-derived role;
      // external users use their explicit permission.
      const effectiveDocumentRole = isWorkspaceMember
        ? 'editor' // Replace with getEffectiveDocumentRole() call if injecting PermissionService
        : explicitDocumentRole;

      let disabledReason: 'OWNER' | 'WORKSPACE_MEMBER' | 'ALREADY_HAS_DOCUMENT_PERMISSION' | null = null;

      if (isOwner) {
        disabledReason = 'OWNER';
      } else if (isWorkspaceMember) {
        disabledReason = 'WORKSPACE_MEMBER';
      } else if (explicitDocumentRole) {
        disabledReason = 'ALREADY_HAS_DOCUMENT_PERMISSION';
      }

      return {
        userId,
        fullName: user.fullName,
        email: user.email,
        isWorkspaceMember,
        isOwner,
        explicitDocumentRole: isOwner ? null : explicitDocumentRole,
        effectiveDocumentRole: isOwner ? 'owner' : effectiveDocumentRole,
        canBeShared: disabledReason === null,
        disabledReason,
      };
    });

    return { results };
  }
}