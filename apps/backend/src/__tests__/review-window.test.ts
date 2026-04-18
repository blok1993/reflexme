import { describe, it, expect } from 'vitest';
import { canSubmitReviewForPredictionDate, getCalendarDateAndHourInTimeZone } from '../lib/review-window.js';

describe('getCalendarDateAndHourInTimeZone', () => {
  it('returns YYYY-MM-DD and hour for Europe/Moscow', () => {
    const r = getCalendarDateAndHourInTimeZone('Europe/Moscow');
    expect(r.ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.hour).toBeGreaterThanOrEqual(0);
    expect(r.hour).toBeLessThanOrEqual(23);
  });
});

describe('canSubmitReviewForPredictionDate', () => {
  it('allows past days regardless of hour', () => {
    const r = canSubmitReviewForPredictionDate({
      predictionDate: '2020-01-01',
      userTimeZone: 'UTC',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects future prediction date', () => {
    const r = canSubmitReviewForPredictionDate({
      predictionDate: '2099-12-31',
      userTimeZone: 'UTC',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VALIDATION_ERROR');
  });
});
