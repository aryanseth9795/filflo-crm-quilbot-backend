import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { SignupInput, LoginInput, ResetPasswordInput } from '../validators/auth.validator';

const signToken = (id: string, role: string, email: string) =>
  jwt.sign({ id, role, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);

const signRefreshToken = (id: string) =>
  jwt.sign({ id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions);

export const authService = {
  async signup(data: SignupInput) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already in use', 409);

    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash: data.password, // pre-save hook hashes this
      role: data.role,
      companyName: data.companyName,
    });

    // Auto-create developer profile if role is developer
    if (data.role === 'developer') {
      await DeveloperProfile.create({ userId: user._id });
    }

    const accessToken = signToken(user.id, user.role, user.email);
    const refreshToken = signRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  },

  async login(data: LoginInput) {
    const user = await User.findOne({ email: data.email }).select('+passwordHash');
    if (!user || !user.isActive) throw new AppError('Invalid email or password', 401);

    const isValid = await user.comparePassword(data.password);
    if (!isValid) throw new AppError('Invalid email or password', 401);

    const accessToken = signToken(user.id, user.role, user.email);
    const refreshToken = signRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  },

  async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new AppError('User not found', 404);
    return user;
  },

  async resetPassword(data: ResetPasswordInput) {
    const user = await User.findOne({ email: data.email }).select('+passwordHash');
    if (!user || !user.isActive) throw new AppError('No account found with that email', 404);
    user.passwordHash = data.newPassword; // pre-save hook will bcrypt this
    await user.save();
    return { message: 'Password updated successfully' };
  },

  async refreshAccessToken(refreshTokenStr: string) {
    let payload: { id: string };
    try {
      payload = jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET) as { id: string };
    } catch {
      throw new AppError('Refresh token is invalid or expired — please log in again', 401);
    }
    const user = await User.findById(payload.id);
    if (!user || !user.isActive) throw new AppError('User not found or deactivated', 401);
    const accessToken = signToken(user.id, user.role, user.email);
    return { accessToken, user };
  },
};

