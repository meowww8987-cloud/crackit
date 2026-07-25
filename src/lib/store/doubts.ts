'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject } from '@/lib/types';
import { uid, todayKey } from '@/lib/utils';

export interface Doubt {
  id: string;
  subject: Subject;
  chapter?: string;
  question: string;
  status: 'pending' | 'resolved';
  solution?: string;
  source?: 'self' | 'class' | 'mock';
  createdAt: number;
  resolvedAt?: number;
}

interface DoubtStore {
  doubts: Doubt[];
  addDoubt: (data: Omit<Doubt, 'id' | 'createdAt' | 'status'>) => void;
  resolveDoubt: (id: string, solution: string) => void;
  deleteDoubt: (id: string) => void;
  getPendingCount: () => number;
  getResolvedThisWeek: () => number;
}

export const useDoubts = create<DoubtStore>()(
  persist(
    (set, get) => ({
      doubts: [],

      addDoubt: (data) =>
        set((s) => ({
          doubts: [
            ...s.doubts,
            { ...data, id: uid(), status: 'pending' as const, createdAt: Date.now() },
          ],
        })),

      resolveDoubt: (id, solution) =>
        set((s) => ({
          doubts: s.doubts.map((d) =>
            d.id === id ? { ...d, status: 'resolved' as const, solution, resolvedAt: Date.now() } : d
          ),
        })),

      deleteDoubt: (id) =>
        set((s) => ({ doubts: s.doubts.filter((d) => d.id !== id) })),

      getPendingCount: () =>
        get().doubts.filter((d) => d.status === 'pending').length,

      getResolvedThisWeek: () => {
        const weekAgo = Date.now() - 7 * 86400000;
        return get().doubts.filter((d) => d.status === 'resolved' && (d.resolvedAt || 0) >= weekAgo).length;
      },
    }),
    { name: 'neet-doubts' }
  )
);
