import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess, sendCreated } from '../utils/response';
import { ticketService } from '../services/ticket.service';
import { eventService } from '../services/event.service';

export const ticketController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const ticket = await ticketService.create(req.body, req.user!.id, files);
    sendCreated(res, { ticket });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const result = await ticketService.list(req.query as any);
    sendSuccess(res, result);
  }),

  getMine: catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 10;
    const status = req.query['status'] as string | undefined;
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const projectId = req.query['projectId'] as string | undefined;
    const approvedBy = req.query['approvedBy'] as string | undefined;
    const result = await ticketService.getMine(req.user!.id, req.user!.role, page, limit, status, from, to, projectId, approvedBy);
    sendSuccess(res, result);
  }),

  getById: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.getById(req.params['id'] as string);
    sendSuccess(res, { ticket });
  }),

  approve: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.approve(req.params['id'] as string, req.body, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  reject: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.reject(req.params['id'] as string, req.body);
    sendSuccess(res, { ticket });
  }),

  acceptTask: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.acceptTask(req.params['id'] as string, req.user!.id, req.body);
    sendSuccess(res, { ticket });
  }),

  startWork: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.startWork(req.params['id'] as string, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  setRolloutTime: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.setRolloutTime(
      req.params['id'] as string,
      req.user!.id,
      new Date(req.body.devRolloutTime)
    );
    sendSuccess(res, { ticket });
  }),

  reviewPR: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.reviewPR(req.params['id'] as string, req.body, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  addFeedback: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.addFeedback(req.params['id'] as string, req.body, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  close: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.close(req.params['id'] as string, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  addAttachments: catchAsync(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const ticket = await ticketService.addAttachments(req.params['id'] as string, files);
    sendSuccess(res, { ticket });
  }),

  completeDbChange: catchAsync(async (req: Request, res: Response) => {
    const ticket = await ticketService.completeDbChange(req.params['id'] as string, req.user!.id);
    sendSuccess(res, { ticket });
  }),

  getTimeline: catchAsync(async (req: Request, res: Response) => {
    const timeline = await eventService.getTimeline(req.params['id'] as string);
    sendSuccess(res, { timeline });
  }),
};
