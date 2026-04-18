import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { deviceMiddleware } from './middleware/device.js';
import router from './routes/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
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
