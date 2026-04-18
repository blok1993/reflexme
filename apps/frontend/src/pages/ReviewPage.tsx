import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ReviewCard } from '../components/PredictionCard';
import { useCreateReview, usePrediction, useDailyStatus } from '../api/hooks';
import { getTodayISO, isEvening, timeUntilEvening } from '../lib/date';
import type { Review, ReviewScore } from '@predictor/contracts';

export function ReviewPage() {
  const navigate = useNavigate();
  const today = getTodayISO();

  const { data: statusData } = useDailyStatus(today);
  const { data: predData, isLoading } = usePrediction(today);
  const createReview = useCreateReview();

  const [likelyScore, setLikelyScore] = useState<ReviewScore | null>(null);
  const [strengthScore, setStrengthScore] = useState<ReviewScore | null>(null);
  const [trapScore, setTrapScore] = useState<ReviewScore | null>(null);
  const [comment, setComment] = useState('');
  const [completedReview, setCompletedReview] = useState<Review | null>(null);

  if (isLoading) {
    return (
      <div className="page flex items-center justify-center min-h-dvh">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
      </div>
    );
  }

  const prediction = predData?.prediction;
  const reviewDone = statusData?.status === 'review_completed';

  if (!prediction) {
    return (
      <div className="page flex flex-col items-center justify-center min-h-dvh text-center gap-4">
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Сначала нужен утренний прогноз
        </p>
        <button
          onClick={() => navigate('/checkin')}
          className="text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          Сделать чек-ин
        </button>
      </div>
    );
  }

  if (reviewDone) {
    return (
      <div className="page flex flex-col items-center justify-center min-h-dvh text-center gap-4">
        <div className="text-4xl">✓</div>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          День закрыт
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Увидимся завтра
        </p>
        <button
          onClick={() => navigate('/insights')}
          className="mt-2 text-sm font-medium"
          style={{ color: 'var(--color-accent)' }}
        >
          Посмотреть паттерны
        </button>
      </div>
    );
  }

  if (!isEvening()) {
    return (
      <div
        className="page flex flex-col items-center justify-center min-h-dvh text-center gap-4 px-4"
        data-testid="review-too-early"
      >
        <div className="text-4xl">🌤</div>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Оценка дня с 17:00
        </p>
        <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Сначала день успеет развернуться — вечером сравним прогноз с тем, как всё было на самом деле.
        </p>
        {timeUntilEvening() && (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {timeUntilEvening()}
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate('/prediction')}
          className="mt-2 text-sm font-semibold py-3 px-6 rounded-2xl"
          style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
        >
          К прогнозу дня
        </button>
      </div>
    );
  }

  const canSubmit = likelyScore && strengthScore && trapScore && !createReview.isPending;

  async function handleSubmit() {
    if (!likelyScore || !strengthScore || !trapScore || !prediction) return;
    const result = await createReview.mutateAsync({
      predictionId: prediction.id,
      likelyEventScore: likelyScore,
      strengthPointScore: strengthScore,
      trapWarningScore: trapScore,
      comment: comment.trim() || undefined,
    });
    setCompletedReview(result.review);
  }

  // ─── Completion screen ───────────────────────────────────────────────────────

  if (completedReview) {
    return (
      <CompletionScreen
        accuracyScore={completedReview.accuracyScore}
        onContinue={() => navigate('/insights')}
      />
    );
  }

  return (
    <div className="page" data-testid="review-page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Итоги дня
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Как прошёл день?
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Оцени каждый прогноз
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-5">
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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="card mb-4"
        >
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
        </motion.div>

        {createReview.isError && (
          <p className="text-sm text-center mb-3" style={{ color: '#D07848' }}>
            Что-то пошло не так, попробуй ещё раз
          </p>
        )}

        <motion.button
          onClick={handleSubmit}
          disabled={!canSubmit}
          whileTap={{ scale: canSubmit ? 0.97 : 1 }}
          data-testid="submit-review-btn"
          className="w-full py-4 rounded-2xl text-base font-semibold transition-all duration-200"
          style={{
            background: canSubmit ? 'var(--color-text)' : 'var(--color-border)',
            color: canSubmit ? '#FFFFFF' : 'var(--color-text-tertiary)',
          }}
        >
          {createReview.isPending ? 'Сохраняю...' : 'Завершить день →'}
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── Completion screen component ─────────────────────────────────────────────

function CompletionScreen({
  accuracyScore,
  onContinue,
}: {
  accuracyScore: number | null;
  onContinue: () => void;
}) {
  const accuracy = accuracyScore !== null ? Math.round(accuracyScore * 100) : null;
  const emoji =
    accuracy === null ? '🌙' :
    accuracy >= 80 ? '🎯' :
    accuracy >= 50 ? '🌤' :
    '🌱';

  useEffect(() => {
    const t = setTimeout(onContinue, 3500);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="page flex flex-col items-center justify-center min-h-dvh text-center gap-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="text-6xl select-none"
      >
        {emoji}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          День закрыт
        </h1>
        {accuracy !== null && (
          <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
            Прогноз попал на{' '}
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {accuracy}%
            </span>
          </p>
        )}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-sm"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Увидимся завтра утром
      </motion.p>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={onContinue}
        className="text-sm font-medium"
        style={{ color: 'var(--color-accent)' }}
      >
        Посмотреть паттерны →
      </motion.button>
    </motion.div>
  );
}
