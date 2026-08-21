'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveSession, SavedSession, Mood, Subject, SessionMode } from '@/lib/types';
import { uid, vibrate, todayKey } from '@/lib/utils';
import { useSettings } from './settings';
import { useHistory } from './history';

interface SessionStore {
  active: ActiveSession | null;
  widgetHidden: boolean;
  focusOpen: boolean; // full-screen timer overlay
  // Burn protection state
  lastInteractionAt: number;
  // Auto-detect wasted time state
  awaySince: number | null;
  // Saved session pending mood selection
  pendingMoodSession: Omit<SavedSession, 'mood' | 'id'> | null;

  // Actions
  startSession: (opts: {
    targetId: string | null;
    subject: Subject;
    chapter: string;
    lecture?: string;
    topic: string;
    mode: SessionMode;
    expectedMinutes?: number;
  }) => void;
  pause: () => void;
  resume: () => void;
  toggleWasting: () => void;
  stop: () => void; // stops and opens mood picker (or saves if disabled)
  saveWithMood: (mood: Mood) => void;
  cancelPending: () => void;
  setFocusOpen: (open: boolean) => void;
  setWidgetHidden: (hidden: boolean) => void;
  bumpInteraction: () => void;
  restoreSession: () => void; // auto-pause on app reload
  markAway: () => void;
  handleReturn: () => void;
  // Internal tick — called every second
  tick: () => void;
}

export const useSession = create<SessionStore>()(
  persist(
    (set, get) => ({
      active: null,
      widgetHidden: false,
      focusOpen: false,
      lastInteractionAt: Date.now(),
      awaySince: null,
      pendingMoodSession: null,

      startSession: (opts) => {
        const state = get();
        // Enforce single active session
        if (state.active) {
          // Auto-save the current one first (without mood)
          const prev = state.active;
          // commit any in-flight study/waste time
          const finalSession = commitInflight(prev);
          const saved: Omit<SavedSession, 'mood' | 'id'> = {
            targetId: finalSession.targetId,
            subject: finalSession.subject,
            chapter: finalSession.chapter,
            lecture: finalSession.lecture,
            topic: finalSession.topic,
            mode: finalSession.mode,
            studySeconds: finalSession.studySeconds,
            wastedSeconds: finalSession.wastedSeconds,
            startedAt: finalSession.startedAt,
            endedAt: Date.now(),
            date: finalSession.date ?? todayKey(), // Use session's START date, not today
          };
          // Save directly without mood prompt for the previous session
          useHistory.getState().addSession({ ...saved, id: uid(), mood: null });
        }

        // Compute baseline = total time already logged for this target today.
        // This lets the timer continue from where the user left off when they
        // restart a session for the same target on the same day (e.g. after
        // marking done → undone → start again). For free study (targetId === null)
        // the baseline stays 0 because each free-study session is independent.
        let baselineStudySeconds = 0;
        let baselineWastedSeconds = 0;
        if (opts.targetId) {
          const priorToday = useHistory.getState().getSessionsForTargetToday(opts.targetId);
          baselineStudySeconds = priorToday.reduce((acc, s) => acc + s.studySeconds, 0);
          baselineWastedSeconds = priorToday.reduce((acc, s) => acc + s.wastedSeconds, 0);
        }

        const session: ActiveSession = {
          targetId: opts.targetId,
          subject: opts.subject,
          chapter: opts.chapter,
          lecture: opts.lecture,
          topic: opts.topic,
          mode: opts.mode,
          expectedMinutes: opts.expectedMinutes,
          studySeconds: 0,
          wastedSeconds: 0,
          paused: false,
          wasting: false,
          lastResumeAt: Date.now(),
          lastWasteStart: null,
          startedAt: Date.now(),
          lastWasteThreshold: 0,
          date: todayKey(), // Bind session to its START date
          baselineStudySeconds,
          baselineWastedSeconds,
        };
        set({ active: session, focusOpen: true, widgetHidden: false, lastInteractionAt: Date.now() });
        vibrate(15);
      },

      pause: () => {
        const s = get().active;
        if (!s || s.paused) return;
        const committed = commitInflight(s);
        set({
          active: { ...committed, paused: true, lastResumeAt: null, lastWasteStart: null, wasting: false },
          lastInteractionAt: Date.now(),
        });
        vibrate(10);
      },

      resume: () => {
        const s = get().active;
        if (!s || !s.paused) return;
        set({
          active: { ...s, paused: false, lastResumeAt: Date.now(), wasting: false },
          widgetHidden: false,
          lastInteractionAt: Date.now(),
        });
        vibrate(10);
      },

      toggleWasting: () => {
        const s = get().active;
        if (!s || s.paused) return;
        const now = Date.now();
        if (s.wasting) {
          // switch back to studying
          const wasteDelta = s.lastWasteStart ? Math.floor((now - s.lastWasteStart) / 1000) : 0;
          set({
            active: {
              ...s,
              wasting: false,
              wastedSeconds: s.wastedSeconds + wasteDelta,
              lastWasteStart: null,
              lastResumeAt: now,
            },
            lastInteractionAt: now,
          });
        } else {
          // switch to wasting
          const studyDelta = s.lastResumeAt ? Math.floor((now - s.lastResumeAt) / 1000) : 0;
          set({
            active: {
              ...s,
              wasting: true,
              studySeconds: s.studySeconds + studyDelta,
              lastResumeAt: null,
              lastWasteStart: now,
              lastWasteThreshold: 0,
            },
            lastInteractionAt: now,
          });
        }
        vibrate(20);
      },

      stop: () => {
        const s = get().active;
        if (!s) return;
        const finalSession = commitInflight(s);
        const pending: Omit<SavedSession, 'mood' | 'id'> = {
          targetId: finalSession.targetId,
          subject: finalSession.subject,
          chapter: finalSession.chapter,
          lecture: finalSession.lecture,
          topic: finalSession.topic,
          mode: finalSession.mode,
          studySeconds: finalSession.studySeconds,
          wastedSeconds: finalSession.wastedSeconds,
          startedAt: finalSession.startedAt,
          endedAt: Date.now(),
          date: finalSession.date ?? todayKey(), // Use session's START date, not today
        };
        set({
          pendingMoodSession: pending,
          active: null,
          focusOpen: false,
          widgetHidden: false,
        });
        vibrate([10, 30, 10]);
      },

      saveWithMood: (mood) => {
        const pending = get().pendingMoodSession;
        if (!pending) return;
        useHistory.getState().addSession({ ...pending, id: uid(), mood });
        // If linked to a target and study time meets expected, auto-mark done? No — let user decide.
        set({ pendingMoodSession: null });
      },

      cancelPending: () => {
        // Still save the session but with null mood
        const pending = get().pendingMoodSession;
        if (pending) {
          useHistory.getState().addSession({ ...pending, id: uid(), mood: null });
        }
        set({ pendingMoodSession: null });
      },

      setFocusOpen: (open) => set({ focusOpen: open, lastInteractionAt: Date.now() }),
      setWidgetHidden: (hidden) => set({ widgetHidden: hidden }),
      bumpInteraction: () => set({ lastInteractionAt: Date.now() }),

      restoreSession: () => {
        const s = get().active;
        if (!s) return;

        // === DATE CHANGE DETECTION ===
        // If the session was started on a different day than today (e.g. user
        // studied Aug 21, left widget open, reopened Aug 22), auto-save the
        // accumulated time to the ORIGINAL start date, then close the session.
        // This prevents yesterday's study time from being attributed to today.
        const sessionDate = s.date ?? todayKey();
        const today = todayKey();
        if (sessionDate !== today) {
          const committed = commitInflight(s);
          const saved: Omit<SavedSession, 'mood' | 'id'> = {
            targetId: committed.targetId,
            subject: committed.subject,
            chapter: committed.chapter,
            lecture: committed.lecture,
            topic: committed.topic,
            mode: committed.mode,
            studySeconds: committed.studySeconds,
            wastedSeconds: committed.wastedSeconds,
            startedAt: committed.startedAt,
            endedAt: Date.now(),
            date: sessionDate, // Save to the ORIGINAL start date
          };
          useHistory.getState().addSession({ ...saved, id: uid(), mood: null });
          // Close the session entirely — user must start fresh today
          set({ active: null, focusOpen: false, widgetHidden: false });
          return;
        }

        // Same day — normal restore: auto-pause if was running
        if (!s.paused) {
          const committed = commitInflight(s);
          set({
            active: { ...committed, paused: true, lastResumeAt: null, lastWasteStart: null, wasting: false },
            focusOpen: false,
            widgetHidden: false,
          });
        }
      },

      markAway: () => {
        // Only set awaySince if not already away (avoid overwriting original away time)
        const state = get();
        if (state.active && !state.active.paused && !state.awaySince) {
          // Commit any in-flight study time up to now
          const committed = commitInflight(state.active);
          set({
            active: { ...committed, lastResumeAt: null }, // Stop counting study time
            awaySince: Date.now(),
          });
        }
      },

      handleReturn: () => {
        const { active, awaySince } = get();
        if (!active || !awaySince) {
          set({ awaySince: null });
          return;
        }
        const awayMs = Date.now() - awaySince;
        if (awayMs > 2000) {
          // markAway already committed study time up to when user left
          // Now just add the away duration as wasted time and resume studying
          const awaySec = Math.floor(awayMs / 1000);
          set({
            active: {
              ...active,
              wasting: false,
              lastWasteStart: null,
              lastResumeAt: Date.now(), // Resume studying from now
              wastedSeconds: active.wastedSeconds + awaySec,
            },
            awaySince: null,
          });
          // Optional: fire taunt notification
          const settings = useSettings.getState();
          if (settings.distractionTauntInterval > 0 && settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            const taunts = [
              'Every minute you spend scrolling, someone else is studying.',
              'The exam won\'t wait. Get back.',
              'Distraction is the enemy of focus. Return now.',
              'Your future self is watching. Study.',
              'Discipline beats motivation. Come back.',
            ];
            const t = taunts[Math.floor(Math.random() * taunts.length)];
            try {
              new Notification('⚠ Wasted time detected', { body: t });
              useSettings.getState().addNotification({ title: '⚠ Wasted time detected', body: t });
            } catch {}
          }
        } else {
          // Very brief away (< 2s) — just resume, no wasted time
          set({
            active: { ...active, lastResumeAt: Date.now() },
            awaySince: null,
          });
        }
      },

      tick: () => {
        // Reads FRESH state every tick — no closure staleness
        const s = get().active;
        if (!s) return;

        // === MIDNIGHT ROLLOVER DETECTION ===
        // If the session's start date is different from today (user kept
        // the app open past midnight), auto-save yesterday's portion to
        // the original date and close the session.
        const sessionDate = s.date ?? todayKey();
        if (sessionDate !== todayKey()) {
          const committed = commitInflight(s);
          const saved: Omit<SavedSession, 'mood' | 'id'> = {
            targetId: committed.targetId,
            subject: committed.subject,
            chapter: committed.chapter,
            lecture: committed.lecture,
            topic: committed.topic,
            mode: committed.mode,
            studySeconds: committed.studySeconds,
            wastedSeconds: committed.wastedSeconds,
            startedAt: committed.startedAt,
            endedAt: Date.now(),
            date: sessionDate,
          };
          useHistory.getState().addSession({ ...saved, id: uid(), mood: null });
          set({ active: null, focusOpen: false, widgetHidden: false });
          return;
        }

        // HARD STOP: if paused, absolutely no counting
        if (s.paused) return;
        // If no lastResumeAt and not wasting, nothing to count
        if (!s.wasting && !s.lastResumeAt) return;
        // If wasting but no lastWasteStart, nothing to count
        if (s.wasting && !s.lastWasteStart) return;

        const now = Date.now();
        if (s.wasting && s.lastWasteStart) {
          const elapsed = Math.floor((now - s.lastWasteStart) / 1000);
          const totalWasted = s.wastedSeconds + elapsed;
          // Vibrate at 30s boundaries
          const settings = useSettings.getState();
          if (settings.haptics && totalWasted >= (s.lastWasteThreshold + 1) * 30) {
            vibrate(30);
            set({
              active: { ...s, lastWasteThreshold: s.lastWasteThreshold + 1 },
            });
          }
        }

        // === PERIODIC COMMIT ===
        // Every ~60 seconds, commit inflight study time to persisted state
        // so it's not lost if the app is killed without firing pagehide/freeze.
        if (s.lastResumeAt && !s.wasting) {
          const inflight = Math.floor((now - s.lastResumeAt) / 1000);
          if (inflight > 0 && inflight % 60 === 0) {
            const committed = commitInflight(s);
            set({ active: committed });
          }
        }
      },
    }),
    {
      name: 'neet-active-session',
      partialize: (s) => ({
        active: s.active,
        widgetHidden: s.widgetHidden,
        awaySince: s.awaySince, // Persist so it survives app death
      }),
    }
  )
);

// Helper: commit any in-flight time (study or waste) to the running totals
function commitInflight(s: ActiveSession): ActiveSession {
  const now = Date.now();
  let { studySeconds, wastedSeconds } = s;
  let lastResumeAt = s.lastResumeAt;
  let lastWasteStart = s.lastWasteStart;

  if (s.wasting && s.lastWasteStart) {
    const delta = Math.floor((now - s.lastWasteStart) / 1000);
    wastedSeconds += delta;
    lastWasteStart = now; // reset reference so subsequent commits don't double-count
  } else if (!s.wasting && !s.paused && s.lastResumeAt) {
    const delta = Math.floor((now - s.lastResumeAt) / 1000);
    studySeconds += delta;
    lastResumeAt = now;
  }
  return { ...s, studySeconds, wastedSeconds, lastResumeAt, lastWasteStart };
}

// ===== Derived helpers (read fresh) =====

export function getLiveStudySeconds(s: ActiveSession | null): number {
  if (!s) return 0;
  const baseline = s.baselineStudySeconds ?? 0;
  if (s.paused || s.wasting || !s.lastResumeAt) return s.studySeconds + baseline;
  return s.studySeconds + Math.floor((Date.now() - s.lastResumeAt) / 1000) + baseline;
}

export function getLiveWastedSeconds(s: ActiveSession | null): number {
  if (!s) return 0;
  const baseline = s.baselineWastedSeconds ?? 0;
  if (s.paused || !s.wasting || !s.lastWasteStart) return s.wastedSeconds + baseline;
  return s.wastedSeconds + Math.floor((Date.now() - s.lastWasteStart) / 1000) + baseline;
}

export function getLiveTotalSeconds(s: ActiveSession | null): number {
  return getLiveStudySeconds(s) + getLiveWastedSeconds(s);
}
