import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from 'src/modules-system/token/token.service';
import { TokenPayload } from 'src/modules-system/token/token.type';
import { TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class ProtectGuard implements CanActivate {
    constructor(private reflector: Reflector, private tokenService: TokenService) {}
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const req = context.switchToHttp().getRequest();
    const { accessToken } = req.cookies;

    try {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])
        if (isPublic){
            return true;
        }


        if (!accessToken) throw new UnauthorizedException("Not Found Token");

        const decode: TokenPayload = this.tokenService.verifyAccessToken(accessToken);

        //Tìm user trong DB ở đây
        let user = "";
        req.user = user;

        if (!user) throw new UnauthorizedException("Xác thực thất bại");
        return true;
    } catch (error: any){
        console.log({error})
        switch (error.constructor) {
            case TokenExpiredError:
                throw new ForbiddenException(error.message);
                break;
        
            default:
                throw new UnauthorizedException("Authentication Error")
                break;
        }
    }
  }
}
