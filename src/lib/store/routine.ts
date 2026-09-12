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
 * Copy logic:
 *  - copyDayToDays(fromDay, targetDays[]): copies source day's blocks to
 *    specific target days. REPLACES all existing blocks on target days.
 *    Source day's blocks are NEVER touched.
 *  - copyDayToAll(fromDay): shorthand for copyDayToDays(fromDay, [all other days])
 *  - copyDayToWeekdays(fromDay): copies to Mon-Fri
 *  - copyDayToWeekends(fromDay): copies to Sat-Sun
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

// Day constants
export const SUNDAY = 0;
export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
export const WEEKENDS = [0, 6]; // Sun + Sat

interface RoutineStore {
  blocks: RoutineBlock[];
  addBlock: (b: Omit<RoutineBlock, 'id'>) => string;
  updateBlock: (id: string, patch: Partial<RoutineBlock>) => void;
  deleteBlock: (id: string) => void;
  deleteBlocksForDay: (day: number) => void;
  getBlocksForDay: (day: number) => RoutineBlock[];
  getTodayBlocks: () => RoutineBlock[];
  getCurrentBlock: () => RoutineBlock | null;
  getNextBlock: () => RoutineBlock | null;
  /** Copy source day's blocks to specific target days.
   *  REPLACES all existing blocks on target days.
   *  Source day's blocks are NEVER modified or removed. */
  copyDayToDays: (fromDay: number, targetDays: number[]) => void;
  /** Shorthand: copy to all OTHER 6 days (source day untouched) */
  copyDayToAll: (fromDay: number) => void;
  /** Copy to Mon-Fri (source day untouched if it's a weekday) */
  copyDayToWeekdays: (fromDay: number) => void;
  /** Copy to Sat-Sun (source day untouched if it's a weekend) */
  copyDayToWeekends: (fromDay: number) => void;
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

      deleteBlocksForDay: (day) =>
        set((s) => ({ blocks: s.blocks.filter((b) => b.day !== day) })),

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
        const tomorrow = (today + 1) % 7;
        const tomorrowBlocks = get().getBlocksForDay(tomorrow);
        return tomorrowBlocks[0] || null;
      },

      /**
       * CORE COPY LOGIC — bulletproof, no source-day clearing possible.
       *
       * Steps:
       * 1. Read current blocks
       * 2. Filter source day's blocks (deep copy each — new objects, new IDs)
       * 3. Keep ALL blocks that are NOT on target days (includes source day)
       * 4. For each target day, add fresh copies of source blocks
       * 5. set() with the combined array
       *
       * The source day is NEVER in targetDays (caller filters it out),
       * so its blocks are always preserved via step 3.
       */
      copyDayToDays: (fromDay, targetDays) => {
        const allBlocks = get().blocks;
        // Deep-copy source blocks (new objects, will get new IDs + target day)
        const sourceBlocks = allBlocks
          .filter((b) => b.day === fromDay)
          .map((b) => ({
            ...b,
            allowedActivities: b.allowedActivities ? [...b.allowedActivities] : undefined,
          }));

        if (sourceBlocks.length === 0) return;
        if (targetDays.length === 0) return;

        // Safety: ensure source day is NOT in targetDays (would cause issues)
        const safeTargets = targetDays.filter((d) => d !== fromDay);

        // Keep all blocks that are NOT on target days.
        // This INCLUDES the source day's original blocks — they're never touched.
        const preservedBlocks = allBlocks.filter((b) => !safeTargets.includes(b.day));

        // Create fresh copies for each target day
        const newCopies: RoutineBlock[] = [];
        for (const targetDay of safeTargets) {
          for (const src of sourceBlocks) {
            newCopies.push({
              ...src,
              id: uid(), // New unique ID for each copy
              day: targetDay,
            });
          }
        }

        // Final = preserved (source + non-target days) + new copies
        set({ blocks: [...preservedBlocks, ...newCopies] });
      },

      copyDayToAll: (fromDay) => {
        const otherDays = ALL_DAYS.filter((d) => d !== fromDay);
        get().copyDayToDays(fromDay, otherDays);
      },

      copyDayToWeekdays: (fromDay) => {
        const targets = WEEKDAYS.filter((d) => d !== fromDay);
        get().copyDayToDays(fromDay, targets);
      },

      copyDayToWeekends: (fromDay) => {
        const targets = WEEKENDS.filter((d) => d !== fromDay);
        get().copyDayToDays(fromDay, targets);
      },

      clearAll: () => set({ blocks: [] }),
    }),
    { name: 'neet-routine' }
  )
);
