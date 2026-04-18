import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PROFILE_PHRASES = [
  'Смотрю на твои паттерны...',
  'Считаю точность прогнозов...',
  'Нахожу закономерности...',
  'Читаю твою историю...',
  'Собираю картину...',
];

const WEEKLY_PHRASES = [
  'Анализирую прошедшую неделю...',
  'Собираю наблюдения...',
  'Смотрю, что изменилось...',
  'Нахожу паттерны недели...',
];

interface InsightsLoadingScreenProps {
  type?: 'profile' | 'weekly';
}

export function InsightsLoadingScreen({ type = 'profile' }: InsightsLoadingScreenProps) {
  const phrases = type === 'weekly' ? WEEKLY_PHRASES : PROFILE_PHRASES;
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 250);
    }, 2000);
    return () => clearInterval(timer);
  }, [phrases.length]);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2"
        style={{
          borderColor: 'var(--color-border)',
          borderTopColor: 'var(--color-accent)',
        }}
      />
      <div className="h-5 flex items-center">
        <AnimatePresence mode="wait">
          {visible && (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {phrases[idx]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
