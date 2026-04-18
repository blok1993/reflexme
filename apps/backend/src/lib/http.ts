import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  res.status(status).json({ success: false, error: { code, message, details } });
}
