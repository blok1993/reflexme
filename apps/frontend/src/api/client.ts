import { getDeviceId, DEVICE_ID_HEADER } from '../lib/deviceId';
import type {
  User,
  DailyCheckin,
  Prediction,
  Review,
  WeeklyInsightsPayload,
  DailyStatus,
  FocusArea,
  PreferredTone,
  CreateCheckinDto,
  CreateReviewDto,
  UpdateSettingsDto,
  ISODateString,
  UUID,
  AccuracyCurvePayload,
  VocabularyPayload,
  PatternCardsPayload,
} from '@predictor/contracts';

const BASE = '/api/v1';

// ─── ApiError ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Client errors (4xx) should not be retried. */
  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  /** Server errors (5xx) may be transient and can be retried. */
  get isServerError() {
    return this.status >= 500;
  }
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        [DEVICE_ID_HEADER]: getDeviceId(),
      },
      ...init,
    });
  } catch (networkErr) {
    // fetch() itself threw — likely offline or DNS failure
    throw new ApiError(
      'Network request failed. Check your connection.',
      'NETWORK_ERROR',
      0,
    );
  }

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    throw new ApiError(
      json?.error?.message ?? `HTTP ${response.status}`,
      json?.error?.code ?? 'HTTP_ERROR',
      response.status,
    );
  }

  return json.data as T;
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const api = {
  getMe: () =>
    request<{ user: User }>('/users/me'),

  updateMe: (dto: UpdateSettingsDto) =>
    request<{ user: User }>('/users/me', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getDailyStatus: (date: string) =>
    request<{
      date: ISODateString;
      status: DailyStatus;
      checkinExists: boolean;
      predictionExists: boolean;
      reviewExists: boolean;
      checkinId: UUID | null;
      predictionId: UUID | null;
      reviewId: UUID | null;
    }>(`/daily-status?date=${date}`),

  createCheckin: (dto: CreateCheckinDto) =>
    request<{ checkin: DailyCheckin }>('/checkins', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getCheckinByDate: (date: string) =>
    request<{ checkin: DailyCheckin }>(`/checkins/by-date?date=${date}`),

  generatePrediction: (checkinId: string) =>
    request<{ prediction: Prediction }>('/predictions/generate', {
      method: 'POST',
      body: JSON.stringify({ checkinId }),
    }),

  getPredictionByDate: (date: string) =>
    request<{ prediction: Prediction }>(`/predictions/by-date?date=${date}`),

  createReview: (dto: CreateReviewDto) =>
    request<{ review: Review }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getReviewByDate: (date: string) =>
    request<{ review: Review }>(`/reviews/by-date?date=${date}`),

  /** Same as getReviewByDate but returns null instead of throwing when review is missing (404). */
  getReviewByDateOptional: async (date: string): Promise<{ review: Review | null }> => {
    try {
      return await request<{ review: Review }>(`/reviews/by-date?date=${date}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return { review: null };
      }
      throw e;
    }
  },

  getHistory: (limit = 30, offset = 0) =>
    request<{
      items: Array<{
        date: ISODateString;
        dayType: string | null;
        mood: 1 | 2 | 3 | 4 | 5;
        focus: FocusArea;
        accuracyScore: number | null;
        reviewCompleted: boolean;
      }>;
      pagination: { limit: number; offset: number; total: number };
    }>(`/history?limit=${limit}&offset=${offset}`),

  getWeeklyInsights: (startDate: string, endDate: string) =>
    request<WeeklyInsightsPayload>(
      `/insights/weekly?startDate=${startDate}&endDate=${endDate}`,
    ),

  getAccuracyCurve: () =>
    request<AccuracyCurvePayload>('/insights/accuracy-curve'),

  getVocabulary: () =>
    request<VocabularyPayload>('/insights/vocabulary'),

  getPatternCards: () =>
    request<PatternCardsPayload>('/insights/patterns'),

  updateSettings: (dto: Partial<{
    preferredTone: PreferredTone;
    eveningReminderTime: string | null;
    notificationsEnabled: boolean;
  }>) =>
    request<{
      settings: {
        preferredTone: PreferredTone;
        eveningReminderTime: string | null;
        notificationsEnabled: boolean;
      };
    }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
};
