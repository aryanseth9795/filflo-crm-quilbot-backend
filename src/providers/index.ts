import { env } from '../config/env';
import type { MediaUploadProvider } from './media-upload.provider';
import type { EmailProvider } from './email.provider';
import { cloudinaryProvider } from './cloudinary.provider';
import { s3Provider } from './s3.provider';
import { resendProvider } from './resend.provider';
import { sesProvider } from './ses.provider';

export function getMediaProvider(): MediaUploadProvider {
  switch (env.MEDIA_PROVIDER) {
    case 'cloudinary':
      return cloudinaryProvider;
    case 's3':
      return s3Provider;
    default:
      throw new Error(`Unknown MEDIA_PROVIDER: ${env.MEDIA_PROVIDER}`);
  }
}

export function getEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      return resendProvider;
    case 'ses':
      return sesProvider;
    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
  }
}

export type { MediaUploadProvider, UploadOptions, UploadResult } from './media-upload.provider';
export type { EmailProvider, EmailOptions, EmailResult } from './email.provider';
