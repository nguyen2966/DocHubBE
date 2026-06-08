import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { TokenService } from 'src/modules-system/token/token.service'
import { TokenPayload } from 'src/modules-system/token/token.type'
import { User } from 'src/modules-system/mongodb/schemas/users'

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return true
    }

    try {
      const payload: TokenPayload =
        this.tokenService.verifyAccessToken(accessToken);

      const isRevoked = await this.tokenService.isAccessTokenRevoked(payload.jti)
      if (isRevoked) {
        return true
      }

      const user = await this.userModel
        .findById(payload.sub)
        .select('-passwordHash')
        .lean();

      if (!user) {
        return true
      }

      req.user = user
      req.tokenPayload = payload

      return true;
    } catch {
      return true;
    }
  }
}