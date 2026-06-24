import { Types } from 'mongoose'
import { SearchService } from '../../../src/modules-api/search/search.service'
import { createQueryMock } from '../helpers'

describe('SearchService', () => {
  const userModel = {
    find: jest.fn(),
  }
  const memberModel = {
    find: jest.fn(),
  }

  const service = () => new SearchService(userModel as any, memberModel as any)
  const workspaceId = new Types.ObjectId().toString()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searches verified users by escaped email prefix', async () => {
    const userId = new Types.ObjectId()
    userModel.find.mockReturnValue(
      createQueryMock([
        {
          _id: userId,
          email: 'a+b@example.com',
          fullName: 'A B',
        },
      ]),
    )
    memberModel.find.mockReturnValue(createQueryMock([]))

    await expect(service().searchByEmail(' a+b@ ', workspaceId)).resolves.toEqual([
      {
        email: 'a+b@example.com',
        isRegistered: true,
        userId: userId.toString(),
        fullName: 'A B',
        isMember: false,
      },
    ])

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        email: { $regex: 'a\\+b@', $options: 'i' },
        isEmailVerified: true,
      }),
    )
  })

  it('marks users that are already workspace members', async () => {
    const userId = new Types.ObjectId()
    userModel.find.mockReturnValue(
      createQueryMock([{ _id: userId, email: 'user@example.com' }]),
    )
    memberModel.find.mockReturnValue(createQueryMock([{ userId }]))

    await expect(service().searchByEmail('user', workspaceId)).resolves.toEqual([
      expect.objectContaining({
        email: 'user@example.com',
        isMember: true,
      }),
    ])
  })
})

