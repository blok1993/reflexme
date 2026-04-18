import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CreateCheckinDto, CreateReviewDto } from '@predictor/contracts';
import { getTodayISO, getWeekRange } from '../lib/date';

export const keys = {
  user: ['user'] as const,
  dailyStatus: (date: string) => ['daily-status', date] as const,
  checkin: (date: string) => ['checkin', date] as const,
  prediction: (date: string) => ['prediction', date] as const,
  review: (date: string) => ['review', date] as const,
  history: ['history'] as const,
  weeklyInsights: (start: string, end: string) => ['insights', start, end] as const,
};

// ─── User ─────────────────────────────────────────────────────────────

export function useUser() {
  return useQuery({ queryKey: keys.user, queryFn: () => api.getMe() });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.user }),
  });
}

// ─── Daily status ─────────────────────────────────────────────────────

export function useDailyStatus(date?: string) {
  const d = date ?? getTodayISO();
  return useQuery({ queryKey: keys.dailyStatus(d), queryFn: () => api.getDailyStatus(d) });
}

// ─── Checkin ──────────────────────────────────────────────────────────

export function useCheckin(date?: string) {
  const d = date ?? getTodayISO();
  return useQuery({
    queryKey: keys.checkin(d),
    queryFn: () => api.getCheckinByDate(d),
    retry: false,
  });
}

export function useCreateCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCheckinDto) => api.createCheckin(dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: keys.dailyStatus(variables.date) });
      qc.invalidateQueries({ queryKey: keys.checkin(variables.date) });
    },
  });
}

// ─── Prediction ───────────────────────────────────────────────────────

export function usePrediction(date?: string) {
  const d = date ?? getTodayISO();
  return useQuery({
    queryKey: keys.prediction(d),
    queryFn: () => api.getPredictionByDate(d),
    retry: false,
  });
}

export function useGeneratePrediction() {
  const qc = useQueryClient();
  const today = getTodayISO();
  return useMutation({
    mutationFn: (checkinId: string) => api.generatePrediction(checkinId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.prediction(today) });
      qc.invalidateQueries({ queryKey: keys.dailyStatus(today) });
    },
  });
}

// ─── Review ───────────────────────────────────────────────────────────

export function useReview(date?: string) {
  const d = date && date.length > 0 ? date : getTodayISO();
  return useQuery({
    queryKey: keys.review(d),
    queryFn: () => api.getReviewByDateOptional(d),
    retry: false,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateReviewDto) => api.createReview(dto),
    onSuccess: (data) => {
      const d = data.review.date;
      qc.setQueryData(keys.review(d), { review: data.review });
      // Immediate: status, review, history, accuracy curve, vocabulary, weekly tab
      qc.invalidateQueries({ queryKey: keys.review(d) });
      qc.invalidateQueries({ queryKey: keys.dailyStatus(d) });
      qc.invalidateQueries({ queryKey: keys.history });
      qc.invalidateQueries({ queryKey: ['accuracy-curve'] });
      qc.invalidateQueries({ queryKey: ['vocabulary'] });
      qc.invalidateQueries({ queryKey: ['insights'] });

      // Delayed: pattern cards and profile summary are updated by a fire-and-forget
      // LLM call on the backend — give it ~15s to finish before re-fetching.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['pattern-cards'] });
        qc.invalidateQueries({ queryKey: ['profile'] });
      }, 15_000);
    },
  });
}

// ─── History ──────────────────────────────────────────────────────────

export function useHistory() {
  return useQuery({ queryKey: keys.history, queryFn: () => api.getHistory() });
}

// ─── Weekly insights ──────────────────────────────────────────────────

export function useWeeklyInsights() {
  const { startDate, endDate } = getWeekRange();
  return useQuery({
    queryKey: keys.weeklyInsights(startDate, endDate),
    queryFn: () => api.getWeeklyInsights(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Accuracy curve ───────────────────────────────────────────────────

export function useAccuracyCurve() {
  return useQuery({
    queryKey: ['accuracy-curve'] as const,
    queryFn: () => api.getAccuracyCurve(),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Vocabulary ───────────────────────────────────────────────────────

export function useVocabulary() {
  return useQuery({
    queryKey: ['vocabulary'] as const,
    queryFn: () => api.getVocabulary(),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Pattern cards ────────────────────────────────────────────────────

export function usePatternCards() {
  return useQuery({
    queryKey: ['pattern-cards'] as const,
    queryFn: () => api.getPatternCards(),
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Settings ─────────────────────────────────────────────────────────

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.user }),
  });
}
