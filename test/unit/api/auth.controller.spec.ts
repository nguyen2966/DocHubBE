jest.mock('../../../src/modules-api/auth/auth.service', () => ({
  AuthService: class AuthService {},
}))

import { AuthController } from '../../../src/modules-api/auth/auth.controller'
import { createResponseMock } from '../helpers'

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    resendVerificationEmail: jest.fn(),
  }

  const controller = () => new AuthController(authService as any)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('registers and stores signup nonce in a cookie without returning it', async () => {
    authService.register.mockResolvedValue({
      message: 'registered',
      signupNonce: 'nonce',
    })
    const res = createResponseMock()

    await expect(
      controller().register(
        { email: 'user@example.com', password: 'password', fullName: 'User' } as any,
        res as any,
      ),
    ).resolves.toEqual({ message: 'registered' })

    expect(res.cookie).toHaveBeenCalledWith('signupNonce', 'nonce', expect.any(Object))
  })

  it('verifies email, sets auth cookies, and clears signup nonce', async () => {
    authService.verifyEmail.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { _id: 'user-1' },
      redirectTo: '/welcome',
    })
    const req = {
      headers: { 'user-agent': 'ua' },
      ip: 'ip',
      cookies: { signupNonce: 'nonce' },
    }
    const res = createResponseMock()

    await expect(controller().verifyEmail({ token: 'token' }, req as any, res as any)).resolves.toEqual({
      user: { _id: 'user-1' },
      redirectTo: '/welcome',
      sessionStarted: true,
    })
    expect(authService.verifyEmail).toHaveBeenCalledWith('token', 'nonce', {
      userAgent: 'ua',
      ipAddress: 'ip',
    })
    expect(res.cookie).toHaveBeenCalledTimes(2)
    expect(res.clearCookie).toHaveBeenCalledWith('signupNonce', expect.any(Object))
  })

  it('logs in and sets auth cookies', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { _id: 'user-1' },
    })
    const req = { headers: {}, ip: undefined }
    const res = createResponseMock()

    await expect(controller().login({ email: 'u@example.com', password: 'p' }, req as any, res as any)).resolves.toEqual({
      user: { _id: 'user-1' },
    })
    expect(res.cookie).toHaveBeenCalledWith('accessToken', 'access', expect.any(Object))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh', expect.any(Object))
  })

  it('refreshes token from cookie and rotates auth cookies', async () => {
    authService.refreshToken.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
    const req = {
      cookies: { refreshToken: 'old-refresh' },
      headers: { 'user-agent': 'ua' },
      ip: 'ip',
    }
    const res = createResponseMock()

    await expect(controller().refreshToken(req as any, res as any)).resolves.toEqual({
      message: 'Token refreshed',
    })
    expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh', {
      userAgent: 'ua',
      ipAddress: 'ip',
    })
    expect(res.cookie).toHaveBeenCalledWith('accessToken', 'new-access', expect.any(Object))
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'new-refresh', expect.any(Object))
  })

  it('logs out and clears auth cookies', async () => {
    authService.logout.mockResolvedValue({ message: 'ok' })
    const req = {
      tokenPayload: { jti: 'jti', exp: 123 },
      cookies: { refreshToken: 'refresh' },
    }
    const res = createResponseMock()

    await expect(controller().logout(req as any, res as any)).resolves.toEqual({ message: 'ok' })
    expect(authService.logout).toHaveBeenCalledWith('jti', 123, 'refresh')
    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', expect.any(Object))
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object))
  })
})
