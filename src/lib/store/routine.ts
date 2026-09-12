'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject, ActivityType } from '@/lib/types';
import { uid } from '@/lib/utils';

/**
 * RoutineStore — Smart Study Routine schedule.
 *
 * A weekly schedule of study blocks. Each block has:
 *  - day (0=Sun ... 6=Sat)
 *  - startHour / endHour (whole hours, 0-24)
 *  - subject (Physics/Chemistry/Botany/Zoology/General)
 *  - type: 'lecture' | 'self-study' | 'break'
 *  - For 'self-study': allowedActivities (which activities count as "on plan")
 *
 * The app uses getCurrentBlock() to show "you should be doing X right now" on
 * the Study tab, and computes adherence by comparing planned blocks vs actual
 * saved sessions.
 *
 * Break blocks are excluded from the adherence denominator — they're free time.
 */

export type BlockType = 'lecture' | 'self-study' | 'break';

export interface RoutineBlock {
  id: string;
  day: number;         // 0=Sun, 6=Sat
  startHour: number;   // 0-23
  endHour: number;     // 1-24 (endHour > startHour)
  subject: Subject;
  type: BlockType;
  /** For 'self-study' blocks: which activities count as on-plan.
   *  Empty = any activity counts. */
  allowedActivities?: ActivityType[];
}

interface RoutineStore {
  blocks: RoutineBlock[];
  addBlock: (b: Omit<RoutineBlock, 'id'>) => string;
  updateBlock: (id: string, patch: Partial<RoutineBlock>) => void;
  deleteBlock: (id: string) => void;
  getBlocksForDay: (day: number) => RoutineBlock[];
  getTodayBlocks: () => RoutineBlock[];
  getCurrentBlock: () => RoutineBlock | null;
  getNextBlock: () => RoutineBlock | null;
  copyDayToAll: (fromDay: number) => void;
  clearAll: () => void;
}

export const useRoutine = create<RoutineStore>()(
  persist(
    (set, get) => ({
      blocks: [],

      addBlock: (b) => {
        const id = uid();
        const block: RoutineBlock = { ...b, id };
        set((s) => ({ blocks: [...s.blocks, block] }));
        return id;
      },

      updateBlock: (id, patch) =>
        set((s) => ({
          blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),

      deleteBlock: (id) =>
        set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),

      getBlocksForDay: (day) => {
        const blocks = get().blocks;
        return blocks
          .filter((b) => b.day === day)
          .sort((a, b) => a.startHour - b.startHour);
      },

      getTodayBlocks: () => {
        const today = new Date().getDay();
        return get().getBlocksForDay(today);
      },

      getCurrentBlock: () => {
        const now = new Date();
        const hour = now.getHours();
        const today = now.getDay();
        const blocks = get().blocks;
        return (
          blocks.find(
            (b) => b.day === today && hour >= b.startHour && hour < b.endHour
          ) || null
        );
      },

      getNextBlock: () => {
        const now = new Date();
        const hour = now.getHours();
        const today = now.getDay();
        const todayBlocks = get()
          .getBlocksForDay(today)
          .filter((b) => b.startHour > hour);
        if (todayBlocks.length > 0) return todayBlocks[0];
        // No more blocks today — find first block tomorrow
        const tomorrow = (today + 1) % 7;
        const tomorrowBlocks = get().getBlocksForDay(tomorrow);
        return tomorrowBlocks[0] || null;
      },

      copyDayToAll: (fromDay) => {
        const blocks = get().blocks;
        const sourceBlocks = blocks.filter((b) => b.day === fromDay);
        if (sourceBlocks.length === 0) return;
        // === FIX: Replace ALL blocks on other days with copies of source ===
        // Previous code kept existing blocks on other days AND added copies →
        // duplicates on every day that already had blocks.
        // Now: keep ONLY the source day's original blocks, then add fresh
        // copies for each of the other 6 days. No duplicates possible.
        const copiedBlocks: RoutineBlock[] = [];
        for (let day = 0; day < 7; day++) {
          if (day === fromDay) continue;
          for (const src of sourceBlocks) {
            copiedBlocks.push({
              ...src,
              id: uid(),
              day,
            });
          }
        }
        // Final blocks = source day's originals + copies for other 6 days
        set({ blocks: [...sourceBlocks, ...copiedBlocks] });
      },

      clearAll: () => set({ blocks: [] }),
    }),
    { name: 'neet-routine' }
  )
);
