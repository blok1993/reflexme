import { motion } from 'framer-motion';
import type { ReviewScore } from '@predictor/contracts';

export type CardType = 'likelyEvent' | 'strengthPoint' | 'trapWarning';

const CARD_CONFIG = {
  likelyEvent: {
    title: 'Что вероятно',
    icon: '👁',
    borderColor: '#5B6FD4',
    iconBg: '#EEF0FF',
  },
  strengthPoint: {
    title: 'Твоя сила',
    icon: '⚡',
    borderColor: '#3DAB7A',
    iconBg: '#EDFAF3',
  },
  trapWarning: {
    title: 'Ловушка дня',
    icon: '⚠️',
    borderColor: '#D07848',
    iconBg: '#FFF2E8',
  },
} as const;

const SCORE_OPTIONS: { value: ReviewScore; label: string; color: string; bg: string }[] = [
  { value: 'yes', label: 'Да', color: '#3DAB7A', bg: '#EDFAF3' },
  { value: 'partial', label: 'Частично', color: '#C09A50', bg: '#FDF6E3' },
  { value: 'no', label: 'Мимо', color: '#AEAEB2', bg: '#F5F5F5' },
];

// ─── Prediction display card ─────────────────────────────────────────────────

interface PredictionCardProps {
  type: CardType;
  text: string;
  index?: number;
}

export function PredictionCard({ type, text, index = 0 }: PredictionCardProps) {
  const config = CARD_CONFIG[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4, ease: 'easeOut' }}
      data-testid={`prediction-card-${type}`}
      className={`card prediction-card-${type === 'likelyEvent' ? 'likely' : type === 'strengthPoint' ? 'strength' : 'trap'} pl-5`}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm leading-none"
          style={{ background: config.iconBg }}
        >
          {config.icon}
        </span>
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: config.borderColor }}
          >
            {config.title}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
            {text}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Review card (with score buttons) ────────────────────────────────────────

interface ReviewCardProps {
  type: CardType;
  text: string;
  index?: number;
  score: ReviewScore | null;
  onScore: (score: ReviewScore) => void;
}

export function ReviewCard({ type, text, index = 0, score, onScore }: ReviewCardProps) {
  const config = CARD_CONFIG[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: 'easeOut' }}
      className={`card prediction-card-${type === 'likelyEvent' ? 'likely' : type === 'strengthPoint' ? 'strength' : 'trap'} pl-5`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs leading-none"
          style={{ background: config.iconBg }}
        >
          {config.icon}
        </span>
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: config.borderColor }}
        >
          {config.title}
        </p>
      </div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>
        {text}
      </p>
      <div className="flex gap-2">
        {SCORE_OPTIONS.map((option) => {
          const isSelected = score === option.value;
          return (
            <motion.button
              key={option.value}
              onClick={() => onScore(option.value)}
              whileTap={{ scale: 0.93 }}
              aria-pressed={isSelected}
              className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: isSelected ? option.bg : 'rgba(0,0,0,0.04)',
                color: isSelected ? option.color : 'var(--color-text-tertiary)',
                border: `1.5px solid ${isSelected ? option.color + '60' : 'transparent'}`,
              }}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
