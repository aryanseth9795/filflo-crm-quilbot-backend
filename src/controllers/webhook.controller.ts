import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import { webhookService } from '../services/webhook.service';
import { logger } from '../config/logger';

export const webhookController = {
  githubHandler: async (req: Request, res: Response) => {
    // Respond immediately (GitHub expects < 10s response)
    res.status(200).json({ success: true, message: 'Webhook received' });

    // Process asynchronously to avoid timeout
    const projectId = req.params['projectId'] as string;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody: Buffer = (req as any).rawBody;

    setImmediate(async () => {
      try {
        const result = await webhookService.processGitHubEvent(projectId, rawBody, signature, req.body);
        logger.info('Webhook processed:', result);
      } catch (err: any) {
        logger.error('Webhook processing error:', err.message);
      }
    });
  },
};
