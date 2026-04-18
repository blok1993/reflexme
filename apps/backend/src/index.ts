import 'dotenv/config';
import app from './app.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const port = Number(process.env.PORT || 3001);
const server = app.listen(port, () => {
  logger.info({ port }, '✦ Predictor backend started');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});
