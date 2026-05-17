import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess, sendCreated } from '../utils/response';
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

  listAll: catchAsync(async (_req: Request, res: Response) => {
    const users = await User.find({})
      .select('name email role isActive companyName createdAt')
      .sort({ createdAt: -1 });
    sendSuccess(res, { users });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const { name, email, password, role, companyName } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw new AppError('Email already in use', 409);
    const user = await User.create({ name, email, passwordHash: password, role, companyName });
    if (role === 'developer') {
      await DeveloperProfile.create({ userId: user._id });
    }
    sendCreated(res, { user });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const { name, email, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) throw new AppError('Email already in use', 409);
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    await user.save();
    sendSuccess(res, { user });
  }),

  toggleActive: catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    user.isActive = !user.isActive;
    await user.save();
    sendSuccess(res, { user });
  }),
};
