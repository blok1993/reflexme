export type UUID = string;
export type ISODateString = string;
export type ISODateTimeString = string;

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type PreferredTone = 'gentle' | 'neutral' | 'sharp';
export type FocusArea =
  | 'work'
  | 'people'
  | 'energy'
  | 'emotions'
  | 'tension'
  | 'control'
  | 'rest'
  | 'self_focus';
export type PredictionConfidence = 'low' | 'medium' | 'high';
export type ReviewScore = 'yes' | 'partial' | 'no';

export type DailyStatus =
  | 'checkin_missing'
  | 'prediction_generating'
  | 'prediction_ready'
  | 'review_completed';

export type Gender = 'male' | 'female';

export interface User {
  id: UUID;
  deviceId: string;
  name: string | null;
  gender: Gender | null;
  birthDate: string | null; // YYYY-MM-DD
  preferredTone: PreferredTone;
  timezone: string;
  onboardingCompleted: boolean;
  eveningReminderTime: string | null;
  notificationsEnabled: boolean;
  profileSummary: string | null;
  profileUpdatedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface DailyCheckin {
  id: UUID;
  userId: UUID;
  date: ISODateString;
  mood: 1 | 2 | 3 | 4 | 5;
  focus: FocusArea;
  contextText: string | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface PredictionGeneratedFrom {
  mood: 1 | 2 | 3 | 4 | 5;
  focus: FocusArea;
  contextLength?: number;
  preferredTone?: PreferredTone;
}

export interface Prediction {
  id: UUID;
  userId: UUID;
  checkinId: UUID;
  date: ISODateString;
  dayType: string;
  likelyEvent: string;
  strengthPoint: string;
  trapWarning: string;
  confidence: PredictionConfidence;
  modelVersion: string;
  generatedFrom: PredictionGeneratedFrom | null;
  createdAt: ISODateTimeString;
}

export interface Review {
  id: UUID;
  userId: UUID;
  predictionId: UUID;
  date: ISODateString;
  likelyEventScore: ReviewScore;
  strengthPointScore: ReviewScore;
  trapWarningScore: ReviewScore;
  comment: string | null;
  accuracyScore: number | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface WeeklyInsightDay {
  date: ISODateString;
  dayType: string;
  accuracyScore: number | null;
}

export interface WeeklySummary {
  totalDays: number;
  averageAccuracy: number | null;
  mostFrequentDayType: string | null;
  mostAccurateSection: 'likelyEvent' | 'strengthPoint' | 'trapWarning' | null;
}

export interface WeeklyInsightsPayload {
  range: { startDate: ISODateString; endDate: ISODateString };
  summary: WeeklySummary;
  patterns: string[];
  days: WeeklyInsightDay[];
}

export interface CreateCheckinDto {
  date: ISODateString;
  mood: 1 | 2 | 3 | 4 | 5;
  focus: FocusArea;
  contextText?: string;
}

export interface GeneratePredictionDto {
  checkinId: UUID;
}

export interface CreateReviewDto {
  predictionId: UUID;
  likelyEventScore: ReviewScore;
  strengthPointScore: ReviewScore;
  trapWarningScore: ReviewScore;
  comment?: string;
}

export interface UpdateSettingsDto {
  name?: string;
  gender?: Gender | null;
  birthDate?: string | null;
  preferredTone?: PreferredTone;
  eveningReminderTime?: string | null;
  notificationsEnabled?: boolean;
  onboardingCompleted?: boolean;
  timezone?: string;
}

export type GetMeResponse = ApiResponse<{ user: User }>;
export type UpsertMeResponse = ApiResponse<{ user: User }>;
export type GetDailyStatusResponse = ApiResponse<{
  date: ISODateString;
  status: DailyStatus;
  checkinExists: boolean;
  predictionExists: boolean;
  reviewExists: boolean;
  checkinId: UUID | null;
  predictionId: UUID | null;
  reviewId: UUID | null;
}>;
export type CreateCheckinResponse = ApiResponse<{ checkin: DailyCheckin }>;
export type GetCheckinByDateResponse = ApiResponse<{ checkin: DailyCheckin }>;
export type GeneratePredictionResponse = ApiResponse<{ prediction: Prediction }>;
export type GetPredictionByDateResponse = ApiResponse<{ prediction: Prediction }>;
export type CreateReviewResponse = ApiResponse<{ review: Review }>;
export type GetReviewByDateResponse = ApiResponse<{ review: Review }>;
export type GetHistoryResponse = ApiResponse<{
  items: Array<{
    date: ISODateString;
    dayType: string;
    mood: 1 | 2 | 3 | 4 | 5;
    focus: FocusArea;
    accuracyScore: number | null;
    reviewCompleted: boolean;
  }>;
  pagination: { limit: number; offset: number; total: number };
}>;
export type GetWeeklyInsightsResponse = ApiResponse<WeeklyInsightsPayload>;

// ─── Accuracy curve ───────────────────────────────────────────────────────────

export interface AccuracyPoint {
  date: ISODateString;
  accuracy: number;
}

export type AccuracyTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export interface AccuracyCurvePayload {
  points: AccuracyPoint[];
  trend: AccuracyTrend;
  totalReviews: number;
}

export type GetAccuracyCurveResponse = ApiResponse<AccuracyCurvePayload>;

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export interface VocabularyWord {
  word: string;
  count: number;
}

export interface VocabularyPayload {
  words: VocabularyWord[];
  totalCheckins: number;
  analyzedCheckins: number;
  hasEnoughData: boolean;
}

export type GetVocabularyResponse = ApiResponse<VocabularyPayload>;

// ─── Pattern cards ────────────────────────────────────────────────────────────

export type PatternCategory = 'accuracy' | 'focus' | 'mood' | 'trigger' | 'strength';

export interface PatternCard {
  id: string;
  title: string;
  insight: string;
  category: PatternCategory;
  highlight?: string;
}

export interface PatternCardsPayload {
  cards: PatternCard[];
  generatedAt: ISODateTimeString | null;
  totalReviews: number;
  hasEnoughData: boolean;
  minimumRequired: number;
}

export type GetPatternCardsResponse = ApiResponse<PatternCardsPayload>;
export type UpdateSettingsResponse = ApiResponse<{
  settings: {
    preferredTone: PreferredTone;
    eveningReminderTime: string | null;
    notificationsEnabled: boolean;
  };
}>;
