import { create } from 'zustand';
import type { MoodValue } from '../lib/mood';

interface AppStore {
  selectedMood: MoodValue | null;
  setSelectedMood: (mood: MoodValue | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedMood: null,
  setSelectedMood: (mood) => set({ selectedMood: mood }),
}));
