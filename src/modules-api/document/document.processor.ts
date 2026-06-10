import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document } from 'src/modules-system/mongodb/schemas/document';
import { PDFParse } from 'pdf-parse';

@Processor('document-processing')
export class DocumentProcessor extends WorkerHost {
  constructor(
    @InjectModel('Document') private documentModel: Model<Document>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'extract-pdf') {
      const { documentId, fileBuffer } = job.data;

      try {
        // Convert base64 back to buffer
        const buffer = Buffer.from(fileBuffer, 'base64');

        // Extract text using pdf-parse
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();

        let text = result.text || '';

        // Enforce the 10,000 limit
        const limit = 10000;
        const isTruncated = text.length > limit;

        if (isTruncated) {
          text = text.substring(0, limit);
        }

        // Update DB with extracted content
        await this.documentModel.findByIdAndUpdate(documentId, {
          extractedTextPreview: text || null,
          extractedTextCharCount: text.length,
          isExtractedTextTruncated: isTruncated,
          processingStatus: 'processed',
        });

      } catch (error) {
        console.error(`Failed to process PDF text for document ${documentId}:`, error);

        // If it fails (e.g. image-only PDF with no text layer, or corrupted file), 
        // fallback to keeping the file but mark it unprocessable for text-search
        await this.documentModel.findByIdAndUpdate(documentId, {
          extractedTextPreview: null,
          extractedTextCharCount: 0,
          isExtractedTextTruncated: false,
          processingStatus: 'unprocessable',
        });
      }
    }
  }
}