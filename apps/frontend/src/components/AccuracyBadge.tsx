interface AccuracyBadgeProps {
  totalReviews: number;
  accuracyPercent: number | null;
}

/**
 * Replaces the old ConfidenceBadge. Shows real user accuracy once enough
 * reviews are collected; falls back to a neutral "accumulating" badge.
 */
export function AccuracyBadge({ totalReviews, accuracyPercent }: AccuracyBadgeProps) {
  const MIN_REVIEWS = 5;
  const hasData = totalReviews >= MIN_REVIEWS && accuracyPercent !== null;

  if (!hasData) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
        style={{ background: '#F5F5F5', color: '#AEAEB2' }}
        title={`Нужно ещё ${MIN_REVIEWS - totalReviews} оценок для расчёта точности`}
      >
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#AEAEB2' }} />
        Низкая точность
      </span>
    );
  }

  const color =
    accuracyPercent >= 67 ? '#3DAB7A' :
    accuracyPercent >= 34 ? '#C09A50' :
    '#D07848';

  const bg =
    accuracyPercent >= 67 ? '#EDFAF3' :
    accuracyPercent >= 34 ? '#FDF6E3' :
    '#FFF2E8';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: bg, color }}
      aria-label={`Точность прогнозов: ${accuracyPercent}%`}
    >
      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      Точность {accuracyPercent}%
    </span>
  );
}
