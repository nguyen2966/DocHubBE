import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { type Response, type Request } from 'express'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { Public } from 'src/common/decorators/public.decorator'
import { ResendVerificationDto } from './dto/resend-verification.dto'
import { ACCESS_TOKEN_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_OPTIONS } from 'src/common/constants/cookie.constants'
import { APP_CLIENT_URL } from 'src/common/constants/app.constants'


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    try {
      await this.authService.verifyEmail(token)
      return res.redirect(`${APP_CLIENT_URL}/welcome?status=success`)
    } catch {
      return res.redirect(`${APP_CLIENT_URL}/welcome?status=error`)
    }
  }

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: req.ip ?? '',
    }
    const result = await this.authService.login(dto, deviceInfo);
    res.cookie('accessToken', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return result;
  }

  @Post('refresh-token')
  @Public()
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] ?? '',
      ipAddress: req.ip ?? '',
    }
    const refreshToken = req.cookies?.refreshToken;
    const result = await this.authService.refreshToken(refreshToken, deviceInfo);
    res.cookie('accessToken', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return result;
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    // JwtAuthGuard đã attach user và decoded token vào req
    const { jti, exp, sub } = (req as any).tokenPayload;
    const refreshToken = req.cookies?.refreshToken;
    return this.authService.logout(jti, exp, refreshToken);
  }

  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email)
  }
}