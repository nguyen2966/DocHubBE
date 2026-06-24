import { BadRequestException } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { Types } from 'mongoose'
import { ActivityService } from '../../../src/modules-api/activity/activity.service'
import { ACTIVITY_ACTION } from '../../../src/modules-api/activity/activity.constants'
import { createQueryMock } from '../helpers'

describe('ActivityService', () => {
  const activityLogModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  }
  const userModel = {
    find: jest.fn(),
  }

  const service = () => new ActivityService(activityLogModel as any, userModel as any)
  const workspaceId = new Types.ObjectId().toString()
  const actorId = new Types.ObjectId().toString()
  const targetId = new Types.ObjectId().toString()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('records activity with normalized ObjectIds', async () => {
    await service().record({
      workspaceId,
      actorId,
      actionType: ACTIVITY_ACTION.CREATE_DOCUMENT,
      targetType: 'document',
      targetId,
      metadata: { title: 'Doc' },
    })

    expect(activityLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: expect.any(Types.ObjectId),
        actorId: expect.any(Types.ObjectId),
        targetId: expect.any(Types.ObjectId),
        metadata: { title: 'Doc' },
      }),
    )
  })

  it('recordSafe swallows logging failures', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    activityLogModel.create.mockRejectedValue(new Error('db down'))

    await expect(
      service().recordSafe({
        workspaceId,
        actorId,
        actionType: ACTIVITY_ACTION.CREATE_DOCUMENT,
        targetType: 'document',
      }),
    ).resolves.toBeUndefined()
  })

  it('finds paginated workspace activity and normalizes actor shape', async () => {
    const logId = new Types.ObjectId()
    activityLogModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: logId,
          workspaceId,
          actorId: {
            _id: actorId,
            fullName: 'User',
            email: 'u@example.com',
          },
          targetId,
          actionType: ACTIVITY_ACTION.CREATE_DOCUMENT,
          targetType: 'document',
          metadata: {},
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    )
    activityLogModel.countDocuments.mockResolvedValue(1)

    await expect(
      service().findByWorkspace(workspaceId, { page: 1, limit: 100 }),
    ).resolves.toMatchObject({
      page: 1,
      limit: 50,
      totalItems: 1,
      items: [
        {
          _id: logId.toString(),
          actor: {
            _id: actorId,
            fullName: 'User',
            email: 'u@example.com',
            avatarUrl: null,
          },
          targetId,
        },
      ],
    })
  })

  it('rejects invalid action type filters', async () => {
    await expect(
      service().findByWorkspace(workspaceId, { actionTypes: 'not-valid' } as any),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects invalid date ranges', async () => {
    await expect(
      service().findByWorkspace(workspaceId, {
        from: '2026-02-01',
        to: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('maps actor aggregation results to existing users', async () => {
    const missingUserId = new Types.ObjectId()
    activityLogModel.aggregate.mockResolvedValue([
      { _id: actorId, activityCount: 3, latestActivityAt: new Date('2026-01-02') },
      { _id: missingUserId, activityCount: 1, latestActivityAt: new Date('2026-01-01') },
    ])
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: actorId,
          fullName: 'User',
          email: 'u@example.com',
        },
      ]),
    )

    await expect(service().findActorsByWorkspace(workspaceId)).resolves.toEqual([
      expect.objectContaining({
        _id: actorId,
        fullName: 'User',
        activityCount: 3,
      }),
    ])
  })
})
