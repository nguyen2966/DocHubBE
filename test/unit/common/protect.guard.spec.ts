import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { TokenExpiredError } from 'jsonwebtoken'
import { ProtectGuard } from '../../../src/common/guards/protect.guard'
import { createHttpContext, createQueryMock } from '../helpers'

describe('ProtectGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  }
  const tokenService = {
    verifyAccessToken: jest.fn(),
    isAccessTokenRevoked: jest.fn(),
  }
  const userModel = {
    findById: jest.fn(),
  }

  const guard = () =>
    new ProtectGuard(reflector as any, tokenService as any, userModel as any)

  beforeEach(() => {
    jest.clearAllMocks()
    reflector.getAllAndOverride.mockReturnValue(false)
  })

  it('allows public handlers without reading cookies', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => key === 'isPublic')

    await expect(guard().canActivate(createHttpContext({ cookies: {} }))).resolves.toBe(true)
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled()
  })

  it('rejects requests without access token', async () => {
    await expect(guard().canActivate(createHttpContext({ cookies: {} }))).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('allows optional auth requests without access token', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => key === 'isOptionalAuth')

    await expect(guard().canActivate(createHttpContext({ cookies: {} }))).resolves.toBe(true)
  })

  it('rejects revoked access tokens', async () => {
    tokenService.verifyAccessToken.mockReturnValue({ sub: 'user-1', jti: 'jti-1' })
    tokenService.isAccessTokenRevoked.mockResolvedValue(true)

    await expect(
      guard().canActivate(createHttpContext({ cookies: { accessToken: 'token' } })),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('attaches user and token payload for valid tokens', async () => {
    const request = { cookies: { accessToken: 'token' } }
    const payload = { sub: 'user-1', jti: 'jti-1', exp: 1 }
    const user = { _id: 'user-1', email: 'u@example.com' }

    tokenService.verifyAccessToken.mockReturnValue(payload)
    tokenService.isAccessTokenRevoked.mockResolvedValue(false)
    userModel.findById.mockReturnValue(createQueryMock(user))

    await expect(guard().canActivate(createHttpContext(request))).resolves.toBe(true)
    expect(request).toMatchObject({ user, tokenPayload: payload })
  })

  it('maps expired tokens to an explicit UnauthorizedException', async () => {
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new TokenExpiredError('jwt expired', new Date())
    })

    await expect(
      guard().canActivate(createHttpContext({ cookies: { accessToken: 'token' } })),
    ).rejects.toThrow('Access token expired')
  })

  it('rethrows formatted forbidden errors', async () => {
    tokenService.verifyAccessToken.mockImplementation(() => {
      throw new ForbiddenException('blocked')
    })

    await expect(
      guard().canActivate(createHttpContext({ cookies: { accessToken: 'token' } })),
    ).rejects.toThrow(ForbiddenException)
  })
})

