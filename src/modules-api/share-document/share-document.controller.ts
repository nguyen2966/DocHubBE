import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkspacePermissionGuard } from '../../modules-system/permissions/guards/workspace-permission.guard';
import { DocumentPermissionGuard } from '../../modules-system/permissions/guards/document-permission.guard';
import { RequireDocumentPermissions } from 'src/modules-system/permissions/decorators/require-document-permission.decorator';
import { ShareDocumentDto, UpdateDocumentRoleDto } from './dto/share-document.dto';
import { ShareDocumentService } from './share-document.service';
import { ApiParam } from '@nestjs/swagger';

@Controller('workspaces/:workspaceId/documents/:documentId')
@UseGuards(WorkspacePermissionGuard, DocumentPermissionGuard)
@RequireDocumentPermissions('document:manage_access')
export class ShareDocumentController {
  constructor(private readonly shareDocumentService: ShareDocumentService) { }

  @Get('access')
  async getAccess(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.shareDocumentService.getDocumentAccess(documentId, workspaceId);
  }

  @Get('users/search')
  searchUsers(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
    @Query('email') email: string,
  ) {
    return this.shareDocumentService.searchUsersWithContext(
      documentId,
      workspaceId,
      email,
    );
  }

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

  @Patch('members/:userId')
  updateRole(
    @Param('documentId') documentId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateDocumentRoleDto,
  ) {
    return this.shareDocumentService.updateRole(
      documentId,
      workspaceId,
      userId,
      dto,
    );
  }

  @Delete('members/:userId')
  @ApiParam({ name: 'workspaceId', required: true, type: String })
  @ApiParam({ name: 'documentId', required: true, type: String })
  @ApiParam({ name: 'userId', required: true, type: String })
  removeAccess(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
  ) {
    return this.shareDocumentService.removeAccess(documentId, workspaceId, userId);
  }
}