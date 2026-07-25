'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedSession } from '@/lib/types';
import { todayKey, isSameDay } from '@/lib/utils';

interface HistoryStore {
  sessions: SavedSession[];
  addSession: (s: SavedSession) => void;
  deleteSession: (id: string) => void;
  getTodaySessions: () => SavedSession[];
  getSessionsForTargetToday: (targetId: string) => SavedSession[];
  getSessionsForTarget: (targetId: string) => SavedSession[];
  getSessionsForDate: (date: string) => SavedSession[];
  getAllSessions: () => SavedSession[];
  getTodayStudySeconds: () => number;
  getYesterdayStudySeconds: () => number;
  getThisWeekStudySeconds: () => number;
  getLastWeekStudySeconds: () => number;
  // Returns streak (consecutive days with at least 1 session), 0 if none
  getStreak: () => number;
}

// Helper: count consecutive study days (without freeze logic — raw count)
function streakCount(days: Set<string>): number {
  let count = 0;
  const d = new Date();
  const todayKeyStr = todayKey();
  if (!days.has(todayKeyStr)) d.setDate(d.getDate() - 1);
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (days.has(key)) { count++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return count;
}

export const useHistory = create<HistoryStore>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (s) => set((st) => ({ sessions: [...st.sessions, s] })),

      deleteSession: (id) =>
        set((st) => ({ sessions: st.sessions.filter((x) => x.id !== id) })),

      getTodaySessions: () => {
        const today = todayKey();
        return get().sessions.filter((s) => s.date === today);
      },

      getSessionsForTargetToday: (targetId) => {
        const today = todayKey();
        return get().sessions.filter((s) => s.targetId === targetId && s.date === today);
      },

      getSessionsForTarget: (targetId) =>
        get().sessions.filter((s) => s.targetId === targetId),

      getSessionsForDate: (date) =>
        get().sessions.filter((s) => s.date === date),

      getAllSessions: () =>
        [...get().sessions].sort((a, b) => b.endedAt - a.endedAt),

      getTodayStudySeconds: () => {
        const today = todayKey();
        return get()
          .sessions.filter((s) => s.date === today)
          .reduce((acc, s) => acc + s.studySeconds, 0);
      },

      getYesterdayStudySeconds: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return get()
          .sessions.filter((s) => s.date === y)
          .reduce((acc, s) => acc + s.studySeconds, 0);
      },

      getThisWeekStudySeconds: () => {
        // Week = last 7 days including today
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;
        return get()
          .sessions.filter((s) => s.endedAt >= weekAgo)
          .reduce((acc, s) => acc + s.studySeconds, 0);
      },

      getLastWeekStudySeconds: () => {
        // Last week = 7-14 days ago
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;
        const twoWeeksAgo = now - 14 * 86400000;
        return get()
          .sessions.filter((s) => s.endedAt >= twoWeeksAgo && s.endedAt < weekAgo)
          .reduce((acc, s) => acc + s.studySeconds, 0);
      },

      getStreak: () => {
        const sessions = get().sessions;
        if (sessions.length === 0) return 0;
        // Build set of unique study-day keys (where study seconds > 60)
        const days = new Set<string>();
        for (const s of sessions) {
          if (s.studySeconds >= 60) days.add(s.date);
        }
        if (days.size === 0) return 0;

        // Streak freeze: every 7 consecutive days, earn 1 freeze.
        // Freezes auto-fill gaps (missed days) in the streak.
        // Max 2 freezes can be used per streak.
        const freezesAvailable = Math.floor(streakCount(days) / 7);
        const freezesUsed = get()._freezesUsed || 0;
        const freezesRemaining = Math.max(0, freezesAvailable - freezesUsed);

        // Count back from today, allowing up to 2 freeze gaps
        let streak = 0;
        let freezeGapsUsed = 0;
        const d = new Date();
        const todayKeyStr = todayKey();
        if (!days.has(todayKeyStr)) {
          d.setDate(d.getDate() - 1);
        }
        while (true) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (days.has(key)) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else if (freezeGapsUsed < freezesRemaining && freezeGapsUsed < 2) {
            // Use a freeze to skip this gap day
            freezeGapsUsed++;
            streak++;
            d.setDate(d.getDate() - 1);
          } else break;
        }
        return streak;
      },

      // Streak freeze state
      _freezesUsed: 0,
      _freezesEarned: 0,
    }),
    { name: 'neet-history' }
  )
);

// Re-export for convenience
export { isSameDay };
