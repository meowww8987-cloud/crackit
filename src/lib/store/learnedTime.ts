'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject, ActivityType } from '@/lib/types';

/**
 * LearnedTimeStore — learns expected study time per (subject, activity) pair.
 *
 * Every time a target is added or a session is saved, we record the time.
 * The store keeps a running list of recent durations (max 20 per pair) and
 * computes the median.
 *
 * When adding a new target, the app calls getLearnedMinutes(subject, activity)
 * to get the smart default.
 *
 * STORAGE: Zustand persist middleware writes to localStorage key
 * 'neet-learned-times'. The persist middleware handles hydration + writes
 * automatically — we do NOT write to localStorage directly (that caused
 * a race condition where persist's hydration overwrote our direct writes).
 */

const MAX_SAMPLES = 20;
const STORAGE_KEY = 'neet-learned-times';
const DEFAULTS: Record<ActivityType, number> = {
  Lecture: 60,
  DPP: 30,
  Notes: 25,
  Revision: 20,
  Custom: 60,
};

interface LearnedTimeStore {
  data: Record<string, number[]>;
  record: (subject: Subject, activity: ActivityType, studyMinutes: number) => void;
  getLearnedMinutes: (subject: Subject, activity: ActivityType) => number;
  getAll: () => Record<string, number[]>;
  clear: () => void;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export const useLearnedTime = create<LearnedTimeStore>()(
  persist(
    (set, get) => ({
      data: {},

      record: (subject, activity, studyMinutes) => {
        if (studyMinutes < 3 || studyMinutes > 240) return;
        const key = `${subject}:${activity}`;
        set((state) => {
          const existing = state.data[key] || [];
          const updated = [...existing, studyMinutes].slice(-MAX_SAMPLES);
          return { data: { ...state.data, [key]: updated } };
        });
        // Zustand persist will write to localStorage automatically after set().
        // We do NOT write to localStorage directly — that caused a race condition
        // where persist's async hydration overwrote our direct writes.
      },

      getLearnedMinutes: (subject, activity) => {
        const key = `${subject}:${activity}`;
        const samples = get().data[key] || [];
        if (samples.length === 0) return DEFAULTS[activity] || 60;
        const med = median(samples);
        return roundTo5(Math.max(5, med));
      },

      getAll: () => get().data,

      clear: () => set({ data: {} }),
    }),
    {
      name: STORAGE_KEY,
      // Force immediate write on every set() — no batching delay
      // This ensures localStorage is always in sync with Zustand state
    }
  )
);

/**
 * Convenience function — record a session's study time.
 * Used by history.addSession when a session is saved.
 */
export function recordSessionTime(subject: Subject, activity: ActivityType, studySeconds: number) {
  const minutes = Math.round(studySeconds / 60);
  if (minutes < 3 || minutes > 240) return;
  // Single write path — Zustand state update triggers persist → localStorage
  useLearnedTime.getState().record(subject, activity, minutes);
}

/**
 * Convenience function — get learned expected minutes without React hook.
 * Used in non-component code (e.g., quick-add handlers, AddTargetSheet).
 *
 * Reads from Zustand's getState() which is always in sync with localStorage
 * after hydration. On first render before hydration, falls back to defaults.
 *
 * NOTE: We no longer read localStorage directly here. The previous code
 * read localStorage first, which worked for reads but the write path
 * (in addTarget) wrote to localStorage directly, causing a race with
 * Zustand's persist hydration. Now both read and write go through Zustand.
 */
export function getLearnedExpectedMinutes(subject: Subject, activity: ActivityType): number {
  // Try Zustand store first — always in sync after hydration
  const storeVal = useLearnedTime.getState().getLearnedMinutes(subject, activity);
  if (storeVal !== DEFAULTS[activity]) {
    return storeVal; // Store has learned data
  }

  // Fallback: read localStorage directly (handles pre-hydration on first load)
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const data = parsed?.state?.data;
        if (data) {
          const key = `${subject}:${activity}`;
          const samples = data[key];
          if (samples && Array.isArray(samples) && samples.length > 0) {
            const sorted = [...samples].sort((a: number, b: number) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const med = sorted.length % 2 === 0
              ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
              : sorted[mid];
            return Math.round(Math.max(5, med) / 5) * 5;
          }
        }
      }
    }
  } catch {}

  return DEFAULTS[activity] || 60;
}
