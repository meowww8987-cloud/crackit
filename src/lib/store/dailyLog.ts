'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayKey, dateKey, addDays } from '@/lib/utils';

export interface DailyLog {
  date: string;
  sleepHours: number;
  energyLevel: number; // 1-5
  loggedAt: number;
}

interface DailyLogStore {
  logs: Record<string, DailyLog>;
  logToday: (sleepHours: number, energyLevel: number) => void;
  /** Update only the energy level for today (creates a partial log if needed). */
  setEnergy: (energyLevel: number) => void;
  getToday: () => DailyLog | null;
  getWeek: () => DailyLog[];
}

export const useDailyLog = create<DailyLogStore>()(
  persist(
    (set, get) => ({
      logs: {},

      logToday: (sleepHours, energyLevel) => {
        const today = todayKey();
        set((s) => ({
          logs: {
            ...s.logs,
            [today]: { date: today, sleepHours, energyLevel, loggedAt: Date.now() },
          },
        }));
      },

      setEnergy: (energyLevel) => {
        const today = todayKey();
        const existing = get().logs[today];
        set((s) => ({
          logs: {
            ...s.logs,
            [today]: {
              date: today,
              sleepHours: existing?.sleepHours ?? 0,
              energyLevel,
              loggedAt: Date.now(),
            },
          },
        }));
      },

      getToday: () => {
        const today = todayKey();
        return get().logs[today] || null;
      },

      getWeek: () => {
        const result: DailyLog[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = addDays(new Date(), -i);
          const key = dateKey(d);
          const log = get().logs[key];
          if (log) result.push(log);
        }
        return result;
      },
    }),
    { name: 'neet-daily-log' }
  )
);
