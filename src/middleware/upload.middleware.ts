import multer from 'multer';
import { AppError } from '../utils/AppError';

const FIFTY_MB = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FIFTY_MB,    // per-file max (total enforced in service)
    files: 20,             // max file count per request
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(`File type not allowed: ${file.mimetype}`, 400));
    }
    cb(null, true);
  },
});

export const MAX_TOTAL_BYTES = FIFTY_MB;
