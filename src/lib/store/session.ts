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
  // === Dedupe guard: timestamp of the last handleReturn() call. ===
  // On mobile, returning to the app fires visibilitychange + focus + pageshow
  // + resume in quick succession (sometimes 3-4 events within 100ms). Without
  // this guard, each event reads the same `awaySince` and double/triple-counts
  // the wasted time. We ignore any handleReturn call within 1000ms of the last.
  lastReturnAt: number;
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
    plannedSlotId?: string; // Smart Study Routine: which routine block this session fulfills
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
      lastReturnAt: 0,
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
            plannedSlotId: finalSession.plannedSlotId, // Smart Study Routine
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
          plannedSlotId: opts.plannedSlotId, // Smart Study Routine
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
        if (!s) return;
        const now = Date.now();

        // === If paused, auto-resume first then start wasting ===
        // Previous behaviour: silently returned (button looked tappable but
        // did nothing). Now: if the user taps "Got Distracted" while paused,
        // we resume the session AND enter wasting mode in one step. This is
        // the intuitive behaviour — "I was on break, now I'm distracted".
        if (s.paused) {
          // Resume + start wasting simultaneously
          set({
            active: {
              ...s,
              paused: false,
              wasting: true,
              lastResumeAt: null,
              lastWasteStart: now,
              lastWasteThreshold: 0,
              wasteBoutStartSeconds: s.wastedSeconds,
            },
            lastInteractionAt: now,
          });
          vibrate(20);
          return;
        }

        if (s.wasting) {
          // === Switch back to studying ===
          // Manual waste has NO CAP — the user explicitly said "I'm distracted",
          // so we count the full duration they were in wasting mode. (Auto-detect
          // away time is still capped at 5 min, but that's a different path.)
          // The 15-MIN AUTO-RESUME safety net (in tick()) prevents catastrophic
          // waste if the user forgets to tap "Back to Study".
          const wasteDelta = s.lastWasteStart
            ? Math.floor((now - s.lastWasteStart) / 1000)
            : 0;
          set({
            active: {
              ...s,
              wasting: false,
              wastedSeconds: s.wastedSeconds + wasteDelta,
              lastWasteStart: null,
              lastResumeAt: now,
              lastWasteThreshold: 0,
            },
            lastInteractionAt: now,
          });
        } else {
          // === Switch to wasting ===
          const studyDelta = s.lastResumeAt ? Math.floor((now - s.lastResumeAt) / 1000) : 0;
          set({
            active: {
              ...s,
              wasting: true,
              studySeconds: s.studySeconds + studyDelta,
              lastResumeAt: null,
              lastWasteStart: now,
              lastWasteThreshold: 0,
              // === Mark the start of this wasting bout so the vibration
              //     threshold logic can be relative to the bout, not total. ===
              wasteBoutStartSeconds: s.wastedSeconds,
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
          plannedSlotId: finalSession.plannedSlotId, // Smart Study Routine
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
            plannedSlotId: committed.plannedSlotId, // Smart Study Routine
          };
          useHistory.getState().addSession({ ...saved, id: uid(), mood: null });
          // Close the session entirely — user must start fresh today
          set({ active: null, focusOpen: false, widgetHidden: false });
          return;
        }

        // Same day — normal restore: auto-pause if was running
        // === BATTERY-DIE PROTECTION (moved here from commitInflight) ===
        // On restore, if the gap since lastResumeAt is > 90s, the app was
        // likely killed or the phone died. We DISCARD the inflight delta
        // to prevent corrupt sessions like "8h studied" when the user was asleep.
        // This protection ONLY applies on restore — during normal pause/stop,
        // the full delta is always committed (no time loss).
        if (!s.paused) {
          const now = Date.now();
          let { studySeconds, wastedSeconds } = s;
          const MAX_RESTORE_GAP_SEC = 90;

          if (s.wasting && s.lastWasteStart) {
            const delta = Math.floor((now - s.lastWasteStart) / 1000);
            if (delta <= MAX_RESTORE_GAP_SEC) {
              wastedSeconds += delta;
            }
            // If delta > 90s, discard — app was killed
          } else if (!s.wasting && s.lastResumeAt) {
            const delta = Math.floor((now - s.lastResumeAt) / 1000);
            if (delta <= MAX_RESTORE_GAP_SEC) {
              studySeconds += delta;
            }
            // If delta > 90s, discard — app was killed
          }

          set({
            active: {
              ...s,
              studySeconds,
              wastedSeconds,
              paused: true,
              lastResumeAt: null,
              lastWasteStart: null,
              wasting: false,
            },
            focusOpen: false,
            widgetHidden: false,
          });
        }
      },

      markAway: () => {
        // Only set awaySince if not already away (avoid overwriting original away time)
        const state = get();
        if (!state.active || state.active.paused || state.awaySince) return;
        // === Manual wasting protection ===
        // If the user explicitly tapped "Got Distracted" (wasting: true), do NOT
        // fire auto-detect. The wasting clock keeps running via periodic commit,
        // and on return we just resume the waste clock — no away time is added.
        // This prevents auto-detect from overriding the user's explicit intent.
        if (state.active.wasting) return;
        // === Also respect the autoDetectWasted setting ===
        // When OFF, we still mark away (so the timer pauses correctly), but
        // handleReturn will NOT add away time as waste — it just resumes silently.
        const committed = commitInflight(state.active);
        set({
          // Clear BOTH lastResumeAt AND lastWasteStart so nothing accumulates
          // while the app is backgrounded. The away duration will be added
          // as wasted time by handleReturn when the user comes back.
          active: { ...committed, lastResumeAt: null, lastWasteStart: null },
          awaySince: Date.now(),
        });
      },

      handleReturn: () => {
        const { active, awaySince, lastReturnAt } = get();
        // === Dedupe guard ===
        // On mobile, returning fires visibilitychange + focus + pageshow + resume
        // in quick succession. Ignore duplicate calls within 1 second.
        const now = Date.now();
        if (now - lastReturnAt < 1000) {
          set({ awaySince: null });
          return;
        }
        if (!active || !awaySince) {
          set({ awaySince: null, lastReturnAt: now });
          return;
        }
        const awayMs = now - awaySince;
        const awaySec = Math.floor(awayMs / 1000);
        const settings = useSettings.getState();
        // === 60-SECOND THRESHOLD ===
        // Away < 60s = silent resume (no waste counted, no flash). Brief aways
        // for legit reasons (notification, system dialog, brief app switch)
        // shouldn't be punished. Away > 60s = waste counted (capped at 5 min
        // to prevent pocket-dial corruption), flash shows.
        const AWAY_THRESHOLD_SEC = 60;
        const MAX_AWAY_SEC = 300; // 5 min cap (pocket-dial protection)
        if (awaySec > AWAY_THRESHOLD_SEC && settings.autoDetectWasted) {
          const cappedAwaySec = Math.min(MAX_AWAY_SEC, awaySec);
          set({
            active: {
              ...active,
              wasting: false,
              lastWasteStart: null,
              lastResumeAt: now, // Resume studying from now
              wastedSeconds: active.wastedSeconds + cappedAwaySec,
            },
            awaySince: null,
            lastReturnAt: now,
          });
          // Optional: fire taunt notification
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
          // === Silent resume ===
          // Away was < 60s OR autoDetectWasted is OFF. Just resume studying.
          // No waste counted, no flash shown.
          set({
            active: { ...active, lastResumeAt: now, wasting: false, lastWasteStart: null },
            awaySince: null,
            lastReturnAt: now,
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
          // === 15-MIN AUTO-RESUME SAFETY NET ===
          // If the user tapped "Got Distracted" and forgot to tap "Back to Study"
          // for 15 minutes, auto-resume studying. This prevents catastrophic
          // waste accumulation (e.g. 2 hours of waste from forgetting) which
          // would destroy the session stats. 15 min is enough for a real break
          // (bathroom, quick snack) but short enough to prevent stat corruption.
          const MAX_MANUAL_WASTE_SEC = 15 * 60; // 15 minutes
          const elapsed = Math.floor((now - s.lastWasteStart) / 1000);
          if (elapsed >= MAX_MANUAL_WASTE_SEC) {
            // Auto-resume: commit the waste (capped at 15 min), start studying
            const cappedWaste = Math.min(MAX_MANUAL_WASTE_SEC, elapsed);
            set({
              active: {
                ...s,
                wasting: false,
                wastedSeconds: s.wastedSeconds + cappedWaste,
                lastWasteStart: null,
                lastResumeAt: now,
                lastWasteThreshold: 0,
              },
            });
            vibrate([10, 30, 10]);
            return;
          }

          // === Vibration: fire at 30s/60s/90s... of THIS BOUT (not cumulative) ===
          // Previous logic used `totalWasted = wastedSeconds + elapsed` which meant
          // the second bout's first vibration fired immediately (because totalWasted
          // was already > 30 from the first bout). Now we use `elapsed` (inflight
          // waste in current bout) relative to bout start, so each bout vibrates
          // at 30s, 60s, 90s of THAT bout.
          const settings = useSettings.getState();
          if (settings.haptics && elapsed >= (s.lastWasteThreshold + 1) * 30) {
            vibrate(30);
            set({
              active: { ...s, lastWasteThreshold: s.lastWasteThreshold + 1 },
            });
          }

          // === Periodic commit for wasting mode too ===
          // Commit inflight waste every 60s so it's not lost on app kill.
          // (Same logic as study-time periodic commit below, but for waste.)
          if (elapsed >= 60) {
            const committed = commitInflight(s);
            set({ active: committed });
          }
        }

        // === PERIODIC COMMIT ===
        // Every ~60 seconds, commit inflight study time to persisted state
        // so it's not lost if the app is killed without firing pagehide/freeze.
        // === BUG FIX: Previous check `inflight % 60 === 0` was fragile — if a
        //     tick was skipped (e.g. due to JS event loop congestion) and
        //     inflight went 59 → 61, the commit at 60 was missed entirely and
        //     the next commit wouldn't fire until inflight hit 120. Worse, if
        //     the AppShell tick was stopped (FocusTimer mode) and only the
        //     FocusTimer's local tick was running, that tick never called
        //     session.tick() — so no commit EVER happened, all study time
        //     lived in the unpersisted lastResumeAt delta, and a sudden
        //     app kill would lose everything (timer showed 0 on restore).
        //     Now: commit whenever inflight >= 60, then reset lastResumeAt
        //     to now so the next commit is ~60s later. ===
        if (s.lastResumeAt && !s.wasting) {
          const inflight = Math.floor((now - s.lastResumeAt) / 1000);
          if (inflight >= 60) {
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

  // === No cap on study OR waste deltas here ===
  // The 5-min cap on AWAY time (auto-detect) is handled separately in
  // handleReturn. Manual wasting (toggleWasting) and periodic commits
  // count the full duration — the user explicitly said "I'm distracted",
  // so we honor that. Study time never has a cap.
  if (s.wasting && s.lastWasteStart) {
    const delta = Math.floor((now - s.lastWasteStart) / 1000);
    wastedSeconds += delta;
    lastWasteStart = now;
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
  // === FIX: Removed 90s cap from LIVE display ===
  // The cap belongs only in commitInflight (restore/battery-die scenario).
  // Capping the live display caused the timer to FREEZE at 90s during
  // normal foreground study — every tick computed Date.now()-lastResumeAt
  // but capped it at 90, so the displayed time stopped increasing.
  // The AppShell tick commits every 60s, resetting lastResumeAt, which
  // is why the timer appeared to "jump" every 60s then freeze again.
  const delta = Math.floor((Date.now() - s.lastResumeAt) / 1000);
  return s.studySeconds + delta + baseline;
}

export function getLiveWastedSeconds(s: ActiveSession | null): number {
  if (!s) return 0;
  const baseline = s.baselineWastedSeconds ?? 0;
  if (s.paused || !s.wasting || !s.lastWasteStart) return s.wastedSeconds + baseline;
  // === No cap on live waste display ===
  // Manual wasting (user tapped "Got Distracted") should show the full duration.
  // The 5-min cap only applies to AUTO-DETECT away time (handled in handleReturn),
  // not to manual wasting. If the user said "I'm distracted" for 20 min, show 20 min.
  const delta = Math.floor((Date.now() - s.lastWasteStart) / 1000);
  return s.wastedSeconds + delta + baseline;
}

export function getLiveTotalSeconds(s: ActiveSession | null): number {
  return getLiveStudySeconds(s) + getLiveWastedSeconds(s);
}
