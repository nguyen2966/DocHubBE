import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { type Request, type Response } from 'express'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { Public } from 'src/common/decorators/public.decorator'
import { ResendVerificationDto } from './dto/resend-verification.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  SIGNUP_NONCE_COOKIE_OPTIONS,
} from 'src/common/constants/cookie.constants'
import { APP_CLIENT_URL } from 'src/common/constants/app.constants'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @Public()
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto)

    res.cookie(
      'signupNonce',
      result.signupNonce,
      SIGNUP_NONCE_COOKIE_OPTIONS,
    )

    return { message: result.message }
  }

  @Public()
  @Get('verify-email')
  redirectLegacyVerifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const hash = token ? `#token=${encodeURIComponent(token)}` : ''

    return res.redirect(`${APP_CLIENT_URL}/verify-email${hash}`)
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: req.ip ?? '',
    }
    const signupNonce = req.cookies?.signupNonce
    const result = await this.authService.verifyEmail(
      dto.token,
      signupNonce,
      deviceInfo,
    )

    res.cookie('accessToken', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)
    res.clearCookie('signupNonce', SIGNUP_NONCE_COOKIE_OPTIONS)

    return {
      user: result.user,
      redirectTo: result.redirectTo,
      sessionStarted: true,
    }
  }

  @Post('login')
  @Public()
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: req.ip ?? '',
    }
    const result = await this.authService.login(dto, deviceInfo)

    res.cookie('accessToken', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS)
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS)

    return { user: result.user }
  }

  @Post('refresh-token')
  @Public()
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: req.ip ?? '',
    }
    const refreshToken = req.cookies?.refreshToken;
    
    const result = await this.authService.refreshToken(refreshToken, deviceInfo);

    res.cookie('accessToken', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return { message: 'Token refreshed' };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { jti, exp } = (req as any).tokenPayload
    const refreshToken = req.cookies?.refreshToken
    const result = await this.authService.logout(jti, exp, refreshToken)

    res.clearCookie('accessToken', ACCESS_TOKEN_COOKIE_OPTIONS)
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS)

    return result
  }

  @Get('me')
  async me(@Req() req: Request) {
    return { user: req['user'] }
  }

  @Public()
  @Post('resend-verification')
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
  ) {
    return this.authService.resendVerificationEmail(
      dto.email,
      req.cookies?.signupNonce,
    )
  }
}
