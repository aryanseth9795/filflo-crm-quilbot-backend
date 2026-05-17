import { Router, Request, Response, NextFunction } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { webhookLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Raw body capture middleware (needed for HMAC verification)
// Must be placed BEFORE express.json() for this route
const captureRawBody = (req: Request, _res: Response, next: NextFunction) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    // Parse JSON manually after capturing raw body
    try {
      req.body = JSON.parse((req as any).rawBody.toString());
    } catch {
      req.body = {};
    }
    next();
  });
};

router.post(
  '/github/:projectId',
  webhookLimiter,
  captureRawBody,
  webhookController.githubHandler
);

export default router;
