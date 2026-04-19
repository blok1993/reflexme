import { Router } from 'express';
import type { DailyCheckin, Prediction, Prisma, Review } from '@prisma/client';
import type { FocusArea, PreferredTone } from '@predictor/contracts';
import { prisma } from '../lib/prisma.js';
import { fail, ok } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';
import {
  generatePredictionLLM,
  generateWeeklyPatternsLLM,
  generateProfileSummaryLLM,
  generatePatternCardsLLM,
  type PatternCard,
} from '../services/prediction.service.js';
import { analyzeVocabulary } from '../services/vocabulary.service.js';
import { canSubmitReviewForPredictionDate } from '../lib/review-window.js';

const router = Router();

/** Составные типы без `Prisma.*GetPayload` — на CI иногда другой сгенерированный namespace. */
type ReviewWithPredictionCheckin = Review & {
  prediction: Prediction & { checkin: DailyCheckin };
};

type CheckinWithPredictionReview = DailyCheckin & {
  prediction: (Prediction & { review: Review | null }) | null;
};

type ReviewDateAccuracy = Pick<Review, 'date' | 'accuracyScore'>;

type CheckinContextOnly = Pick<DailyCheckin, 'contextText'>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Asynchronously regenerates the user's psychological profile summary
 * if enough reviews exist and the profile hasn't been updated recently.
 *
 * Runs fire-and-forget after a review is submitted — doesn't block the response.
 * Profile becomes available on the NEXT prediction request.
 *
 * Conditions for update:
 *  - At least 5 completed reviews
 *  - Profile is either missing or was last generated ≥ 6 days ago
 */
async function maybeUpdateProfile(userId: string): Promise<void> {
  const totalReviews = await prisma.review.count({ where: { userId } });
  if (totalReviews < 5) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const profileAgeMs = user.profileUpdatedAt
    ? Date.now() - user.profileUpdatedAt.getTime()
    : Infinity;

  const sixDays = 6 * 24 * 60 * 60 * 1000;
  if (profileAgeMs < sixDays) return; // still fresh

  // Load last 30 reviews with full context
  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { prediction: { include: { checkin: true } } },
  });

  const summary = await generateProfileSummaryLLM({
    totalReviews,
    reviews: reviews.map((r: ReviewWithPredictionCheckin) => ({
      date: r.date,
      mood: r.prediction?.checkin?.mood ?? 3,
      focus: r.prediction?.checkin?.focus ?? 'work',
      dayType: r.prediction?.dayType ?? '',
      likelyEventScore: r.likelyEventScore,
      strengthPointScore: r.strengthPointScore,
      trapWarningScore: r.trapWarningScore,
      comment: r.comment,
      contextText: r.prediction?.checkin?.contextText ?? null,
    })),
  });

  if (summary) {
    await prisma.user.update({
      where: { id: userId },
      data: { profileSummary: summary, profileUpdatedAt: new Date() },
    });
    logger.info({ userId, length: summary.length }, 'User profile summary updated');
  }
}

/**
 * Regenerates pattern cards when enough reviews exist and cards are stale.
 * Requires 15+ reviews; updates every ~10 days.
 */
async function maybeUpdatePatternCards(userId: string): Promise<void> {
  const totalReviews = await prisma.review.count({ where: { userId } });
  if (totalReviews < 7) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const ageMs = user.patternCardsUpdatedAt
    ? Date.now() - user.patternCardsUpdatedAt.getTime()
    : Infinity;
  if (ageMs < 10 * 24 * 60 * 60 * 1000) return;

  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { prediction: { include: { checkin: true } } },
  });

  const cards = await generatePatternCardsLLM({
    totalReviews,
    reviews: reviews.map((r: ReviewWithPredictionCheckin) => ({
      date: r.date,
      mood: r.prediction?.checkin?.mood ?? 3,
      focus: r.prediction?.checkin?.focus ?? 'work',
      dayType: r.prediction?.dayType ?? '',
      likelyEventScore: r.likelyEventScore,
      strengthPointScore: r.strengthPointScore,
      trapWarningScore: r.trapWarningScore,
      comment: r.comment,
      contextText: r.prediction?.checkin?.contextText ?? null,
    })),
  });

  if (cards) {
    await prisma.user.update({
      where: { id: userId },
      data: { patternCards: JSON.stringify(cards), patternCardsUpdatedAt: new Date() },
    });
    logger.info({ userId, count: cards.length }, 'Pattern cards updated');
  }
}

/** Find or create a user identified by their device ID. */
async function getOrCreateUser(deviceId: string) {
  const existing = await prisma.user.findUnique({ where: { deviceId } });
  if (existing) return existing;
  return prisma.user.create({
    data: { deviceId, timezone: 'UTC', preferredTone: 'neutral', onboardingCompleted: false },
  });
}

export function scoreValue(value: 'yes' | 'partial' | 'no'): number {
  return value === 'yes' ? 1 : value === 'partial' ? 0.5 : 0;
}

export function calculateAccuracy(
  likelyEventScore: 'yes' | 'partial' | 'no',
  strengthPointScore: 'yes' | 'partial' | 'no',
  trapWarningScore: 'yes' | 'partial' | 'no',
): number {
  return (scoreValue(likelyEventScore) + scoreValue(strengthPointScore) + scoreValue(trapWarningScore)) / 3;
}

// ─── Health ──────────────────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, {
      status: 'ok',
      db: 'connected',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      uptime_s: Math.floor(process.uptime()),
    });
  } catch (err) {
    logger.error({ err }, 'Health check DB ping failed');
    res.status(503).json({
      success: false,
      error: { code: 'UNHEALTHY', message: 'Database unavailable' },
    });
  }
});

// ─── User ────────────────────────────────────────────────────────────────────

router.get('/api/v1/users/me', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  ok(res, { user });
});

router.post('/api/v1/users/me', async (req, res) => {
  const schema = z
    .object({
      name: z.string().max(60).optional(),
      gender: z.enum(['male', 'female']).nullable().optional(),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      preferredTone: z.enum(['gentle', 'neutral', 'sharp']).optional(),
      timezone: z.string().max(80).optional(),
      onboardingCompleted: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.onboardingCompleted === true && data.gender !== 'male' && data.gender !== 'female') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Укажи пол, чтобы завершить настройку',
          path: ['gender'],
        });
      }
    });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Invalid body', 400, parsed.error.flatten());
  const current = await getOrCreateUser(req.deviceId);
  const user = await prisma.user.update({ where: { id: current.id }, data: parsed.data });
  ok(res, { user });
});

// ─── Daily status ─────────────────────────────────────────────────────────────

router.get('/api/v1/daily-status', async (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return fail(res, 'VALIDATION_ERROR', 'date is required');
  const user = await getOrCreateUser(req.deviceId);

  const checkin = await prisma.dailyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } });
  const prediction = await prisma.prediction.findUnique({ where: { userId_date: { userId: user.id, date } } });
  const review = await prisma.review.findUnique({ where: { userId_date: { userId: user.id, date } } });

  const status = review
    ? 'review_completed'
    : prediction
      ? 'prediction_ready'
      : checkin
        ? 'prediction_generating'
        : 'checkin_missing';

  ok(res, {
    date,
    status,
    checkinExists: Boolean(checkin),
    predictionExists: Boolean(prediction),
    reviewExists: Boolean(review),
    checkinId: checkin?.id ?? null,
    predictionId: prediction?.id ?? null,
    reviewId: review?.id ?? null,
  });
});

// ─── Check-ins ────────────────────────────────────────────────────────────────

router.post('/api/v1/checkins', async (req, res) => {
  const schema = z.object({
    date: z.string().min(1),
    mood: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    focus: z.enum([
      'work',
      'people',
      'energy',
      'emotions',
      'tension',
      'control',
      'rest',
      'self_focus',
    ]),
    contextText: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Invalid body', 400, parsed.error.flatten());

  const user = await getOrCreateUser(req.deviceId);
  const exists = await prisma.dailyCheckin.findUnique({
    where: { userId_date: { userId: user.id, date: parsed.data.date } },
  });
  if (exists) return fail(res, 'CHECKIN_ALREADY_EXISTS', 'Check-in for this date already exists', 409);

  const checkin = await prisma.dailyCheckin.create({
    data: {
      userId: user.id,
      date: parsed.data.date,
      mood: parsed.data.mood,
      focus: parsed.data.focus,
      contextText: parsed.data.contextText,
    },
  });

  ok(res, { checkin }, 201);
});

router.get('/api/v1/checkins/by-date', async (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return fail(res, 'VALIDATION_ERROR', 'date is required');
  const user = await getOrCreateUser(req.deviceId);
  const checkin = await prisma.dailyCheckin.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!checkin) return fail(res, 'NOT_FOUND', 'Check-in not found', 404);
  ok(res, { checkin });
});

// ─── Predictions ──────────────────────────────────────────────────────────────

router.post('/api/v1/predictions/generate', async (req, res) => {
  const schema = z.object({ checkinId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Invalid body', 400, parsed.error.flatten());

  const user = await getOrCreateUser(req.deviceId);
  const checkin = await prisma.dailyCheckin.findUnique({ where: { id: parsed.data.checkinId } });
  if (!checkin || checkin.userId !== user.id) return fail(res, 'NOT_FOUND', 'Check-in not found', 404);

  const existing = await prisma.prediction.findUnique({ where: { checkinId: checkin.id } });
  if (existing) return ok(res, { prediction: existing });

  const recentReviews = await prisma.review.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 7,
    include: { prediction: { include: { checkin: true } } },
  });

  let llm;
  try {
    llm = await generatePredictionLLM({
      preferredTone: user.preferredTone as PreferredTone,
      gender: user.gender,
      birthDate: user.birthDate,
      profileSummary: user.profileSummary ?? null,
      today: {
        mood: checkin.mood as 1 | 2 | 3 | 4 | 5,
        focus: checkin.focus as FocusArea,
        contextText: checkin.contextText ?? '',
      },
      recentHistory: recentReviews.map((r: ReviewWithPredictionCheckin) => ({
        date: r.date,
        mood: r.prediction?.checkin?.mood ?? 3,
        focus: r.prediction?.checkin?.focus ?? 'work',
        accuracyScore: r.accuracyScore,
        reviewComment: r.comment,
        dayType: r.prediction?.dayType,
      })),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, checkinId: checkin.id }, 'LLM generation failed');
    return fail(res, 'GENERATION_FAILED', 'Failed to generate prediction. Please try again.', 503);
  }

  // Double-checked create: re-check inside a serializable transaction so that a
  // concurrent request that won the race returns the already-created prediction
  // instead of triggering a second LLM call and crashing on the unique constraint.
  let prediction;
  try {
    prediction = await prisma.$transaction(async (tx) => {
      const race = await tx.prediction.findUnique({ where: { checkinId: checkin.id } });
      if (race) return race;
      return tx.prediction.create({
        data: {
          userId: user.id,
          checkinId: checkin.id,
          date: checkin.date,
          dayType: llm.dayType,
          likelyEvent: llm.likelyEvent,
          strengthPoint: llm.strengthPoint,
          trapWarning: llm.trapWarning,
          confidence: llm.confidence,
          modelVersion: llm.modelVersion,
          generatedFrom: {
            mood: checkin.mood,
            focus: checkin.focus,
            contextLength: checkin.contextText?.length ?? 0,
            preferredTone: user.preferredTone,
          },
          rawResponse: process.env.NODE_ENV !== 'production' ? (llm as Prisma.InputJsonValue) : undefined,
        },
      });
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, checkinId: checkin.id }, 'Prediction create failed');
    return fail(res, 'GENERATION_FAILED', 'Failed to save prediction. Please try again.', 503);
  }

  ok(res, { prediction }, 201);
});

router.get('/api/v1/predictions/by-date', async (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return fail(res, 'VALIDATION_ERROR', 'date is required');
  const user = await getOrCreateUser(req.deviceId);
  const prediction = await prisma.prediction.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!prediction) return fail(res, 'NOT_FOUND', 'Prediction not found', 404);
  ok(res, { prediction });
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

router.post('/api/v1/reviews', async (req, res) => {
  const schema = z.object({
    predictionId: z.string().min(1),
    likelyEventScore: z.enum(['yes', 'partial', 'no']),
    strengthPointScore: z.enum(['yes', 'partial', 'no']),
    trapWarningScore: z.enum(['yes', 'partial', 'no']),
    comment: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Invalid body', 400, parsed.error.flatten());

  const user = await getOrCreateUser(req.deviceId);
  const prediction = await prisma.prediction.findUnique({ where: { id: parsed.data.predictionId } });
  if (!prediction || prediction.userId !== user.id) return fail(res, 'NOT_FOUND', 'Prediction not found', 404);

  const existingReview = await prisma.review.findUnique({ where: { predictionId: prediction.id } });
  if (existingReview) return ok(res, { review: existingReview });

  const windowCheck = canSubmitReviewForPredictionDate({
    predictionDate: prediction.date,
    userTimeZone: user.timezone,
  });
  if (!windowCheck.ok) {
    return fail(res, windowCheck.code, windowCheck.message, windowCheck.code === 'REVIEW_TOO_EARLY' ? 403 : 400);
  }

  const accuracyScore = calculateAccuracy(
    parsed.data.likelyEventScore,
    parsed.data.strengthPointScore,
    parsed.data.trapWarningScore,
  );

  const review = await prisma.review.create({
    data: {
      userId: user.id,
      predictionId: prediction.id,
      date: prediction.date,
      likelyEventScore: parsed.data.likelyEventScore,
      strengthPointScore: parsed.data.strengthPointScore,
      trapWarningScore: parsed.data.trapWarningScore,
      comment: parsed.data.comment,
      accuracyScore,
    },
  });

  ok(res, { review }, 201);

  // Mark weekly patterns cache as stale so it regenerates on next visit.
  // Setting reviewCount: -1 ensures it never matches the real count.
  if (user.weeklyPatternsCache) {
    try {
      const wc = JSON.parse(user.weeklyPatternsCache);
      prisma.user.update({
        where: { id: user.id },
        data: { weeklyPatternsCache: JSON.stringify({ ...wc, reviewCount: -1 }) },
      }).catch(() => { /* non-critical */ });
    } catch { /* ignore parse errors */ }
  }

  // Fire-and-forget background LLM updates — don't block the response
  maybeUpdateProfile(user.id).catch((err) =>
    logger.warn({ err: (err as Error).message }, 'Background profile update failed'),
  );
  maybeUpdatePatternCards(user.id).catch((err) =>
    logger.warn({ err: (err as Error).message }, 'Background pattern cards update failed'),
  );
});

router.get('/api/v1/reviews/by-date', async (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return fail(res, 'VALIDATION_ERROR', 'date is required');
  const user = await getOrCreateUser(req.deviceId);
  const review = await prisma.review.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!review) return fail(res, 'NOT_FOUND', 'Review not found', 404);
  ok(res, { review });
});

// ─── History ──────────────────────────────────────────────────────────────────

router.get('/api/v1/history', async (req, res) => {
  const limit = Number(req.query.limit ?? 30);
  const offset = Number(req.query.offset ?? 0);
  const user = await getOrCreateUser(req.deviceId);
  const total = await prisma.dailyCheckin.count({ where: { userId: user.id } });
  const checkins = await prisma.dailyCheckin.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    skip: offset,
    take: limit,
    include: { prediction: { include: { review: true } } },
  });

  ok(res, {
    items: checkins.map((c: CheckinWithPredictionReview) => ({
      date: c.date,
      dayType: c.prediction?.dayType ?? null,
      mood: c.mood,
      focus: c.focus,
      accuracyScore: c.prediction?.review?.accuracyScore ?? null,
      reviewCompleted: Boolean(c.prediction?.review),
    })),
    pagination: { limit, offset, total },
  });
});

// ─── Insights ─────────────────────────────────────────────────────────────────

router.get('/api/v1/insights/weekly', async (req, res) => {
  const startDate = String(req.query.startDate || '');
  const endDate = String(req.query.endDate || '');
  if (!startDate || !endDate) return fail(res, 'VALIDATION_ERROR', 'startDate and endDate are required');

  const user = await getOrCreateUser(req.deviceId);
  const reviews: ReviewWithPredictionCheckin[] = await prisma.review.findMany({
    where: { userId: user.id, date: { gte: startDate, lte: endDate } },
    include: { prediction: { include: { checkin: true } } },
    orderBy: { date: 'desc' },
  });

  const totalDays = reviews.length;
  const averageAccuracy = totalDays
    ? reviews.reduce((sum: number, r: ReviewWithPredictionCheckin) => sum + (r.accuracyScore ?? 0), 0) / totalDays
    : null;

  const dayTypeCount = new Map<string, number>();
  for (const r of reviews) {
    const key = r.prediction.dayType;
    dayTypeCount.set(key, (dayTypeCount.get(key) ?? 0) + 1);
  }
  const mostFrequentDayType = [...dayTypeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sectionSums = { likelyEvent: 0, strengthPoint: 0, trapWarning: 0 };
  const score = (s: string) => scoreValue(s as 'yes' | 'partial' | 'no');
  reviews.forEach((r: ReviewWithPredictionCheckin) => {
    sectionSums.likelyEvent += score(r.likelyEventScore);
    sectionSums.strengthPoint += score(r.strengthPointScore);
    sectionSums.trapWarning += score(r.trapWarningScore);
  });
  const mostAccurateSection = totalDays
    ? (Object.entries(sectionSums).sort((a, b) => b[1] - a[1])[0][0] as 'likelyEvent' | 'strengthPoint' | 'trapWarning')
    : null;

  // ── Pattern cache logic ──────────────────────────────────────────────────────
  // Weekly LLM patterns are cached in User.weeklyPatternsCache keyed by startDate.
  // We only regenerate when:
  //   (a) it's a different week, or
  //   (b) more reviews have been added since last generation.
  // This makes the endpoint respond in <20ms on repeat visits instead of 5-8s.

  type WeeklyCache = { week: string; patterns: string[]; reviewCount: number; generatedAt: number };
  let patterns: string[];

  const cached = user.weeklyPatternsCache
    ? (JSON.parse(user.weeklyPatternsCache) as WeeklyCache)
    : null;

  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  const cacheAge = cached?.generatedAt ? Date.now() - cached.generatedAt : Infinity;

  const needsRegen =
    !cached ||
    cached.week !== startDate ||
    // Regenerate if new reviews appeared AND cache is at least 8 hours old.
    // Prevents calling LLM every evening after the user submits their review.
    (cached.reviewCount !== totalDays && cacheAge > EIGHT_HOURS);

  if (needsRegen) {
    patterns = await generateWeeklyPatternsLLM({
      totalDays,
      averageAccuracy,
      mostFrequentDayType,
      reviews: reviews.map((r: ReviewWithPredictionCheckin) => ({
        date: r.date,
        dayType: r.prediction.dayType,
        likelyEventScore: r.likelyEventScore,
        strengthPointScore: r.strengthPointScore,
        trapWarningScore: r.trapWarningScore,
        comment: r.comment,
        mood: r.prediction.checkin?.mood ?? 3,
        focus: r.prediction.checkin?.focus ?? 'work',
      })),
    });
    // Persist cache — awaited so that the next request sees the saved result and
    // does not regenerate (and call LLM) again due to a failed fire-and-forget write.
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          weeklyPatternsCache: JSON.stringify({
            week: startDate,
            patterns,
            reviewCount: totalDays,
            generatedAt: Date.now(),
          } satisfies WeeklyCache),
        },
      });
    } catch (err: unknown) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Failed to cache weekly patterns — next request will regenerate');
    }
  } else {
    patterns = cached.patterns;
    logger.debug({ week: startDate }, 'Weekly patterns served from cache');
  }

  ok(res, {
    range: { startDate, endDate },
    summary: { totalDays, averageAccuracy, mostFrequentDayType, mostAccurateSection },
    patterns,
    days: reviews.map((r: ReviewWithPredictionCheckin) => ({
      date: r.date,
      dayType: r.prediction.dayType,
      accuracyScore: r.accuracyScore,
    })),
  });
});

// ─── Profile summary ──────────────────────────────────────────────────────────

/** GET current profile summary — shows what the model knows about the user */
router.get('/api/v1/profile', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  ok(res, {
    profileSummary: user.profileSummary,
    profileUpdatedAt: user.profileUpdatedAt,
    hasProfile: !!user.profileSummary,
  });
});

/** POST force-refresh the profile — useful for dev/testing */
router.post('/api/v1/profile/refresh', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  const totalReviews = await prisma.review.count({ where: { userId: user.id } });

  if (totalReviews < 5) {
    return fail(res, 'NOT_ENOUGH_DATA', `Need at least 5 reviews, have ${totalReviews}`, 400);
  }

  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { prediction: { include: { checkin: true } } },
  });

  const summary = await generateProfileSummaryLLM({
    totalReviews,
    reviews: reviews.map((r: ReviewWithPredictionCheckin) => ({
      date: r.date,
      mood: r.prediction?.checkin?.mood ?? 3,
      focus: r.prediction?.checkin?.focus ?? 'work',
      dayType: r.prediction?.dayType ?? '',
      likelyEventScore: r.likelyEventScore,
      strengthPointScore: r.strengthPointScore,
      trapWarningScore: r.trapWarningScore,
      comment: r.comment,
      contextText: r.prediction?.checkin?.contextText ?? null,
    })),
  });

  if (!summary) {
    return fail(res, 'GENERATION_FAILED', 'Could not generate profile summary', 503);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { profileSummary: summary, profileUpdatedAt: new Date() },
  });

  ok(res, { profileSummary: updated.profileSummary, profileUpdatedAt: updated.profileUpdatedAt });
});

// ─── Accuracy curve ───────────────────────────────────────────────────────────

router.get('/api/v1/insights/accuracy-curve', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' },
    select: { date: true, accuracyScore: true },
  });

  // Build cumulative running average: each point = mean of all days up to that date.
  // This smooths out day-to-day variance and shows whether accuracy is improving overall.
  const withScore = reviews.filter((r: ReviewDateAccuracy) => r.accuracyScore !== null);
  let runningSum = 0;
  const dataPoints = withScore.map((r: ReviewDateAccuracy, i: number) => {
    runningSum += r.accuracyScore as number;
    return { date: r.date, accuracy: runningSum / (i + 1) };
  });

  // Prepend a synthetic 0% origin so the curve always starts from zero,
  // making the upward trend immediately visible.
  const points = dataPoints.length > 0
    ? [{ date: null as unknown as string, accuracy: 0 }, ...dataPoints]
    : [];

  // Trend: compare the first-half cumulative average vs second-half cumulative average.
  // Since points are already smoothed, a small delta (>3%) is meaningful.
  let trend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
  if (points.length >= 6) {
    const mid = Math.floor(points.length / 2);
    const firstHalfLast = points[mid - 1].accuracy;        // cumulative avg at midpoint
    const secondHalfLast = points[points.length - 1].accuracy; // cumulative avg at end
    const diff = secondHalfLast - firstHalfLast;
    trend = diff > 0.03 ? 'improving' : diff < -0.03 ? 'declining' : 'stable';
  }

  ok(res, { points, trend, totalReviews: reviews.length });
});

// ─── Vocabulary ────────────────────────────────────────────────────────────────

router.get('/api/v1/insights/vocabulary', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  const checkins = await prisma.dailyCheckin.findMany({
    where: { userId: user.id },
    select: { contextText: true },
    orderBy: { date: 'desc' },
    take: 90, // last 3 months max
  });

  const texts = checkins.map((c: CheckinContextOnly) => c.contextText);
  const words = analyzeVocabulary(texts);
  const analyzed = texts.filter(Boolean).length;

  ok(res, {
    words,
    totalCheckins: checkins.length,
    analyzedCheckins: analyzed,
    hasEnoughData: analyzed >= 5 && words.length >= 3,
  });
});

// ─── Pattern cards ─────────────────────────────────────────────────────────────

router.get('/api/v1/insights/patterns', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  const totalReviews = await prisma.review.count({ where: { userId: user.id } });

  const cards: PatternCard[] = user.patternCards
    ? (JSON.parse(user.patternCards) as PatternCard[])
    : [];

  ok(res, {
    cards,
    generatedAt: user.patternCardsUpdatedAt ?? null,
    totalReviews,
    hasEnoughData: totalReviews >= 7,
    minimumRequired: 7,
  });
});

/** Force-refresh pattern cards (dev/testing) */
router.post('/api/v1/insights/patterns/refresh', async (req, res) => {
  const user = await getOrCreateUser(req.deviceId);
  const totalReviews = await prisma.review.count({ where: { userId: user.id } });

  if (totalReviews < 7) {
    return fail(res, 'NOT_ENOUGH_DATA', `Need at least 7 reviews, have ${totalReviews}`, 400);
  }

  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { prediction: { include: { checkin: true } } },
  });

  const cards = await generatePatternCardsLLM({
    totalReviews,
    reviews: reviews.map((r: ReviewWithPredictionCheckin) => ({
      date: r.date,
      mood: r.prediction?.checkin?.mood ?? 3,
      focus: r.prediction?.checkin?.focus ?? 'work',
      dayType: r.prediction?.dayType ?? '',
      likelyEventScore: r.likelyEventScore,
      strengthPointScore: r.strengthPointScore,
      trapWarningScore: r.trapWarningScore,
      comment: r.comment,
      contextText: r.prediction?.checkin?.contextText ?? null,
    })),
  });

  if (!cards) return fail(res, 'GENERATION_FAILED', 'Could not generate pattern cards', 503);

  await prisma.user.update({
    where: { id: user.id },
    data: { patternCards: JSON.stringify(cards), patternCardsUpdatedAt: new Date() },
  });

  ok(res, { cards, generatedAt: new Date().toISOString(), totalReviews });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.patch('/api/v1/settings', async (req, res) => {
  const schema = z.object({
    preferredTone: z.enum(['gentle', 'neutral', 'sharp']).optional(),
    eveningReminderTime: z.string().nullable().optional(),
    notificationsEnabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Invalid body', 400, parsed.error.flatten());

  const user = await getOrCreateUser(req.deviceId);
  const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  ok(res, {
    settings: {
      preferredTone: updated.preferredTone,
      eveningReminderTime: updated.eveningReminderTime,
      notificationsEnabled: updated.notificationsEnabled,
    },
  });
});

export default router;
