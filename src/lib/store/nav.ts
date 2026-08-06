'use client';

import { create } from 'zustand';

export type TabKey = 'home' | 'study' | 'syllabus' | 'history' | 'tests' | 'stats' | 'settings';

interface NavStore {
  activeTab: TabKey;
  setTab: (t: TabKey) => void;
  // For swipe navigation
  swipeToTab: (direction: 'left' | 'right') => void;
}

const TAB_ORDER: TabKey[] = ['home', 'study', 'syllabus', 'history', 'tests', 'stats', 'settings'];

export const useNav = create<NavStore>((set, get) => ({
  activeTab: 'study', // Default per spec
  setTab: (t) => set({ activeTab: t }),
  swipeToTab: (direction) => {
    const current = get().activeTab;
    const idx = TAB_ORDER.indexOf(current);
    if (direction === 'left' && idx > 0) {
      set({ activeTab: TAB_ORDER[idx - 1] });
    } else if (direction === 'right' && idx < TAB_ORDER.length - 1) {
      set({ activeTab: TAB_ORDER[idx + 1] });
    }
  },
}));

export { TAB_ORDER };
