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
  // Percentage of timer visibility when dimmed. 100 = fully visible, 5 = barely visible.
  screenDimOpacity: 30,
  // Allow landscape rotation in focus timer
  allowLandscape: true,
  // Minimal mode — hides non-essential UI for deep focus
  minimalMode: false,
  // OLED Black — pure #000000 backgrounds for battery saving
  oledBlack: false,
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
      version: 4,
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

export function applyTheme(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (theme === 'dark') {
    el.classList.add('dark');
  } else {
    el.classList.remove('dark');
  }
}

export function applyOledBlack(enabled: boolean) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (enabled) {
    el.classList.add('oled-black');
  } else {
    el.classList.remove('oled-black');
  }
}

export function applyMinimalMode(enabled: boolean) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (enabled) {
    el.classList.add('minimal-mode');
  } else {
    el.classList.remove('minimal-mode');
  }
}
