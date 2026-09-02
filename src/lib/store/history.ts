'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedSession, Subject, ActivityType } from '@/lib/types';
import { todayKey, isSameDay } from '@/lib/utils';
import { useLearnedTime } from './learnedTime';

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
  // Streak freeze — earned weekly, max 2 stored
  getFreezes: () => number;
  addFreeze: () => void;
  useFreeze: () => boolean;
}

export const useHistory = create<HistoryStore>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (s) => {
        set((st) => ({ sessions: [...st.sessions, s] }));
        // === Record learned time for this subject+activity pair ===
        // This powers the AI that auto-fills expected time when adding new targets.
        // We look up the target's activity from localStorage (synchronous) and
        // update BOTH the Zustand store state AND localStorage. Updating the
        // Zustand state is critical — otherwise the store stays empty and
        // persist middleware can overwrite localStorage on next hydration.
        if (s.targetId && s.studySeconds >= 180) {
          try {
            // Read targets from localStorage directly (synchronous, no import)
            const raw = localStorage.getItem('neet-targets');
            if (raw) {
              const parsed = JSON.parse(raw);
              const byDate = parsed?.state?.byDate || {};
              let activity: ActivityType | null = null;
              for (const date of Object.keys(byDate)) {
                const target = byDate[date]?.find((t: any) => t.id === s.targetId);
                if (target) { activity = target.activity as ActivityType; break; }
              }
              if (activity) {
                const minutes = Math.round(s.studySeconds / 60);
                if (minutes >= 3 && minutes <= 240) {
                  // 1. Update Zustand store state (reactive + triggers persist write)
                  useLearnedTime.getState().record(
                    s.subject as Subject,
                    activity,
                    minutes
                  );
                  // 2. Also write directly to localStorage as a safety net
                  // (record() above already triggers persist, but this ensures
                  // the data is there even if persist is delayed)
                  try {
                    const ltRaw = localStorage.getItem('neet-learned-times');
                    const ltParsed = ltRaw ? JSON.parse(ltRaw) : { state: { data: {} } };
                    const data = ltParsed?.state?.data || {};
                    const key = `${s.subject}:${activity}`;
                    const existing = data[key] || [];
                    data[key] = [...existing, minutes].slice(-20);
                    ltParsed.state = ltParsed.state || {};
                    ltParsed.state.data = data;
                    localStorage.setItem('neet-learned-times', JSON.stringify(ltParsed));
                  } catch {}
                }
              }
            }
          } catch {}
        }
      },

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

        // === Streak Freeze ===
        // Read freezes from localStorage (max 2 stored)
        let freezesAvailable = 0;
        try {
          freezesAvailable = parseInt(localStorage.getItem('neet-streak-freezes') || '0', 10);
          if (isNaN(freezesAvailable)) freezesAvailable = 0;
        } catch {}

        // Count back from today
        let streak = 0;
        let freezesUsed = 0;
        const d = new Date();
        // If today not in set but yesterday is — still count from yesterday
        const todayKeyStr = todayKey();
        if (!days.has(todayKeyStr)) {
          d.setDate(d.getDate() - 1);
        }
        while (true) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (days.has(key)) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else {
            // Gap day — check if we have a freeze available
            if (freezesUsed < freezesAvailable) {
              freezesUsed++;
              streak++;
              d.setDate(d.getDate() - 1);
            } else {
              break;
            }
          }
        }
        return streak;
      },

      // === Streak Freeze management ===
      getFreezes: () => {
        try {
          return Math.min(2, parseInt(localStorage.getItem('neet-streak-freezes') || '0', 10) || 0);
        } catch { return 0; }
      },
      addFreeze: () => {
        try {
          const current = parseInt(localStorage.getItem('neet-streak-freezes') || '0', 10) || 0;
          localStorage.setItem('neet-streak-freezes', String(Math.min(2, current + 1)));
        } catch {}
      },
      useFreeze: () => {
        try {
          const current = parseInt(localStorage.getItem('neet-streak-freezes') || '0', 10) || 0;
          if (current > 0) {
            localStorage.setItem('neet-streak-freezes', String(current - 1));
            return true;
          }
        } catch {}
        return false;
      },
    }),
    { name: 'neet-history' }
  )
);

// Re-export for convenience
export { isSameDay };
