import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

import {
  EMAIL_QUEUE,
  EmailJobName,
  SendVerificationEmailJob,
  SendWorkspaceInvitationEmailJob
} from './email.job';

import { User } from '../mongodb/schemas/users';
import { RedisService } from '../redis/redis.service';

import {
  APP_URL,
  EMAIL_VERIFY_TTL_MINUTES,
} from 'src/common/constants/app.constants';

interface EmailVerificationPayload {
  userId: string;
  email: string;
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
      .digest('hex');
  }

  private getTokenKey(tokenHash: string): string {
    return `email_verification:${tokenHash}`;
  }

  private getUserKey(userId: string): string {
    return `email_verification_by_user:${userId}`;
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    const ttlSeconds =
      Number(EMAIL_VERIFY_TTL_MINUTES) * 60;

    const userKey = this.getUserKey(userId);

    /**
     * Revoke token cũ nếu có
     */
    const oldTokenHash =
      await this.redisService.get(userKey);

    if (oldTokenHash) {
      await Promise.all([
        this.redisService.del(
          this.getTokenKey(oldTokenHash),
        ),
        this.redisService.del(userKey),
      ]);
    }

    /**
     * Tạo token mới
     */
    const rawToken =
      crypto.randomBytes(32).toString('hex');

    const tokenHash =
      this.hashToken(rawToken);

    const payload: EmailVerificationPayload = {
      userId,
      email,
    };

    /**
     * Lưu Redis
     */
    await Promise.all([
      this.redisService.setJson(
        this.getTokenKey(tokenHash),
        payload,
        ttlSeconds,
      ),

      this.redisService.set(
        userKey,
        tokenHash,
        ttlSeconds,
      ),
    ]);

    /**
     * Tạo link verify
     */
    const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${rawToken}`;

    /**
     * Enqueue email
     */
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
    );
  }

  async verifyEmailToken(
    rawToken: string,
  ): Promise<string> {
    const tokenHash =
      this.hashToken(rawToken);

    const payload =
      await this.redisService.getJson<EmailVerificationPayload>(
        this.getTokenKey(tokenHash),
      );

    if (!payload) {
      throw new BadRequestException(
        'Invalid or expired verification token',
      );
    }

    const user =
      await this.userModel.findById(
        payload.userId,
      );

    if (!user) {
      throw new BadRequestException(
        'User not found',
      );
    }

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    /**
     * Token dùng một lần
     */
    await Promise.all([
      this.redisService.del(
        this.getTokenKey(tokenHash),
      ),

      this.redisService.del(
        this.getUserKey(payload.userId),
      ),
    ]);

    return payload.userId;
  }

  async resendVerificationEmail(
    userId: string,
  ): Promise<void> {
    const user =
      await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException(
        'User not found',
      );
    }

    if (user.isEmailVerified) {
      throw new BadRequestException(
        'Email already verified',
      );
    }

    await this.sendVerificationEmail(
      user._id.toString(),
      user.email,
    );
  }

  async revokeVerificationToken(
    userId: string,
  ): Promise<void> {
    const userKey =
      this.getUserKey(userId);

    const tokenHash =
      await this.redisService.get(userKey);

    if (!tokenHash) {
      return;
    }

    await Promise.all([
      this.redisService.del(
        this.getTokenKey(tokenHash),
      ),
      this.redisService.del(userKey),
    ]);
  }

  async sendWorkspaceInvitationEmail(data: SendWorkspaceInvitationEmailJob): Promise<void> {
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