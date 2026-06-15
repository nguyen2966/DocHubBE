import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DocumentPermission } from 'src/modules-system/mongodb/schemas/document-permission';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

@Injectable()
export class MySharedDocumentsService {

  constructor(
    @InjectModel('DocumentPermission')
    private readonly documentPermissionModel: Model<DocumentPermission>,
  ) {

  }

  async getSharedWithMeDocuments(userId: string) {
    const permissions = await this.documentPermissionModel.find({
      userId: userId,
      role: { $in: ['viewer', 'commenter', 'editor'] },
    })
      .populate({
        path: 'documentId',
        select:
          'workspaceId title sourceType ownerId processingStatus pdfFileUrl updatedAt createdAt',
        populate: [
          {
            path: 'ownerId',
            select: 'fullName email avatarUrl',
          },
          {
            path: 'workspaceId',
            select: 'name',
          },
        ],
      })
      .lean();

    return permissions
      .filter((permission) => permission.documentId)
      .map((permission) => {
        const document = (permission as any).documentId;
        const workspace = document.workspaceId;
        const owner = document.ownerId;

        return {
          _id: document._id.toString(),
          workspaceId: workspace?._id?.toString?.() ?? document.workspaceId?.toString?.(),
          workspaceName: workspace?.name ?? '',
          title: document.title,
          sourceType: document.sourceType,
          processingStatus: document.processingStatus,
          pdfFileUrl: document.pdfFileUrl,
          role: permission.role,
          owner: owner
            ? {
              _id: owner._id.toString(),
              fullName: owner.fullName,
              email: owner.email,
              avatarUrl: owner.avatarUrl ?? null,
            }
            : null,
          sharedAt: (permission as any).createdAt?.toISOString?.() ?? null,
          updatedAt: document.updatedAt?.toISOString?.() ?? null,
          createdAt: document.createdAt?.toISOString?.() ?? null,
        };
      });
  }

  async getSharedWithMeDocumentDetail(userId: string, documentId: string) {
    const permission = await this.documentPermissionModel
      .findOne({
        userId: userId,
        documentId: documentId,
        role: { $in: ['viewer', 'commenter', 'editor'] },
      })
      .populate({
        path: 'documentId',
        select:
          'workspaceId title sourceType ownerId markdownContent fileSize extractedTextPreview extractedTextCharCount extractedTextLimit isExtractedTextTruncated processingStatus pdfStorageKey pdfFileUrl createdAt updatedAt',
        populate: [
          {
            path: 'ownerId',
            select: 'fullName email avatarUrl',
          },
          {
            path: 'workspaceId',
            select: 'name',
          },
        ],
      })
      .lean();
    
    if (!permission) {
      throw new ForbiddenException('You do not have access to this document');
    }

    const document = (permission as any).documentId;

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const workspace = document.workspaceId;
    const owner = document.ownerId;

    return {
      _id: document._id.toString(),
      workspaceId:
        workspace?._id?.toString?.() ?? document.workspaceId?.toString?.(),
      workspaceName: workspace?.name ?? '',

      title: document.title,
      sourceType: document.sourceType,

      ownerId: owner
        ? {
          _id: owner._id.toString(),
          fullName: owner.fullName,
          email: owner.email,
          avatarUrl: owner.avatarUrl ?? null,
        }
        : null,

      markdownContent: document.markdownContent ?? null,
      fileSize: document.fileSize ?? 0,

      extractedTextPreview: document.extractedTextPreview ?? null,
      extractedTextCharCount: document.extractedTextCharCount ?? 0,
      extractedTextLimit: document.extractedTextLimit ?? 10000,
      isExtractedTextTruncated:
        document.isExtractedTextTruncated ?? false,

      processingStatus: document.processingStatus,
      pdfStorageKey: document.pdfStorageKey ?? '',
      pdfFileUrl: document.pdfFileUrl ?? '',

      role: permission.role,
      permissions: this.mapRoleToPermissions(permission.role),

      sharedAt: (permission as any).createdAt?.toISOString?.() ?? null,
      createdAt: document.createdAt?.toISOString?.() ?? null,
      updatedAt: document.updatedAt?.toISOString?.() ?? null,
    };
  }

  private mapRoleToPermissions(role: string) {
    switch (role) {
      case 'editor':
        return ['document:view', 'document:edit', 'document:comment'];

      case 'commenter':
        return ['document:view', 'document:comment'];

      case 'viewer':
      default:
        return ['document:view'];
    }
  }
}
