import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_FOLDER,
} from 'src/common/constants/app.constants';
import { StorageContract, UploadResult } from '../storage.contract';

@Injectable()
export class CloudinaryStorageProvider extends StorageContract {
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor() {
    super()

    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    })
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadResult> {
    const publicId = this.toPublicId(key);

    const result = await this.uploadBuffer(buffer, publicId, mimeType, false);

    this.logger.log(`Uploaded: ${publicId}`);

    return {
      fileKey: key,
      publicUrl: result.secure_url,
    }
  }

  async overwrite(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    const publicId = this.toPublicId(key)

    await this.uploadBuffer(buffer, publicId, mimeType, true)

    this.logger.log(`Overwritten: ${publicId}`)
  }

  async download(key: string): Promise<Buffer> {
    const publicUrl = this.getPublicUrl(key);

    const response = await fetch(publicUrl);

    if (!response.ok) {
      throw new NotFoundException(`Cloudinary file not found: ${key}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const publicId = this.toPublicId(key);

    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      invalidate: true,
    })

    this.logger.log(`Deleted: ${publicId}`);
  }

  async exists(key: string): Promise<boolean> {
    const publicId = this.toPublicId(key);

    try {
      await cloudinary.api.resource(publicId, {
        resource_type: 'raw',
      });

      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    const publicId = this.toPublicId(key);

    return cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true,
    })
  }

  private uploadBuffer(
    buffer: Buffer,
    publicId: string,
    mimeType: string,
    overwrite: boolean,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'raw',
          overwrite,
          invalidate: overwrite,
          use_filename: false,
          unique_filename: false,
        },
        (error, result) => {
          if (error) return reject(error)
          if (!result) return reject(new Error('Cloudinary upload failed'))
          resolve(result)
        },
      )

      stream.end(buffer);
    })
  }

  private toPublicId(key: string): string {
    const normalizedKey = key.replace(/\\/g, '/');

    const folder = CLOUDINARY_FOLDER?.replace(/^\/+|\/+$/g, '') ?? 'dochub';

    return `${folder}/${normalizedKey}`;
  }
}