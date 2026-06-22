import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import {
  EMAIL_QUEUE,
  EmailJobName,
  SendVerificationEmailJob,
  SendWorkspaceInvitationEmailJob
} from './email.job'
import { EMAIL_VERIFY_TTL_MINUTES, MAIL_FROM_ADDRESS, MAIL_FROM_NAME, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_SECURE, SMTP_USER } from 'src/common/constants/app.constants'

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name)
  private transporter: nodemailer.Transporter

  constructor() {
    super()
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT as string),
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EmailJobName.SEND_VERIFICATION:
        await this.handleSendVerification(job.data as SendVerificationEmailJob)
        break
      case EmailJobName.SEND_WORKSPACE_INVITATION:
        await this.handleSendWorkspaceInvitation(
          job.data as SendWorkspaceInvitationEmailJob,
        )
        break
      default:
        this.logger.warn(`Unknown job name: ${job.name}`)
    }
  }

  private async handleSendVerification(
    data: SendVerificationEmailJob,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
        to: data.to,
        subject: 'Verify your DocHub account',
        html: `
          <p>Hi,</p>
          <p>Click the button below to verify your account:</p>
          <a href="${data.verificationUrl}">
            <button style="background-color:green;color:white;padding:10px 10px">Verify</button>
          </a>
          <p>The link is active in ${EMAIL_VERIFY_TTL_MINUTES ?? 60} minutes.</p>
        `,
      })
      this.logger.log(`Verification email sent to ${data.to}`)
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${data.to}`,
        error,
      )
      throw error  // throw để BullMQ retry theo cấu hình attempts
    }
  }

  private async handleSendWorkspaceInvitation(
    data: SendWorkspaceInvitationEmailJob,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
        to: data.to,
        subject: `You are invited to join ${data.workspaceName}`,
        html: `
        <p>Hi,</p>
        <p>
          ${data.inviterName ?? 'Someone'} invited you to join
          <b>${data.workspaceName}</b> as <b>${data.role}</b>.
        </p>
        <a href="${data.invitationUrl}">
          <button style="background-color:green;color:white;padding:10px 10px">
            Accept invitation
          </button>
        </a>
        <p>This invitation link will expire soon.</p>
      `,
      })

      this.logger.log(`Workspace invitation email sent to ${data.to}`)
    } catch (error) {
      this.logger.error(
        `Failed to send workspace invitation email to ${data.to}`,
        error,
      )
      throw error
    }
  }
}
