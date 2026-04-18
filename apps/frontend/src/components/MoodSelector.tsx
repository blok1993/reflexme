import { motion } from 'framer-motion';
import { MOOD_OPTIONS, MOOD_ACCENT_COLORS } from '../lib/mood';
import type { MoodValue } from '../lib/mood';

interface MoodSelectorProps {
  value: MoodValue | null;
  onChange: (mood: MoodValue) => void;
}

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex justify-between gap-2">
      {MOOD_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        const accentColor = MOOD_ACCENT_COLORS[option.value];

        return (
          <motion.button
            key={option.value}
            onClick={() => onChange(option.value)}
            whileTap={{ scale: 0.92 }}
            data-testid={`mood-option-${option.value}`}
            className="flex flex-col items-center gap-1.5 flex-1 py-3 px-1 rounded-2xl transition-all duration-200"
            style={{
              background: isSelected ? `${accentColor}18` : 'rgba(0,0,0,0.03)',
              border: `1.5px solid ${isSelected ? accentColor : 'transparent'}`,
            }}
          >
            <span className="text-2xl leading-none">{option.emoji}</span>
            <span
              className="text-xs font-medium leading-none"
              style={{ color: isSelected ? accentColor : 'var(--color-text-tertiary)' }}
            >
              {option.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
