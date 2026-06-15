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
    const limit = Math.min(query.limit ?? 20, 50)
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

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor)
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: cursor.id },
        },
      ]
    }

    const activities = await this.activityLogModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate('actorId', 'fullName email avatarUrl')
      .lean()

    const hasMore = activities.length > limit
    const pageItems = hasMore ? activities.slice(0, limit) : activities
    const lastItem = pageItems[pageItems.length - 1] as any

    return {
      items: pageItems.map((activity: any) => ({
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
      nextCursor:
        hasMore && lastItem
          ? this.encodeCursor(lastItem.createdAt, lastItem._id)
          : null,
      hasMore,
    }
  }

  private encodeCursor(createdAt: Date, id: Types.ObjectId): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: createdAt.toISOString(),
        id: toStringId(id),
      }),
    ).toString('base64')
  }

  private decodeCursor(cursor: string): {
    createdAt: Date
    id: Types.ObjectId
  } {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
      const createdAt = new Date(decoded.createdAt)

      if (
        typeof decoded.createdAt !== 'string' ||
        Number.isNaN(createdAt.getTime()) ||
        typeof decoded.id !== 'string'
      ) {
        throw new Error('Malformed cursor')
      }

      return {
        createdAt,
        id: toObjectId(decoded.id),
      }
    } catch {
      throw new BadRequestException('Invalid activity cursor')
    }
  }
}
