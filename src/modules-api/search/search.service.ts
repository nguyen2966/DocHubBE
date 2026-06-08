import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { User } from 'src/modules-system/mongodb/schemas/users'
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member'
import { Types } from 'mongoose'

export interface UserSearchResult {
  email: string
  isRegistered: boolean
  userId?: string
  fullName?: string
  avatarUrl?: string
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
  ) { }

  async searchByEmail(emailPrefix: string, workspaceId: string): Promise<UserSearchResult[]> {
    const prefix = emailPrefix.toLowerCase().trim();


    const users = await this.userModel
      .find({
        email: { $regex: this.escapeRegex(prefix), $options: 'i' },
        isEmailVerified: true,
        isDeleted: { $ne: true },
      })
      .select('email fullName avatarUrl')
      .limit(10)
      .lean();

    // Nếu có workspaceId → batch check membership 1 query
  const memberUserIds = workspaceId
    ? new Set(
        (await this.memberModel
          .find({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: { $in: users.map(u => u._id) },
            isDeleted: false,
          })
          .select('userId')
          .lean()
        ).map(m => m.userId.toString())
      )
    : null;

    return users.map((u) => ({
      email: u.email,
      isRegistered: true,
      userId: (u._id as any).toString(),
      fullName: u.fullName ?? undefined,
      isMember: memberUserIds ? memberUserIds.has((u._id as any).toString()) : undefined,
    }));
  }

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

}