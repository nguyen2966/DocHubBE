import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from '../mongodb/schemas/refresh-tokens';
import { REFRESH_TOKEN_TTL_DAYS } from 'src/common/constants/app.constants';
import { TokenPayload } from './token.type';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import { toObjectId } from 'src/common/utils/mongo-id.util';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  // ─── Helpers ──────────────────────────────────────────────

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex')
  }

  private generateRawToken(): string {
    return crypto.randomBytes(64).toString('hex')
  }

  // ─── Access Token ─────────────────────────────────────────

  signAccessToken(userId: string): string {
    const jti = uuidv4()
    return this.jwtService.sign({ sub: userId, jti })
  }

  decodeAccessToken(token: string): { sub: string; jti: string; exp: number } {
    return this.jwtService.decode(token) as any
  }

  async revokeAccessToken(
    jti: string,
    expiresAt: Date,
    reason: string = 'logout',
  ): Promise<void> {
    const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000)

    // TTL âm nghĩa token đã hết hạn tự nhiên — không cần blacklist
    if (ttlSeconds <= 0) return

    // Key: "revoked_at:<jti>", value tuỳ ý, TTL = thời gian còn lại của token
    await this.cacheManager.set(`revoked_at:${jti}`, reason, ttlSeconds * 1000);
  }

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    const value = await this.cacheManager.get(`revoked_at:${jti}`)
    return value !== null && value !== undefined
  }
  // ─── Refresh Token ────────────────────────────────────────

  async generateTokenPair(
    userId: string,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.signAccessToken(userId)

    const rawRefresh = this.generateRawToken()
    const tokenHash = this.hashToken(rawRefresh)
    const familyId = uuidv4()
    const expiresAt = new Date(
      Date.now() +
      parseInt(REFRESH_TOKEN_TTL_DAYS as string) *
      86400 * 1000,
    )

    await this.refreshTokenModel.create({
      userId: toObjectId(userId),
      tokenHash,
      familyId,
      isRevoked: false,
      expiresAt,
      deviceInfo: deviceInfo ?? null,
    })

    return { accessToken, refreshToken: rawRefresh }
  }

  async rotateRefreshToken(
    incomingRaw: string,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = this.hashToken(incomingRaw)
    const existing = await this.refreshTokenModel.findOne({ tokenHash: hash })

    // Token không tồn tại
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Reuse attack: token đã bị revoke trước đó
    if (existing.isRevoked) {
      await this.refreshTokenModel.updateMany(
        { familyId: existing.familyId },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'reuse_detected' },
      )
      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been revoked.',
      )
    }

    // Token hết hạn
    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired')
    }

    // Tạo cặp token mới
    const accessToken = this.signAccessToken(existing.userId.toString())
    const rawRefresh = this.generateRawToken()
    const newHash = this.hashToken(rawRefresh)
    const expiresAt = new Date(
      Date.now() +
      parseInt(REFRESH_TOKEN_TTL_DAYS as string) *
      86400 * 1000,
    )

    const newToken = await this.refreshTokenModel.create({
      userId: existing.userId,
      tokenHash: newHash,
      familyId: existing.familyId,   // kế thừa familyId
      isRevoked: false,
      expiresAt,
      deviceInfo: deviceInfo ?? existing.deviceInfo,
    })

    // Revoke token cũ, trỏ sang token mới
    await this.refreshTokenModel.findByIdAndUpdate(existing._id, {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: 'rotated',
      replacedByTokenId: newToken._id,
    })

    return { accessToken, refreshToken: rawRefresh }
  }

  async revokeRefreshToken(incomingRaw: string): Promise<void> {
    const hash = this.hashToken(incomingRaw)
    await this.refreshTokenModel.findOneAndUpdate(
      { tokenHash: hash },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'logout' },
    )
  }

  async revokeAllRefreshTokensByUser(userId: string): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId: toObjectId(userId), isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'manual_revoke' },
    )
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token);
  }
}
