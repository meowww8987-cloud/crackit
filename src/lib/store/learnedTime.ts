'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject, ActivityType } from '@/lib/types';

/**
 * LearnedTimeStore — learns expected study time per (subject, activity) pair.
 *
 * Every time a session is saved, we record the actual study time for that
 * subject+activity combination. The store keeps a running list of recent
 * durations (max 20 per pair) and computes the median.
 *
 * When adding a new target, the app calls getLearnedMinutes(subject, activity)
 * to get the smart default.
 *
 * Example flow:
 *   1. User studies Physics + Lecture for 120 min → record(Physics, Lecture, 120)
 *   2. User studies Physics + Revision for 45 min → record(Physics, Revision, 45)
 *   3. User studies Physics + DPP for 15 min → record(Physics, DPP, 15)
 *   4. Next time user selects Physics + Revision → getLearnedMinutes returns 45
 *   5. Next time user selects Physics + Lecture → getLearnedMinutes returns 120
 */

const MAX_SAMPLES = 20; // Keep last 20 sessions per (subject, activity) pair
const DEFAULTS: Record<ActivityType, number> = {
  Lecture: 60,
  DPP: 30,
  Notes: 25,
  Revision: 20,
  Custom: 60,
};

interface LearnedTimeStore {
  // Key: "Physics:Lecture" → array of durations in minutes
  data: Record<string, number[]>;

  /** Record a completed session's study time */
  record: (subject: Subject, activity: ActivityType, studyMinutes: number) => void;

  /** Get the learned expected time for a (subject, activity) pair */
  getLearnedMinutes: (subject: Subject, activity: ActivityType) => number;

  /** Get all learned times (for debugging/display) */
  getAll: () => Record<string, number[]>;

  /** Clear all learned data */
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
        // Ignore tiny sessions (< 3 min) and huge ones (> 4h)
        if (studyMinutes < 3 || studyMinutes > 240) return;
        const key = `${subject}:${activity}`;
        set((state) => {
          const existing = state.data[key] || [];
          const updated = [...existing, studyMinutes].slice(-MAX_SAMPLES);
          return { data: { ...state.data, [key]: updated } };
        });
      },

      getLearnedMinutes: (subject, activity) => {
        const key = `${subject}:${activity}`;
        const samples = get().data[key] || [];
        if (samples.length === 0) return DEFAULTS[activity] || 60;
        const med = median(samples);
        return roundTo5(Math.max(5, med)); // minimum 5 min
      },

      getAll: () => get().data,

      clear: () => set({ data: {} }),
    }),
    { name: 'neet-learned-times' }
  )
);

/**
 * Convenience function — call this when a session is saved to record
 * the study time for that subject+activity pair.
 */
export function recordSessionTime(subject: Subject, activity: ActivityType, studySeconds: number) {
  const minutes = Math.round(studySeconds / 60);
  useLearnedTime.getState().record(subject, activity, minutes);
}

/**
 * Convenience function — get learned expected minutes without React hook.
 * Used in non-component code (e.g., quick-add handlers).
 */
export function getLearnedExpectedMinutes(subject: Subject, activity: ActivityType): number {
  return useLearnedTime.getState().getLearnedMinutes(subject, activity);
}
