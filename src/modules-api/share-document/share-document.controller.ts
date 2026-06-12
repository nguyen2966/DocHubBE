import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { WorkspacePermissionGuard } from '../../modules-system/permissions/guards/workspace-permission.guard';
import { DocumentPermissionGuard } from '../../modules-system/permissions/guards/document-permission.guard';
import { RequireDocumentPermissions } from 'src/modules-system/permissions/decorators/require-document-permission.decorator';
import { ShareDocumentDto, UpdateDocumentRoleDto } from './dto/share-document.dto';
import { ShareDocumentService } from './share-document.service';

@Controller('workspaces/:workspaceId/documents/:documentId')
@UseGuards(WorkspacePermissionGuard, DocumentPermissionGuard)
@RequireDocumentPermissions('document:manage_access')
export class ShareDocumentController {
  constructor(private readonly shareDocumentService: ShareDocumentService) {}

  // GET /workspaces/:workspaceId/documents/:documentId/access
  @Get('access')
  getAccess(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.shareDocumentService.getDocumentAccess(documentId, workspaceId);
  }

  // GET /workspaces/:workspaceId/documents/:documentId/users/search?email=
  @Get('users/search')
  searchUsers(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
    @Query('email') email: string,
  ) {
    return this.shareDocumentService.searchUsersWithContext(documentId, workspaceId, email);
  }

  // POST /workspaces/:workspaceId/documents/:documentId/members
  @Post('members')
  share(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ShareDocumentDto,
    @Req() req: any,
  ) {
    return this.shareDocumentService.shareDocument(
      documentId,
      workspaceId,
      req.user._id.toString(),
      dto,
    );
  }

  // PATCH /workspaces/:workspaceId/documents/:documentId/members/:userId
  @Patch('members/:userId')
  updateRole(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateDocumentRoleDto,
  ) {
    return this.shareDocumentService.updateRole(documentId, userId, dto);
  }

  // DELETE /workspaces/:workspaceId/documents/:documentId/members/:userId
  @Delete('members/:userId')
  removeAccess(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
  ) {
    return this.shareDocumentService.removeAccess(documentId, userId);
  }
}