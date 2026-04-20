import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { PredictionCard, ReviewCard } from '../components/PredictionCard';
import { SkeletonPredictionCard } from '../components/SkeletonCard';
import { useCreateReview, usePrediction, useReview } from '../api/hooks';
import { formatDateRu, getTodayISO, isEvening, timeUntilEvening } from '../lib/date';
import type { ReviewScore } from '@predictor/contracts';

const SCORE_LABEL: Record<ReviewScore, string> = {
  yes: 'Сбылось',
  partial: 'Частично',
  no: 'Мимо',
};
const SCORE_COLOR: Record<ReviewScore, string> = {
  yes: '#3DAB7A',
  partial: '#C09A50',
  no: '#AEAEB2',
};

export function PredictionDetailPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const today = getTodayISO();
  const canStillReview = Boolean(date && date <= today);

  const { data: predData, isLoading: predLoading } = usePrediction(date);
  const { data: reviewPayload, isLoading: reviewLoading } = useReview(date);
  const createReview = useCreateReview();

  const [likelyScore, setLikelyScore] = useState<ReviewScore | null>(null);
  const [strengthScore, setStrengthScore] = useState<ReviewScore | null>(null);
  const [trapScore, setTrapScore] = useState<ReviewScore | null>(null);
  const [comment, setComment] = useState('');

  if (!date) {
    return (
      <div className="page flex items-center justify-center min-h-dvh">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Некорректная дата
        </p>
      </div>
    );
  }

  const prediction = predData?.prediction;
  const review = reviewPayload?.review ?? null;

  const isToday = date === today;
  const eveningOkForToday = !isToday || isEvening();

  const showPastReviewForm =
    canStillReview &&
    prediction &&
    !review &&
    !predLoading &&
    !reviewLoading &&
    eveningOkForToday;

  const showTodayReviewTooEarly =
    canStillReview &&
    prediction &&
    !review &&
    !predLoading &&
    !reviewLoading &&
    isToday &&
    !isEvening();

  const canSubmit =
    likelyScore &&
    strengthScore &&
    trapScore &&
    !createReview.isPending &&
    prediction;

  async function handleSubmitReview() {
    if (!canSubmit || !prediction) return;
    try {
      await createReview.mutateAsync({
        predictionId: prediction.id,
        likelyEventScore: likelyScore,
        strengthPointScore: strengthScore,
        trapWarningScore: trapScore,
        comment: comment.trim() || undefined,
      });
      toast.success('Оценка сохранена');
      setLikelyScore(null);
      setStrengthScore(null);
      setTrapScore(null);
      setComment('');
    } catch {
      toast.error('Не удалось сохранить — попробуй ещё раз');
    }
  }

  return (
    <div className="page" data-testid="prediction-detail-page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center tap-scale flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.05)' }}
            aria-label="Назад"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
              Прогноз
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {formatDateRu(date)}
            </p>
          </div>
        </div>

        {predLoading && (
          <div className="flex flex-col gap-3">
            <div className="card animate-pulse" style={{ height: 44, background: 'rgba(0,0,0,0.04)' }} />
            <SkeletonPredictionCard />
            <SkeletonPredictionCard />
            <SkeletonPredictionCard />
          </div>
        )}

        {!predLoading && !prediction && (
          <div className="card text-center py-10">
            <p className="text-2xl mb-3">🌫</p>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Прогноз не найден
            </p>
          </div>
        )}

        {prediction && (
          <>
            <div className="flex items-start justify-between mb-5">
              <h1
                className="text-xl font-bold leading-tight flex-1 mr-3"
                style={{ color: 'var(--color-text)' }}
              >
                {prediction.dayType}
              </h1>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <PredictionCard type="likelyEvent" text={prediction.likelyEvent} index={0} />
              <PredictionCard type="strengthPoint" text={prediction.strengthPoint} index={1} />
              <PredictionCard type="trapWarning" text={prediction.trapWarning} index={2} />
            </div>

            {showTodayReviewTooEarly && (
              <div
                className="card text-sm text-center leading-relaxed mb-5"
                style={{ color: 'var(--color-text-secondary)' }}
                data-testid="detail-review-too-early"
              >
                Оценка за сегодня открывается после 17:00.
                {timeUntilEvening() && (
                  <span className="block text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    {timeUntilEvening()}
                  </span>
                )}
              </div>
            )}

            {showPastReviewForm && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5"
                data-testid="past-review-form"
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  Оценка дня
                </p>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Если вечером не успел — можно закрыть день сейчас. Это поможет точности прогнозов и паттернам.
                </p>
                <div className="flex flex-col gap-3 mb-4">
                  <ReviewCard
                    type="likelyEvent"
                    text={prediction.likelyEvent}
                    index={0}
                    score={likelyScore}
                    onScore={setLikelyScore}
                  />
                  <ReviewCard
                    type="strengthPoint"
                    text={prediction.strengthPoint}
                    index={1}
                    score={strengthScore}
                    onScore={setStrengthScore}
                  />
                  <ReviewCard
                    type="trapWarning"
                    text={prediction.trapWarning}
                    index={2}
                    score={trapScore}
                    onScore={setTrapScore}
                  />
                </div>
                <div className="card mb-4">
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Что оказалось главным?
                  </p>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    Необязательно
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Свободная мысль о дне..."
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-3 rounded-xl text-sm leading-relaxed resize-none"
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1.5px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
                <motion.button
                  onClick={handleSubmitReview}
                  disabled={!canSubmit}
                  whileTap={{ scale: canSubmit ? 0.97 : 1 }}
                  data-testid="past-review-submit"
                  className="w-full py-4 rounded-2xl text-base font-semibold transition-all duration-200"
                  style={{
                    background: canSubmit ? 'var(--color-text)' : 'var(--color-border)',
                    color: canSubmit ? '#FFFFFF' : 'var(--color-text-tertiary)',
                  }}
                >
                  {createReview.isPending ? 'Сохраняю...' : 'Сохранить оценку'}
                </motion.button>
              </motion.div>
            )}

            {review && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Твоя оценка
                </p>
                <div className="flex flex-col gap-2">
                  {([
                    { label: 'Что вероятно', score: review.likelyEventScore as ReviewScore },
                    { label: 'Твоя сила', score: review.strengthPointScore as ReviewScore },
                    { label: 'Ловушка дня', score: review.trapWarningScore as ReviewScore },
                  ]).map(({ label, score }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {label}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: SCORE_COLOR[score],
                          background: `${SCORE_COLOR[score]}18`,
                        }}
                      >
                        {SCORE_LABEL[score]}
                      </span>
                    </div>
                  ))}
                </div>
                {review.comment && (
                  <p
                    className="text-sm mt-3 pt-3 italic leading-relaxed"
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    «{review.comment}»
                  </p>
                )}
                {review.accuracyScore !== null && (
                  <p
                    className="text-xs mt-2 font-medium"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Точность: {Math.round(review.accuracyScore * 100)}%
                  </p>
                )}
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
