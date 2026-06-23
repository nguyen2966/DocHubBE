// src/modules-system/storage/providers/local-storage.provider.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageContract, UploadResult } from '../storage.contract';
import { APP_URL, LOCAL_STORAGE_ROOT } from 'src/common/constants/app.constants';

@Injectable()
export class LocalStorageProvider extends StorageContract {
  private readonly logger = new Logger(LocalStorageProvider.name);

  private readonly root: string = LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), 'storage');

  private readonly baseUrl: string = `${APP_URL}/storage`;

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    const fullPath = this.resolvePath(key);
    this.ensureDir(fullPath);
    fs.writeFileSync(fullPath, buffer);
    this.logger.log(`Uploaded: ${key}`);
    return { fileKey: key, publicUrl: this.getPublicUrl(key) };
  }

  async overwrite(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    console.log(fullPath);
    this.ensureDir(fullPath);
    fs.writeFileSync(fullPath, buffer);
    this.logger.log(`Overwritten: ${key}`);
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Storage file not found: ${key}`);
    }
    return fs.readFileSync(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.logger.log(`Deleted: ${key}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolvePath(key));
  }

  getPublicUrl(key: string): string {
    const urlPath = key.split(path.sep).join('/');
    return `${this.baseUrl}/${urlPath}`;
  }

  private resolvePath(key: string): string {
    return path.join(this.root, key);
  }

  private ensureDir(fullPath: string): void {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  }
}