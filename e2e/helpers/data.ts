export const TODAY = new Date().toISOString().slice(0, 10);

// ─── User fixtures ────────────────────────────────────────────────────────────

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

export const NEW_USER = {
  id: 'user_test_1',
  deviceId: DEVICE_ID,
  name: null,
  gender: null,
  birthDate: null,
  preferredTone: 'neutral',
  timezone: 'UTC',
  onboardingCompleted: false,
  eveningReminderTime: null,
  notificationsEnabled: false,
  createdAt: `${TODAY}T08:00:00.000Z`,
  updatedAt: `${TODAY}T08:00:00.000Z`,
};

export const ONBOARDED_USER = {
  ...NEW_USER,
  onboardingCompleted: true,
  name: 'Тест',
};

export const NAMED_USER = {
  ...ONBOARDED_USER,
  name: 'Алекс',
};

// ─── Checkin fixtures ─────────────────────────────────────────────────────────

export const CHECKIN = {
  id: 'checkin_test_1',
  userId: 'user_test_1',
  date: TODAY,
  mood: 3 as 1 | 2 | 3 | 4 | 5,
  focus: 'work' as const,
  contextText: 'Тестовый контекст дня',
  createdAt: `${TODAY}T09:00:00.000Z`,
  updatedAt: `${TODAY}T09:00:00.000Z`,
};

// ─── Prediction fixtures ──────────────────────────────────────────────────────

export const PREDICTION = {
  id: 'pred_test_1',
  userId: 'user_test_1',
  checkinId: 'checkin_test_1',
  date: TODAY,
  dayType: 'День внутреннего шума',
  likelyEvent: 'Сегодня тебя будет задевать чужой тон сильнее, чем обычно',
  strengthPoint: 'Лучше всего сработаешь в одиночных задачах без объяснений',
  trapWarning: 'Не принимай утреннюю усталость за итог всего дня',
  confidence: 'medium' as const,
  modelVersion: 'gpt-4.1-mini',
  generatedFrom: null,
  createdAt: `${TODAY}T09:01:00.000Z`,
};

// ─── Review fixtures ──────────────────────────────────────────────────────────

export const REVIEW = {
  id: 'review_test_1',
  userId: 'user_test_1',
  predictionId: 'pred_test_1',
  date: TODAY,
  likelyEventScore: 'yes' as const,
  strengthPointScore: 'partial' as const,
  trapWarningScore: 'yes' as const,
  comment: null,
  accuracyScore: 0.83,
  createdAt: `${TODAY}T21:00:00.000Z`,
  updatedAt: `${TODAY}T21:00:00.000Z`,
};

// ─── Daily status factory ─────────────────────────────────────────────────────

export type DailyStatusType =
  | 'checkin_missing'
  | 'prediction_generating'
  | 'prediction_ready'
  | 'review_completed';

export function makeStatus(status: DailyStatusType) {
  const hasCheckin = status !== 'checkin_missing';
  const hasPrediction = status === 'prediction_ready' || status === 'review_completed';
  const hasReview = status === 'review_completed';
  return {
    date: TODAY,
    status,
    checkinExists: hasCheckin,
    predictionExists: hasPrediction,
    reviewExists: hasReview,
    checkinId: hasCheckin ? CHECKIN.id : null,
    predictionId: hasPrediction ? PREDICTION.id : null,
    reviewId: hasReview ? REVIEW.id : null,
  };
}

// ─── Weekly insights fixture ──────────────────────────────────────────────────

export const WEEKLY_INSIGHTS = {
  range: { startDate: TODAY, endDate: TODAY },
  summary: {
    totalDays: 3,
    averageAccuracy: 0.72,
    mostFrequentDayType: 'День внутреннего шума',
    mostAccurateSection: 'trapWarning' as const,
  },
  patterns: [
    'Ты чаще ждёшь конфликта там, где его потом не происходит.',
    'В дни с фокусом на работе прогнозы точнее.',
    'Когда ты пишешь короткий контекст, приложение ошибается чаще.',
  ],
  days: [
    { date: TODAY, dayType: 'День внутреннего шума', accuracyScore: 0.83 },
  ],
};

// ─── History fixture ──────────────────────────────────────────────────────────

export const HISTORY = {
  items: [
    {
      date: TODAY,
      dayType: 'День внутреннего шума',
      mood: 3 as const,
      focus: 'work' as const,
      accuracyScore: 0.83,
      reviewCompleted: true,
    },
  ],
  pagination: { limit: 30, offset: 0, total: 1 },
};
