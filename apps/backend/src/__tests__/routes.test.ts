import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Prisma } from '@prisma/client';
import request from 'supertest';
import app from '../app.js';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TODAY = new Date().toISOString().slice(0, 10);
/** Вчерашний календарный день — ревью для прошлых дней доступен в любое время (нет окна 17:00). */
const YESTERDAY = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const mockUser = {
  id: 'user_1',
  deviceId: DEVICE_ID,
  name: 'Test',
  gender: null,
  birthDate: null,
  preferredTone: 'neutral',
  timezone: 'UTC',
  onboardingCompleted: true,
  eveningReminderTime: null,
  notificationsEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCheckin = {
  id: 'checkin_1',
  userId: 'user_1',
  date: TODAY,
  mood: 3,
  focus: 'work',
  contextText: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    dailyCheckin: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    prediction: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function authHeaders() {
  return { 'X-Device-ID': DEVICE_ID };
}

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('does NOT require X-Device-ID header', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

// ─── Device ID middleware ─────────────────────────────────────────────────────

describe('Device ID requirement', () => {
  it('returns 400 when X-Device-ID is missing', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_DEVICE_ID');
  });

  it('returns 400 when X-Device-ID is not a valid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('X-Device-ID', 'not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/users/me ─────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
  });

  it('returns existing user', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('user_1');
  });

  it('creates user if not found', async () => {
    const { prisma } = await import('../lib/prisma.js');
    // getOrCreateUser now uses upsert — it handles both find and create atomically.
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ deviceId: DEVICE_ID }) }),
    );
  });
});

// ─── POST /api/v1/checkins ────────────────────────────────────────────────────

describe('POST /api/v1/checkins', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.dailyCheckin.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.dailyCheckin.create).mockResolvedValue(mockCheckin as never);
  });

  it('creates checkin and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 3, focus: 'work' });

    expect(res.status).toBe(201);
    expect(res.body.data.checkin.id).toBe('checkin_1');
  });

  it('returns 409 when checkin already exists for today', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.dailyCheckin.findUnique).mockResolvedValue(mockCheckin as never);

    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 3, focus: 'work' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECKIN_ALREADY_EXISTS');
  });

  it('returns 400 for invalid mood value', async () => {
    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 6, focus: 'work' }); // mood must be 1-5

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid focus value', async () => {
    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 3, focus: 'invalid_focus' });

    expect(res.status).toBe(400);
  });

  it('accepts contextText up to 300 chars', async () => {
    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 3, focus: 'work', contextText: 'a'.repeat(300) });

    expect(res.status).toBe(201);
  });

  it('rejects contextText longer than 300 chars', async () => {
    const res = await request(app)
      .post('/api/v1/checkins')
      .set(authHeaders())
      .send({ date: TODAY, mood: 3, focus: 'work', contextText: 'a'.repeat(301) });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/reviews ─────────────────────────────────────────────────────

describe('POST /api/v1/reviews — accuracy calculation', () => {
  const mockPrediction = {
    id: 'pred_1',
    userId: 'user_1',
    checkinId: 'checkin_1',
    date: YESTERDAY,
    dayType: 'Test Day',
    likelyEvent: 'Test',
    strengthPoint: 'Test',
    trapWarning: 'Test',
    confidence: 'medium',
    modelVersion: 'test',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(mockPrediction as never);
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);
  });

  it('calculates accuracyScore = 1 when all yes', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.create).mockImplementation(async (args: Prisma.ReviewCreateArgs) => {
      const { data } = args;
      return { id: 'rev_1', ...data, createdAt: new Date(), updatedAt: new Date() } as never;
    });

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders())
      .send({
        predictionId: 'pred_1',
        likelyEventScore: 'yes',
        strengthPointScore: 'yes',
        trapWarningScore: 'yes',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.review.accuracyScore).toBe(1);
  });

  it('calculates accuracyScore = 0 when all no', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.create).mockImplementation(async (args: Prisma.ReviewCreateArgs) => {
      const { data } = args;
      return { id: 'rev_1', ...data, createdAt: new Date(), updatedAt: new Date() } as never;
    });

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders())
      .send({
        predictionId: 'pred_1',
        likelyEventScore: 'no',
        strengthPointScore: 'no',
        trapWarningScore: 'no',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.review.accuracyScore).toBe(0);
  });

  it('calculates accuracyScore ≈ 0.5 for yes+partial+no', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.create).mockImplementation(async (args: Prisma.ReviewCreateArgs) => {
      const { data } = args;
      return { id: 'rev_1', ...data, createdAt: new Date(), updatedAt: new Date() } as never;
    });

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders())
      .send({
        predictionId: 'pred_1',
        likelyEventScore: 'yes',
        strengthPointScore: 'partial',
        trapWarningScore: 'no',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.review.accuracyScore).toBeCloseTo(0.5, 5);
  });

  it('returns 404 when prediction does not belong to user', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      ...mockPrediction,
      userId: 'other_user',
    } as never);

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeaders())
      .send({
        predictionId: 'pred_1',
        likelyEventScore: 'yes',
        strengthPointScore: 'yes',
        trapWarningScore: 'yes',
      });

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/users/me ────────────────────────────────────────────────────

describe('POST /api/v1/users/me — field validation', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as never);
  });

  it('accepts valid gender "male"', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ gender: 'male' });

    expect(res.status).toBe(200);
  });

  it('accepts valid gender "female"', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ gender: 'female' });

    expect(res.status).toBe(200);
  });

  it('rejects invalid gender value', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ gender: 'other' });

    expect(res.status).toBe(400);
  });

  it('accepts valid birthDate YYYY-MM-DD', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ birthDate: '1990-06-15' });

    expect(res.status).toBe(200);
  });

  it('rejects invalid birthDate format', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ birthDate: '15-06-1990' });

    expect(res.status).toBe(400);
  });

  it('accepts null birthDate to clear it', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ birthDate: null });

    expect(res.status).toBe(200);
  });

  it('rejects onboardingCompleted without gender', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ onboardingCompleted: true });

    expect(res.status).toBe(400);
  });

  it('rejects onboardingCompleted with gender null', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ onboardingCompleted: true, gender: null });

    expect(res.status).toBe(400);
  });

  it('accepts onboardingCompleted with gender male', async () => {
    const res = await request(app)
      .post('/api/v1/users/me')
      .set(authHeaders())
      .send({ onboardingCompleted: true, gender: 'male' });

    expect(res.status).toBe(200);
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});
