import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MoodSelector } from '../components/MoodSelector';
import { FocusSelector } from '../components/FocusSelector';
import { SkeletonCheckin } from '../components/SkeletonCard';
import { useCreateCheckin, useUser, useDailyStatus, keys } from '../api/hooks';
import { useAppStore } from '../store/useAppStore';
import { getTodayISO, formatDateRu, getGreeting } from '../lib/date';
import type { MoodValue } from '../lib/mood';
import type { FocusArea } from '@predictor/contracts';

export function CheckinPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = getTodayISO();
  const { data: userData } = useUser();
  const { data: statusData } = useDailyStatus(today);
  const createCheckin = useCreateCheckin();
  const setSelectedMood = useAppStore((s) => s.setSelectedMood);

  const [mood, setMood] = useState<MoodValue | null>(null);
  const [focus, setFocus] = useState<FocusArea | null>(null);
  const [contextText, setContextText] = useState('');

  // If checkin already exists today, skip to prediction
  useEffect(() => {
    if (statusData && statusData.status !== 'checkin_missing') {
      navigate('/prediction', { replace: true });
    }
  }, [statusData, navigate]);

  function handleMoodChange(value: MoodValue) {
    setMood(value);
    setSelectedMood(value);
  }

  const canSubmit = mood !== null && focus !== null && !createCheckin.isPending;

  async function handleSubmit() {
    if (!mood || !focus) return;
    try {
      const result = await createCheckin.mutateAsync({
        date: today,
        mood,
        focus,
        contextText: contextText.trim() || undefined,
      });
      // Optimistically seed the cache with prediction_generating status so that
      // the PredictionPage doesn't see stale 'checkin_missing' data and redirect back.
      qc.setQueryData(keys.dailyStatus(today), {
        date: today,
        status: 'prediction_generating',
        checkinExists: true,
        predictionExists: false,
        reviewExists: false,
        checkinId: result.checkin.id,
        predictionId: null,
        reviewId: null,
      });
      navigate('/prediction');
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // Checkin already exists for today — seed cache and go to prediction anyway
      if (msg.includes('already exists') || msg.includes('CHECKIN_ALREADY_EXISTS')) {
        qc.setQueryData(keys.dailyStatus(today), {
          date: today,
          status: 'prediction_generating',
          checkinExists: true,
          predictionExists: false,
          reviewExists: false,
          checkinId: null, // unknown here but enough to prevent redirect loop
          predictionId: null,
          reviewId: null,
        });
        navigate('/prediction', { replace: true });
      }
      // Other errors are shown via createCheckin.isError
    }
  }

  const user = userData?.user;

  // Show skeleton while user data loads on first visit
  if (!userData && !user) {
    return <SkeletonCheckin />;
  }

  return (
    <div className="page" data-testid="checkin-page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mb-6">
          <p
            className="text-sm font-medium mb-1 capitalize"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {formatDateRu(today)}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            {getGreeting(user?.name ?? null)}
          </h1>
        </div>

        <div className="flex flex-col gap-5">
          <section className="card" data-testid="mood-section">
            <p className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Как ты сейчас?
            </p>
            <MoodSelector value={mood} onChange={handleMoodChange} />
          </section>

          <section className="card" data-testid="focus-section">
            <p className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Что сегодня в фокусе?
            </p>
            <FocusSelector value={focus} onChange={setFocus} />
          </section>

          <section className="card">
            <p className="text-base font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              Пара слов о предстоящем дне
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              Необязательно, но делает прогноз точнее
            </p>
            <textarea
              data-testid="context-input"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Не выспался, важный разговор, раздражает одна ситуация..."
              maxLength={300}
              rows={3}
              className="w-full px-3 py-3 rounded-xl text-sm leading-relaxed resize-none"
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            <p
              className="text-right text-xs mt-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {contextText.length}/300
            </p>
          </section>

          {createCheckin.isError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              data-testid="checkin-error"
              className="text-sm text-center"
              style={{ color: '#D07848' }}
            >
              {(createCheckin.error as Error).message}
            </motion.p>
          )}

          <motion.button
            onClick={handleSubmit}
            disabled={!canSubmit}
            whileTap={{ scale: canSubmit ? 0.97 : 1 }}
            data-testid="submit-checkin-btn"
            className="w-full py-4 rounded-2xl text-base font-semibold transition-all duration-200"
            style={{
              background: canSubmit ? 'var(--color-text)' : 'var(--color-border)',
              color: canSubmit ? '#FFFFFF' : 'var(--color-text-tertiary)',
            }}
          >
            {createCheckin.isPending ? 'Отправляю...' : 'Получить прогноз →'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
