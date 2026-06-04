// Định nghĩa tên queue và job, dùng chung cho EmailService và EmailProcessor
export const EMAIL_QUEUE = 'email'

export const EmailJobName = {
  SEND_VERIFICATION: 'send_verification',
} as const

export interface SendVerificationEmailJob {
  to: string
  verificationUrl: string
}