'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/lib/types';

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  addNotification: (n: { title: string; body: string }) => void;
  clearNotifications: () => void;
}

const DEFAULTS: Settings = {
  dailyGoalHours: 8,
  targetScore: 650,
  examDate: '2027-05-02',
  prepStartDate: null,
  pomodoroWork: 50,
  pomodoroBreak: 10,
  burnProtection: true,
  dimDelay: 5,
  distractionTauntInterval: 2,
  autoDetectWasted: true,
  appTheme: 'dark',
  focusTheme: 'dark',
  textSize: 'M',
  prefer2D: true,
  haptics: true,
  confettiEnabled: true,
  soundEnabled: true,
  soundVolume: 50,
  notificationsEnabled: false,
  notificationHistory: [],
  // 3D background — 'auto' picks scene based on active session subject + chapter
  bg3DMode: 'auto',
  // Animation controls — reduce disables bounces/confetti; intensity scales loudness
  reduceAnimations: false,
  animationIntensity: 60,
  // Tutorial mode — shows one-time coach marks for every major feature
  tutorialMode: false,
  // Screen dimming opacity during focus timer (0-100%)
  // 0 = no dim, 100 = full black. Default 8 = subtle dim.
  screenDimOpacity: 8,
  // Allow landscape rotation in focus timer
  allowLandscape: true,
};

const TEXT_SIZE_PX = { S: 14, M: 16, L: 18, XL: 20 };

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULTS }),
      addNotification: (n) =>
        set((s) => ({
          notificationHistory: [
            { ...n, timestamp: Date.now() },
            ...s.notificationHistory,
          ].slice(0, 10),
        })),
      clearNotifications: () => set({ notificationHistory: [] }),
    }),
    {
      name: 'neet-settings',
      version: 5,
      migrate: (persisted: any) => {
        // Add bg3DMode default for users who saved settings before this field existed
        if (persisted?.state && persisted.state.bg3DMode === undefined) {
          persisted.state.bg3DMode = 'auto';
        }
        // Add animation control defaults for existing users
        if (persisted?.state && persisted.state.reduceAnimations === undefined) {
          persisted.state.reduceAnimations = false;
        }
        if (persisted?.state && persisted.state.animationIntensity === undefined) {
          persisted.state.animationIntensity = 60;
        }
        // Add tutorial mode default for existing users
        if (persisted?.state && persisted.state.tutorialMode === undefined) {
          persisted.state.tutorialMode = false;
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          applyTextSize(state.textSize);
          applyTheme(state.appTheme);
        }
      },
    }
  )
);

export function applyTextSize(size: Settings['textSize']) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--app-font-size', `${TEXT_SIZE_PX[size]}px`);
}

export function applyTheme(theme: 'dark' | 'light' | 'warm') {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  // Remove all theme classes
  el.classList.remove('dark', 'warm', 'light-mode-adapt', 'warm-mode-adapt');
  if (theme === 'dark') {
    el.classList.add('dark');
  } else if (theme === 'warm') {
    el.classList.add('warm', 'warm-mode-adapt');
  } else {
    // light mode — add adapter class so text-white/bg-white adapt to dark
    el.classList.add('light-mode-adapt');
  }
}
