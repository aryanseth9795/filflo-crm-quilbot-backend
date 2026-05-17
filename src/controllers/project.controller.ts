import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess, sendCreated } from '../utils/response';
import { projectService } from '../services/project.service';
import { env } from '../config/env';

export const projectController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const result = await projectService.create(req.body, req.user!.id);
    sendCreated(res, result);
  }),

  list: catchAsync(async (_req: Request, res: Response) => {
    const projects = await projectService.list();
    sendSuccess(res, { projects });
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const project = await projectService.getById(id, false);
    const secret = await projectService.getByIdWithSecret(id);
    const webhookUrl = `${env.SERVER_URL}/api/webhooks/github/${id}`;
    sendSuccess(res, { project, webhookUrl, webhookSecret: secret.webhookSecret });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const project = await projectService.update(id, req.body);
    sendSuccess(res, { project });
  }),

  deactivate: catchAsync(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    await projectService.deactivate(id);
    sendSuccess(res, { message: 'Project deactivated' });
  }),

  regenerateSecret: catchAsync(async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const result = await projectService.regenerateSecret(id);
    sendSuccess(res, result);
  }),
};
