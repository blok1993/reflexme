import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

/** Payload для `prisma.$on('warn'|'error')` — не везде экспортируется как `Prisma.LogEvent`. */
interface PrismaClientLogEvent {
  timestamp: Date;
  message: string;
  target: string;
}

export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('error', (e: PrismaClientLogEvent) => logger.error({ err: e }, 'Prisma error'));
prisma.$on('warn', (e: PrismaClientLogEvent) => logger.warn({ msg: e.message }, 'Prisma warning'));
