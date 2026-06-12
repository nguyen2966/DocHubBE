// src/modules-system/storage/storage.contract.ts

export interface UploadResult {
  fileKey: string;
  publicUrl: string;
}

export abstract class StorageContract {
  /**
   * Upload a new file. Returns the storage key and public URL.
   */
  abstract upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;

  /**
   * Overwrite an existing file in-place by its storage key.
   */
  abstract overwrite(key: string, buffer: Buffer, mimeType: string): Promise<void>;

  /**
   * Download a file and return its content as a Buffer.
   */
  abstract download(key: string): Promise<Buffer>;

  /**
   * Delete a file by its storage key.
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Check whether a file exists.
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Return a public URL for a given storage key.
   */
  abstract getPublicUrl(key: string): string;
}