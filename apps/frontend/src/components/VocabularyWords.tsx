import { motion } from 'framer-motion';
import type { VocabularyWord } from '@predictor/contracts';

interface VocabularyWordsProps {
  words: VocabularyWord[];
  hasEnoughData: boolean;
  analyzedCheckins: number;
}

export function VocabularyWords({ words, hasEnoughData, analyzedCheckins: _analyzedCheckins }: VocabularyWordsProps) {
  if (!hasEnoughData) {
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Мой язык
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Пиши несколько слов утром — и со временем здесь появится твой словарь.
        </p>
      </div>
    );
  }

  const maxCount = words[0]?.count ?? 1;

  // Three size tiers based on relative frequency
  function getFontSize(count: number): number {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 16;
    if (ratio >= 0.5) return 14;
    return 12;
  }

  function getOpacity(count: number): number {
    const ratio = count / maxCount;
    return 0.5 + ratio * 0.5;
  }

  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Мой язык
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Слова, которые ты используешь чаще других
      </p>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => (
          <motion.span
            key={w.word}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: getOpacity(w.count), scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="px-2.5 py-1 rounded-full font-medium"
            style={{
              fontSize: getFontSize(w.count),
              background: 'var(--color-accent-light)',
              color: 'var(--color-accent)',
            }}
            title={`${w.count} ${w.count === 1 ? 'раз' : w.count < 5 ? 'раза' : 'раз'}`}
          >
            {w.word}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
