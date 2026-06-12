// src/modules-api/document/upload-job.service.ts
import { UploadJob } from "src/modules-system/mongodb/schemas/upload-job";
import { Model } from "mongoose";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ProgressGateway } from "src/modules-system/websocket/progress.gateway";
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadJobService {
  constructor(
    @InjectModel(UploadJob.name) private jobModel: Model<UploadJob>,
    private readonly wsGateway: ProgressGateway,
  ) {}

  async create(workspaceId: string): Promise<string> {
    const jobId = uuidv4();
    await this.jobModel.create({ jobId, workspaceId, status: 'UPLOADING', progress: 0 });
    return jobId;
  }

  async update(jobId: string, patch: Partial<Pick<UploadJob, 'status' | 'progress' | 'documentId' | 'errorMessage'|'isCancelled'>>) {
    const job = await this.jobModel.findOneAndUpdate(
      { jobId },
      { ...patch, updatedAt: new Date() },
       { returnDocument: 'after' }
    );
     if (!job) return null;
    // Emit sau mỗi cập nhật — frontend nhận ngay lập tức
    this.wsGateway.emitProgress(job!.workspaceId, {
      jobId: job?.jobId,
      status: job?.status,
      progress: job?.progress,
      documentId: job?.documentId,
      errorMessage: job?.errorMessage,
    });
    return job;
  }
}