// src/modules-api/document/document.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { PDFParse } from 'pdf-parse';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

import { Document } from 'src/modules-system/mongodb/schemas/document';
import { StorageContract } from 'src/modules-system/storage/storage.contract';
import { buildDocumentKey } from 'src/modules-system/storage/storage-key.util';
import { UploadJobService } from './upload-job.service';
import { UploadJob } from 'src/modules-system/mongodb/schemas/upload-job';
import { toObjectId } from 'src/common/utils/mongo-id.util';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXTRACTED_TEXT_LIMIT = 10_000;

// ─── Job payload types ────────────────────────────────────────────────────────

interface ExtractPdfJob {
  documentId: string;
  storageKey: string;
  jobId: string,
}

interface ConvertMarkdownJob {
  documentId: string;
  markdownContent: string;
  workspaceId: string;
}

// ─── Processor ────────────────────────────────────────────────────────────────

@Processor('document-processing')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    @InjectModel('Document') private readonly documentModel: Model<Document>,
    private readonly storage: StorageContract,
    private readonly uploadJobService: UploadJobService,
    @InjectModel(UploadJob.name)
    private readonly uploadJobModel: Model<UploadJob>,
  ) {
    super();
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'extract-pdf':
        return this.handleExtractPdf(job.data as ExtractPdfJob);
      case 'convert-markdown':
        return this.handleConvertMarkdown(job.data as ConvertMarkdownJob);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }


  private async handleExtractPdf({ documentId, storageKey, jobId }: ExtractPdfJob) {
    const documentObjectId = toObjectId(documentId);
    // Helper: check xem job có bị cancel không
    const isCancelled = async () => {
      const job = await this.uploadJobModel.findOne({ jobId }).lean();
      return job?.isCancelled === true;
    };

    try {
      // ← emit EXTRACTING ngay khi worker nhận job
      await this.uploadJobService.update(jobId, {
        status: 'EXTRACTING',
        progress: 66,   // giữ 66% — chỉ đổi status text trên UI
      });
      // DEV ONLY: delay 1s để test cancel ở 66%
      if (process.env.NODE_ENV !== 'production') {
        await this.sleep(2000);
      }
      // Check trước khi download (có thể là file lớn)
      if (await isCancelled()) {
        console.log("User cancle the upload")
        return;}
      const buffer = await this.storage.download(storageKey);

      // Check trước khi parse (pdf-parse có thể tốn thời gian)
      if (await isCancelled()) return;
      const text = await this.extractText(buffer);

      // Nếu cancel xảy ra trong lúc extractText đang chạy,
      // check lần cuối trước khi ghi kết quả vào DB
      if (await isCancelled()) return;

      await this.documentModel.findByIdAndUpdate(documentObjectId, {
        extractedTextPreview: text || null,
        processingStatus: 'processed',
        updatedAt: new Date(),
      });

      await this.uploadJobService.update(jobId, { status: 'COMPLETED', progress: 100 });

    } catch (error) {
      // Không override trạng thái CANCELLED bằng FAILED
      const job = await this.uploadJobModel.findOne({ jobId }).lean();
      if (job?.isCancelled) return;

      await this.documentModel.findByIdAndUpdate(documentObjectId, { processingStatus: 'unprocessable' });
      await this.uploadJobService.update(jobId, { status: 'FAILED', errorMessage: error.message });
    }
  }

  private async handleConvertMarkdown({
    documentId,
    markdownContent,
    workspaceId,
  }: ConvertMarkdownJob): Promise<void> {
    const documentObjectId = toObjectId(documentId);
    try {
      // ── Step 1: markdown → HTML ────────────────────────────────────────────
      const html = await this.renderMarkdownToHtml(markdownContent);

      // ── Step 2: HTML → PDF buffer ──────────────────────────────────────────
      const pdfBuffer = await this.htmlToPdf(html);

      // ── Step 3: Upload to storage ──────────────────────────────────────────
      const key = buildDocumentKey(workspaceId, documentId);
      const { publicUrl } = await this.storage.upload(key, pdfBuffer, 'application/pdf');

      // ── Step 4: Extract text preview ───────────────────────────────────────
      // The spec says to take the first 10,000 chars of the *markdown* content
      // for md_editor documents (not the extracted PDF text) because the markdown
      // source is already available as structured text — no need to round-trip
      // through PDF extraction.
      const rawText = markdownContent.replace(/[#*`_~>\-\[\]()!|]/g, ' ').replace(/\s+/g, ' ').trim();
      const text = rawText.substring(0, EXTRACTED_TEXT_LIMIT);
      const isTruncated = rawText.length > EXTRACTED_TEXT_LIMIT;

      // ── Step 5: Persist everything ─────────────────────────────────────────
      await this.documentModel.findByIdAndUpdate(documentObjectId, {
        pdfStorageKey: key,
        pdfFileUrl: publicUrl,
        fileSize: pdfBuffer.byteLength,
        extractedTextPreview: text || null,
        extractedTextCharCount: text.length,
        isExtractedTextTruncated: isTruncated,
        processingStatus: 'processed',
        updatedAt: new Date(),
      });

      this.logger.log(`convert-markdown done: ${documentId}`);
    } catch (error) {
      this.logger.error(`convert-markdown failed for ${documentId}`, error);

      await this.documentModel.findByIdAndUpdate(documentObjectId, {
        processingStatus: 'unprocessable',
      });
    }
  }

  // ─── Shared helpers ─────────────────────────────────────────────────────────

  /**
   * Runs pdf-parse on a buffer and returns text capped at EXTRACTED_TEXT_LIMIT.
   * Throws on parse failure so the caller can handle `unprocessable` status.
   */
  private async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const raw = (result.text ?? '').trim();
    return raw.substring(0, EXTRACTED_TEXT_LIMIT);
  }

  /**
   * Renders markdown to HTML.
   *
   * The editor only produces: bold, italic, underline, strikethrough,
   * bullet lists, and ordered lists — so styles are scoped to exactly those
   * elements. `marked` handles **bold**, *italic*, ~~strikethrough~~, and
   * both list types natively. Underline has no markdown syntax, so the
   * frontend must emit it as a raw <u> tag; no extra parsing needed.
   */
  private async renderMarkdownToHtml(markdown: string): Promise<string> {
    const body = await marked.parse(markdown);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body   { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #000; margin: 40px 48px; }
    p      { margin: 0 0 8px; }
    strong { font-weight: bold; }
    em     { font-style: italic; }
    u      { text-decoration: underline; }
    del    { text-decoration: line-through; }
    ul, ol { margin: 0 0 8px; padding-left: 24px; }
    li     { margin-bottom: 2px; }
  </style>
</head>
<body>${body}</body>
</html>`;
  }

 
  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
