import { UnauthorizedException } from '@nestjs/common'
import { Types } from 'mongoose'
import { TokenService } from '../../../src/modules-system/token/token.service'

describe('TokenService', () => {
  const jwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  }
  const refreshTokenModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }
  const cacheManager = {
    set: jest.fn(),
    get: jest.fn(),
  }

  const service = () =>
    new TokenService(jwtService as any, refreshTokenModel as any, cacheManager as any)

  beforeEach(() => {
    jest.clearAllMocks()
    jwtService.sign.mockReturnValue('access-token')
  })

  it('signs access tokens with subject and jti', () => {
    expect(service().signAccessToken('user-1')).toBe('access-token')
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      jti: '00000000-0000-4000-8000-000000000000',
    })
  })

  it('delegates access token decode and verify to JwtService', () => {
    jwtService.decode.mockReturnValue({ sub: 'user-1', jti: 'jti', exp: 1 })
    jwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'jti' })

    expect(service().decodeAccessToken('token')).toEqual({
      sub: 'user-1',
      jti: 'jti',
      exp: 1,
    })
    expect(service().verifyAccessToken('token')).toEqual({ sub: 'user-1', jti: 'jti' })
  })

  it('does not blacklist already expired access tokens', async () => {
    await service().revokeAccessToken('jti', new Date(Date.now() - 1000))

    expect(cacheManager.set).not.toHaveBeenCalled()
  })

  it('blacklists active access tokens until their expiry', async () => {
    await service().revokeAccessToken('jti', new Date(Date.now() + 60_000), 'logout')

    expect(cacheManager.set).toHaveBeenCalledWith(
      'revoked_at:jti',
      'logout',
      expect.any(Number),
    )
  })

  it('checks whether an access token was revoked', async () => {
    cacheManager.get.mockResolvedValueOnce('logout').mockResolvedValueOnce(undefined)

    await expect(service().isAccessTokenRevoked('a')).resolves.toBe(true)
    await expect(service().isAccessTokenRevoked('b')).resolves.toBe(false)
  })

  it('generates token pairs and persists hashed refresh tokens', async () => {
    refreshTokenModel.create.mockResolvedValue({})

    const result = await service().generateTokenPair(
      new Types.ObjectId().toString(),
      { userAgent: 'ua', ipAddress: 'ip' },
    )

    expect(result.accessToken).toBe('access-token')
    expect(result.refreshToken).toHaveLength(128)
    expect(refreshTokenModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.any(String),
        familyId: '00000000-0000-4000-8000-000000000000',
        isRevoked: false,
        deviceInfo: { userAgent: 'ua', ipAddress: 'ip' },
      }),
    )
  })

  it('rejects unknown refresh tokens', async () => {
    refreshTokenModel.findOne.mockResolvedValue(null)

    await expect(service().rotateRefreshToken('raw')).rejects.toThrow(UnauthorizedException)
  })

  it('revokes the whole refresh-token family on reuse detection', async () => {
    refreshTokenModel.findOne.mockResolvedValue({
      familyId: 'family-1',
      isRevoked: true,
    })

    await expect(service().rotateRefreshToken('raw')).rejects.toThrow('reuse detected')
    expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
      { familyId: 'family-1' },
      expect.objectContaining({ isRevoked: true, revokedReason: 'reuse_detected' }),
    )
  })

  it('rejects expired refresh tokens', async () => {
    refreshTokenModel.findOne.mockResolvedValue({
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(service().rotateRefreshToken('raw')).rejects.toThrow('expired')
  })

  it('rotates valid refresh tokens and revokes the old record', async () => {
    const userId = new Types.ObjectId()
    refreshTokenModel.findOne.mockResolvedValue({
      _id: 'old-id',
      userId,
      familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      deviceInfo: { userAgent: 'old', ipAddress: 'old' },
    })
    refreshTokenModel.create.mockResolvedValue({ _id: 'new-id' })

    const result = await service().rotateRefreshToken('raw', {
      userAgent: 'new',
      ipAddress: 'new',
    })

    expect(result).toMatchObject({ accessToken: 'access-token' })
    expect(refreshTokenModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        familyId: 'family-1',
        isRevoked: false,
        deviceInfo: { userAgent: 'new', ipAddress: 'new' },
      }),
    )
    expect(refreshTokenModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'old-id',
      expect.objectContaining({
        isRevoked: true,
        revokedReason: 'rotated',
        replacedByTokenId: 'new-id',
      }),
    )
  })

  it('revokes one refresh token and all user refresh tokens', async () => {
    const userId = new Types.ObjectId().toString()

    await service().revokeRefreshToken('raw')
    await service().revokeAllRefreshTokensByUser(userId)

    expect(refreshTokenModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tokenHash: expect.any(String) },
      expect.objectContaining({ isRevoked: true, revokedReason: 'logout' }),
    )
    expect(refreshTokenModel.updateMany).toHaveBeenCalledWith(
      { userId: expect.any(Types.ObjectId), isRevoked: false },
      expect.objectContaining({ isRevoked: true, revokedReason: 'manual_revoke' }),
    )
  })
})

