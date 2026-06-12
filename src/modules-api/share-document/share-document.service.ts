import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  ShareDocumentDto,
  UpdateDocumentRoleDto,
} from './dto/share-document.dto';

import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member';
import { DocumentPermission } from 'src/modules-system/mongodb/schemas/document-permission';
import { User } from 'src/modules-system/mongodb/schemas/users';
import { Document } from 'src/modules-system/mongodb/schemas/document';
import { Workspace } from 'src/modules-system/mongodb/schemas/workspace';

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

    @InjectModel('Document')
    private readonly documentModel: Model<Document>,

    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<Workspace>
  ) { }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toId(value: any): string {
    return value?._id?.toString?.() ?? value?.toString?.() ?? '';
  }

  async shareDocument(
    documentId: string,
    workspaceId: string,
    grantedBy: string,
    dto: ShareDocumentDto,
  ) {
    const { userIds, role } = dto;

    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    const [workspaceMembers, existingPermissions] = await Promise.all([
      this.memberModel
        .find({
          workspaceId : new Types.ObjectId(workspaceId),
          userId: { $in: userIds.map((u) => new Types.ObjectId(u)) },
          isDeleted: false,
        })
        .lean(),

      this.documentPermissionModel
        .find({
          documentId : new Types.ObjectId(documentId),
          userId: { $in: userIds },
        })
        .lean(),
    ]);

    const workspaceMemberSet = new Set(
      workspaceMembers.map((m) => this.toId((m as any).userId)),
    );

    const existingRoleMap = new Map(
      existingPermissions.map((p) => [
        this.toId((p as any).userId),
        (p as any).role,
      ]),
    );

    const added: DocumentPermission[] = [];
    const skipped: Array<{ userId: string; reason: SkipReason }> = [];

    for (const userId of userIds) {
      if (userId === ownerId) {
        skipped.push({ userId, reason: 'OWNER' });
        continue;
      }

      if (workspaceMemberSet.has(userId)) {
        skipped.push({ userId, reason: 'WORKSPACE_MEMBER' });
        continue;
      }

      const existingRole = existingRoleMap.get(userId);

      if (existingRole === 'owner') {
        skipped.push({ userId, reason: 'OWNER' });
        continue;
      }

      if (existingRole === role) {
        skipped.push({ userId, reason: 'ALREADY_HAS_ROLE' });
        continue;
      }

      const result = await this.documentPermissionModel.findOneAndUpdate(
        { documentId, userId },
        {
          documentId,
          userId,
          role,
          grantedBy,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      added.push(result);
    }

    return { added, skipped };
  }

  async updateRole(
    documentId: string,
    workspaceId: string,
    userId: string,
    dto: UpdateDocumentRoleDto,
  ) {
    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    if (userId === ownerId) {
      throw new ConflictException('Cannot change role of document owner');
    }

    const [perm, workspaceMember] = await Promise.all([
      this.documentPermissionModel.findOne({ documentId, userId }),
      this.memberModel
        .findOne({ 
          workspaceId : new Types.ObjectId(workspaceId), 
          userId : new Types.ObjectId(userId), 
          isDeleted: false })
        .lean(),
    ]);

    if (workspaceMember) {
      throw new ConflictException('Workspace member already has access');
    }

    if (!perm) {
      throw new NotFoundException('Permission not found');
    }

    if (perm.role === 'owner') {
      throw new ConflictException('Cannot change role of document owner');
    }

    if (perm.role === dto.role) {
      throw new ConflictException(`User already has the '${dto.role}' role`);
    }

    perm.role = dto.role;
    return perm.save();
  }

  async removeAccess(documentId: string, workspaceId: string, userId: string) {


    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId: workspaceId })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);
    console.log(document);

    if (userId === ownerId) {
      throw new ConflictException('Cannot remove document owner');
    }

    const [perm, workspaceMember] = await Promise.all([
      this.documentPermissionModel.findOne({
        documentId: documentId,
        userId: userId,
      }),

      this.memberModel
        .findOne({
          workspaceId: workspaceId,
          userId: userId,
          isDeleted: false,
        })
        .lean(),
    ]);

    if (workspaceMember) {
      throw new ConflictException('Workspace member already has access');
    }

    if (!perm) {
      throw new NotFoundException('Permission not found');
    }

    if (perm.role === 'owner') {
      throw new ConflictException('Cannot remove document owner');
    }

    await this.documentPermissionModel.deleteOne({
      documentId: documentId,
      userId: userId,
    });

    return { success: true };
  }

  async getDocumentAccess(documentId: string, workspaceId: string) {

    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId: workspaceId })
      .populate<{ ownerId: Pick<User, '_id' | 'fullName' | 'email'> }>(
        'ownerId',
        'fullName email ',
      )
      .lean()

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerUser = (document as any).ownerId;
    const ownerId = this.toId(ownerUser);

    const [workspace, memberCount, allExplicitPerms] = await Promise.all([
      this.workspaceModel
        .findById(workspaceId)
        .select('name')
        .lean(),

      this.memberModel.countDocuments({
        workspaceId: new Types.ObjectId(workspaceId),
        isDeleted: { $ne: true },
      }),

      this.documentPermissionModel
        .find({
          documentId: documentId,
          role: { $ne: 'owner' },
        })
        .populate<{ userId: Pick<User, '_id' | 'fullName' | 'email'> }>(
          'userId',
          'fullName email',
        )
        .lean(),
    ]);

    const explicitUserIds = allExplicitPerms.map((p) =>
      this.toId((p as any).userId),
    );
    console.log(memberCount);
    console.log(explicitUserIds);

    const workspaceMembersWithExplicitPerm = explicitUserIds.length
      ? await this.memberModel
        .find({
          workspaceId: workspaceId,
          userId: {
            $in: explicitUserIds.map((id) => new Types.ObjectId(id)),
          },
          isDeleted: { $ne: true },
        })
        .select('userId')
        .lean()
      : []

    const workspaceMemberSet = new Set(
      workspaceMembersWithExplicitPerm.map((m) =>
        this.toId((m as any).userId),
      ),
    )

    const externalPerms = allExplicitPerms.filter((p) => {
      const userId = this.toId((p as any).userId)
      return userId !== ownerId && !workspaceMemberSet.has(userId)
    })

    return {
      workspace: {
        workspaceId,
        workspaceName: (workspace as any)?.name ?? '',
        memberCount,
        role: 'workspace_member' as const,
      },

      owner: ownerUser
        ? {
          userId: ownerId,
          fullName: ownerUser.fullName,
          email: ownerUser.email,
          avatarUrl: ownerUser.avatarUrl ?? null,
          role: 'owner' as const,
        }
        : null,

      externalUsers: externalPerms.map((p) => {
        const user = (p as any).userId

        return {
          userId: this.toId(user),
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
          role: (p as any).role,
          permissionId: this.toId((p as any)._id),
          createdAt: (p as any).createdAt?.toISOString?.() ?? null,
        }
      }),
    }
  }

  async searchUsersWithContext(
    documentId: string,
    workspaceId: string,
    email: string,
  ) {
    const keyword = email?.trim();

    if (!keyword || keyword.length < 2) {
      return { results: [] };
    }

    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    const escapedKeyword = this.escapeRegex(keyword);

    const users = await this.userModel
      .find({
        email: { $regex: escapedKeyword, $options: 'i' },
      })
      .select('_id fullName email avatarUrl')
      .limit(10)
      .lean();

    if (!users.length) {
      return { results: [] };
    }

    const userIds = users.map((u) => this.toId((u as any)._id));

    const [workspaceMembers, docPermissions] = await Promise.all([
      this.memberModel
        .find({
          workspaceId,
          userId: { $in: userIds },
          isDeleted: false,
        })
        .lean(),

      this.documentPermissionModel
        .find({
          documentId,
          userId: { $in: userIds },
        })
        .lean(),
    ]);

    const workspaceMemberSet = new Set(
      workspaceMembers.map((m) => this.toId((m as any).userId)),
    );

    const permissionMap = new Map(
      docPermissions.map((p) => [
        this.toId((p as any).userId),
        (p as any).role,
      ]),
    );

    const results = users.map((user) => {
      const userId = this.toId((user as any)._id);

      const isOwner = userId === ownerId;
      const isWorkspaceMember = workspaceMemberSet.has(userId);

      const explicitRole = permissionMap.get(userId) ?? null;
      const explicitDocumentRole =
        explicitRole && explicitRole !== 'owner' ? explicitRole : null;

      let disabledReason:
        | 'OWNER'
        | 'WORKSPACE_MEMBER'
        | 'ALREADY_HAS_DOCUMENT_PERMISSION'
        | null = null;

      if (isOwner) {
        disabledReason = 'OWNER';
      } else if (isWorkspaceMember) {
        disabledReason = 'WORKSPACE_MEMBER';
      } else if (explicitDocumentRole) {
        disabledReason = 'ALREADY_HAS_DOCUMENT_PERMISSION';
      }

      return {
        userId,
        fullName: (user as any).fullName,
        email: (user as any).email,
        avatarUrl: (user as any).avatarUrl ?? null,

        isWorkspaceMember,
        isOwner,

        explicitDocumentRole,
        effectiveDocumentRole: isOwner ? 'owner' : explicitDocumentRole,

        canBeShared: disabledReason === null,
        disabledReason,
      };
    });

    return { results };
  }
}