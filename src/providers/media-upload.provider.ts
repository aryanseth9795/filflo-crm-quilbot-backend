export interface UploadOptions {
  folder: string;
  fileName: string;
  mimeType: string;
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
}

export interface MediaUploadProvider {
  upload(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
}
