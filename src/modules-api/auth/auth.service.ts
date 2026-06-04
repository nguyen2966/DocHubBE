import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcrypt'
import { TokenService } from '../../modules-system/token/token.service'
import { EmailService } from '../../modules-system/email/email.service'
import { User } from '../../modules-system/mongodb/schemas/users'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    })
    if (existing) {
      throw new ConflictException('Email already in use')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.userModel.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      passwordHash,
      isEmailVerified: false,
    })

    // Fire and forget — không await, không block response
    this.emailService
      .sendVerificationEmail(user._id.toString(), user.email)
      .catch((err) => {
        // Logger sẽ xử lý trong EmailProcessor, nhưng log thêm ở đây phòng
        // trường hợp lỗi xảy ra trước khi job được enqueue
        console.error('Failed to enqueue verification email', err)
      })

    return {
      message:
        'Register succeeed. Please check your email for account activation',
    }
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    await this.emailService.verifyEmailToken(rawToken)
    return { message: 'Email verification succeed. You can login' }
  }

  async login(
    dto: LoginDto,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: { id: string; email: string; fullName: string }
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
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
      },
    }
  }

  async refreshToken(
    incomingRefreshToken: string,
    deviceInfo?: { userAgent: string; ipAddress: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
      this.tokenService.revokeAccessToken(jti, expiresAt,'logout'),
      this.tokenService.revokeRefreshToken(refreshToken),
    ])
    return { message: 'Log out successfully.' }
  }
}