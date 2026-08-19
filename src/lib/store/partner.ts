'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useHistory } from './history';
import { useTests } from './tests';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from './session';
import { usePractice } from './practice';
import { useTargets } from './targets';
import { todayKey } from '@/lib/utils';

/** Rich partner data payload — synced to server and shown on the other
 *  device's partner card. Each field is designed for at-a-glance comparison. */
export interface PartnerSyncPayload {
  // === Study time ===
  /** Total seconds studied TODAY (saved sessions + live active session). */
  todaySec: number;
  /** Total seconds WASTED today (distractions). */
  todayWastedSec: number;
  /** Total seconds studied in the last 7 days. */
  weekSec: number;
  /** Current streak in days. */
  streak: number;

  // === Current activity (live) ===
  /** Subject of the most recent or active session. */
  lastSubject: string | null;
  /** Chapter of the most recent or active session. */
  lastChapter: string | null;
  /** Lecture name/number of the most recent or active session. */
  lastLecture: string | null;
  /** Topic of the most recent or active session. */
  lastTopic: string | null;
  /** True if the user is currently in an active (running) study session. */
  isStudying: boolean;
  /** True if the active session is paused. */
  isPaused: boolean;
  /** True if the active session is in "wasting time" mode. */
  isWasting: boolean;
  /** Seconds studied in the CURRENT active session (0 if none active). */
  currentSessionSec: number;
  /** What kind of activity the user is currently doing:
   *  - 'focus'   → running a focus-timer study session
   *  - 'practice'→ running a practice question session (subject shown in lastSubject)
   *  - null      → no live activity (idle / just saved a session) */
  activityType: 'focus' | 'practice' | null;
  /** True if the user is currently mid-practice (activePractice is set). */
  isPracticing: boolean;

  // === Today's targets ===
  /** Number of today's targets marked done. */
  targetsDone: number;
  /** Total number of today's targets. */
  targetsTotal: number;

  // === Tests ===
  /** Score of the most recent test (/720). */
  lastTestScore: number | null;
  /** Number of tests logged in the last 7 days. */
  weekTestCount: number;

  /** Server-side timestamp of this payload (set by sync route). */
  updatedAt: number;
}

export interface PartnerData {
  name: string;
  code: string;
  isUserB: boolean; // false = user A (created), true = user B (joined)
  partnerName: string | null;
  lastSyncAt: number | null;
  /** Server-side timestamp of when the partner last pushed data.
   *  Used for accurate online/offline detection (immune to client clock skew). */
  partnerLastSeen: number | null;
  partnerLastData: PartnerSyncPayload | null;
}

interface PartnerStore extends PartnerData {
  /** Returns the new code on success, or { error } on failure. */
  createPair: (name: string) => Promise<{ code?: string; error?: string }>;
  /** Returns true on success, or { error } on failure. */
  joinPair: (code: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  syncData: () => Promise<void>;
  /** Returns 'ok' | 'notfound' | 'error' so callers can surface failures
   *  instead of silently swallowing them (which leaves users stuck on the
   *  "waiting for partner" screen forever if their code is stale). */
  fetchPartnerData: () => Promise<'ok' | 'notfound' | 'error'>;
  disconnect: () => void;
}

export const usePartner = create<PartnerStore>()(
  persist(
    (set, get) => ({
      name: '',
      code: '',
      isUserB: false,
      partnerName: null,
      lastSyncAt: null,
      partnerLastSeen: null,
      partnerLastData: null,

      createPair: async (name) => {
        try {
          const res = await fetch('/api/partner/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          const data = await res.json();
          if (data.error) {
            console.warn('[partner] createPair server error:', data.error);
            return { error: data.error };
          }
          if (!data.code) {
            console.warn('[partner] createPair: no code in response');
            return { error: 'Server returned no code. Try again.' };
          }
          // Clear any previous pair state when creating a fresh pair —
          // otherwise stale partnerName/partnerLastData from an old pair
          // would persist into the new one.
          set({
            name,
            code: data.code,
            isUserB: false,
            partnerName: null,
            partnerLastData: null,
            lastSyncAt: null,
          });
          return { code: data.code };
        } catch (e) {
          console.warn('[partner] createPair network error:', e);
          return { error: 'Network error. Check your connection and try again.' };
        }
      },

      joinPair: async (code, name) => {
        try {
          const res = await fetch('/api/partner/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, name }),
          });
          const data = await res.json();
          if (data.error) {
            console.warn('[partner] joinPair server error:', data.error);
            return { ok: false, error: data.error };
          }
          // Clear previous state — joining as user B with a new partner.
          set({
            name,
            code: code.toUpperCase(),
            isUserB: true,
            partnerName: data.partnerName ?? null,
            partnerLastData: null,
            lastSyncAt: null,
          });
          // CRITICAL: push our initial data to the server immediately so that
          // user A's next poll sees us. Without this, A would only see our
          // name after our first periodic sync (which could be minutes away).
          // Use setTimeout to let state settle before syncData reads it.
          setTimeout(() => { get().syncData(); }, 0);
          return { ok: true };
        } catch (e) {
          console.warn('[partner] joinPair network error:', e);
          return { ok: false, error: 'Network error. Check your connection and try again.' };
        }
      },

      syncData: async () => {
        const state = get();
        if (!state.code) return;
        const sessions = useHistory.getState().sessions;
        const tests = useTests.getState().tests;
        const today = todayKey();

        // === Saved session aggregates (from history) ===
        const savedTodaySec = sessions
          .filter((s) => s.date === today)
          .reduce((a, s) => a + s.studySeconds, 0);
        const savedTodayWastedSec = sessions
          .filter((s) => s.date === today)
          .reduce((a, s) => a + s.wastedSeconds, 0);
        const weekAgo = Date.now() - 7 * 86400000;
        const savedWeekSec = sessions
          .filter((s) => s.endedAt >= weekAgo)
          .reduce((a, s) => a + s.studySeconds, 0);
        const streak = useHistory.getState().getStreak();

        // === LIVE active session (focus timer) ===
        // CRITICAL: include the currently-running session's time so the
        // partner sees real-time progress. Previously only saved sessions
        // were synced, so if B studied 1h without stopping, A only saw the
        // time from B's last SAVED session (could be much smaller).
        const activeSession = useSession.getState().active;
        const liveSec = getLiveStudySeconds(activeSession);
        const liveWastedSec = getLiveWastedSeconds(activeSession);

        // === LIVE active practice (practice mode) ===
        // Practice time also counts as study time. If the user is mid-practice
        // (no focus session running), broadcast practice as the current activity
        // so the partner card shows "Practicing Physics" instead of just "Online".
        const activePractice = usePractice.getState().activePractice;
        const livePracticeSec = activePractice
          ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
          : 0;

        // Determine which activity is "primary" — focus session takes priority
        // (it's the more deliberate study mode), practice is the fallback.
        const hasFocus = !!activeSession;
        const hasPractice = !!activePractice;

        const isStudying = (hasFocus && !activeSession!.paused && !activeSession!.wasting) || hasPractice;
        const isPaused = !!activeSession && activeSession.paused;  // practice can't be "paused" in the focus-timer sense
        const isWasting = !!activeSession && activeSession.wasting;
        const isPracticing = hasPractice && !hasFocus;  // practice shows as "Practicing" only when not also in a focus session

        // todaySec = saved sessions + live focus time + live practice time.
        const todaySec = savedTodaySec
          + (hasFocus ? liveSec : 0)
          + (hasPractice ? livePracticeSec : 0);
        const todayWastedSec = savedTodayWastedSec + (hasFocus ? liveWastedSec : 0);

        // === Current subject/topic/chapter/lecture ===
        // Priority: active focus session > active practice > most recent saved session today.
        let lastSubject: string | null = null;
        let lastChapter: string | null = null;
        let lastLecture: string | null = null;
        let lastTopic: string | null = null;
        let activityType: 'focus' | 'practice' | null = null;

        if (hasFocus && activeSession!.subject) {
          // Focus session is primary — use its subject/chapter/lecture/topic.
          lastSubject = activeSession!.subject;
          lastChapter = activeSession!.chapter || null;
          lastLecture = activeSession!.lecture || null;
          lastTopic = activeSession!.topic || null;
          activityType = 'focus';
        } else if (hasPractice) {
          // Practice is primary — use its subject/chapter; the practice name
          // (e.g. "Physics · ∞Q") goes into lastTopic so the partner sees context.
          lastSubject = activePractice!.subject || null;
          lastChapter = activePractice!.chapter || null;
          lastLecture = null;
          lastTopic = activePractice!.name || null;
          activityType = 'practice';
        } else {
          // No live activity — fall back to most recent saved session today
          // so the partner card still shows context.
          const lastSaved = sessions
            .filter((s) => s.date === today)
            .sort((a, b) => b.endedAt - a.endedAt)[0];
          lastSubject = lastSaved?.subject || null;
          lastChapter = lastSaved?.chapter || null;
          lastLecture = lastSaved?.lecture || null;
          lastTopic = lastSaved?.topic || null;
          activityType = null;
        }

        // currentSessionSec = whichever live session is active right now.
        const currentSessionSec = hasFocus
          ? liveSec
          : hasPractice
            ? livePracticeSec
            : 0;

        // === Today's targets (done / total) ===
        const todayTargets = useTargets.getState().getTodayTargets();
        const targetsTotal = todayTargets.length;
        const targetsDone = todayTargets.filter((t) => t.done).length;

        // === Tests ===
        const recentTest = tests
          .filter((t) => t.totalMarks !== undefined)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const lastTestScore = recentTest?.totalMarks || null;
        const weekTestCount = tests.filter((t) => {
          const tDate = new Date(t.date + 'T00:00:00').getTime();
          return tDate >= weekAgo;
        }).length;

        const payload: PartnerSyncPayload = {
          todaySec,
          todayWastedSec,
          weekSec: savedWeekSec
            + (hasFocus ? liveSec : 0)
            + (hasPractice ? livePracticeSec : 0),
          streak,
          lastSubject,
          lastChapter,
          lastLecture,
          lastTopic,
          isStudying,
          isPaused,
          isWasting,
          currentSessionSec,
          activityType,
          isPracticing,
          targetsDone,
          targetsTotal,
          lastTestScore,
          weekTestCount,
          updatedAt: Date.now(),
        };

        try {
          const res = await fetch('/api/partner/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: state.code, isUserB: state.isUserB, data: payload }),
            cache: 'no-store',
          });
          if (!res.ok) {
            console.warn('[partner] syncData POST failed:', res.status, 'for code', state.code);
          } else {
            set({ lastSyncAt: Date.now() });
            // Verbose diagnostic — helps verify pushes are actually happening.
            // Check DevTools console for this log to confirm your device is pushing.
            console.log('[partner] syncData OK — pushed', {
              code: state.code,
              isUserB: state.isUserB,
              todaySec,
              isStudying,
              lastSubject,
              updatedAt: payload.updatedAt,
            });
          }
        } catch (e) {
          console.warn('[partner] syncData network error:', e);
        }
      },

      fetchPartnerData: async () => {
        const state = get();
        if (!state.code) return 'error';
        const user = state.isUserB ? 'B' : 'A';
        try {
          // cache: 'no-store' + _t timestamp — PREVENTS browser HTTP caching.
          // Without this, the browser caches the GET response and "refresh"
          // returns stale data (partner appears offline until hard reload).
          const res = await fetch(
            `/api/partner/sync?code=${encodeURIComponent(state.code)}&user=${user}&_t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (res.status === 404) {
            // Pair doesn't exist on server anymore — DB was reset, or the
            // code was never valid. Caller should show a "reset" UI.
            console.warn('[partner] Pair not found on server for code:', state.code);
            return 'notfound';
          }
          if (!res.ok) {
            console.warn('[partner] sync fetch failed:', res.status);
            return 'error';
          }
          const data = await res.json();
          if (data.error) {
            console.warn('[partner] sync returned error:', data.error);
            return 'error';
          }
          // Convert server ISO string to epoch ms for client-side age calculation
          const serverLastSeen = data.lastSeen
            ? new Date(data.lastSeen).getTime()
            : null;
          set({
            // Only update partnerName if server has a real value; otherwise
            // preserve any existing local value (avoids flicker during polls).
            partnerName: data.partnerName ?? state.partnerName,
            partnerLastData: data.data ?? null,
            // Use the SERVER timestamp for freshness — immune to client clock
            // skew. This is what drives the "online / Xs ago / offline" badge.
            partnerLastSeen: serverLastSeen,
          });
          return 'ok';
        } catch (e) {
          console.warn('[partner] sync network error:', e);
          return 'error';
        }
      },

      disconnect: () => {
        set({
          name: '', code: '', isUserB: false, partnerName: null,
          lastSyncAt: null, partnerLastSeen: null, partnerLastData: null,
        });
      },
    }),
    { name: 'neet-partner' }
  )
);
