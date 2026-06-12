// src/modules-system/permissions/guards/document-permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { DOCUMENT_PERMISSIONS_KEY } from '../decorators/require-document-permission.decorator';

@Injectable()
export class DocumentPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      DOCUMENT_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.log(requiredPermissions);

    if (!requiredPermissions?.length) return true

    const req = context.switchToHttp().getRequest()
    const userId = req.user?._id?.toString()
    if (!userId) throw new UnauthorizedException()

    const { workspaceId, documentId } = req.params;
    if (!workspaceId) throw new BadRequestException('Missing workspaceId');
    if (!documentId) throw new BadRequestException('Missing documentId');

    const results = await Promise.all(
      requiredPermissions.map((perm) =>
        this.permissionsService.canDocument(userId, workspaceId, documentId, perm),
      ),
    );

    console.log(results);

    if (!results.every(Boolean)) {
      throw new ForbiddenException('You do not have permission to perform this action on the document')
    }

    return true
  }
}