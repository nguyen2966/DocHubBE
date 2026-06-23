import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as crypto from 'crypto'

import {
  EMAIL_QUEUE,
  EmailJobName,
  SendVerificationEmailJob,
  SendWorkspaceInvitationEmailJob,
} from './email.job'

import { User } from '../mongodb/schemas/users'
import { RedisService } from '../redis/redis.service'

import {
  APP_CLIENT_URL,
  EMAIL_VERIFY_TTL_MINUTES,
} from 'src/common/constants/app.constants'

interface EmailVerificationPayload {
  userId: string
  email: string
  signupNonceHash: string
  invitationToken?: string | null
}

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly redisService: RedisService,
  ) { }

  private hashToken(raw: string): string {
    return crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex')
  }

  private getTokenKey(tokenHash: string): string {
    return `email_verification:${tokenHash}`
  }

  private getUserKey(userId: string): string {
    return `email_verification_by_user:${userId}`
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
    options: {
      signupNonceHash: string
      invitationToken?: string | null
    },
  ): Promise<void> {
    const ttlSeconds = Number(EMAIL_VERIFY_TTL_MINUTES) * 60
    const userKey = this.getUserKey(userId)
    const oldTokenHash = await this.redisService.get(userKey)

    if (oldTokenHash) {
      await Promise.all([
        this.redisService.del(this.getTokenKey(oldTokenHash)),
        this.redisService.del(userKey),
      ])
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = this.hashToken(rawToken)

    const payload: EmailVerificationPayload = {
      userId,
      email,
      signupNonceHash: options.signupNonceHash,
      invitationToken: options.invitationToken ?? null,
    }

    await Promise.all([
      this.redisService.setJson(
        this.getTokenKey(tokenHash),
        payload,
        ttlSeconds,
      ),
      this.redisService.set(userKey, tokenHash, ttlSeconds),
    ])

    const verificationUrl = `${APP_CLIENT_URL}/verify-email#token=${rawToken}`

    await this.emailQueue.add(
      EmailJobName.SEND_VERIFICATION,
      {
        to: email,
        verificationUrl,
      } satisfies SendVerificationEmailJob,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
  }

  async validateAndConsumeEmailVerificationToken(
    rawToken: string,
    signupNonce: string,
  ): Promise<{
    userId: string
    email: string
    invitationToken?: string | null
  }> {
    const tokenHash = this.hashToken(rawToken)
    const tokenKey = this.getTokenKey(tokenHash)
    const payload =
      await this.redisService.getJson<EmailVerificationPayload>(tokenKey)

    if (!payload) {
      throw new BadRequestException('Invalid or expired verification token')
    }

    const signupNonceHash = this.hashToken(signupNonce)

    if (signupNonceHash !== payload.signupNonceHash) {
      throw new ForbiddenException(
        'Open this verification link in the same browser where you signed up',
      )
    }

    const consumedPayload =
      await this.redisService.getDelJson<EmailVerificationPayload>(tokenKey)

    if (
      !consumedPayload ||
      consumedPayload.userId !== payload.userId ||
      consumedPayload.signupNonceHash !== payload.signupNonceHash
    ) {
      throw new BadRequestException('Invalid or expired verification token')
    }

    const user = await this.userModel.findById(consumedPayload.userId)

    if (!user) {
      throw new BadRequestException('User not found')
    }

    if (!user.isEmailVerified) {
      user.isEmailVerified = true
      await user.save()
    }

    await this.redisService.del(this.getUserKey(consumedPayload.userId))

    return {
      userId: consumedPayload.userId,
      email: consumedPayload.email,
      invitationToken: consumedPayload.invitationToken ?? null,
    }
  }

  async resendVerificationEmail(
    userId: string,
    signupNonce: string,
  ): Promise<void> {
    const user = await this.userModel.findById(userId)

    if (!user) {
      throw new BadRequestException('User not found')
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified')
    }

    await this.sendVerificationEmail(
      user._id.toString(),
      user.email,
      {
        signupNonceHash: this.hashToken(signupNonce),
      },
    )
  }

  async revokeVerificationToken(
    userId: string,
  ): Promise<void> {
    const userKey = this.getUserKey(userId)
    const tokenHash = await this.redisService.get(userKey)

    if (!tokenHash) {
      return
    }

    await Promise.all([
      this.redisService.del(this.getTokenKey(tokenHash)),
      this.redisService.del(userKey),
    ])
  }

  async sendWorkspaceInvitationEmail(
    data: SendWorkspaceInvitationEmailJob,
  ): Promise<void> {
    await this.emailQueue.add(
      EmailJobName.SEND_WORKSPACE_INVITATION,
      data,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
  }
}
