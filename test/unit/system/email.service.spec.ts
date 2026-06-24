import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EmailService } from '../../../src/modules-system/email/email.service'
import { EmailJobName } from '../../../src/modules-system/email/email.job'

describe('EmailService', () => {
  const emailQueue = {
    add: jest.fn(),
  }
  const userModel = {
    findById: jest.fn(),
  }
  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
    setJson: jest.fn(),
    getJson: jest.fn(),
    getDelJson: jest.fn(),
    del: jest.fn(),
  }

  const service = () =>
    new EmailService(emailQueue as any, userModel as any, redisService as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('replaces old verification token and queues a verification email', async () => {
    redisService.get.mockResolvedValue('old-hash')

    await service().sendVerificationEmail('user-1', 'u@example.com', {
      signupNonceHash: 'nonce-hash',
      invitationToken: 'invite-1',
    })

    expect(redisService.del).toHaveBeenCalledWith('email_verification:old-hash')
    expect(redisService.del).toHaveBeenCalledWith('email_verification_by_user:user-1')
    expect(redisService.setJson).toHaveBeenCalledWith(
      expect.stringMatching(/^email_verification:/),
      expect.objectContaining({
        userId: 'user-1',
        email: 'u@example.com',
        signupNonceHash: 'nonce-hash',
        invitationToken: 'invite-1',
      }),
      expect.any(Number),
    )
    expect(emailQueue.add).toHaveBeenCalledWith(
      EmailJobName.SEND_VERIFICATION,
      expect.objectContaining({
        to: 'u@example.com',
        verificationUrl: expect.stringContaining('#token='),
      }),
      expect.any(Object),
    )
  })

  it('rejects invalid verification tokens', async () => {
    redisService.getJson.mockResolvedValue(null)

    await expect(
      service().validateAndConsumeEmailVerificationToken('raw-token', 'nonce'),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects verification from a different signup nonce', async () => {
    redisService.getJson.mockResolvedValue({
      userId: 'user-1',
      email: 'u@example.com',
      signupNonceHash: 'different-hash',
    })

    await expect(
      service().validateAndConsumeEmailVerificationToken('raw-token', 'nonce'),
    ).rejects.toThrow(ForbiddenException)
  })

  it('consumes a valid token and marks the user as verified', async () => {
    const user = {
      isEmailVerified: false,
      save: jest.fn(),
    }
    const payload = {
      userId: 'user-1',
      email: 'u@example.com',
      signupNonceHash:
        '78377b525757b494427f89014f97d79928f3938d14eb51e20fb5dec9834eb304',
      invitationToken: null,
    }
    redisService.getJson.mockResolvedValue(payload)
    redisService.getDelJson.mockResolvedValue(payload)
    userModel.findById.mockResolvedValue(user)

    await expect(
      service().validateAndConsumeEmailVerificationToken('raw-token', 'nonce'),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'u@example.com',
      invitationToken: null,
    })
    expect(user.isEmailVerified).toBe(true)
    expect(user.save).toHaveBeenCalled()
    expect(redisService.del).toHaveBeenCalledWith('email_verification_by_user:user-1')
  })

  it('queues workspace invitation emails', async () => {
    const data = {
      to: 'u@example.com',
      workspaceName: 'Workspace',
      inviterName: 'Inviter',
      role: 'member',
      invitationUrl: 'http://example.test/invite',
      isRegistered: true,
    }

    await service().sendWorkspaceInvitationEmail(data)

    expect(emailQueue.add).toHaveBeenCalledWith(
      EmailJobName.SEND_WORKSPACE_INVITATION,
      data,
      expect.any(Object),
    )
  })
})
