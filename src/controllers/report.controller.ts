import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { reportService } from '../services/report.service';

export const reportController = {
  getOverview: catchAsync(async (req: Request, res: Response) => {
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const data = await reportService.getOverview(from, to);
    sendSuccess(res, data);
  }),

  getHappinessIndex: catchAsync(async (req: Request, res: Response) => {
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const data = await reportService.getHappinessIndex(from, to);
    sendSuccess(res, { companies: data });
  }),

  getProjectDetail: catchAsync(async (req: Request, res: Response) => {
    const projectId = req.params['id'] as string;
    const data = await reportService.getProjectDetail(projectId);
    sendSuccess(res, data);
  }),

  getDeveloperStats: catchAsync(async (req: Request, res: Response) => {
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const data = await reportService.getDeveloperStats(from, to);
    sendSuccess(res, { developers: data });
  }),

  exportCSV: catchAsync(async (req: Request, res: Response) => {
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const csv = await reportService.exportCSV(from, to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="filflo-report.csv"');
    res.send(csv);
  }),

  getCompanyReport: catchAsync(async (req: Request, res: Response) => {
    const projectId = req.params['id'] as string;
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const data = await reportService.getCompanyReport(projectId, from, to);
    sendSuccess(res, data);
  }),
};
