import { ReactNode, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { useAppStore } from '../store/useAppStore';
import { applyMoodTheme } from '../lib/mood';

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const selectedMood = useAppStore((s) => s.selectedMood);

  useEffect(() => {
    applyMoodTheme(selectedMood);
  }, [selectedMood]);

  return (
    <div className="app-shell">
      <main>{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}
