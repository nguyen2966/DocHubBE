// src/modules-system/storage/storage-key.util.ts
import * as path from 'path';

/**
 * Generates the canonical storage key for a document PDF.
 *
 * Layout on disk / in S3:
 *   documents/{workspaceId}/{documentId}.pdf
 */
export function buildDocumentKey(workspaceId: string, documentId: string): string {
  return path.join('documents', workspaceId, `${documentId}.pdf`);
}