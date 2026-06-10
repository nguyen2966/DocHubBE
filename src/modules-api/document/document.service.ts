// src/modules-api/document/document.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RenameDocumentDto } from './dto/rename-document.dto';


@Injectable()
export class DocumentService {
  constructor(
    @InjectModel('Document')
    private documentModel: Model<any>,
    @InjectModel('DocumentPermission')
    private documentPermissionModel: Model<any>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
    @InjectQueue('document-processing') 
    private readonly documentQueue: Queue, // Inject Queue
  ) { }

  // Flow 1: Create Markdown
  async createMarkdown(workspaceId: string, ownerId: string, dto: CreateDocumentDto) {
    const title = await this.resolveTitle(workspaceId, dto.title);

    const doc = await this.documentModel.create({
      workspaceId,
      ownerId,
      title,
      sourceType: 'md_editor',
      markdownContent: dto.markdownContent,
      processingStatus: 'processed', // Markdown is instantly processed
    });

    await this.assignOwner(doc._id, ownerId);
    return doc;
  }

  // Flow 2: Upload PDF
  async uploadPdf(workspaceId: string, ownerId: string, file: Express.Multer.File, titleInput: string) {
    const title = await this.resolveTitle(workspaceId, titleInput);

    // TODO: In a real environment, you upload 'file.buffer' to S3 here
    // const s3Result = await this.s3Service.upload(file);
    const mockFileUrl = 'https://mock-storage/file.pdf';
    const mockStorageKey = 'uploads/file.pdf';

    const doc = await this.documentModel.create({
      workspaceId,
      ownerId,
      title,
      sourceType: 'file_upload',
      pdfFileUrl: mockFileUrl,
      pdfStorageKey: mockStorageKey,
      fileSize: file.size,
      processingStatus: 'processing', // Marks as processing for UI loaders
    });

    await this.assignOwner(doc._id, ownerId);

    // Push extraction task to background Queue
    await this.documentQueue.add('extract-pdf', {
      documentId: doc._id.toString(),
      // ARCHITECTURE NOTE: For small files, passing base64 is okay. 
      // For 20MB files, Redis memory will spike. Best practice is to pass the 'mockStorageKey' 
      // and have the Worker download it directly from S3.
      fileBuffer: file.buffer.toString('base64'),
    });

    return doc;
  }

  private async assignOwner(documentId: any, userId: string) {
    await this.documentPermissionModel.create({
      documentId,
      userId,
      role: 'owner',
      grantedBy: userId,
    });
  }

  async findById(documentId: string) {
    const doc = await this.documentModel.findById(documentId).populate('ownerId', 'fullName').lean();
    if (!doc) throw new NotFoundException('Document not found');
    return doc
  }

  async findByWorkspace(workspaceId: string) {
    return this.documentModel
      .find({ workspaceId })
      .populate('ownerId', 'fullName')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async rename(documentId: string, workspaceId: string, body: RenameDocumentDto) {
    const { title } = body;
    const resolved = await this.resolveTitle(workspaceId, title, documentId)
    return this.documentModel.findByIdAndUpdate(
      documentId,
      { title: resolved },
      { new: true },
    )
  }

  async delete(documentId: string) {
    await this.documentModel.findByIdAndDelete(documentId)
    // Annotations và comments được xử lý bởi cascade hoặc scheduled job
  }

  // Inside DocumentService -> shareDocument
  async shareDocument(documentId: string, workspaceId: string, grantedBy: string, dto: ShareDocumentDto) {
    // Rule 3: Prevent sharing to existing workspace members
    const existingMember = await this.memberModel.findOne({
      workspaceId,
      userId: dto.userId,
      isDeleted: false
    });

    if (existingMember) {
      throw new ConflictException('Cannot share document with existing workspace members. They already have access.');
    }

    // Rule 4: Safely upsert for external users
    return this.documentPermissionModel.findOneAndUpdate(
      { documentId, userId: dto.userId },
      { role: dto.role, grantedBy },
      { upsert: true, new: true },
    );
  }

  async removeAccess(documentId: string, userId: string) {
    // Không cho remove owner
    const perm = await this.documentPermissionModel.findOne({ documentId, userId })
    if (perm?.role === 'owner') throw new ConflictException('Cannot remove document owner')
    await this.documentPermissionModel.deleteOne({ documentId, userId })
  }

  async getMembers(documentId: string) {
    return this.documentPermissionModel
      .find({ documentId })
      .populate('userId', 'name email avatar')
      .lean();
  }

  private async resolveTitle(workspaceId: string, title: string, excludeId?: string) {
    let candidate = title
    let suffix = 0

    while (true) {
      const query: any = { workspaceId, title: candidate };
      if (excludeId) query._id = { $ne: excludeId }
      const existing = await this.documentModel.findOne(query).lean();
      if (!existing) return candidate;
      suffix++;
      candidate = `${title} (${suffix})`;
    }
  }
}