import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { toObjectId, toStringId } from 'src/common/utils/mongo-id.util'
import { ActivityLog } from 'src/modules-system/mongodb/schemas/activity-log'
import { User } from 'src/modules-system/mongodb/schemas/users'
import {
  ACTIVITY_ACTION,
  ActivityAction,
  ActivityTarget,
} from './activity.constants'
import { ActivityLogQueryDto } from './dto/activity-log-query.dto'

export interface RecordActivityInput {
  workspaceId: string | Types.ObjectId
  actorId: string | Types.ObjectId
  actionType: ActivityAction
  targetType: ActivityTarget
  targetId?: string | Types.ObjectId | null
  metadata?: Record<string, unknown>
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name)

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async record(input: RecordActivityInput): Promise<void> {
    await this.activityLogModel.create({
      workspaceId: toObjectId(input.workspaceId),
      actorId: toObjectId(input.actorId),
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId ? toObjectId(input.targetId) : null,
      metadata: input.metadata ?? {},
    })
  }

  async recordSafe(input: RecordActivityInput): Promise<void> {
    try {
      await this.record(input)
    } catch (error) {
      this.logger.error(
        `Failed to record '${input.actionType}' activity`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  async findByWorkspace(workspaceId: string, query: ActivityLogQueryDto) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 13, 50)
    const filter: Record<string, any> = {
      workspaceId: toObjectId(workspaceId),
    }

    const actorIds = this.parseCommaSeparated(query.actorIds)
    if (actorIds.length) {
      filter.actorId = {
        $in: actorIds.map((actorId) => toObjectId(actorId)),
      }
    }

    const actionTypes = this.parseCommaSeparated(query.actionTypes)
    if (actionTypes.length) {
      const validActions = new Set(Object.values(ACTIVITY_ACTION))

      if (actionTypes.some((action) => !validActions.has(action as ActivityAction))) {
        throw new BadRequestException('Invalid activity actionTypes filter')
      }

      filter.actionType = { $in: actionTypes }
    }

    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined
      const to = query.to ? new Date(query.to) : undefined

      if (from && to && from >= to) {
        throw new BadRequestException("'from' must be before 'to'")
      }

      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: to } : {}),
      }
    }

    const skip = (page - 1) * limit
    const [activities, totalItems] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'fullName email avatarUrl')
        .lean(),
      this.activityLogModel.countDocuments(filter),
    ])

    const totalPages = Math.ceil(totalItems / limit)

    return {
      items: activities.map((activity: any) => this.normalizeActivity(activity)),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }
  }

  async findActorsByWorkspace(workspaceId: string) {
    const actorStats = await this.activityLogModel.aggregate<{
      _id: Types.ObjectId
      activityCount: number
      latestActivityAt: Date
    }>([
      { $match: { workspaceId: toObjectId(workspaceId) } },
      {
        $group: {
          _id: '$actorId',
          activityCount: { $sum: 1 },
          latestActivityAt: { $max: '$createdAt' },
        },
      },
      { $sort: { latestActivityAt: -1, _id: -1 } },
    ])

    const users = await this.userModel
      .find({ _id: { $in: actorStats.map((actor) => actor._id) } })
      .select('fullName email avatarUrl')
      .lean()

    const userById = new Map(
      users.map((user: any) => [toStringId(user._id), user]),
    )

    return actorStats
      .map((stats) => {
        const user: any = userById.get(toStringId(stats._id))
        if (!user) return null

        return {
          _id: toStringId(user._id),
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
          activityCount: stats.activityCount,
          latestActivityAt: stats.latestActivityAt,
        }
      })
      .filter(Boolean)
  }

  private parseCommaSeparated(value?: string): string[] {
    if (!value) return []

    return [
      ...new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ]
  }

  private normalizeActivity(activity: any) {
    const {
      __v,
      updatedAt,
      actorId,
      _id,
      workspaceId,
      targetId,
      ...rest
    } = activity

    return {
      ...rest,
      _id: toStringId(_id),
      workspaceId: toStringId(workspaceId),
      actor: actorId
        ? {
            _id: toStringId(actorId),
            fullName: actorId.fullName,
            email: actorId.email,
            avatarUrl: actorId.avatarUrl ?? null,
          }
        : null,
      targetId: targetId ? toStringId(targetId) : null,
    }
  }
}
