import type { Request, Response, NextFunction } from 'express';
import { fail } from '../lib/http.js';

// Extend Express Request type to carry the validated deviceId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceId: string;
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deviceMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = req.headers['x-device-id'];
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return fail(
      res,
      'MISSING_DEVICE_ID',
      'X-Device-ID header with a valid UUID v4 is required',
      400,
    );
  }
  req.deviceId = id;
  next();
}
