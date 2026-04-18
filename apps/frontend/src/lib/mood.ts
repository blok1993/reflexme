export type MoodValue = 1 | 2 | 3 | 4 | 5;

export const MOOD_OPTIONS = [
  { value: 1 as MoodValue, emoji: '😔', label: 'Тяжело' },
  { value: 2 as MoodValue, emoji: '😕', label: 'Непросто' },
  { value: 3 as MoodValue, emoji: '😐', label: 'Нейтрально' },
  { value: 4 as MoodValue, emoji: '🙂', label: 'Хорошо' },
  { value: 5 as MoodValue, emoji: '😊', label: 'Отлично' },
] as const;

export const MOOD_ACCENT_COLORS: Record<MoodValue, string> = {
  1: '#7B9EBE',
  2: '#9E7BBE',
  3: '#A09080',
  4: '#5DA888',
  5: '#C09A50',
};

export const MOOD_BG_COLORS: Record<MoodValue, string> = {
  1: '#EEF2F7',
  2: '#F2EEF7',
  3: '#F7F4EF',
  4: '#EFF7F3',
  5: '#F7F3E8',
};

export function applyMoodTheme(mood: MoodValue | null) {
  const root = document.documentElement;
  if (!mood) {
    root.removeAttribute('data-mood');
    return;
  }
  root.setAttribute('data-mood', String(mood));
}
