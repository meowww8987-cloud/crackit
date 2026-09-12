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
  checkAutoComplete: () => void; // auto-complete if endsAt has passed (app return)
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
        // === FIX: Use endsAt as completedAt (when the timer ACTUALLY ended),
        // not Date.now() (when the user happened to reopen the app) ===
        const completedAt = s.endsAt || Date.now();
        set({
          isActive: false,
          isCompleted: true,
          completedAt,
        });
        // Save full session — uses capped elapsedSec + endsAt as endedAt
        if (elapsedSec >= 30) {
          saveSession({ ...s, completedAt }, elapsedSec);
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
        const raw = Math.max(0, Math.floor((endTime - s.startedAt) / 1000));
        // === FIX: Cap elapsed at target duration ===
        // When the timer is active (not yet cancelled/completed) and the app
        // was backgrounded past the end time, Date.now() - startedAt would
        // return the FULL background duration (could be hours). We cap it at
        // targetMinutes * 60 so the saved session + displayed time is correct.
        if (s.targetMinutes > 0) {
          return Math.min(raw, s.targetMinutes * 60);
        }
        return raw;
      },

      getProgressPct: () => {
        const s = get();
        if (!s.isActive || s.targetMinutes === 0) return 0;
        const elapsed = s.getElapsedSec();
        const total = s.targetMinutes * 60;
        return Math.min(100, Math.round((elapsed / total) * 100));
      },

      // === FIX: Auto-complete if timer should have ended while app was backgrounded ===
      // Called on app visibility return. If endsAt has passed, complete the timer
      // with the correct (capped) elapsed time.
      checkAutoComplete: () => {
        const s = get();
        if (!s.isActive) return;
        if (Date.now() >= s.endsAt) {
          // Timer should have ended while app was in background
          get().complete();
        }
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
  // === FIX: Use endsAt as the endedAt timestamp when the timer completed
  // naturally (not cancelled). This ensures the session's endedAt reflects
  // when the timer ACTUALLY ended, not when the user happened to reopen
  // the app. For cancellations, cancelledAt is used (set by cancel()).
  const endedAt = s.cancelledAt || s.endsAt || Date.now();
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
    endedAt,
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
    // === HEAT FIX: Skip when tab hidden — getRemainingSec is Date-diff based ===
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(i);
  }, [isActive]);
}
