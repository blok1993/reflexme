import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/apple-touch-icon.png"
      alt=""
      width={56}
      height={56}
      decoding="async"
      draggable={false}
      className={className ?? 'h-14 w-14 rounded-2xl object-cover select-none shrink-0'}
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.1)' }}
      aria-hidden
    />
  );
}

const PHRASES = [
  { emoji: '📖', text: 'Читаю твой день...' },
  { emoji: '🔍', text: 'Смотрю на контекст...' },
  { emoji: '🔮', text: 'Ищу вероятные сценарии...' },
  { emoji: '✨', text: 'Нахожу твою точку силы...' },
  { emoji: '✍️', text: 'Подбираю слова...' },
  { emoji: '🌟', text: 'Почти готово...' },
] as const;

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, 300);
    }, 1700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="page flex flex-col items-center justify-center min-h-dvh"
      role="status"
      aria-label={message ?? PHRASES[phraseIndex].text}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="min-h-[3.5rem] flex flex-col items-center justify-center gap-3">
          <AnimatePresence mode="wait">
            {visible && (
              <motion.div
                key={message ? 'custom' : phraseIndex}
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.94 }}
                transition={{ duration: 0.28 }}
                className="flex flex-col items-center gap-3"
              >
                {message || PHRASES[phraseIndex].emoji === '🔮' ? (
                  <LogoMark />
                ) : (
                  <span
                    className="text-[2.75rem] leading-none select-none"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
                    aria-hidden
                  >
                    {PHRASES[phraseIndex].emoji}
                  </span>
                )}
                <p
                  className="text-base font-medium text-center max-w-[min(20rem,85vw)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {message ?? PHRASES[phraseIndex].text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
