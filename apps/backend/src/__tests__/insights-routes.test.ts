import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TODAY = new Date().toISOString().slice(0, 10);

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
  profileSummary: null,
  profileUpdatedAt: null,
  patternCards: null,
  patternCardsUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    dailyCheckin: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    prediction: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function headers() {
  return { 'X-Device-ID': DEVICE_ID };
}

// ─── GET /api/v1/insights/accuracy-curve ─────────────────────────────────────

describe('GET /api/v1/insights/accuracy-curve', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
  });

  it('returns empty points when no reviews', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/insights/accuracy-curve')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.points).toEqual([]);
    expect(res.body.data.trend).toBe('insufficient_data');
    expect(res.body.data.totalReviews).toBe(0);
  });

  it('excludes reviews with null accuracy and prepends 0% origin', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { date: '2026-04-01', accuracyScore: null },
      { date: '2026-04-02', accuracyScore: 0.75 },
    ] as never);

    const res = await request(app)
      .get('/api/v1/insights/accuracy-curve')
      .set(headers());

    // 1 real point + 1 synthetic origin = 2 total
    expect(res.body.data.points).toHaveLength(2);
    expect(res.body.data.points[0].accuracy).toBe(0);  // origin
    expect(res.body.data.points[1].accuracy).toBe(0.75);
  });

  it('detects improving trend: cumulative avg at end > cumulative avg at midpoint', async () => {
    const { prisma } = await import('../lib/prisma.js');
    // First 3 days: 0.3 → cumulative avg at mid ≈ 0.3
    // Last 3 days: 0.9 → cumulative avg at end ≈ (0.3+0.3+0.3+0.9+0.9+0.9)/6 = 0.6
    // diff = 0.6 - 0.3 = +0.3 → improving
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { date: '2026-04-01', accuracyScore: 0.3 },
      { date: '2026-04-02', accuracyScore: 0.3 },
      { date: '2026-04-03', accuracyScore: 0.3 },
      { date: '2026-04-04', accuracyScore: 0.9 },
      { date: '2026-04-05', accuracyScore: 0.9 },
      { date: '2026-04-06', accuracyScore: 0.9 },
    ] as never);

    const res = await request(app)
      .get('/api/v1/insights/accuracy-curve')
      .set(headers());

    expect(res.body.data.trend).toBe('improving');
    // Also verify cumulative averaging: last point ≈ 0.6 (synthetic origin at index 0)
    const pts = res.body.data.points;
    expect(pts[0].accuracy).toBe(0); // synthetic origin
    expect(pts[pts.length - 1].accuracy).toBeCloseTo(0.6, 1);
  });

  it('detects declining trend: cumulative avg at end < cumulative avg at midpoint', async () => {
    const { prisma } = await import('../lib/prisma.js');
    // First 3: 0.9 → cumulative mid ≈ 0.9, Last 3: 0.1 → cumulative end ≈ 0.5
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { date: '2026-04-01', accuracyScore: 0.9 },
      { date: '2026-04-02', accuracyScore: 0.9 },
      { date: '2026-04-03', accuracyScore: 0.9 },
      { date: '2026-04-04', accuracyScore: 0.1 },
      { date: '2026-04-05', accuracyScore: 0.1 },
      { date: '2026-04-06', accuracyScore: 0.1 },
    ] as never);

    const res = await request(app)
      .get('/api/v1/insights/accuracy-curve')
      .set(headers());

    expect(res.body.data.trend).toBe('declining');
  });

  it('insufficient_data when fewer than 6 points', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { date: '2026-04-01', accuracyScore: 0.5 },
      { date: '2026-04-02', accuracyScore: 0.7 },
    ] as never);

    const res = await request(app)
      .get('/api/v1/insights/accuracy-curve')
      .set(headers());

    expect(res.body.data.trend).toBe('insufficient_data');
  });
});

// ─── GET /api/v1/insights/vocabulary ─────────────────────────────────────────

describe('GET /api/v1/insights/vocabulary', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
  });

  it('returns empty words when no checkins', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.dailyCheckin.findMany).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/insights/vocabulary')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.words).toEqual([]);
    expect(res.body.data.hasEnoughData).toBe(false);
  });

  it('returns words extracted from contextText', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.dailyCheckin.findMany).mockResolvedValue([
      { contextText: 'стресс созвон тяжело' },
      { contextText: 'стресс работа тяжело' },
      { contextText: 'стресс созвон задача' },
      { contextText: null },
      { contextText: 'созвон задача работа' },
      { contextText: 'тяжело работа стресс' },
    ] as never);

    const res = await request(app)
      .get('/api/v1/insights/vocabulary')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.words.length).toBeGreaterThan(0);
    expect(res.body.data.analyzedCheckins).toBe(5); // one null
    const words = res.body.data.words.map((w: { word: string }) => w.word);
    expect(words).toContain('стресс');
  });

  it('hasEnoughData is true when 5+ analyzed checkins with 3+ words', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.dailyCheckin.findMany).mockResolvedValue(
      Array.from({ length: 6 }, () => ({ contextText: 'стресс созвон тяжело встреча работа' })) as never,
    );

    const res = await request(app)
      .get('/api/v1/insights/vocabulary')
      .set(headers());

    expect(res.body.data.hasEnoughData).toBe(true);
  });
});

// ─── GET /api/v1/insights/patterns ────────────────────────────────────────────

describe('GET /api/v1/insights/patterns', () => {
  beforeEach(async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.review.count).mockResolvedValue(5);
  });

  it('returns empty cards when no pattern cards cached', async () => {
    const res = await request(app)
      .get('/api/v1/insights/patterns')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.cards).toEqual([]);
    expect(res.body.data.hasEnoughData).toBe(false);
  });

  it('returns cached pattern cards when available', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const cachedCards = [
      {
        id: 'card_1',
        title: 'Конфликт реже, чем кажется',
        insight: 'Ты ожидаешь напряжения, но оно случается редко.',
        category: 'accuracy',
        highlight: '23% случаев',
      },
    ];
    const userWithCards = {
      ...mockUser,
      patternCards: JSON.stringify(cachedCards),
      patternCardsUpdatedAt: new Date(),
    };
    vi.mocked(prisma.user.upsert).mockResolvedValue(userWithCards as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithCards as never);

    const res = await request(app)
      .get('/api/v1/insights/patterns')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.cards).toHaveLength(1);
    expect(res.body.data.cards[0].title).toBe('Конфликт реже, чем кажется');
  });

  it('hasEnoughData is true when 7+ reviews', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.review.count).mockResolvedValue(10);

    const res = await request(app)
      .get('/api/v1/insights/patterns')
      .set(headers());

    expect(res.body.data.hasEnoughData).toBe(true);
    expect(res.body.data.minimumRequired).toBe(7);
  });
});

// ─── GET /api/v1/profile ──────────────────────────────────────────────────────

describe('GET /api/v1/profile', () => {
  it('returns null profile for new user', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const res = await request(app)
      .get('/api/v1/profile')
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.profileSummary).toBeNull();
    expect(res.body.data.hasProfile).toBe(false);
  });

  it('returns profile when summary exists', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const userWithProfile = {
      ...mockUser,
      profileSummary: 'Пользователь часто испытывает тревогу.',
      profileUpdatedAt: new Date(),
    };
    vi.mocked(prisma.user.upsert).mockResolvedValue(userWithProfile as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithProfile as never);

    const res = await request(app)
      .get('/api/v1/profile')
      .set(headers());

    expect(res.body.data.profileSummary).toBe('Пользователь часто испытывает тревогу.');
    expect(res.body.data.hasProfile).toBe(true);
  });
});

// ─── POST /api/v1/profile/refresh ─────────────────────────────────────────────

describe('POST /api/v1/profile/refresh', () => {
  it('returns 400 when fewer than 5 reviews', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.review.count).mockResolvedValue(3);

    const res = await request(app)
      .post('/api/v1/profile/refresh')
      .set(headers());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_ENOUGH_DATA');
  });
});

afterEach(() => vi.clearAllMocks());
