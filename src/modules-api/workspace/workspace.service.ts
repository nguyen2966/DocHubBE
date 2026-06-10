import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as crypto from 'crypto'

import { Workspace } from 'src/modules-system/mongodb/schemas/workspace'
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member'
import { WorkspaceInvitation } from 'src/modules-system/mongodb/schemas/workspace-ivitation'
import { User } from 'src/modules-system/mongodb/schemas/users'
import { Role } from 'src/modules-system/mongodb/schemas/role'
import { EmailService } from 'src/modules-system/email/email.service'

import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

import { InvitationAction } from 'src/common/constants/enum'
import { WORKSPACE_ROLE_PERMISSIONS } from 'src/modules-system/permissions/roles/role.permissions'
import { InviteEmailResult } from './types/types'


import {
  INVITATION_TTL_DAYS,
  APP_URL,
} from 'src/common/constants/app.constants'

@Injectable()
export class WorkspaceService implements OnModuleInit {
  // Cache roleId để tránh query lặp lại
  private adminRoleId!: Types.ObjectId
  private memberRoleId!: Types.ObjectId

  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<Workspace>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
    @InjectModel(WorkspaceInvitation.name)
    private readonly invitationModel: Model<WorkspaceInvitation>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) { }

  async onModuleInit() {
    const [adminRole, memberRole] = await Promise.all([
      this.roleModel.findOne({ name: 'admin', scope: 'workspace' }).lean(),
      this.roleModel.findOne({ name: 'member', scope: 'workspace' }).lean(),
    ])

    if (!adminRole || !memberRole) {
      throw new Error('Workspace roles chưa được seed. Vui lòng chạy seeder trước.')
    }

    this.adminRoleId = adminRole._id as Types.ObjectId
    this.memberRoleId = memberRole._id as Types.ObjectId
  }

  // ─── Private Helpers ──────────────────────────────────────

  private toId(id: string): Types.ObjectId {
    return new Types.ObjectId(id)
  }

  /**
   * Lấy active membership (chưa bị soft delete).
   * Schema pre-hook tự động filter isDeleted = false nên không cần thêm điều kiện.
   */
  private async getMember(workspaceId: string, userId: string) {
    return this.memberModel
      .findOne({
        workspaceId: this.toId(workspaceId),
        userId: this.toId(userId),
        isDeleted: false
      })
      .lean()
  }

  private async isAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(workspaceId, userId)
    if (!member) return false
    return member.roleId.equals(this.adminRoleId)
  }

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.getMember(workspaceId, userId)
    if (!member) throw new ForbiddenException('Bạn không thuộc workspace này')
    return member
  }

  private async assertAdmin(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId)
    const admin = await this.isAdmin(workspaceId, userId)
    if (!admin) {
      throw new ForbiddenException('Chỉ admin mới có quyền thực hiện thao tác này')
    }
  }

  private async getActiveAdminCount(workspaceId: string): Promise<number> {
    return this.memberModel.countDocuments({
      workspaceId: this.toId(workspaceId),
      roleId: this.adminRoleId,
      // isDeleted filter đã được xử lý bởi pre-hook
    })
  }

  /** Soft delete một document bất kỳ có isDeleted/deletedAt/deletedBy */
  private softDeleteUpdate(actorId: string) {
    return {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: this.toId(actorId),
    }
  }

  // ─── Workspace CRUD ───────────────────────────────────────

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.workspaceModel.create({
      name: dto.name,
      description: dto.description ?? '',
      createdBy: this.toId(userId),
    })

    await this.memberModel.create({
      workspaceId: workspace._id as Types.ObjectId,
      userId: this.toId(userId),
      roleId: this.adminRoleId,
      invitedBy: this.toId(userId),
      joinedAt: new Date(),
    })

    return workspace
  }

  async findAllByUser(
    userId: string,
    options: {
      cursor?: string
      limit?: number
    } = {},
  ) {
    const limit = Math.min(options.limit ?? 20, 50)

    const query: any = {
      userId: this.toId(userId),
     // isDeleted: false
    }

    if (options.cursor) {
      query._id = { $lt: this.toId(options.cursor) }
    }

    const memberships = await this.memberModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('workspaceId')
      .populate('roleId', 'name scope')
      .lean()

    const hasMore = memberships.length > limit
    const pageItems = hasMore ? memberships.slice(0, limit) : memberships

    const workspaceIds = pageItems
      .map((m) => (m.workspaceId as any)?._id)
      .filter(Boolean)

    const memberCounts = await this.memberModel.aggregate([
      {
        $match: {
          workspaceId: { $in: workspaceIds },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$workspaceId',
          count: { $sum: 1 },
        },
      },
    ])

    const memberCountMap = new Map<string, number>(
      memberCounts.map((item) => [
        item._id.toString(),
        item.count,
      ]),
    )

    return {
      items: pageItems.map((m) => {
        const workspace = m.workspaceId as any
        const role = m.roleId as any
        const workspaceId = workspace._id.toString()

        return {
          ...workspace,
          memberCount: memberCountMap.get(workspaceId) ?? 0,
          currentUserAccess: {
            role: role.name,
            scope: role.scope,
            permissions: WORKSPACE_ROLE_PERMISSIONS[role.name] ?? [],
          },
        }
      }),
      nextCursor:
        hasMore && pageItems.length > 0
          ? pageItems[pageItems.length - 1]._id.toString()
          : null,
      hasMore,
    }
  }

  async findOne(workspaceId: string, userId: string) {
    const membership = await this.memberModel
      .findOne({
        workspaceId: this.toId(workspaceId),
        userId: this.toId(userId),
       // isDeleted: false,
      })
      .populate('roleId', 'name scope')
      .lean()

    if (!membership) {
      throw new ForbiddenException('Bạn không thuộc workspace này hoặc workspace đã bị xóa');
    }

    const workspace = await this.workspaceModel
      .findById(workspaceId)
      .lean()

    if (!workspace) {
      throw new NotFoundException('Workspace không tồn tại');
    }

    const role = membership.roleId as any

    return {
      ...workspace,
      currentUserAccess: {
        role: role.name,
        scope: role.scope,
        permissions: WORKSPACE_ROLE_PERMISSIONS[role.name] ?? [],
      },
    }
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    await this.assertAdmin(workspaceId, userId)

    const workspace = await this.workspaceModel
      .findByIdAndUpdate(workspaceId, { $set: dto }, { new: true })
      .lean()

    if (!workspace) throw new NotFoundException('Workspace không tồn tại')
    return workspace
  }

  /**
   * Soft delete workspace:
   * - Đánh dấu workspace isDeleted
   * - Soft delete toàn bộ memberships
   * - Expire toàn bộ pending invitations
   */
  async remove(workspaceId: string, userId: string): Promise<void> {
    await this.assertAdmin(workspaceId, userId)

    const now = new Date()
    const deletedBy = this.toId(userId)
    const wsId = this.toId(workspaceId)

    await Promise.all([
      // Soft delete workspace
      this.workspaceModel.findByIdAndUpdate(workspaceId, {
        $set: { isDeleted: true, deletedAt: now, deletedBy },
      }),

      // Soft delete tất cả members (kể cả bản thân actor)
      this.memberModel.updateMany(
        { workspaceId: wsId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: now, deletedBy } },
      ),

      // Expire tất cả pending invitations
      this.invitationModel.updateMany(
        { workspaceId: wsId, status: 'pending' },
        { $set: { status: 'expired' } },
      ),
    ])
  }

  // ─── Members ──────────────────────────────────────────────

  async getMembers(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId)

    return this.memberModel
      .find({ workspaceId: this.toId(workspaceId), isDeleted: false })
      .populate('userId', 'fullName email')
      .populate('roleId', 'name')
      .lean()
  }


  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    actorId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.assertAdmin(workspaceId, actorId);

    if (targetUserId === actorId) {
      throw new BadRequestException(
        'You can not change your own role',
      );
    }

    const role = await this.roleModel.findOne({
      name: dto.role,
    });

    if (!role) {
      throw new NotFoundException(
        `Role '${dto.role}' does not exist`,
      );
    }

    const newRoleId = role._id as Types.ObjectId;

    const isDowngradingToNonAdmin =
      role.name !== 'admin';

    // admin -> member
    if (isDowngradingToNonAdmin) {
      const target = await this.getMember(
        workspaceId,
        targetUserId,
      );

      if (!target) {
        throw new NotFoundException(
          'Member not found',
        );
      }

      if (target.roleId.equals(this.adminRoleId)) {
        const adminCount =
          await this.getActiveAdminCount(workspaceId);

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Workspace must have at least 1 admin',
          );
        }
      }
    }

    const updated = await this.memberModel
      .findOneAndUpdate(
        {
          workspaceId: this.toId(workspaceId),
          userId: this.toId(targetUserId),
        },
        {
          roleId: newRoleId,
        },
        {
          new: true,
        },
      )
      .populate('roleId', 'name')
      .lean();

    if (!updated) {
      throw new NotFoundException(
        'Member not found',
      );
    }

    return updated;
  }

  /**
   * Admin kick member ra khỏi workspace (soft delete membership).
   */
  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertAdmin(workspaceId, actorId)

    if (targetUserId === actorId) {
      throw new BadRequestException(
        'You can not remove yourself from workspace',
      )
    }

    const target = await this.getMember(workspaceId, targetUserId)
    if (!target) throw new NotFoundException('Member not found')

    if (target.roleId.equals(this.adminRoleId)) {
      const adminCount = await this.getActiveAdminCount(workspaceId)
      if (adminCount <= 1) {
        throw new BadRequestException('Workspace must have at least 1 admin');
      }
    }

    await this.memberModel.deleteOne({
      workspaceId: this.toId(workspaceId),
      userId: this.toId(targetUserId),
    })
  }

  /**
   * User tự rời workspace (soft delete chính membership của mình).
   */
  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const member = await this.assertMember(workspaceId, userId)

    if (member.roleId.equals(this.adminRoleId)) {
      const adminCount = await this.getActiveAdminCount(workspaceId)
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Bạn là admin duy nhất. Hãy chỉ định admin khác trước khi rời workspace.',
        )
      }
    }

    await this.memberModel.findOneAndUpdate(
      { workspaceId: this.toId(workspaceId), userId: this.toId(userId) },
      { $set: this.softDeleteUpdate(userId) },
    )
  }

  // ─── Invitations ──────────────────────────────────────────

  async inviteMember(
    workspaceId: string,
    actorId: string,
    dto: InviteMemberDto,           // dto.emails: string[], dto.role: string
  ): Promise<InviteEmailResult[]> {
    await this.assertAdmin(workspaceId, actorId)

    const [workspace, inviter] = await Promise.all([
      this.workspaceModel.findById(workspaceId).lean(),
      this.userModel.findById(actorId).lean(),
    ])

    // Batch lookup: 1 query cho toàn bộ emails thay vì N queries
    const existingUsers = await this.userModel
      .find({ email: { $in: dto.emails } })
      .select('_id email')
      .lean()

    const userByEmail = new Map(
      existingUsers.map((u) => [u.email, u]),
    )

    // Batch lookup memberships cho registered users
    const registeredUserIds = existingUsers.map((u) => u._id)
    const existingMembers = registeredUserIds.length
      ? await this.memberModel
        .find({
          workspaceId: this.toId(workspaceId),
          userId: { $in: registeredUserIds },
          isDeleted: false,
        })
        .select('userId')
        .lean()
      : []

    const alreadyMemberUserIds = new Set(
      existingMembers.map((m) => m.userId.toString()),
    )

    // Xử lý từng email song song — mỗi email độc lập, lỗi 1 cái không ảnh hưởng cái khác
    const results = await Promise.all(
      dto.emails.map(async (email): Promise<InviteEmailResult> => {
        try {
          const existingUser = userByEmail.get(email)
          const isRegistered = !!existingUser

          // Guard: đã là member
          if (existingUser && alreadyMemberUserIds.has(existingUser._id.toString())) {
            return { email, status: 'already_member' }
          }

          // Expire pending invitations cũ của email này trong workspace
          await this.invitationModel.updateMany(
            {
              workspaceId: this.toId(workspaceId),
              invitedEmail: email,
              status: 'pending',
            },
            { $set: { status: 'expired' } },
          )

          const token = crypto.randomBytes(32).toString('hex')
          const ttlDays = parseInt(INVITATION_TTL_DAYS as string, 10)
          const expiresAt = new Date(Date.now() + ttlDays * 86_400 * 1000)

          const invitation = await this.invitationModel.create({
            workspaceId: this.toId(workspaceId),
            invitedEmail: email,
            invitedUserId: existingUser?._id ?? null,
            invitedBy: this.toId(actorId),
            role: dto.role,
            token,
            status: 'pending',
            expiresAt,
          })

          const invitationUrl = `${APP_URL}/api/workspaces/invitations/${token}/accept`

          // Fire-and-forget email — không block kết quả trả về
          this.emailService
            .sendWorkspaceInvitationEmail({
              to: email,
              workspaceName: workspace?.name ?? 'Workspace',
              inviterName: inviter?.fullName ?? inviter?.email,
              role: dto.role,
              invitationUrl,
              isRegistered,
            })
            .catch((err) =>
              console.error(`[inviteMember] email send failed for ${email}:`, err),
            )

          return {
            email,
            status: 'invited',
            invitationId: (invitation._id as any).toString(),
          }
        } catch (err) {
          console.error(`[inviteMember] unexpected error for ${email}:`, err)
          return { email, status: 'error' }
        }
      }),
    )

    return results;
  }

  /**
   * Entry point từ email — user click link GET trong browser.
   *
   * Unregistered: redirect → FE sign-up page kèm invitationToken
   * Registered + đã login: add vào workspace → redirect Document list
   * Registered + chưa login: redirect → FE login page kèm ?next=... để sau login FE gọi POST accept
   */

  async handleInvitationLink(
    token: string,
    userId?: string,
  ) {
    const invitation = await this.invitationModel
      .findOne({ token })
      .lean();

    if (
      !invitation ||
      invitation.status !== 'pending' ||
      invitation.expiresAt < new Date()
    ) {
      if (
        invitation?.status === 'pending' &&
        invitation.expiresAt < new Date()
      ) {
        await this.invitationModel.updateOne(
          { token },
          { status: 'expired' },
        );
      }

      return {
        action: InvitationAction.INVALID,
      };
    }

    const existingUser = await this.userModel
      .findOne({
        email: invitation.invitedEmail,
      })
      .lean();

    if (!existingUser) {
      return {
        action: InvitationAction.SIGN_UP,
        token,
      };
    }

    if (!userId) {
      console.log("No userID");
      return {
        action: InvitationAction.SIGN_IN,
        token,
      };
    }

    const result = await this.acceptInvitation(
      token,
      userId,
    );

    return {
      action: InvitationAction.ACCEPTED,
      workspaceId: result.workspaceId,
    };
  }

  /**
   * Accept invitation — dành cho REGISTERED user đã đăng nhập.
   * Unregistered user sẽ được auto-join sau khi sign-up qua
   * `claimPendingInvitations()`.
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ workspaceId: string }> {
    const invitation = await this.invitationModel.findOne({ token }).lean()

    if (!invitation) throw new NotFoundException('Lời mời không tồn tại')

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Lời mời đã được sử dụng hoặc đã hết hạn')
    }

    if (invitation.expiresAt < new Date()) {
      await this.invitationModel.updateOne({ token }, { status: 'expired' })
      throw new BadRequestException('Lời mời đã hết hạn')
    }

    const user = await this.userModel.findById(userId).lean()
    if (!user) throw new NotFoundException('User không tồn tại')

    if (user.email.toLowerCase() !== invitation.invitedEmail) {
      throw new ForbiddenException('Email tài khoản không khớp với lời mời')
    }

    const alreadyMember = await this.getMember(
      invitation.workspaceId.toString(),
      userId,
    )
    if (alreadyMember) {
      throw new ConflictException('Bạn đã là thành viên của workspace này')
    }

    const roleId = invitation.role === 'admin' ? this.adminRoleId : this.memberRoleId

    await Promise.all([
      this.memberModel.create({
        workspaceId: invitation.workspaceId,
        userId: this.toId(userId),
        roleId,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      }),
      this.invitationModel.updateOne(
        { token },
        { status: 'accepted', invitedUserId: this.toId(userId) },
      ),
    ]);

    console.log("called");

    return { workspaceId: invitation.workspaceId.toString() }
  }

  /**
   * Claim tất cả pending invitations cho user vừa hoàn thành sign-up & verify.
   * Gọi từ AuthService sau khi user verify email thành công.
   *
   * @returns danh sách workspaceId mà user được add vào
   */
  async claimPendingInvitations(userId: string, userEmail: string): Promise<string[]> {
    const email = userEmail.toLowerCase()

    const pendingInvitations = await this.invitationModel
      .find({
        invitedEmail: email,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
      .lean()

    if (!pendingInvitations.length) return []

    const joinedWorkspaceIds: string[] = []

    await Promise.all(
      pendingInvitations.map(async (inv) => {
        // Kiểm tra chưa là member (trường hợp edge case invite 2 lần)
        const alreadyMember = await this.getMember(
          inv.workspaceId.toString(),
          userId,
        )
        if (alreadyMember) return

        const roleId = inv.role === 'admin' ? this.adminRoleId : this.memberRoleId

        await Promise.all([
          this.memberModel.create({
            workspaceId: inv.workspaceId,
            userId: this.toId(userId),
            roleId,
            invitedBy: inv.invitedBy,
            joinedAt: new Date(),
          }),
          this.invitationModel.updateOne(
            { _id: inv._id },
            { status: 'accepted', invitedUserId: this.toId(userId) },
          ),
        ])

        joinedWorkspaceIds.push(inv.workspaceId.toString())
      }),
    )

    return joinedWorkspaceIds
  }

  async getInvitations(workspaceId: string, actorId: string) {
    await this.assertAdmin(workspaceId, actorId)

    return this.invitationModel
      .find({ workspaceId: this.toId(workspaceId), status: 'pending' })
      .populate('invitedBy', 'fullName email')
      .lean()
  }

  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertAdmin(workspaceId, actorId)

    const invitation = await this.invitationModel.findOne({
      _id: this.toId(invitationId),
      workspaceId: this.toId(workspaceId),
    })

    if (!invitation) throw new NotFoundException('Lời mời không tồn tại')

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Lời mời đã được xử lý')
    }

    await invitation.updateOne({ status: 'expired' })
  }
}