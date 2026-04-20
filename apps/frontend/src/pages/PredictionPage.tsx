import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PredictionCard } from '../components/PredictionCard';
import { AccuracyBadge } from '../components/AccuracyBadge';
import { LoadingScreen } from '../components/LoadingScreen';
import { useGeneratePrediction, usePrediction, useDailyStatus, useAccuracyCurve } from '../api/hooks';
import { getTodayISO, isEvening, timeUntilEvening } from '../lib/date';
import toast from 'react-hot-toast';

export function PredictionPage() {
  const navigate = useNavigate();
  const today = getTodayISO();
  const generateFired = useRef(false);

  const { data: statusData, isLoading: statusLoading, isFetching: statusFetching } = useDailyStatus(today);
  const { data: predData, isLoading: predLoading } = usePrediction(today);
  const { data: curveData } = useAccuracyCurve();
  const generate = useGeneratePrediction();

  useEffect(() => {
    // Skip while status is being refreshed to avoid acting on stale data.
    // This prevents redirect to /checkin when navigating here right after a checkin submit.
    if (!statusData || statusFetching) return;

    if (statusData.status === 'checkin_missing') {
      navigate('/checkin', { replace: true });
      return;
    }

    if (statusData.status === 'review_completed') return;

    // Fire generate only once per mount
    if (
      statusData.checkinId &&
      !statusData.predictionExists &&
      !generateFired.current
    ) {
      generateFired.current = true;
      generate.mutate(statusData.checkinId);
    }
  }, [statusData, statusFetching, navigate, generate]);

  // Show loading while:
  // – initial queries are loading
  // – generate is in-flight
  // – about to generate: status says no prediction, prediction not yet in cache,
  //   generate hasn't failed, and effect hasn't fired yet
  // – generate succeeded but the prediction query hasn't refreshed yet
  const aboutToGenerate =
    !statusData?.predictionExists &&
    !predData?.prediction &&
    !generate.isError &&
    !generateFired.current;
  const generatedButNotLoaded = generate.isSuccess && !predData?.prediction;

  if (
    statusLoading ||
    predLoading ||
    generate.isPending ||
    aboutToGenerate ||
    generatedButNotLoaded
  ) {
    return <LoadingScreen />;
  }

  const prediction = predData?.prediction;

  if (!prediction) {
    const canRetry = generate.isError && statusData?.checkinId;

    return (
      <div
        data-testid="prediction-not-found"
        className="page flex flex-col items-center justify-center min-h-dvh text-center gap-4"
      >
        <div className="text-4xl select-none">🌫</div>
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          {generate.isError ? 'Не удалось получить прогноз' : 'Прогноз не найден'}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)', maxWidth: 260 }}>
          {generate.isError
            ? 'Что-то пошло не так при генерации. Попробуй ещё раз.'
            : 'Сначала нужен утренний чек-ин.'}
        </p>
        {canRetry && (
          <motion.button
            onClick={() => {
              generateFired.current = false;
              generate.reset();
            }}
            whileTap={{ scale: 0.97 }}
            data-testid="retry-generate-btn"
            className="px-6 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
          >
            Попробовать ещё раз
          </motion.button>
        )}
        {!canRetry && (
          <button
            onClick={() => navigate('/checkin')}
            className="text-sm font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            Сделать чек-ин
          </button>
        )}
      </div>
    );
  }

  const evening = isEvening();
  const reviewDone = statusData?.status === 'review_completed';

  async function handleShare() {
    if (!prediction) return;
    const text = [
      `😱 Смотри, что мне предсказал на день ReflexMe:`,
      ``,
      `«${prediction.dayType}»`,
      ``,
      `Чего ожидать: ${prediction.likelyEvent}`,
      `Сила: ${prediction.strengthPoint}`,
      `Ловушка: ${prediction.trapWarning}`,
      ``,
      `Попробуй сам → https://www.reflexme.ru`,
    ].join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано в буфер обмена');
    }
  }

  return (
    <div className="page" data-testid="prediction-page">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Прогноз дня
            </p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl font-bold leading-tight"
              style={{ color: 'var(--color-text)' }}
              data-testid="day-type"
            >
              {prediction.dayType}
            </motion.h1>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <AccuracyBadge
              totalReviews={curveData?.totalReviews ?? 0}
              accuracyPercent={
                curveData && curveData.points.length > 0
                  ? Math.round(curveData.points[curveData.points.length - 1].accuracy * 100)
                  : null
              }
            />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <PredictionCard type="likelyEvent" text={prediction.likelyEvent} index={0} />
          <PredictionCard type="strengthPoint" text={prediction.strengthPoint} index={1} />
          <PredictionCard type="trapWarning" text={prediction.trapWarning} index={2} />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-3"
        >
          {!reviewDone && evening && (
            <motion.button
              onClick={() => navigate('/review')}
              whileTap={{ scale: 0.97 }}
              data-testid="go-to-review-btn"
              className="w-full py-4 rounded-2xl text-base font-semibold"
              style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
            >
              Итоги дня 🌙
            </motion.button>
          )}

          {reviewDone && (
            <div
              data-testid="day-closed-badge"
              className="text-center text-sm py-3 rounded-xl"
              style={{ background: '#EDFAF3', color: '#3DAB7A' }}
            >
              ✓ День закрыт
            </div>
          )}

          {!reviewDone && !evening && (
            <div
              className="card text-sm text-center leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Вечером подведём итоги дня
              {timeUntilEvening() && (
                <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {timeUntilEvening()}
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleShare}
            data-testid="share-btn"
            className="w-full py-3 rounded-2xl text-sm font-medium tap-scale flex items-center justify-center gap-2"
            style={{
              background: 'rgba(0,0,0,0.04)',
              color: 'var(--color-text-secondary)',
              border: 'none',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Поделиться прогнозом
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
