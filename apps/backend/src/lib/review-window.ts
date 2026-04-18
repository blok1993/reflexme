/** Local calendar day (YYYY-MM-DD) and hour in IANA timezone. */
export function getCalendarDateAndHourInTimeZone(timeZone: string | null | undefined): {
  ymd: string;
  hour: number;
} {
  const tz = timeZone?.trim() || 'UTC';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') m[p.type] = p.value;
  }
  const ymd = `${m.year}-${m.month}-${m.day}`;
  const hour = parseInt(m.hour ?? '0', 10);
  return { ymd, hour };
}

const EVENING_START_HOUR = 17;

/**
 * Review for a past calendar day (in the user's TZ) may be submitted anytime.
 * For "today", only from 17:00 local time onward.
 */
export function canSubmitReviewForPredictionDate(params: {
  predictionDate: string;
  userTimeZone: string | null | undefined;
}): { ok: true } | { ok: false; code: string; message: string } {
  const { ymd, hour } = getCalendarDateAndHourInTimeZone(params.userTimeZone);
  if (params.predictionDate < ymd) return { ok: true };
  if (params.predictionDate > ymd) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Нельзя оценить будущий день' };
  }
  if (hour < EVENING_START_HOUR) {
    return {
      ok: false,
      code: 'REVIEW_TOO_EARLY',
      message: 'Оценка дня доступна с 17:00 по твоему локальному времени',
    };
  }
  return { ok: true };
}
