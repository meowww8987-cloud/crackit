'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimetableSlot, Subject } from '@/lib/types';
import { uid } from '@/lib/utils';

interface TimetableStore {
  slots: TimetableSlot[];
  addSlot: (slot: Omit<TimetableSlot, 'id'>) => void;
  updateSlot: (id: string, patch: Partial<TimetableSlot>) => void;
  deleteSlot: (id: string) => void;
  getTodaySlots: () => TimetableSlot[];
  getSlotsForDay: (day: number) => TimetableSlot[];
  getCurrentSlot: () => TimetableSlot | null;
}

export const useTimetable = create<TimetableStore>()(
  persist(
    (set, get) => ({
      slots: [],

      addSlot: (slot) =>
        set((s) => ({ slots: [...s.slots, { ...slot, id: uid() }] })),

      updateSlot: (id, patch) =>
        set((s) => ({
          slots: s.slots.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
        })),

      deleteSlot: (id) =>
        set((s) => ({ slots: s.slots.filter((sl) => sl.id !== id) })),

      getTodaySlots: () => {
        const today = new Date().getDay();
        return get()
          .getSlotsForDay(today)
          .sort((a, b) => a.startHour - b.startHour);
      },

      getSlotsForDay: (day) =>
        get()
          .slots.filter((s) => s.day === day)
          .sort((a, b) => a.startHour - b.startHour),

      getCurrentSlot: () => {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentMinutes = hour * 60 + minute;
        return (
          get()
            .getSlotsForDay(day)
            .find((s) => {
              const start = s.startHour * 60;
              const end = s.endHour * 60;
              return currentMinutes >= start && currentMinutes < end;
            }) || null
        );
      },
    }),
    { name: 'neet-timetable' }
  )
);
