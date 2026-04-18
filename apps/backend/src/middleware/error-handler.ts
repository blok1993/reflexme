import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  logger.error(
    {
      err: { message: err.message, stack: err.stack, name: err.name },
      method: req.method,
      path: req.path,
    },
    'Unhandled server error',
  );

  if (res.headersSent) return;

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
