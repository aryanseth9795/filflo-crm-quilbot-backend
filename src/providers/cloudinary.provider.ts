import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import type { MediaUploadProvider, UploadOptions, UploadResult } from './media-upload.provider';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const cloudinaryProvider: MediaUploadProvider = {
  async upload(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: 'auto',
          public_id: `${Date.now()}_${options.fileName.replace(/\s+/g, '_')}`,
          use_filename: false,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            sizeBytes: result.bytes,
            mimeType: options.mimeType,
            fileName: options.fileName,
          });
        }
      );
      uploadStream.end(fileBuffer);
    });
  },

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
  },
};
