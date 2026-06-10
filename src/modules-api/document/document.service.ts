// src/modules-api/document/document.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { CreateDocumentDto } from './dto/create-document.dto'
import { ShareDocumentDto } from './dto/share-document.dto'


@Injectable()
export class DocumentService {
  constructor(
    @InjectModel('Document') private documentModel: Model<any>,
    @InjectModel('DocumentPermission') private documentPermissionModel: Model<any>,
  ) {}

  async create(workspaceId: string, ownerId: string, dto: CreateDocumentDto, pdfInfo: {
    pdfFileUrl: string
    pdfStorageKey: string
    fileSize: number
    extractedTextPreview?: string
    extractedTextCharCount?: number
    isExtractedTextTruncated?: boolean
    processingStatus?: string
  }) {
    // Resolve duplicate title trong workspace
    const title = await this.resolveTitle(workspaceId, dto.title)

    const doc = await this.documentModel.create({
      workspaceId,
      ownerId,
      title,
      sourceType: dto.sourceType,
      markdownContent: dto.markdownContent ?? null,
      ...pdfInfo,
    })

    // Auto-assign owner permission
    await this.documentPermissionModel.create({
      documentId: doc._id,
      userId: ownerId,
      role: 'owner',
      grantedBy: ownerId,
    })

    return doc
  }

  async findById(documentId: string) {
    const doc = await this.documentModel.findById(documentId).lean()
    if (!doc) throw new NotFoundException('Document not found')
    return doc
  }

  async findByWorkspace(workspaceId: string) {
    return this.documentModel
      .find({ workspaceId })
      .sort({ updatedAt: -1 })
      .lean()
  }

  async rename(documentId: string, workspaceId: string, title: string) {
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

  async shareDocument(documentId: string, grantedBy: string, dto: ShareDocumentDto) {
    return this.documentPermissionModel.findOneAndUpdate(
      { documentId, userId: dto.userId },
      { role: dto.role, grantedBy },
      { upsert: true, new: true },
    )
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
      .lean()
  }

  private async resolveTitle(workspaceId: string, title: string, excludeId?: string) {
    let candidate = title
    let suffix = 0

    while (true) {
      const query: any = { workspaceId, title: candidate }
      if (excludeId) query._id = { $ne: excludeId }
      const existing = await this.documentModel.findOne(query).lean()
      if (!existing) return candidate
      suffix++
      candidate = `${title} (${suffix})`
    }
  }
}