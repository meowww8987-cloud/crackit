'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject } from '@/lib/types';
import { uid, todayKey, dateKey } from '@/lib/utils';

export type ProgressEventType = 'lecture_done' | 'lecture_undone' | 'chapter_complete' | 'revision_done';

export interface ProgressEvent {
  id: string;
  type: ProgressEventType;
  lectureId?: string;
  chapterId: string;
  subject: Subject;
  chapterName: string;
  lectureLabel?: string; // "L1" or "C1"
  topic: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
}

interface ProgressStore {
  events: ProgressEvent[];
  logEvent: (event: Omit<ProgressEvent, 'id' | 'timestamp' | 'date'>) => void;
  getRecentEvents: (limit?: number) => ProgressEvent[];
  getEventsGroupedByDay: () => { date: string; events: ProgressEvent[] }[];
  getDoneCount: () => number;
  getDoneCountForDate: (date: string) => number;
  getDoneCountThisWeek: () => number;
  getMilestones: () => ProgressEvent[]; // chapter_complete events
  clearEvents: () => void;
}

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => ({
      events: [],

      logEvent: (event) =>
        set((s) => ({
          events: [
            ...s.events,
            {
              ...event,
              id: uid(),
              timestamp: Date.now(),
              date: todayKey(),
            },
          ].slice(-500), // keep last 500 events max
        })),

      getRecentEvents: (limit = 50) =>
        [...get().events]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit),

      getEventsGroupedByDay: () => {
        const events = [...get().events].sort((a, b) => b.timestamp - a.timestamp);
        const map: Record<string, ProgressEvent[]> = {};
        for (const e of events) {
          if (!map[e.date]) map[e.date] = [];
          map[e.date].push(e);
        }
        return Object.entries(map)
          .map(([date, evts]) => ({ date, events: evts }))
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      getDoneCount: () =>
        get().events.filter((e) => e.type === 'lecture_done').length,

      getDoneCountForDate: (date) =>
        get().events.filter((e) => e.date === date && e.type === 'lecture_done').length,

      getDoneCountThisWeek: () => {
        const weekAgo = Date.now() - 7 * 86400000;
        return get().events.filter(
          (e) => e.type === 'lecture_done' && e.timestamp >= weekAgo
        ).length;
      },

      getMilestones: () =>
        get().events.filter((e) => e.type === 'chapter_complete'),

      clearEvents: () => set({ events: [] }),
    }),
    { name: 'neet-progress' }
  )
);
