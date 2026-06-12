import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req, UploadedFile, UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspacePermissionGuard } from '../../modules-system/permissions/guards/workspace-permission.guard';
import { DocumentPermissionGuard } from '../../modules-system/permissions/guards/document-permission.guard';
import { RequireWorkspacePermission } from 'src/modules-system/permissions/decorators/require-workspace-permission.decorator';
import { RequireDocumentPermissions } from 'src/modules-system/permissions/decorators/require-document-permission.decorator';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { UploadPdfDto } from './dto/upload-pdf.dto';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RenameDocumentDto } from './dto/rename-document.dto';
import { type Request } from 'express';
import { PermissionsService } from 'src/modules-system/permissions/permissions.service';
import { UploadJobService } from './upload-job.service';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(WorkspacePermissionGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService,
    private readonly permissionsService: PermissionsService,
    private readonly uploadJobService: UploadJobService
  ) { }

  // 1. Markdown Flow
  @Post()
  @RequireWorkspacePermission('workspace:create_document')
  createMarkdown(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: any
  ) {
    if (dto.sourceType !== 'md_editor') {
      throw new BadRequestException('Invalid source type for this endpoint');
    }
    return this.documentService.createMarkdown(workspaceId, req.user._id.toString(), dto);
  }

  // 2. PDF Upload Flow
  @Post('upload')
  @RequireWorkspacePermission('workspace:create_document')
  @ApiConsumes('multipart/form-data') // Khai báo nhận form-data chứa file
  @ApiBody({
    description: 'Upload file PDF kèm theo thông tin tài liệu',
    type: UploadPdfDto,
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 }, // Max 20MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Only accept PDF'), false);
      }
      cb(null, true);
    }
  }))
  async uploadPdf(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPdfDto, // Sử dụng DTO mới tạo
    @Req() req: any
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!dto.jobId) throw new BadRequestException('jobId is required')

    // Tạo job trước → trả jobId về frontend ngay
    const jobId = dto.jobId;
    // Lấy title từ dto, nếu không có thì lấy tên gốc của file (bỏ đuôi .pdf)
    const title = dto.title || file.originalname.replace(/\.pdf$/i, '');

    return this.documentService.uploadPdf(workspaceId, req.user._id.toString(), file, title, jobId);
  }

  @Post('upload-jobs')
  @RequireWorkspacePermission('workspace:create_document')
  async createUploadJob(
    @Param('workspaceId') workspaceId: string,
  ) {
    const jobId = await this.uploadJobService.create(workspaceId);

    return { jobId }
  }

  @Delete('upload/:jobId/cancel')
  @RequireWorkspacePermission('workspace:create_document')
  cancelUpload(
    @Param('workspaceId') workspaceId: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ) {
    return this.documentService.cancelUpload(
      jobId,
      workspaceId,
      req.user._id.toString(),
    )
  }

  @Patch(':documentId/content')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:edit')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Edited PDF exported from Apryse' })
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Only PDF files are accepted'), false);
      }
      cb(null, true);
    },
  }))
  editPdf(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documentService.editPdf(documentId, file.buffer);
  }

  // Lấy danh sách
  @Get()
  @RequireWorkspacePermission('workspace:view')
  async findAll(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const userId = req.user?._id.toString();

    // 1. Lấy danh sách documents gốc từ service
    const documents = await this.documentService.findByWorkspace(workspaceId);

    if (!documents || documents.length === 0) {
      return [];
    }

    // 2. Gom toàn bộ Document ID lại thành mảng
    const docIds = documents.map(doc => doc._id.toString());

    // 3. Tính toán permission một lần cho tất cả (chống N+1 query)
    const permissionsMap = await this.permissionsService.getBulkDocumentPermissions(
      userId as string,
      workspaceId,
      docIds
    );

    // 4. Map data trả về cho Frontend
    return documents.map(doc => ({
      ...doc,
      permissions: permissionsMap[doc._id.toString()] || [],
    }));
  }

  // Xem document
  @Get(':documentId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:view')
  async findOne(@Param('documentId') documentId: string, @Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const userId = req.user?._id.toString();

    // 1. Lấy dữ liệu metadata của tài liệu từ Database
    const documentData = await this.documentService.findById(documentId);

    // 2. Tra cứu mảng quyền cụ thể của người dùng này đối với tài liệu hiện tại
    const allowedPermissions = await this.permissionsService.getAvailableDocumentPermissions(
      userId as string,
      workspaceId,
      documentId,
    );

    // 3. Gộp quyền vào payload trả về cho Frontend
    return {
      ...documentData,
      permissions: allowedPermissions, // Dạng: ["document:view", "document:edit", "document:comment"]
    };
  }

  // Đổi tên
  @Patch(':documentId/rename')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:rename')
  @ApiBody({ type: RenameDocumentDto })
  rename(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Body() body: RenameDocumentDto,
  ) {
    return this.documentService.rename(documentId, workspaceId, body)
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
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ShareDocumentDto,
    @Req() req: any,
  ) {
    return this.documentService.shareDocument(documentId, workspaceId, req.user._id.toString(), dto)
  }

  // Xóa quyền truy cập
  @Delete(':documentId/members/:userId')
  @UseGuards(DocumentPermissionGuard)
  @RequireDocumentPermissions('document:manage_access')
  removeAccess(
    @Param('documentId') documentId: string,
    @Param('userId') userId: string,
    @Param('workspaceId') workspaceId: string
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