import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rate-limit.middleware';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import ticketRoutes from './routes/ticket.routes';
import userRoutes from './routes/user.routes';
import reportRoutes from './routes/report.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

// Webhook routes FIRST — before express.json() — raw body handled internally
app.use('/api/webhooks', webhookRoutes);

// General middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export default app;
