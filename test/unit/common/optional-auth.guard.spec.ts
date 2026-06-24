import { OptionalAuthGuard } from '../../../src/common/guards/option.guard'
import { createHttpContext, createQueryMock } from '../helpers'

describe('OptionalAuthGuard', () => {
  const tokenService = {
    verifyAccessToken: jest.fn(),
    isAccessTokenRevoked: jest.fn(),
  }
  const userModel = {
    findById: jest.fn(),
  }

  const guard = () => new OptionalAuthGuard(tokenService as any, userModel as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows requests without access token', async () => {
    await expect(guard().canActivate(createHttpContext({ cookies: {} }))).resolves.toBe(true)
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled()
  })

  it('allows invalid tokens without attaching user', async () => {
    const request = { cookies: { accessToken: 'bad-token' } }
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid')
    })

    await expect(guard().canActivate(createHttpContext(request))).resolves.toBe(true)
    expect(request).not.toHaveProperty('user')
  })

  it('does not attach revoked tokens', async () => {
    const request = { cookies: { accessToken: 'token' } }
    tokenService.verifyAccessToken.mockReturnValue({ sub: 'user-1', jti: 'jti-1' })
    tokenService.isAccessTokenRevoked.mockResolvedValue(true)

    await expect(guard().canActivate(createHttpContext(request))).resolves.toBe(true)
    expect(request).not.toHaveProperty('user')
  })

  it('attaches user for valid optional auth tokens', async () => {
    const request = { cookies: { accessToken: 'token' } }
    const payload = { sub: 'user-1', jti: 'jti-1' }
    const user = { _id: 'user-1' }

    tokenService.verifyAccessToken.mockReturnValue(payload)
    tokenService.isAccessTokenRevoked.mockResolvedValue(false)
    userModel.findById.mockReturnValue(createQueryMock(user))

    await expect(guard().canActivate(createHttpContext(request))).resolves.toBe(true)
    expect(request).toMatchObject({ user, tokenPayload: payload })
  })
})

