import { PrismaClient, type Prisma } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('error', (e: Prisma.LogEvent) => logger.error({ err: e }, 'Prisma error'));
prisma.$on('warn', (e: Prisma.LogEvent) => logger.warn({ msg: e.message }, 'Prisma warning'));
