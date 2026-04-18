import { motion } from 'framer-motion';
import type { PatternCard, PatternCategory } from '@predictor/contracts';

const CATEGORY_CONFIG: Record<PatternCategory, { emoji: string; color: string; bg: string }> = {
  accuracy:  { emoji: '🎯', color: '#5B6FD4', bg: '#EEF0FF' },
  focus:     { emoji: '🔍', color: '#3DAB7A', bg: '#EDFAF3' },
  mood:      { emoji: '🌊', color: '#9E7BBE', bg: '#F2EEF7' },
  trigger:   { emoji: '⚡', color: '#D07848', bg: '#FFF2E8' },
  strength:  { emoji: '💪', color: '#5DA888', bg: '#EFF7F3' },
};

interface PatternCardsProps {
  cards: PatternCard[];
  hasEnoughData: boolean;
  totalReviews: number;
  minimumRequired: number;
}

export function PatternCards({ cards, hasEnoughData, totalReviews, minimumRequired }: PatternCardsProps) {
  if (!hasEnoughData) {
    const remaining = minimumRequired - totalReviews;
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Открытия
        </p>
        <div className="flex flex-col items-center py-4 gap-2 text-center">
          <span className="text-3xl">🔭</span>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Появятся после {minimumRequired} заполненных дней
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Ещё {remaining} {remaining === 1 ? 'день' : remaining < 5 ? 'дня' : 'дней'}
          </p>
          <div className="flex gap-1 mt-1 flex-wrap justify-center">
            {Array.from({ length: minimumRequired }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i < totalReviews ? 'var(--color-accent)' : 'var(--color-border)' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Открытия
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Паттерны формируются — загляни завтра
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Открытия
      </p>
      <div className="flex flex-col gap-3">
        {cards.map((card, i) => {
          const cfg = CATEGORY_CONFIG[card.category];
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.35 }}
              className="card"
              style={{ borderLeft: `3px solid ${cfg.color}` }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: cfg.bg }}
                >
                  {cfg.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {card.insight}
                  </p>
                  {card.highlight && (
                    <span
                      className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {card.highlight}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
