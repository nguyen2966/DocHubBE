export const EMAIL_QUEUE = 'email'

export const EmailJobName = {
  SEND_VERIFICATION: 'send_verification',
  SEND_WORKSPACE_INVITATION: 'send_workspace_invitation',
} as const

export interface SendVerificationEmailJob {
  to: string
  verificationUrl: string
}

export interface SendWorkspaceInvitationEmailJob {
  to: string
  workspaceName: string
  inviterName?: string
  role: string
  invitationUrl: string
  isRegistered: boolean
}