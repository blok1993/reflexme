import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FocusArea } from '@predictor/contracts';

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface FocusOption {
  value: FocusArea;
  label: string;
  emoji: string;
}

const FOCUS_OPTIONS: FocusOption[] = [
  { value: 'work', label: 'Работа', emoji: '💼' },
  { value: 'people', label: 'Люди', emoji: '👥' },
  { value: 'energy', label: 'Энергия', emoji: '⚡' },
  { value: 'emotions', label: 'Эмоции', emoji: '💭' },
  { value: 'tension', label: 'Напряжение', emoji: '🌀' },
  { value: 'control', label: 'Контроль', emoji: '🎯' },
  { value: 'rest', label: 'Отдых', emoji: '🌿' },
  { value: 'self_focus', label: 'Фокус на себе', emoji: '🧘' },
];

interface FocusSelectorProps {
  value: FocusArea | null;
  onChange: (focus: FocusArea) => void;
}

export function FocusSelector({ value, onChange }: FocusSelectorProps) {
  /** Новый порядок при каждом заходе на экран; внутри сессии стабилен, чтобы не дёргать UI при ре-рендерах. */
  const options = useMemo(() => shuffle(FOCUS_OPTIONS), []);

  return (
    <div
      className="grid grid-cols-2 gap-2.5"
      role="group"
      aria-label="Фокус дня"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            whileTap={{ scale: 0.96 }}
            data-testid={`focus-option-${option.value}`}
            className="flex w-full min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center transition-all duration-200"
            style={{
              background: isSelected ? 'var(--color-text)' : 'rgba(0,0,0,0.05)',
              color: isSelected ? '#FFFFFF' : 'var(--color-text-secondary)',
              border: 'none',
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <span className="text-[1.35rem] leading-none select-none" aria-hidden>
              {option.emoji}
            </span>
            <span className="text-[13px] font-medium leading-snug sm:text-sm">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export { FOCUS_OPTIONS };
