'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Subject } from '@/lib/types';
import { todayKey, uid } from '@/lib/utils';
import { useHistory } from '@/lib/store/history';

export interface LockTimerState {
  isActive: boolean;
  isCompleted: boolean;
  subject: Subject | null;
  chapter?: string;
  topic?: string;
  targetMinutes: number;
  startedAt: number;   // ms timestamp
  endsAt: number;      // startedAt + targetMinutes * 60000
  cancelledAt: number | null;
  completedAt: number | null;
}

interface LockTimerStore extends LockTimerState {
  start: (opts: { subject: Subject; chapter?: string; topic?: string; targetMinutes: number }) => void;
  cancel: () => void;      // double-tap cancel — saves partial session
  complete: () => void;    // timer finished naturally — saves full session
  clear: () => void;       // reset state after UI dismisses
  getRemainingSec: () => number;
  getElapsedSec: () => number;
  getProgressPct: () => number;
}

export const useLockTimer = create<LockTimerStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      isCompleted: false,
      subject: null,
      chapter: undefined,
      topic: undefined,
      targetMinutes: 0,
      startedAt: 0,
      endsAt: 0,
      cancelledAt: null,
      completedAt: null,

      start: (opts) => {
        const now = Date.now();
        set({
          isActive: true,
          isCompleted: false,
          subject: opts.subject,
          chapter: opts.chapter,
          topic: opts.topic || `Lock-In: ${opts.subject}`,
          targetMinutes: opts.targetMinutes,
          startedAt: now,
          endsAt: now + opts.targetMinutes * 60 * 1000,
          cancelledAt: null,
          completedAt: null,
        });
      },

      cancel: () => {
        const s = get();
        if (!s.isActive) return;
        const elapsedSec = s.getElapsedSec();
        set({
          isActive: false,
          cancelledAt: Date.now(),
        });
        // Save partial session (only if at least 30s studied)
        if (elapsedSec >= 30) {
          saveSession(s, elapsedSec);
        }
      },

      complete: () => {
        const s = get();
        if (!s.isActive) return;
        const elapsedSec = s.getElapsedSec();
        set({
          isActive: false,
          isCompleted: true,
          completedAt: Date.now(),
        });
        // Save full session
        if (elapsedSec >= 30) {
          saveSession(s, elapsedSec);
        }
      },

      clear: () => {
        set({
          isActive: false,
          isCompleted: false,
          subject: null,
          chapter: undefined,
          topic: undefined,
          targetMinutes: 0,
          startedAt: 0,
          endsAt: 0,
          cancelledAt: null,
          completedAt: null,
        });
      },

      getRemainingSec: () => {
        const s = get();
        if (!s.isActive) return 0;
        return Math.max(0, Math.floor((s.endsAt - Date.now()) / 1000));
      },

      getElapsedSec: () => {
        const s = get();
        if (!s.startedAt) return 0;
        const endTime = s.cancelledAt || s.completedAt || Date.now();
        return Math.max(0, Math.floor((endTime - s.startedAt) / 1000));
      },

      getProgressPct: () => {
        const s = get();
        if (!s.isActive || s.targetMinutes === 0) return 0;
        const elapsed = s.getElapsedSec();
        const total = s.targetMinutes * 60;
        return Math.min(100, Math.round((elapsed / total) * 100));
      },
    }),
    {
      name: 'neet-lock-timer',
      partialize: (s) => ({
        isActive: s.isActive,
        isCompleted: s.isCompleted,
        subject: s.subject,
        chapter: s.chapter,
        topic: s.topic,
        targetMinutes: s.targetMinutes,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        cancelledAt: s.cancelledAt,
        completedAt: s.completedAt,
      }),
    }
  )
);

// Helper: save a session to history
function saveSession(s: LockTimerState, elapsedSec: number) {
  useHistory.getState().addSession({
    id: uid(),
    targetId: null,
    subject: s.subject || 'General',
    chapter: s.chapter || 'Lock-In',
    lecture: undefined,
    topic: s.topic || `Lock-In: ${s.subject}`,
    mode: 'focus',
    studySeconds: elapsedSec,
    wastedSeconds: 0,
    mood: null,
    startedAt: s.startedAt,
    endedAt: Date.now(),
    date: todayKey(),
  });
}

// === React hook for live ticking ===
// Components use this to re-render every second while the timer is active.
import { useState, useEffect } from 'react';
export function useLockTimerTick() {
  const isActive = useLockTimer((s) => s.isActive);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isActive]);
}
