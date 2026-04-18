import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level =
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'warn' :
      'info';

    logger[level]({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
    }, `${req.method} ${req.path} ${res.statusCode}`);
  });

  next();
}
