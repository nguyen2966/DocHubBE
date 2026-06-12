import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionsService } from '../permissions.service'

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(
        'workspace_permissions',
        [context.getHandler(), context.getClass()],
      )

    if (!requiredPermissions?.length) return true

    const req = context.switchToHttp().getRequest()

    const userId = req.user?._id?.toString()
    if (!userId) {
      throw new UnauthorizedException()
    }

    const workspaceId = req.params.workspaceId
    if (!workspaceId) {
      throw new BadRequestException('Missing workspaceId')
    }

    const allowed = await Promise.all(
      requiredPermissions.map((permission) =>
        this.permissionsService.canWorkspace(
          userId,
          workspaceId,
          permission,
        ),
      ),
    );

   // console.log("Guard passed:")
    //console.log(allowed);

    if (!allowed.every(Boolean)) {
      throw new ForbiddenException(
        'You do not have permission to access this workspace resource',
      )
    }

    return true
  }
}