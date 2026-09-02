'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Target } from '@/lib/types';
import { todayKey, uid, isToday } from '@/lib/utils';

interface TargetsStore {
  // keyed by date string YYYY-MM-DD
  byDate: Record<string, Target[]>;
  addTarget: (t: Omit<Target, 'id' | 'order' | 'createdAt' | 'done'>) => string;
  updateTarget: (id: string, patch: Partial<Target>) => void;
  deleteTarget: (id: string) => void;
  toggleDone: (id: string) => void;
  reorderToday: (newOrder: Target[]) => void;
  isAlreadyAddedToday: (subject: Target['subject'], chapter: string, activity: Target['activity'], lecture?: string) => boolean;
  getTodayTargets: () => Target[];
}

export const useTargets = create<TargetsStore>()(
  persist(
    (set, get) => ({
      byDate: {},

      addTarget: (t) => {
        const id = uid();
        const date = t.date || todayKey();
        const list = get().byDate[date] || [];
        const newTarget: Target = {
          ...t,
          id,
          date,
          order: list.length,
          done: false,
          createdAt: Date.now(),
        };
        set((s) => ({
          byDate: { ...s.byDate, [date]: [...list, newTarget] },
        }));
        return id;
      },

      updateTarget: (id, patch) =>
        set((s) => {
          const newByDate = { ...s.byDate };
          for (const date of Object.keys(newByDate)) {
            newByDate[date] = newByDate[date].map((t) =>
              t.id === id ? { ...t, ...patch } : t
            );
          }
          return { byDate: newByDate };
        }),

      deleteTarget: (id) =>
        set((s) => {
          const newByDate = { ...s.byDate };
          for (const date of Object.keys(newByDate)) {
            newByDate[date] = newByDate[date].filter((t) => t.id !== id);
          }
          return { byDate: newByDate };
        }),

      toggleDone: (id) => {
        // Find the target to get its lectureId + new done state
        const state = get();
        let target: Target | undefined;
        let newDone = false;
        for (const date of Object.keys(state.byDate)) {
          const t = state.byDate[date].find((x) => x.id === id);
          if (t) { target = t; newDone = !t.done; break; }
        }

        set((s) => {
          const newByDate = { ...s.byDate };
          for (const date of Object.keys(newByDate)) {
            newByDate[date] = newByDate[date].map((t) =>
              t.id === id ? { ...t, done: !t.done } : t
            );
          }
          return { byDate: newByDate };
        });

        // If marking DONE and there's an active session for this target → auto-stop the session
        if (newDone && target) {
          import('./session').then(({ useSession }) => {
            const session = useSession.getState();
            if (session.active && session.active.targetId === id) {
              // Session is running for this target → stop it
              session.stop();
            }
          });
        }

        // Bi-directional sync: if target is linked to a syllabus lecture,
        // sync the CORRECT resource based on the target's activity type.
        // Uses a global CustomEvent to avoid circular dependency with syllabus store.
        if (target?.lectureId && !target.isChapterTarget && newDone) {
          const activity = target.activity;
          // Dispatch a global event that the syllabus store listens for
          window.dispatchEvent(new CustomEvent('target-done-sync', {
            detail: {
              lectureId: target.lectureId,
              activity,
            }
          }));
        } else if (target?.lectureId && !target.isChapterTarget && !newDone) {
          // Undo — dispatch undo event
          window.dispatchEvent(new CustomEvent('target-undone-sync', {
            detail: {
              lectureId: target.lectureId,
              activity: target.activity,
            }
          }));
        }
      },

      reorderToday: (newOrder) =>
        set((s) => {
          const date = newOrder[0]?.date || todayKey();
          const reordered = newOrder.map((t, i) => ({ ...t, order: i }));
          return {
            byDate: { ...s.byDate, [date]: reordered },
          };
        }),

      isAlreadyAddedToday: (subject, chapter, activity, lecture) => {
        const list = get().byDate[todayKey()] || [];
        return list.some(
          (t) =>
            t.subject === subject &&
            t.chapter === chapter &&
            t.activity === activity &&
            (lecture ? t.lecture === lecture : true) &&
            isToday(t.date)
        );
      },

      getTodayTargets: () => {
        const list = get().byDate[todayKey()] || [];
        return [...list].sort((a, b) => a.order - b.order);
      },
    }),
    { name: 'neet-targets' }
  )
);
