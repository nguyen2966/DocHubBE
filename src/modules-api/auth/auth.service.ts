import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { TokenService } from '../../modules-system/token/token.service'
import { EmailService } from '../../modules-system/email/email.service'
import { User } from '../../modules-system/mongodb/schemas/users'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { WorkspaceService } from '../workspace/workspace.service'

type AuthUserResponse = {
  _id: string
  email: string
  fullName: string
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly workspaceService: WorkspaceService,
  ) { }

  private hashValue(raw: string): string {
    return crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex')
  }

  private toAuthUser(user: User & { _id: any }): AuthUserResponse {
    return {
      _id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
    }
  }

  async register(dto: RegisterDto): Promise<{
    message: string
    signupNonce: string
  }> {
    const email = dto.email.toLowerCase()
    const existing = await this.userModel.findOne({ email })

    if (existing) {
      throw new ConflictException('Email already in use')
    }

    if (dto.invitationToken) {
      await this.workspaceService.validateInvitationForSignup(
        dto.invitationToken,
        email,
      )
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const signupNonce = crypto.randomBytes(32).toString('hex')
    const user = await this.userModel.create({
      fullName: dto.fullName,
      email,
      passwordHash,
      isEmailVerified: false,
    })

    this.emailService
      .sendVerificationEmail(user._id.toString(), user.email, {
        signupNonceHash: this.hashValue(signupNonce),
        invitationToken: dto.invitationToken ?? null,
      })
      .catch((err) => {
        console.error('Failed to enqueue verification email', err)
      })

    return {
      message:
        'Register succeeed. Please check your email for account activation',
      signupNonce,
    }
  }

  async verifyEmail(
    rawToken: string,
    signupNonce: string | undefined,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: AuthUserResponse
    redirectTo: string
  }> {
    if (!signupNonce) {
      throw new ForbiddenException(
        'Open this verification link in the same browser where you signed up',
      )
    }

    const payload =
      await this.emailService.validateAndConsumeEmailVerificationToken(
        rawToken,
        signupNonce,
      )

    const user = await this.userModel.findById(payload.userId)

    if (!user) {
      throw new BadRequestException('User not found after email verification')
    }

    const joinedWorkspaceIds =
      await this.workspaceService.claimPendingInvitations(
        payload.userId,
        user.email,
      )

    const { accessToken, refreshToken } =
      await this.tokenService.generateTokenPair(
        payload.userId,
        deviceInfo,
      )

    const firstWorkspaceId = joinedWorkspaceIds[0]

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user as User & { _id: any }),
      redirectTo: firstWorkspaceId
        ? `/workspaces/${firstWorkspaceId}/documents`
        : '/welcome?status=success',
    }
  }

  async login(
    dto: LoginDto,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: AuthUserResponse
  }> {
    const user = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Please verify by email before log in.',
      )
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash)

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const { accessToken, refreshToken } =
      await this.tokenService.generateTokenPair(
        user._id.toString(),
        deviceInfo,
      )

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user as User & { _id: any }),
    }
  }

  async refreshToken(
    incomingRefreshToken: string,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if(!incomingRefreshToken) throw new UnauthorizedException("Token not found");

    return this.tokenService.rotateRefreshToken(
      incomingRefreshToken,
      deviceInfo,
    )
  }

  async logout(
    jti: string,
    accessTokenExp: number,
    refreshToken: string,
  ): Promise<{ message: string }> {
    const expiresAt = new Date(accessTokenExp * 1000)
    await Promise.all([
      this.tokenService.revokeAccessToken(jti, expiresAt, 'logout'),
      this.tokenService.revokeRefreshToken(refreshToken),
    ])
    return { message: 'Log out successfully.' }
  }

  async resendVerificationEmail(
    email: string,
    signupNonce?: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() })

    if (!user || user.isEmailVerified) {
      return {
        message:
          'If the email exists and is not verified, a verification email will be sent shortly.',
      }
    }

    if (!signupNonce) {
      throw new ForbiddenException(
        'Resend verification from the same browser where you signed up',
      )
    }

    this.emailService
      .sendVerificationEmail(user._id.toString(), user.email, {
        signupNonceHash: this.hashValue(signupNonce),
      })
      .catch((err) =>
        console.error('Failed to enqueue resend verification email', err),
      )

    return {
      message:
        'If the email exists and is not verified, a verification email will be sent shortly.',
    }
  }
}
