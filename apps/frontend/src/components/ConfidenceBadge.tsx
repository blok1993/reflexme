import type { PredictionConfidence } from '@predictor/contracts';

const CONFIDENCE_MAP: Record<PredictionConfidence, { label: string; color: string; bg: string }> = {
  high: { label: 'Уверен', color: '#3DAB7A', bg: '#EDFAF3' },
  medium: { label: 'Вероятно', color: '#C09A50', bg: '#FDF6E3' },
  low: { label: 'Приблизительно', color: '#AEAEB2', bg: '#F5F5F5' },
};

interface ConfidenceBadgeProps {
  confidence: PredictionConfidence;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const { label, color, bg } = CONFIDENCE_MAP[confidence];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: bg, color }}
      aria-label={`Уровень уверенности: ${label}`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
