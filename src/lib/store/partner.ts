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
  /** Per-day study seconds for the last 7 days (index 0 = 6 days ago, 6 = today).
   *  Enables accurate weekly leaderboard comparison without fabricating averages. */
  dailyHistory: number[];
  /** Per-day WASTED seconds for the last 7 days (index 0 = 6 days ago, 6 = today).
   *  Lets the partner card show wasted time per day in the weekly leaderboard. */
  dailyWastedHistory: number[];

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
  /** Timestamp (ms) when the current practice session started (adjusted for
   *  pause/resume so elapsed = Date.now() - practiceStartedAt is always correct).
   *  Sent so the partner card can tick the practice timer LOCALLY every second
   *  without waiting for the next sync. Null when not practicing. */
  practiceStartedAt: number | null;
  /** Timestamp (ms) when the current focus session started (adjusted for
   *  pause/resume). Null when no focus session is active. */
  focusStartedAt: number | null;

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
            // eslint-disable-next-line
            console.warn('[partner] createPair server error:', data.error);
            return { error: data.error };
          }
          if (!data.code) {
            // eslint-disable-next-line
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
          // eslint-disable-next-line
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
            // eslint-disable-next-line
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
          // eslint-disable-next-line
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

        // === Per-day study seconds for last 7 days (computed after live time below) ===

        // === LIVE active session (focus timer) ===
        // CRITICAL: include the currently-running session's time so the
        // partner sees real-time progress. Previously only saved sessions
        // were synced, so if B studied 1h without stopping, A only saw the
        // time from B's last SAVED session (could be much smaller).
        const activeSession = useSession.getState().active;
        // Only count live session time if it's from TODAY (not a stale yesterday session)
        const liveSec = (activeSession && (activeSession as any).date === today) ? getLiveStudySeconds(activeSession) : 0;
        const liveWastedSec = getLiveWastedSeconds(activeSession);

        // === LIVE active practice (practice mode) ===
        // Practice time also counts as study time. If the user is mid-practice
        // (no focus session running), broadcast practice as the current activity
        // so the partner card shows "Practicing Physics" instead of just "Online".
        const activePractice = usePractice.getState().activePractice;
        const livePracticeSec = activePractice
          ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
          : 0;

        // Determine which activity is "primary" for the partner card display.
        //
        // PRIORITY: practice > focus session > saved sessions.
        //
        // Why practice wins: practice mode is the most RECENT + intentional user
        // action — the user explicitly opened Practice Setup → walked through 4
        // steps → started practice. PracticeRunner renders on top of FocusTimer
        // (both z-[9999], but PracticeRunner comes later in DOM). So if both are
        // "active" in their stores, the user is currently looking at / interacting
        // with practice, not the focus timer. A lingering focus session in the
        // store should NOT override the practice as the "current activity".
        //
        // (Time accounting below still sums BOTH live times toward todaySec.)
        const hasFocus = !!activeSession;
        const hasPractice = !!activePractice;
        const focusRunning = hasFocus && !activeSession!.paused && !activeSession!.wasting;

        const isStudying = focusRunning || hasPractice;
        // isPaused / isWasting only true if focus is in that state AND practice
        // is NOT running (practice takes over as primary when active).
        const isPaused = !!activeSession && activeSession.paused && !hasPractice;
        const isWasting = !!activeSession && activeSession.wasting && !hasPractice;
        // isPracticing = true when practice is the primary activity (regardless
        // of any lingering focus session state).
        const isPracticing = hasPractice;

        // todaySec = saved sessions + live focus time + live practice time.
        // (If both are active — e.g. paused focus + running practice — we count
        // both. liveSec is 0 when focus is paused, so this is safe.)
        const todaySec = savedTodaySec
          + (hasFocus ? liveSec : 0)
          + (hasPractice ? livePracticeSec : 0);
        const todayWastedSec = savedTodayWastedSec + (hasFocus ? liveWastedSec : 0);

        // === Current subject/topic/chapter/lecture ===
        // Priority: active practice > active focus session > most recent saved session today.
        let lastSubject: string | null = null;
        let lastChapter: string | null = null;
        let lastLecture: string | null = null;
        let lastTopic: string | null = null;
        let activityType: 'focus' | 'practice' | null = null;

        if (hasPractice) {
          // Practice is primary — use its subject/chapter; the practice name
          // (e.g. "Physics · ∞Q") goes into lastTopic so the partner sees context.
          lastSubject = activePractice!.subject || null;
          lastChapter = activePractice!.chapter || null;
          lastLecture = null;
          lastTopic = activePractice!.name || null;
          activityType = 'practice';
        } else if (hasFocus && activeSession!.subject) {
          // Focus session is secondary — use its subject/chapter/lecture/topic.
          lastSubject = activeSession!.subject;
          lastChapter = activeSession!.chapter || null;
          lastLecture = activeSession!.lecture || null;
          lastTopic = activeSession!.topic || null;
          activityType = 'focus';
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

        // currentSessionSec = whichever live session is the primary activity.
        // Practice takes priority (matches the display priority above).
        const currentSessionSec = hasPractice
          ? livePracticeSec
          : hasFocus
            ? liveSec
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

        // === Per-day study seconds for last 7 days ===
        // Build a map of dateKey → studySeconds for O(N) lookup
        const dailyMap: Record<string, number> = {};
        const dailyWastedMap: Record<string, number> = {};
        for (const s of sessions) {
          dailyMap[s.date] = (dailyMap[s.date] || 0) + s.studySeconds;
          dailyWastedMap[s.date] = (dailyWastedMap[s.date] || 0) + s.wastedSeconds;
        }
        // Array: [6 days ago, 5 days ago, ..., yesterday, today]
        const dailyHistory: number[] = [];
        const dailyWastedHistory: number[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          let daySec = dailyMap[key] || 0;
          let dayWastedSec = dailyWastedMap[key] || 0;
          // Add live time to today's entry (index 6 = today when i=0)
          if (i === 0) {
            daySec += (hasFocus ? liveSec : 0) + (hasPractice ? livePracticeSec : 0);
            dayWastedSec += (hasFocus ? liveWastedSec : 0);
          }
          dailyHistory.push(daySec);
          dailyWastedHistory.push(dayWastedSec);
        }

        const payload: PartnerSyncPayload = {
          todaySec,
          todayWastedSec,
          weekSec: savedWeekSec
            + (hasFocus ? liveSec : 0)
            + (hasPractice ? livePracticeSec : 0),
          streak,
          dailyHistory,
          dailyWastedHistory,
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
          // Send the startedAt timestamps so the partner card can tick the
          // timer LOCALLY every second between syncs (real-time feel without
          // hammering the server). For focus, use activeSession.startedAt.
          // For practice, use activePractice.startedAt (already adjusted for
          // pause/resume by the practice store).
          practiceStartedAt: hasPractice ? activePractice!.startedAt : null,
          focusStartedAt: hasFocus ? activeSession!.startedAt : null,
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
            // eslint-disable-next-line
            console.warn('[partner] syncData POST failed:', res.status, 'for code', state.code);
          } else {
            set({ lastSyncAt: Date.now() });
          }
        } catch (e) {
          // eslint-disable-next-line
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
            // eslint-disable-next-line
            console.warn('[partner] Pair not found on server for code:', state.code);
            return 'notfound';
          }
          if (!res.ok) {
            // eslint-disable-next-line
            console.warn('[partner] sync fetch failed:', res.status);
            return 'error';
          }
          const data = await res.json();
          if (data.error) {
            // eslint-disable-next-line
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
          // eslint-disable-next-line
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
