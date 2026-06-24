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
          <div style="margin:0;padding:0;background-color:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#111111;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f6f5f2;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background-color:#ffffff;border:1px solid #e8e5df;border-radius:12px;">
                    <tr>
                      <td style="padding:32px 32px 8px 32px;">
                        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#111111;">Folio</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 32px 0 32px;">
                        <h1 style="margin:0;font-size:28px;line-height:34px;font-weight:700;color:#111111;">Verify your email</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 32px 0 32px;">
                        <p style="margin:0;font-size:16px;line-height:24px;color:#4a4a4a;">Hi,</p>
                        <p style="margin:12px 0 0 0;font-size:16px;line-height:24px;color:#4a4a4a;">Confirm this email address to finish setting up your account.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px 0 32px;">
                        <a href="${data.verificationUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:8px;">Verify email</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 32px 32px;">
                        <p style="margin:0;font-size:14px;line-height:22px;color:#6f6f6f;">This link is active for ${EMAIL_VERIFY_TTL_MINUTES ?? 60} minutes.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
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
          <div style="margin:0;padding:0;background-color:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#111111;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f6f5f2;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background-color:#ffffff;border:1px solid #e8e5df;border-radius:12px;">
                    <tr>
                      <td style="padding:32px 32px 8px 32px;">
                        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#111111;">Folio</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 32px 0 32px;">
                        <h1 style="margin:0;font-size:28px;line-height:34px;font-weight:700;color:#111111;">Join ${data.workspaceName}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 32px 0 32px;">
                        <p style="margin:0;font-size:16px;line-height:24px;color:#4a4a4a;">Hi,</p>
                        <p style="margin:12px 0 0 0;font-size:16px;line-height:24px;color:#4a4a4a;">${data.inviterName ?? 'Someone'} invited you to join <strong style="color:#111111;">${data.workspaceName}</strong> as <strong style="color:#111111;">${data.role}</strong>.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px 0 32px;">
                        <a href="${data.invitationUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:8px;">Accept invitation</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 32px 32px 32px;">
                        <p style="margin:0;font-size:14px;line-height:22px;color:#6f6f6f;">This invitation link will expire soon.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
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
