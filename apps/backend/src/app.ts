import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { deviceMiddleware } from './middleware/device.js';
import router from './routes/index.js';

const app = express();

app.set('trust proxy', 1);

function canonicalOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.trim().replace(/\/$/, '');
  }
}

/**
 * Несколько фронтов: `FRONTEND_URL=https://a.ru,https://b.onrender.com`
 * В ответе должен быть **один** `Access-Control-Allow-Origin` = origin из запроса, никогда вся строка с запятыми
 * (если в `cors` передать целиком `FRONTEND_URL` со запятыми, браузер падает с «multiple values»).
 */
function resolveCorsOrigin():
  | boolean
  | ((
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean | string) => void,
    ) => void) {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return true;

  const allowedCanon = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(canonicalOrigin),
  );

  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowedCanon.has(canonicalOrigin(origin))) {
      cb(null, origin);
      return;
    }
    cb(new Error(`CORS blocked origin: ${origin}`));
  };
}

app.use(
  cors({
    origin: resolveCorsOrigin(),
    allowedHeaders: ['Content-Type', 'X-Device-ID'],
    credentials: false,
  }),
);
app.use(express.json({ limit: '50kb' }));
app.use(requestLogger);

// General API rate limit
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  }),
);

// Stricter limit on the expensive LLM generation endpoint
app.use(
  '/api/v1/predictions/generate',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many predictions generated' } },
  }),
);

// All /api/v1 routes require a device ID header
app.use('/api/v1', deviceMiddleware);

app.use(router);
app.use(errorHandler);

export default app;
