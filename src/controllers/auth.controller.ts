import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess, sendCreated } from '../utils/response';
import { authService } from '../services/auth.service';
import { env } from '../config/env';

/** Convert JWT expiry strings like '1d', '24h', '30m', '3600s' to milliseconds */
function parseExpiryToMs(expiry: string): number {
  const num = parseInt(expiry, 10);
  if (expiry.endsWith('d')) return num * 24 * 60 * 60 * 1000;
  if (expiry.endsWith('h')) return num * 60 * 60 * 1000;
  if (expiry.endsWith('m')) return num * 60 * 1000;
  if (expiry.endsWith('s')) return num * 1000;
  return num * 1000; // fallback: treat as seconds
}

const ACCESS_COOKIE_MAX_AGE = parseExpiryToMs(env.JWT_EXPIRES_IN);
const REFRESH_COOKIE_MAX_AGE = parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const authController = {
  signup: catchAsync(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.signup(req.body);
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE });
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE });
    sendCreated(res, { user });
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE });
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE });
    sendSuccess(res, { user });
  }),

  logout: catchAsync(async (_req: Request, res: Response) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    sendSuccess(res, { message: 'Logged out successfully' });
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, { user });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, result);
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }
    const { accessToken, user } = await authService.refreshAccessToken(refreshToken);
    res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE });
    sendSuccess(res, { user });
  }),
};
