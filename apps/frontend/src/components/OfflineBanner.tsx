import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Show "reconnected" message briefly
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {(!isOnline || showReconnected) && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-50 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="mt-2 mx-4 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2"
            style={
              isOnline
                ? { background: '#EDFAF3', color: '#3DAB7A' }
                : { background: '#1C1C1E', color: '#FFFFFF' }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: isOnline ? '#3DAB7A' : '#FF6B6B' }}
            />
            {isOnline ? 'Соединение восстановлено' : 'Нет соединения с сетью'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
