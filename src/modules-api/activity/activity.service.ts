import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { toObjectId, toStringId } from 'src/common/utils/mongo-id.util'
import { ActivityLog } from 'src/modules-system/mongodb/schemas/activity-log'
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

    if (query.actionTypes) {
      const validActions = new Set(Object.values(ACTIVITY_ACTION))
      const actionTypes = [
        ...new Set(
          query.actionTypes
            .split(',')
            .map((action) => action.trim())
            .filter(Boolean),
        ),
      ]

      if (!actionTypes.length || actionTypes.some((action) => !validActions.has(action as ActivityAction))) {
        throw new BadRequestException('Invalid activity actionTypes filter')
      }

      filter.actionType = { $in: actionTypes }
    }

    if (query.actorId) {
      filter.actorId = toObjectId(query.actorId)
    }

    if (query.targetType) {
      filter.targetType = query.targetType
    }

    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined
      const to = query.to ? new Date(query.to) : undefined

      if (from && to && from > to) {
        throw new BadRequestException("'from' must be before or equal to 'to'")
      }

      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
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
      items: activities.map((activity: any) => ({
        ...activity,
        _id: toStringId(activity._id),
        workspaceId: toStringId(activity.workspaceId),
        actorId: activity.actorId
          ? {
              ...activity.actorId,
              _id: toStringId(activity.actorId),
            }
          : null,
        targetId: activity.targetId ? toStringId(activity.targetId) : null,
      })),
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    }
  }
}
