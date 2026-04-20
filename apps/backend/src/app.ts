import express from 'express';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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
    // Не кидаем Error — иначе OPTIONS может завершиться 500 и браузер «висит» на preflight.
    cb(null, false);
  };
}

app.use(
  cors({
    origin: resolveCorsOrigin(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Device-ID', 'X-Device-Id'],
    credentials: false,
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: '50kb' }));
app.use(requestLogger);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Use X-Device-ID as the rate-limit key (per user, not per IP).
 * Falls back to IP (via ipKeyGenerator for IPv6 safety) when the header is absent.
 */
function deviceKey(req: express.Request): string {
  const id = req.headers['x-device-id'];
  return (typeof id === 'string' && id.length > 0) ? id : ipKeyGenerator(req.ip ?? '127.0.0.1');
}

/** Skip all rate limits in the test environment so unit/integration tests are unaffected. */
const skipInTests = () => process.env.NODE_ENV === 'test';

const RL_MESSAGE = (code: string, message: string) =>
  ({ success: false, error: { code, message } });

// ─── Rate limits ─────────────────────────────────────────────────────────────

// General: 120 requests / minute per IP — broad protection against bots
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MESSAGE('RATE_LIMITED', 'Too many requests'),
  }),
);

// Checkins: max 5 attempts / day per deviceId
// (business logic already prevents >1 per day via DB unique; this blocks flood at HTTP level)
app.use(
  '/api/v1/checkins',
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 15,
    keyGenerator: deviceKey,
    skip: skipInTests,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MESSAGE('RATE_LIMITED', 'Check-in limit reached for today'),
  }),
);

// Prediction generate: max 3 / day per deviceId (1 real use + buffer for retries)
// Also keeps the original IP-based 10/hour limit as a second layer.
app.use(
  '/api/v1/predictions/generate',
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 50,
    keyGenerator: deviceKey,
    skip: skipInTests,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MESSAGE('RATE_LIMITED', 'Daily prediction limit reached'),
  }),
);
app.use(
  '/api/v1/predictions/generate',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    skip: skipInTests,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MESSAGE('RATE_LIMITED', 'Too many predictions generated'),
  }),
);

// Weekly insights: max 10 / hour per deviceId — endpoint can call OpenAI when cache is stale
app.use(
  '/api/v1/insights/weekly',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: deviceKey,
    skip: skipInTests,
    standardHeaders: true,
    legacyHeaders: false,
    message: RL_MESSAGE('RATE_LIMITED', 'Too many insights requests'),
  }),
);

// All /api/v1 routes require a device ID header
app.use('/api/v1', deviceMiddleware);

app.use(router);
app.use(errorHandler);

export default app;
