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

/** Dev: Vite proxies `/api` → backend. Prod: set `VITE_API_BASE_URL` to backend origin + path, e.g. `https://reflexme-api.onrender.com/api/v1` */
const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api/v1';

/** Если бэкенд «спит» или не отвечает, без таймаута React Query зависнет в loading навсегда. Free Render может просыпаться десятки секунд. */
const REQUEST_TIMEOUT_MS = 65_000;

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    headers.set(DEVICE_ID_HEADER, getDeviceId());

    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    if (networkErr instanceof DOMException && networkErr.name === 'AbortError') {
      throw new ApiError(
        'Сервер не ответил вовремя (таймаут). На Render бесплатный инстанс может просыпаться ~1 мин; повтори позже или проверь логи бэкенда.',
        'TIMEOUT',
        0,
      );
    }
    if (networkErr instanceof Error && networkErr.name === 'AbortError') {
      throw new ApiError(
        'Сервер не ответил вовремя (таймаут). На Render бесплатный инстанс может просыпаться ~1 мин; повтори позже или проверь логи бэкенда.',
        'TIMEOUT',
        0,
      );
    }
    throw new ApiError(
      'Нет сети или сервер недоступен.',
      'NETWORK_ERROR',
      0,
    );
  }

  clearTimeout(timeoutId);

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    const fallbackMsg =
      response.ok && json == null
        ? 'Ответ не JSON (часто отдаётся HTML со статикой). Укажи VITE_API_BASE_URL на URL бэкенда в настройках сборки.'
        : `HTTP ${response.status}`;
    throw new ApiError(
      json?.error?.message ?? fallbackMsg,
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
