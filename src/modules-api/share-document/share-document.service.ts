import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';

import {
  ShareDocumentDto,
  UpdateDocumentRoleDto,
  UpdatePendingShareRoleDto,
} from './dto/share-document.dto';

import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member';
import { DocumentPermission } from 'src/modules-system/mongodb/schemas/document-permission';
import { User } from 'src/modules-system/mongodb/schemas/users';
import { Document } from 'src/modules-system/mongodb/schemas/document';
import { Workspace } from 'src/modules-system/mongodb/schemas/workspace';
import { PendingDocumentShare } from 'src/modules-system/mongodb/schemas/pending-document-invitation';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';

type SkipReason =
  | 'WORKSPACE_MEMBER'
  | 'OWNER'
  | 'ALREADY_HAS_ROLE'
  | 'ALREADY_HAS_DOCUMENT_PERMISSION';

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
    private readonly workspaceModel: Model<Workspace>,

    @InjectModel(PendingDocumentShare.name)
    private readonly pendingShareModel: Model<PendingDocumentShare>,

    private readonly permissionService: PermissionsService,
  ) { }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toId(value: any): string {
    return value?._id?.toString?.() ?? value?.toString?.() ?? '';
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private createShareToken() {
    return randomBytes(32).toString('hex');
  }

  private createShareLink(token: string) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return `${frontendUrl}/document-shares/${token}`;
  }

  private createExpiryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }

  async getDocumentAccess(documentId: string, workspaceId: string) {
    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId })
      .populate<{ ownerId: Pick<User, '_id' | 'fullName' | 'email'> }>(
        'ownerId',
        'fullName email avatarUrl',
      )
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerUser = (document as any).ownerId;
    const ownerId = this.toId(ownerUser);

    const [workspace, memberCount, allExplicitPerms, pendingShares] =
      await Promise.all([
        this.workspaceModel.findById(workspaceId).select('name').lean(),

        this.memberModel.countDocuments({
          workspaceId: new Types.ObjectId(workspaceId),
          isDeleted: { $ne: true },
        }),

        this.documentPermissionModel
          .find({
            documentId,
            role: { $ne: 'owner' },
          })
          .populate<{ userId: Pick<User, '_id' | 'fullName' | 'email'> }>(
            'userId',
            'fullName email avatarUrl',
          )
          .lean(),

        this.pendingShareModel
          .find({
            documentId: new Types.ObjectId(documentId),
            workspaceId: new Types.ObjectId(workspaceId),
            status: 'pending',
          })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

    const explicitUserIds = allExplicitPerms.map((p) =>
      this.toId((p as any).userId),
    );

    const workspaceMembersWithExplicitPerm = explicitUserIds.length
      ? await this.memberModel
        .find({
          workspaceId: new Types.ObjectId(workspaceId),
          userId: {
            $in: explicitUserIds.map((id) => new Types.ObjectId(id)),
          },
          isDeleted: { $ne: true },
        })
        .select('userId')
        .lean()
      : [];

    const workspaceMemberSet = new Set(
      workspaceMembersWithExplicitPerm.map((m) => this.toId((m as any).userId)),
    );

    const externalPerms = allExplicitPerms.filter((p) => {
      const userId = this.toId((p as any).userId);
      return userId !== ownerId && !workspaceMemberSet.has(userId);
    });

    return {
      workspace: {
        workspaceId,
        workspaceName: (workspace as any)?.name ?? '',
        memberCount,
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
        const user = (p as any).userId;

        return {
          userId: this.toId(user),
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
          role: (p as any).role,
          permissionId: this.toId((p as any)._id),
          createdAt: (p as any).createdAt?.toISOString?.() ?? null,
        };
      }),

      pendingUsers: pendingShares.map((share) => ({
        shareId: this.toId((share as any)._id),
        email: (share as any).email,
        role: (share as any).role,
        createdAt: (share as any).createdAt?.toISOString?.() ?? null,
      })),
    };
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
    const normalizedEmail = this.normalizeEmail(keyword);
    const escapedKeyword = this.escapeRegex(normalizedEmail);

    const users = await this.userModel
      .find({
        email: { $regex: escapedKeyword, $options: 'i' },
      })
      .select('_id fullName email avatarUrl')
      .limit(10)
      .lean();

    if (!users.length && normalizedEmail.includes('@')) {
      return {
        results: [
          {
            email: normalizedEmail,
            isRegistered: false,
            isWorkspaceMember: false,
            isOwner: false,
            explicitDocumentRole: null,
            effectiveDocumentRole: null,
            canBeShared: true,
            disabledReason: null,
          },
        ],
      };
    }

    if (!users.length) {
      return { results: [] };
    }

    const userIds = users.map((u) => u._id);

    const [workspaceMembers, docPermissions] = await Promise.all([
      this.memberModel
        .find({
          workspaceId: new Types.ObjectId(workspaceId),
          userId: { $in: userIds },
          isDeleted: false,
        })
        .lean(),

      this.documentPermissionModel
        .find({
          documentId,
          userId: { $in: userIds.map((id) => id.toString()) },
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

    const results = await Promise.all(
      users.map(async (user) => {
        const userId = this.toId((user as any)._id);

        const isOwner = userId === ownerId;
        const isWorkspaceMember = workspaceMemberSet.has(userId);

        const explicitRole = permissionMap.get(userId) ?? null;
        const explicitDocumentRole =
          explicitRole && explicitRole !== 'owner' ? explicitRole : null;

        const effectiveDocumentRole =
          await this.permissionService.getEffectiveDocumentRole(
            userId,
            workspaceId,
            documentId,
          );

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

          isRegistered: true,
          isWorkspaceMember,
          isOwner,

          explicitDocumentRole,
          effectiveDocumentRole,

          canBeShared: disabledReason === null,
          disabledReason,
        };
      }),
    );

    return { results };
  }

  async shareDocument(
    documentId: string,
    workspaceId: string,
    grantedBy: string,
    dto: ShareDocumentDto,
  ) {
    const emails = [...new Set(dto.emails.map((e) => this.normalizeEmail(e)))];
    const { role } = dto;

    const document = await this.documentModel
      .findOne({ _id: documentId, workspaceId })
      .select('_id ownerId title')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    const users = await this.userModel
      .find({ email: { $in: emails } })
      .select('_id email fullName avatarUrl')
      .lean();

    const userByEmail = new Map(
      users.map((u) => [this.normalizeEmail((u as any).email), u]),
    );

    const registeredUserIds = users.map((u) => new Types.ObjectId(this.toId(u)));

    const [workspaceMembers, existingPermissions, existingPendingShares] =
      await Promise.all([
        registeredUserIds.length
          ? this.memberModel
            .find({
              workspaceId: new Types.ObjectId(workspaceId),
              userId: { $in: registeredUserIds },
              isDeleted: false,
            })
            .lean()
          : [],

        registeredUserIds.length
          ? this.documentPermissionModel
            .find({
              documentId,
              userId: { $in: registeredUserIds.map((id) => id.toString()) },
            })
            .lean()
          : [],

        this.pendingShareModel
          .find({
            documentId: new Types.ObjectId(documentId),
            workspaceId: new Types.ObjectId(workspaceId),
            email: { $in: emails },
            status: 'pending',
          })
          .lean(),
      ]);

    const workspaceMemberSet = new Set(
      workspaceMembers.map((m) => this.toId((m as any).userId)),
    );

    const existingRoleMap = new Map<string, string | 'owner'>(
      existingPermissions.map((p) => [
        this.toId((p as any).userId),
        (p as any).role,
      ] as [string, string | 'owner']),
    );

    const pendingByEmail = new Map(
      existingPendingShares.map((s) => [(s as any).email, s]),
    );

    const granted: Array<{ userId: string; email: string; role: string }> = [];
    const pending: Array<{
      shareId: string;
      email: string;
      role: string;
      shareLink: string;
    }> = [];
    const skipped: Array<{ email: string; reason: SkipReason }> = [];

    for (const email of emails) {
      const user = userByEmail.get(email);

      if (user) {
        const userId = this.toId(user);

        if (userId === ownerId) {
          skipped.push({ email, reason: 'OWNER' });
          continue;
        }

        if (workspaceMemberSet.has(userId)) {
          skipped.push({ email, reason: 'WORKSPACE_MEMBER' });
          continue;
        }

        const existingRole = existingRoleMap.get(userId);

        if (existingRole === 'owner') {
          skipped.push({ email, reason: 'OWNER' });
          continue;
        }

        if (existingRole === role) {
          skipped.push({ email, reason: 'ALREADY_HAS_ROLE' });
          continue;
        }

        await this.documentPermissionModel.findOneAndUpdate(
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

        granted.push({
          userId,
          email,
          role,
        });

        continue;
      }

      const existingPending = pendingByEmail.get(email);

      if (existingPending) {
        pending.push({
          shareId: this.toId((existingPending as any)._id),
          email,
          role: (existingPending as any).role,
          shareLink: this.createShareLink((existingPending as any).token),
        });
        continue;
      }

      const token = this.createShareToken();

      const created = await this.pendingShareModel.create({
        documentId: new Types.ObjectId(documentId),
        workspaceId: new Types.ObjectId(workspaceId),
        email,
        role,
        token,
        status: 'pending',
        createdBy: new Types.ObjectId(grantedBy),
        expiresAt: this.createExpiryDate(),
      });

      pending.push({
        shareId: this.toId(created),
        email,
        role,
        shareLink: this.createShareLink(token),
      });
    }

    return { granted, pending, skipped };
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
          workspaceId: new Types.ObjectId(workspaceId),
          userId: new Types.ObjectId(userId),
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
      .findOne({ _id: documentId, workspaceId })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    if (userId === ownerId) {
      throw new ConflictException('Cannot remove document owner');
    }

    const [perm, workspaceMember] = await Promise.all([
      this.documentPermissionModel.findOne({ documentId, userId }),
      this.memberModel
        .findOne({
          workspaceId: new Types.ObjectId(workspaceId),
          userId: new Types.ObjectId(userId),
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

    await this.documentPermissionModel.deleteOne({ documentId, userId });

    return { success: true };
  }

  async updatePendingShareRole(
    documentId: string,
    workspaceId: string,
    shareId: string,
    dto: UpdatePendingShareRoleDto,
  ) {
    const pendingShare = await this.pendingShareModel.findOne({
      _id: shareId,
      documentId: new Types.ObjectId(documentId),
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'pending',
    });

    if (!pendingShare) {
      throw new NotFoundException('Pending share not found');
    }

    pendingShare.role = dto.role;
    await pendingShare.save();

    return {
      shareId: this.toId(pendingShare),
      email: pendingShare.email,
      role: pendingShare.role,
      createdAt: (pendingShare as any).createdAt?.toISOString?.() ?? null,
    };
  }

  async removePendingShare(
    documentId: string,
    workspaceId: string,
    shareId: string,
  ) {
    const pendingShare = await this.pendingShareModel.findOne({
      _id: shareId,
      documentId: new Types.ObjectId(documentId),
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'pending',
    });

    if (!pendingShare) {
      throw new NotFoundException('Pending share not found');
    }

    pendingShare.status = 'revoked';
    await pendingShare.save();

    return { success: true };
  }

  async resolveShareToken(token: string) {
    const share = await this.pendingShareModel
      .findOne({ token })
      .populate<{ documentId: any }>('documentId', 'title')
      .populate<{ workspaceId: any }>('workspaceId', 'name')
      .lean();
    if (!share) {
      throw new NotFoundException('Share invitation not found');
    }

    const now = new Date();

    let status = (share as any).status;

    if (status === 'pending' && (share as any).expiresAt < now) {
      status = 'expired';
      await this.pendingShareModel.updateOne(
        { _id: (share as any)._id },
        { status: 'expired' },
      );
    }

    return {
      documentTitle: (share as any).documentId?.title ?? '',
      workspaceName: (share as any).workspaceId?.name ?? '',
      email: (share as any).email,
      role: (share as any).role,
      status,
    };
  }

  async acceptShareToken(token: string, userId: string) {
    const share = await this.pendingShareModel.findOne({ token });

    if (!share) {
      throw new NotFoundException('Share invitation not found');
    }

    if (share.status !== 'pending') {
      throw new ConflictException(`Share invitation is ${share.status}`);
    }

    if (share.expiresAt < new Date()) {
      share.status = 'expired';
      await share.save();
      throw new ConflictException('Share invitation expired');
    }

    const user = await this.userModel
      .findById(userId)
      .select('_id email')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userEmail = this.normalizeEmail((user as any).email);

    if (userEmail !== share.email) {
      throw new BadRequestException(
        'This invitation belongs to another email',
      );
    }

    const document = await this.documentModel
      .findOne({
        _id: share.documentId,
        workspaceId: share.workspaceId,
      })
      .select('_id ownerId')
      .lean();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const ownerId = this.toId((document as any).ownerId);

    if (ownerId === userId) {
      throw new ConflictException('Document owner cannot accept share');
    }

    const workspaceMember = await this.memberModel
      .findOne({
        workspaceId: share.workspaceId,
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      })
      .lean();

    if (workspaceMember) {
      share.status = 'accepted';
      share.acceptedBy = new Types.ObjectId(userId);
      share.acceptedAt = new Date();
      await share.save();

      return {
        workspaceId: this.toId(share.workspaceId),
        documentId: this.toId(share.documentId),
      };
    }

    await this.documentPermissionModel.findOneAndUpdate(
      {
        documentId: this.toId(share.documentId),
        userId,
      },
      {
        documentId: this.toId(share.documentId),
        userId,
        role: share.role,
        grantedBy: this.toId(share.createdBy),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    share.status = 'accepted';
    share.acceptedBy = new Types.ObjectId(userId);
    share.acceptedAt = new Date();
    await share.save();

    return {
      workspaceId: this.toId(share.workspaceId),
      documentId: this.toId(share.documentId),
    };
  }
}