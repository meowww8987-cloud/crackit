'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayKey, dateKey, addDays } from '@/lib/utils';

interface WeeklyGoals {
  studyHours: number;
  lectures: number;
  dpps: number;
}

interface WeeklyGoalStore {
  currentGoals: WeeklyGoals | null;
  goalWeekStart: string | null; // YYYY-MM-DD (Monday of current week)
  lastWeekGoals: WeeklyGoals | null;
  lastWeekActual: WeeklyGoals | null;

  setWeeklyGoals: (goals: WeeklyGoals) => void;
  checkWeekRollover: () => void;
  getWeekProgress: () => { study: number; lectures: number; dpps: number; goals: WeeklyGoals; weekStart: string } | null;
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  return dateKey(d);
}

export const useWeeklyGoals = create<WeeklyGoalStore>()(
  persist(
    (set, get) => ({
      currentGoals: null,
      goalWeekStart: null,
      lastWeekGoals: null,
      lastWeekActual: null,

      setWeeklyGoals: (goals) => {
        set({
          currentGoals: goals,
          goalWeekStart: getWeekStart(),
        });
      },

      checkWeekRollover: () => {
        const state = get();
        const thisWeek = getWeekStart();
        if (state.goalWeekStart && state.goalWeekStart !== thisWeek) {
          // Week changed — archive last week's goals
          set({
            lastWeekGoals: state.currentGoals,
            lastWeekActual: null, // Will be computed by caller
            goalWeekStart: thisWeek,
            currentGoals: null, // Reset — user needs to set new goals
          });
        }
      },

      getWeekProgress: () => {
        const state = get();
        if (!state.currentGoals) return null;
        return {
          goals: state.currentGoals,
          weekStart: state.goalWeekStart || getWeekStart(),
          study: 0, // Filled by caller
          lectures: 0,
          dpps: 0,
        };
      },
    }),
    { name: 'neet-weekly-goals' }
  )
);
