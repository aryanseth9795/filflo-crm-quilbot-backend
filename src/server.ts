import 'dotenv/config';
import http from 'http';
import app from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';

const server = http.createServer(app);

const start = async () => {
  await connectDB();

  server.listen(Number(env.PORT), () => {
    logger.info(`🚀 Filflo CRM Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📡 Webhook base URL: ${env.SERVER_URL}/api/webhooks/github/:projectId`);
  });
};

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await disconnectDB();
    logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

start();
