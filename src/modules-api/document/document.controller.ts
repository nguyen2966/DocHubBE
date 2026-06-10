import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { WorkspacePermissionGuard } from '../../modules-system/permissions/guards/workspace-permission.guard'
import { DocumentPermissionGuard } from '../../modules-system/permissions/guards/document-permission.guard'
import { RequireWorkspacePermission } from 'src/modules-system/permissions/decorators/require-workspace-permission.decorator';
import { RequireDocumentPermissions } from 'src/modules-system/permissions/decorators/require-document-permission.decorator';
import { DocumentService } from './document.service'
import { CreateDocumentDto } from './dto/create-document.dto'
import { ShareDocumentDto } from './dto/share-document.dto'

@Controller('workspaces/:workspaceId/documents')
@UseGuards(WorkspacePermissionGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // Tạo document bằng markdown
  @Post()
  @RequireWorkspacePermission('workspace:create_document')
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateDocumentDto, @Req() req: any) {
    // pdfInfo được truyền từ service sau khi render markdown → PDF
    return this.documentService.create(workspaceId, req.user._id.toString(), dto, {
      pdfFileUrl: '',       // filled after markdown render
      pdfStorageKey: '',
      fileSize: 0,
    })
  }

  // Upload PDF
  @Post('upload')
  @RequireWorkspacePermission('workspace:create_document')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Param('workspaceId') workspaceId: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    // Xử lý PDF upload trong service, truyền kết quả vào create
    return this.documentService.create(workspaceId, req.user._id.toString(), {
      title: file.originalname.replace(/\.pdf$/i, ''),
      sourceType: 'file_upload',
    }, {
      pdfFileUrl: '',       // filled after storage upload
      pdfStorageKey: '',
      fileSize: file.size,
    })
  }

  // Lấy danh sách
  @Get()
  @RequireWorkspacePermission('workspace:view')
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.documentService.findByWorkspace(workspaceId)
  }

  // Xem document
  @Get(':documentId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  findOne(@Param('documentId') documentId: string) {
    return this.documentService.findById(documentId)
  }

  // Đổi tên
  @Patch(':documentId/rename')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:rename')
  rename(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Body('title') title: string,
  ) {
    return this.documentService.rename(documentId, workspaceId, title)
  }

  // Xóa document
  @Delete(':documentId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:delete')
  remove(@Param('documentId') documentId: string) {
    return this.documentService.delete(documentId)
  }

  // Chia sẻ document
  @Post(':documentId/members')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:manage_access')
  share(
    @Param('documentId') documentId: string,
    @Body() dto: ShareDocumentDto,
    @Req() req: any,
  ) {
    return this.documentService.shareDocument(documentId, req.user._id.toString(), dto)
  }

  // Xóa quyền truy cập
  @Delete(':documentId/members/:userId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:manage_access')
  removeAccess(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
  ) {
    return this.documentService.removeAccess(documentId, userId)
  }

  // Lấy danh sách thành viên có quyền
  @Get(':documentId/members')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:manage_access')
  getMembers(@Param('documentId') documentId: string) {
    return this.documentService.getMembers(documentId)
  }
}