// src/modules-api/document/document.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { WorkspaceMember } from 'src/modules-system/mongodb/schemas/workspace-member';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RenameDocumentDto } from './dto/rename-document.dto';
import { StorageContract } from 'src/modules-system/storage/storage.contract';
import { buildDocumentKey } from 'src/modules-system/storage/storage-key.util';
import { UploadJobService } from './upload-job.service';
import { UploadJob } from 'src/modules-system/mongodb/schemas/upload-job';
import { toObjectId, toStringId } from 'src/common/utils/mongo-id.util';
import { ActivityService } from '../activity/activity.service';
import { ACTIVITY_ACTION, ACTIVITY_TARGET } from '../activity/activity.constants';



@Injectable()
export class DocumentService {
  constructor(
    @InjectModel('Document')
    private documentModel: Model<any>,
    @InjectModel('DocumentPermission')
    private documentPermissionModel: Model<any>,
    @InjectModel(WorkspaceMember.name)
    private readonly memberModel: Model<WorkspaceMember>,
    @InjectModel(UploadJob.name)
    private readonly uploadJobModel: Model<UploadJob>,
    @InjectQueue('document-processing')
    private readonly documentQueue: Queue, // Inject Queue
    private readonly storage: StorageContract,
    private readonly uploadJobService: UploadJobService,
    private readonly activityService: ActivityService,


  ) { }

  // ─── Flow 1: Create from Markdown Editor ──────────────────────────────────
  private async isUploadCancelled(jobId: string) {
    const job = await this.uploadJobModel.findOne({ jobId }).lean();
    return job?.isCancelled === true || job?.status === 'CANCELLED';
  }


  async createMarkdown(workspaceId: string, ownerId: string, dto: CreateDocumentDto) {
    const workspaceObjectId = toObjectId(workspaceId);
    const ownerObjectId = toObjectId(ownerId);
    const title = await this.resolveTitle(workspaceObjectId, dto.title);

    const doc = await this.documentModel.create({
      workspaceId: workspaceObjectId,
      ownerId: ownerObjectId,
      title,
      sourceType: 'md_editor',
      markdownContent: dto.markdownContent,
      processingStatus: 'processing',
    });

    await this.assignOwner(toObjectId(doc._id), ownerObjectId);

    // Enqueue markdown → PDF conversion
    await this.documentQueue.add('convert-markdown', {
      documentId: toStringId(doc._id),
      markdownContent: dto.markdownContent,
      workspaceId,
    });

    await this.activityService.recordSafe({
      workspaceId,
      actorId: ownerId,
      actionType: ACTIVITY_ACTION.CREATE_DOCUMENT,
      targetType: ACTIVITY_TARGET.DOCUMENT,
      targetId: doc._id,
      metadata: { title: doc.title, sourceType: doc.sourceType },
    });

    return doc;
  }

  async uploadPdf(
    workspaceId: string,
    ownerId: string,
    file: Express.Multer.File,
    titleInput: string,
    jobId: string,
  ) {
    if (await this.isUploadCancelled(jobId)) {
      return { jobId, cancelled: true }
    }

    await this.uploadJobService.update(jobId, {
      status: 'FILE_SAVED',
      progress: 33,
    })

    if (await this.isUploadCancelled(jobId)) {
      return { jobId, cancelled: true }
    }

    const workspaceObjectId = toObjectId(workspaceId)
    const ownerObjectId = toObjectId(ownerId)
    const title = await this.resolveTitle(workspaceObjectId, titleInput)

    const doc = await this.documentModel.create({
      workspaceId: workspaceObjectId,
      ownerId: ownerObjectId,
      title,
      sourceType: 'file_upload',
      fileSize: file.size,
      processingStatus: 'processing',
    })

    await this.uploadJobService.update(jobId, {
      documentId: toStringId(doc._id),
    })

    if (await this.isUploadCancelled(jobId)) {
      await this.documentModel.findByIdAndDelete(doc._id)
      return { jobId, cancelled: true }
    }

    const key = buildDocumentKey(workspaceId, toStringId(doc._id))

    const { publicUrl } = await this.storage.upload(
      key,
      file.buffer,
      'application/pdf',
    )

    if (await this.isUploadCancelled(jobId)) {
      await this.storage.delete(key).catch(() => { })
      await this.documentModel.findByIdAndDelete(doc._id)
      await this.documentPermissionModel.deleteMany({ documentId: doc._id })
      return { jobId, cancelled: true }
    }

    await this.uploadJobService.update(jobId, {
      status: 'EXTRACTING',
      progress: 66,
      documentId: toStringId(doc._id),
    })

    await this.documentModel.findByIdAndUpdate(doc._id, {
      pdfStorageKey: key,
      pdfFileUrl: publicUrl,
    })

    if (await this.isUploadCancelled(jobId)) {
      await this.storage.delete(key).catch(() => { })
      await this.documentModel.findByIdAndDelete(doc._id)
      await this.documentPermissionModel.deleteMany({ documentId: doc._id })
      return { jobId, cancelled: true }
    }

    await this.assignOwner(toObjectId(doc._id), ownerObjectId)

    if (await this.isUploadCancelled(jobId)) {
      await this.storage.delete(key).catch(() => { })
      await this.documentModel.findByIdAndDelete(doc._id)
      await this.documentPermissionModel.deleteMany({ documentId: doc._id })
      return { jobId, cancelled: true }
    }

    await this.documentQueue.add('extract-pdf', {
      documentId: toStringId(doc._id),
      storageKey: key,
      jobId,
    })

    await this.activityService.recordSafe({
      workspaceId,
      actorId: ownerId,
      actionType: ACTIVITY_ACTION.CREATE_DOCUMENT,
      targetType: ACTIVITY_TARGET.DOCUMENT,
      targetId: doc._id,
      metadata: { title: doc.title, sourceType: doc.sourceType },
    })

    return {
      ...doc.toObject(),
      pdfStorageKey: key,
      pdfFileUrl: publicUrl,
      jobId,
    }
  }

  async cancelUpload(jobId: string, workspaceId: string, userId: string) {
    const job = await this.uploadJobModel.findOne({ jobId, workspaceId });
    if (!job) throw new NotFoundException('Job not found');
    // Idempotent — không làm gì nếu đã xong/thất bại
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) return { cancelled: false };


    // Đánh dấu cancel ngay — worker sẽ kiểm tra cờ này
    await this.uploadJobService.update(jobId, {
      status: 'CANCELLED',
      isCancelled: true,
    });

    // Cleanup tùy theo đã đến phase nào
    if (job.documentId) {
      const documentObjectId = toObjectId(job.documentId)
      const doc = await this.documentModel.findById(documentObjectId).lean();

      if (doc?.pdfStorageKey) {
        // Xóa file khỏi storage (fire-and-forget, không throw nếu lỗi)
        await this.storage.delete(doc.pdfStorageKey).catch(() => { });
      }

      // Xóa document record và permission
      await this.documentModel.findByIdAndDelete(documentObjectId);
      await this.documentPermissionModel.deleteMany({ documentId: documentObjectId });
    }

    // Thử remove khỏi BullMQ queue nếu job chưa được worker nhận
    // (nếu worker đã nhận thì remove fail silently, worker sẽ tự check isCancelled)
    const bullJobs = await this.documentQueue.getJobs(['waiting', 'delayed']);
    const bullJob = bullJobs.find(j => j.data.jobId === jobId);
    await bullJob?.remove().catch(() => { });

    return { cancelled: true };
  }


  // ─── Flow 3: Edit PDF (Apryse export → overwrite) ─────────────────────────

  async editPdf(documentId: string, fileBuffer: Buffer, actorId: string) {
    const documentObjectId = toObjectId(documentId)
    const doc = await this.documentModel.findById(documentObjectId).lean();
    if (!doc) throw new NotFoundException('Document not found');

    // Overwrite the file at the existing storage key
    await this.storage.overwrite(doc.pdfStorageKey, fileBuffer, 'application/pdf');

    // Re-extract text preview from the edited PDF via background queue
    await this.documentQueue.add('extract-pdf', {
      documentId,
      storageKey: doc.pdfStorageKey,
    });

    // updatedAt is handled by the worker once extraction completes;
    // mark it immediately so the UI shows the document is being processed
    const updated = await this.documentModel.findByIdAndUpdate(
      documentObjectId,
      { processingStatus: 'processing', updatedAt: new Date() },
      { new: true },
    );

    await this.activityService.recordSafe({
      workspaceId: doc.workspaceId,
      actorId,
      actionType: ACTIVITY_ACTION.UPDATE_DOCUMENT,
      targetType: ACTIVITY_TARGET.DOCUMENT,
      targetId: documentObjectId,
      metadata: { changeType: 'content_updated', title: doc.title },
    })

    return updated
  }

  private async assignOwner(documentId: Types.ObjectId, userId: Types.ObjectId) {
    await this.documentPermissionModel.create({
      documentId,
      userId,
      role: 'owner',
      grantedBy: userId,
    });
  }

  async findById(documentId: string) {
    const documentObjectId = toObjectId(documentId)
    const doc = await this.documentModel
      .findById(documentObjectId)
      .populate('ownerId', 'fullName')
      .lean();

    if (!doc) throw new NotFoundException('Document not found');

    // Always resolve a fresh URL from the storage layer (handles signed URLs, CDN, etc.)
    const pdfFileUrl = doc.pdfStorageKey
      ? this.storage.getPublicUrl(doc.pdfStorageKey)
      : null;

    return { ...doc, pdfFileUrl };
  }

  async findByWorkspace(workspaceId: string) {
    return this.documentModel
      .find({ workspaceId: toObjectId(workspaceId) })
      .populate('ownerId', 'fullName')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async rename(
    documentId: string,
    workspaceId: string,
    actorId: string,
    body: RenameDocumentDto,
  ) {
    const { title } = body;
    const documentObjectId = toObjectId(documentId)
    const resolved = await this.resolveTitle(
      toObjectId(workspaceId),
      title,
      documentObjectId,
    )

    const oldDocument = await this.documentModel
      .findById(documentId)
      .select('title workspaceId')
      .lean()

    if (!oldDocument) {
      throw new NotFoundException('Document not found')
    }

    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { title: resolved },
        { new: true },
      )
      .lean();

    await this.activityService.recordSafe({
      workspaceId: oldDocument.workspaceId,
      actorId,
      actionType: 'update_document',
      targetType: 'document',
      targetId: updated._id,
      metadata: {
        changeType: 'renamed',
        oldTitle: oldDocument.title,
        newTitle: updated.title,
        documentTitle: updated.title,
      },
    })

    return updated
  }

  async delete(documentId: string, actorId: string) {
    const documentObjectId = toObjectId(documentId)
    const doc = await this.documentModel.findById(documentObjectId).lean()
    if (!doc) throw new NotFoundException('Document not found')

    // TODO: add pending-share/annotation/comment cleanup when those modules
    // own persistence and transaction boundaries.
    await Promise.all([
      this.documentModel.findByIdAndDelete(documentObjectId),
      this.documentPermissionModel.deleteMany({ documentId: documentObjectId }),
    ])

    await this.activityService.recordSafe({
      workspaceId: doc.workspaceId,
      actorId,
      actionType: ACTIVITY_ACTION.DELETE_DOCUMENT,
      targetType: ACTIVITY_TARGET.DOCUMENT,
      targetId: documentObjectId,
      metadata: { title: doc.title },
    })
  }

  async getMembers(documentId: string) {
    return this.documentPermissionModel
      .find({ documentId: toObjectId(documentId) })
      .populate('userId', 'name email avatar')
      .lean();
  }

  private async resolveTitle(
    workspaceId: Types.ObjectId,
    title: string,
    excludeId?: Types.ObjectId,
  ) {
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
