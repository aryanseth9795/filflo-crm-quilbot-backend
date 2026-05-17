import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { User } from '../models/User.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';
import { AppError } from '../utils/AppError';

export const userController = {
  getDevelopers: catchAsync(async (_req: Request, res: Response) => {
    const developers = await User.find({ role: 'developer', isActive: true }).select('name email companyName createdAt');
    const profiles = await DeveloperProfile.find({ userId: { $in: developers.map((d) => d._id) } });
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
    const result = developers.map((dev) => ({
      ...dev.toJSON(),
      profile: profileMap.get(dev.id) ?? null,
    }));
    sendSuccess(res, { developers: result });
  }),

  getProfile: catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const [user, profile] = await Promise.all([
      User.findById(id).select('name email createdAt'),
      DeveloperProfile.findOne({ userId: id }),
    ]);
    if (!user) throw new AppError('Developer not found', 404);
    sendSuccess(res, { user, profile });
  }),

  getAdmins: catchAsync(async (_req: Request, res: Response) => {
    const admins = await User.find({ role: 'admin', isActive: true }).select('name email');
    sendSuccess(res, { admins });
  }),
};
