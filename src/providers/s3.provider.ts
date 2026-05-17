import type { MediaUploadProvider, UploadOptions, UploadResult } from './media-upload.provider';

/**
 * AWS S3 provider — stub ready for implementation.
 * Install: @aws-sdk/client-s3 @aws-sdk/lib-storage
 * Set env: MEDIA_PROVIDER=s3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 */
export const s3Provider: MediaUploadProvider = {
  async upload(_fileBuffer: Buffer, _options: UploadOptions): Promise<UploadResult> {
    throw new Error(
      'S3 provider not yet implemented. Set MEDIA_PROVIDER=cloudinary or implement this provider.'
    );
  },

  async delete(_publicId: string): Promise<void> {
    throw new Error('S3 provider not yet implemented.');
  },
};
