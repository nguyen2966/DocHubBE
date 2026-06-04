import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { TokenExpiredError } from 'jsonwebtoken'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { TokenService } from 'src/modules-system/token/token.service'
import { TokenPayload } from 'src/modules-system/token/token.type'
import { User } from 'src/modules-system/mongodb/schemas/users'

@Injectable()
export class ProtectGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const { accessToken } = req.cookies

    if (!accessToken) {
      throw new UnauthorizedException('Access token not found')
    }

    try {
      // 1. Verify chữ ký và hạn của token
      const payload: TokenPayload = this.tokenService.verifyAccessToken(accessToken)

      // 2. Kiểm tra blacklist — token bị revoke sau logout hoặc bị lộ
      const isRevoked = await this.tokenService.isAccessTokenRevoked(payload.jti)
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked')
      }

      // 3. Tìm user trong DB — đảm bảo account vẫn tồn tại và chưa bị khoá
      const user = await this.userModel
        .findById(payload.sub)
        .select('-passwordHash')
        .lean()

      if (!user) {
        throw new UnauthorizedException('User not found')
      }

      // 4. Attach vào request để các handler và service phía sau dùng
      //    - user: dùng cho business logic
      //    - tokenPayload: dùng riêng cho logout (cần jti và exp)
      req.user = user
      req.tokenPayload = payload

      return true
    } catch (error: any) {
      if (error instanceof TokenExpiredError) {
        throw new ForbiddenException('Access token expired')
      }
      // Ném lại các lỗi đã được format sẵn (Unauthorized, Forbidden từ trên)
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error
      }
      // Lỗi không xác định (token malformed, DB lỗi, v.v.)
      throw new UnauthorizedException('Authentication failed')
    }
  }
}