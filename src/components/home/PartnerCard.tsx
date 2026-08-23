'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Copy, Check, TrendingUp, Flame, Clock, Trophy, RefreshCw, Target, BookOpen, Play, Pause, ChevronRight } from 'lucide-react';
import { usePartner } from '@/lib/store/partner';
import { useHistory } from '@/lib/store/history';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { usePractice } from '@/lib/store/practice';
import { useTargets } from '@/lib/store/targets';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { formatHM, todayKey, vibrate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PartnerComparisonSheet } from '@/components/partner/PartnerComparisonSheet';
import { PartnerAvatar } from '@/components/partner/PartnerAvatar';
import { PartnerProgressRing } from '@/components/partner/PartnerProgressRing';
import { AnimatedCounter } from '@/components/partner/AnimatedCounter';
// pushToast removed — partner notifications were annoying when clicking tabs.

// Stable empty array for targets fallback — if we use `|| []` inline in the
// Zustand selector, it creates a NEW array reference on every call, which
// causes React's useSyncExternalStore to detect a "change" every render →
// infinite loop ("getSnapshot should be cached"). Using a module-level
// constant keeps the reference stable.
import type { Target as TargetType } from '@/lib/types';
const EMPTY_TARGETS: TargetType[] = [];

/** Human-readable age from milliseconds — "5s", "3m", "2h", "1d". */
function formatAge(ms: number | null): string {
  if (ms === null) return 'unknown';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * PartnerCard — shows on Home tab when paired with a study partner.
 * Displays partner's today study time, streak, last subject, test score.
 * Includes weekly comparison bar.
 *
 * If not paired, shows "Connect with a partner" CTA.
 */
export function PartnerCard() {
  const partner = usePartner();
  const syncData = usePartner((s) => s.syncData);
  const fetchPartnerData = usePartner((s) => s.fetchPartnerData);
  const disconnect = usePartner((s) => s.disconnect);
  const sessions = useHistory((s) => s.sessions);
  // Reactive active session — MUST be declared BEFORE any early return so
  // the hook count is consistent across all renders (Rules of Hooks).
  const myActiveSession = useSession((s) => s.active);
  // CRITICAL FIX: activePractice MUST also be declared BEFORE the early return.
  // Previously this was on line 195 (after `if (!partner.code) return`),
  // which violates Rules of Hooks — when partner.code goes from empty → set,
  // the hook count changes and React silently fails to subscribe to practice
  // updates. This is why practice time wasn't showing on the partner card.
  const activePractice = usePractice((s) => s.activePractice);
  // Reactive targets — select byDate (stable object reference) instead of
  // `byDate[today] || []` which creates a NEW array every render and causes
  // "getSnapshot should be cached" infinite loop. We derive the array below.
  const _byDate = useTargets((s) => s.byDate);
  const _today = todayKey();
  const myTodayTargets = _byDate[_today] || EMPTY_TARGETS;
  // Daily goal (from settings) — used for progress bar fill
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);

  const [showSetup, setShowSetup] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [syncError, setSyncError] = useState<'notfound' | 'error' | null>(null);
  const [tick, setTick] = useState(0); // re-render every 5s so "Xs ago" stays fresh (value read below)
  const partnerNameRef = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void tick;

  // Track partnerName changes — silently (no toast notification).
  // The user said partner toasts are annoying when clicking tabs.
  useEffect(() => {
    partnerNameRef.current = partner.partnerName;
  }, [partner.partnerName]);

  // Manual refresh handler — used by the "Check now" button.
  const handleManualRefresh = useCallback(async () => {
    setChecking(true);
    setSyncError(null);
    vibrate(8);
    try {
      // Force-push OUR data first (so partner sees our latest), then fetch
      // partner's data. Both happen on manual refresh for maximum freshness.
      await syncData();
      const status = await fetchPartnerData();
      if (status === 'notfound') setSyncError('notfound');
      else if (status === 'error') setSyncError('error');
      setLastChecked(Date.now());
    } finally {
      setChecking(false);
    }
  }, [fetchPartnerData, syncData]);

  // === FETCH partner data (PUSH sync is handled globally by usePartnerSync) ===
  // This effect ONLY fetches the partner's data for UI display.
  // The push-to-server logic lives in usePartnerSync (mounted in AppShell)
  // so it runs on every tab, not just Home.
  //
  // Adaptive polling:
  //  - When WAITING for partner to join: poll every 8 seconds
  //  - When partner data is STALE (>30s old): poll every 5s (catch their next push fast)
  //  - When partner IS studying: poll every 5s (see their timer counting up)
  //  - When partner is idle: poll every 15s (keeps "last seen" fresh)
  const _partnerStudyingForPoll = partner.partnerLastData?.isStudying || false;
  const _partnerDataAge = partner.partnerLastData?.updatedAt ? Date.now() - partner.partnerLastData.updatedAt : null;
  const _partnerDataStale = _partnerDataAge !== null && _partnerDataAge > 30_000;
  useEffect(() => {
    if (!partner.code) return;
    syncData(); // initial push
    fetchPartnerData().then((status) => {
      setLastChecked(Date.now());
      if (status === 'notfound') setSyncError('notfound');
      else if (status === 'error') setSyncError('error');
      else setSyncError(null);
    });

    // Local polling REMOVED — global usePartnerSync (30s) handles all push/fetch.
    // Keep only visibilitychange for immediate refresh on tab return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncData();
        fetchPartnerData().then((status) => {
          setLastChecked(Date.now());
          if (status === 'notfound') setSyncError('notfound');
          else if (status === 'error') setSyncError('error');
          else setSyncError(null);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [partner.code, syncData, fetchPartnerData]);

  // === Local 1-second tick (declared here, before activePractice is set below) ===
  // We use a non-reactive peek at the practice store for the tick speed decision.
  // The actual reactive activePractice is declared later and used for display.
  const _partnerLive = partner.partnerLastData?.isStudying || partner.partnerLastData?.isPracticing || false;
  const _iAmLive = (!!myActiveSession && !myActiveSession.paused) || !!usePractice.getState().activePractice;
  const _tickIntervalMs = (_partnerLive || _iAmLive) ? 1_000 : 5_000;
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), _tickIntervalMs);
    return () => clearInterval(t);
  }, [_tickIntervalMs]);

  // Push when a session is saved (global hook handles live state, but this
  // catches the moment a session is committed to history).
  useEffect(() => {
    if (partner.code && sessions.length > 0) {
      syncData();
    }
  }, [sessions.length, partner.code, syncData]);

  if (!partner.code) {
    return (
      <>
        <button
          onClick={() => { setShowSetup(true); vibrate(10); }}
          className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/[0.07] transition border border-indigo-500/30 dark:border-indigo-500/20"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Study with Friend</div>
            <div className="text-[10px] text-t-muted">Compare study time · stay motivated together</div>
          </div>
        </button>
        <AnimatePresence>
          {showSetup && <PartnerSetupSheet onClose={() => setShowSetup(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // === My stats for comparison (mirror of what we sync to the server) ===
  // myActiveSession and myTodayTargets are declared at the top (before early
  // return) for Rules of Hooks. Here we just compute derived values.
  const today = _today;
  const liveSec = (myActiveSession && (myActiveSession as any).date === _today) ? getLiveStudySeconds(myActiveSession) : 0;
  const liveWastedSec = getLiveWastedSeconds(myActiveSession);
  const savedTodaySec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);
  const savedTodayWastedSec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.wastedSeconds, 0);

  // Live practice time also counts toward myTodaySec — practice is study time.
  // (activePractice is now declared at the top of the component, before the
  //  early return, to comply with Rules of Hooks.)
  const livePracticeSec = activePractice
    ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
    : 0;

  const myTodaySec = savedTodaySec
    + (myActiveSession ? liveSec : 0)
    + (activePractice ? livePracticeSec : 0);
  const myTodayWastedSec = savedTodayWastedSec + (myActiveSession ? liveWastedSec : 0);
  const myStreak = useHistory.getState().getStreak();

  // My targets (done / total) — myTodayTargets is from the hook at top
  const myTargetsTotal = myTodayTargets.length;
  const myTargetsDone = myTodayTargets.filter((t) => t.done).length;

  // My current subject/topic/chapter/lecture — PRACTICE TAKES PRIORITY over
  // focus session (matches partner-side syncData priority). If a focus session
  // is lingering in the store but the user is currently in practice mode, we
  // show the practice's subject/chapter, not the focus session's.
  const myCurrentSubject = activePractice?.subject || myActiveSession?.subject || null;
  const myCurrentChapter = activePractice?.chapter || myActiveSession?.chapter || null;
  const myCurrentLecture = activePractice ? null : (myActiveSession?.lecture || null);
  const myCurrentTopic = activePractice?.name || myActiveSession?.topic || null;
  const myIsStudying = (!!myActiveSession && !myActiveSession.paused && !myActiveSession.wasting) || !!activePractice;
  const myIsPaused = !!myActiveSession && myActiveSession.paused && !activePractice;
  const myIsWasting = !!myActiveSession && myActiveSession.wasting && !activePractice;

  // My last test score
  const myTests = useTests.getState().tests;
  const myLastTest = myTests
    .filter((t) => t.totalMarks !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const myLastTestScore = myLastTest?.totalMarks || null;

  const partnerData = partner.partnerLastData;
  const partnerSec = partnerData?.todaySec || 0;
  const partnerWastedSec = partnerData?.todayWastedSec || 0;
  const partnerStreak = partnerData?.streak || 0;
  const partnerTargetsDone = partnerData?.targetsDone || 0;
  const partnerTargetsTotal = partnerData?.targetsTotal || 0;
  // === Freshness-aware status ===
  // Partner's activity flags (isStudying, isPracticing, etc.) are only
  // trusted if the data is FRESH (<30s old). If data is stale (30s-120s),
  // we show "Online" instead of "Studying" because we don't know if they're
  // still studying. If >120s, show "Offline".
  // This prevents the bug where partner closed their app 81s ago but the
  // card still shows "Studying" because the stale payload has isStudying=true.
  const partnerUpdatedAt = partner.partnerLastSeen ?? partnerData?.updatedAt ?? null;
  const partnerDataAge = partnerUpdatedAt ? Date.now() - partnerUpdatedAt : null;
  const partnerIsLive = partnerDataAge !== null && partnerDataAge < 30_000;
  const partnerIsOffline = partnerDataAge === null || partnerDataAge > 120_000;
  // Only trust payload flags if data is fresh (live)
  const partnerIsStudying = partnerIsLive && (partnerData?.isStudying || false);
  const partnerIsPaused = partnerIsLive && (partnerData?.isPaused || false);
  const partnerIsWasting = partnerIsLive && (partnerData?.isWasting || false);
  const partnerIsPracticing = partnerIsLive && (partnerData?.isPracticing || false);
  const partnerActivityType = partnerIsLive ? (partnerData?.activityType || null) : null;
  const partnerLastSubject = partnerData?.lastSubject || null;
  const partnerLastChapter = partnerData?.lastChapter || null;
  const partnerLastLecture = partnerData?.lastLecture || null;
  const partnerLastTopic = partnerData?.lastTopic || null;
  const partnerLastTestScore = partnerData?.lastTestScore || null;

  // === LIVE partner time (ticks locally every second) ===
  // Between syncs, if the partner is practicing/studying, their todaySec keeps
  // growing. We compute the delta from the last sync time and add it to the
  // synced partnerSec so the timer counts up in real-time on our card.
  // This gives a "live" feel without hammering the server.
  const partnerActiveNow = partnerIsStudying || partnerIsPracticing;
  const partnerLiveDelta = (partnerActiveNow && partnerUpdatedAt)
    ? Math.max(0, Math.floor((Date.now() - partnerUpdatedAt) / 1000))
    : 0;
  const partnerLiveSec = partnerSec + partnerLiveDelta;
  // Live current-session timer for the partner (for the banner display).
  // Uses practiceStartedAt / focusStartedAt from the payload so the elapsed
  // time is accurate even if the sync was a few seconds ago.
  const partnerSessionStartedAt = partnerIsPracticing
    ? (partnerData?.practiceStartedAt ?? null)
    : partnerIsStudying
      ? (partnerData?.focusStartedAt ?? null)
      : null;
  const partnerLiveSessionSec = partnerSessionStartedAt
    ? Math.max(0, Math.floor((Date.now() - partnerSessionStartedAt) / 1000))
    : 0;

  // Comparison bar — who's studied more today (uses LIVE times so it ticks)
  const maxSec = Math.max(myTodaySec, partnerLiveSec, 1);
  const myPct = Math.round((myTodaySec / maxSec) * 100);
  const partnerPct = Math.round((partnerLiveSec / maxSec) * 100);

  // Status text — offline/online checked FIRST, then activity (only if live)
  const partnerStatusText = partnerIsOffline
    ? 'Offline'
    : partnerIsPracticing
      ? 'Practicing'
      : partnerIsStudying
        ? 'Studying'
        : partnerIsWasting
          ? 'Wasting'
          : partnerIsPaused
            ? 'Paused'
            : 'Online';
  const partnerStatusColor = partnerIsOffline
    ? '#9ca3af'
    : partnerIsPracticing
      ? '#3b82f6'
      : partnerIsStudying
        ? '#22c55e'
        : partnerIsWasting
          ? '#ef4444'
          : partnerIsPaused
            ? '#f59e0b'
            : '#3b82f6';
  // "You" status — distinguishes "Practicing" from "Studying".
  // Practice takes priority: if activePractice is set, we are "Practicing X"
  // regardless of any lingering focus session in the store.
  const myIsPracticing = !!activePractice;
  const myStatusText = myIsPracticing
    ? `Practicing ${activePractice?.subject || ''}`
    : myIsStudying
      ? 'Studying'
      : myIsWasting
        ? 'Wasting'
        : myIsPaused
          ? 'Paused'
          : 'Online';
  const myStatusColor = myIsPracticing
    ? '#3b82f6'
    : myIsStudying
      ? '#22c55e'
      : myIsWasting
        ? '#ef4444'
        : myIsPaused
          ? '#f59e0b'
          : '#3b82f6';

  return (
    <>
      <div className="glass rounded-2xl p-3 border border-indigo-500/30 dark:border-indigo-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-t-secondary">Study with Friend</span>
          {/* Minimal header actions — chevron for full comparison, ⋮ for manage */}
          <button
            onClick={() => { vibrate(8); setShowComparison(true); }}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-t-muted hover:text-t-primary hover:bg-white/5 transition"
            aria-label="Full comparison"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => { vibrate(8); setShowSetup(true); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-t-muted hover:text-t-primary hover:bg-white/5 transition"
            aria-label="Manage"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
          </button>
        </div>

        {/* Partner waiting */}
        {!partner.partnerName ? (
          <div className="text-center py-2">
            {syncError === 'notfound' ? (
              /* Pair code doesn't exist on server — DB was reset, or the code
                 was never actually created. Offer a clean reset. */
              <div className="space-y-3">
                <div className="text-xs text-red-500 dark:text-red-400 font-semibold">
                  This pairing code is no longer valid.
                </div>
                <div className="text-[10px] text-t-muted">
                  The code <span className="font-mono font-bold">{partner.code}</span> doesn't
                  exist on the server anymore (it may have been reset).
                  Create a new pair to start fresh.
                </div>
                <button
                  onClick={() => { vibrate(10); disconnect(); }}
                  className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-semibold text-sm"
                >
                  Reset & Create New Pair
                </button>
              </div>
            ) : syncError === 'error' ? (
              /* Network or server error — show retry. */
              <div className="space-y-3">
                <div className="text-xs text-amber-500 dark:text-amber-400 font-semibold">
                  Couldn't reach the server.
                </div>
                <div className="text-[10px] text-t-muted">
                  Check your internet connection and try again.
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={checking}
                  className="w-full py-2.5 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold text-sm border border-indigo-500/30"
                >
                  <RefreshCw size={12} className={checking ? 'animate-spin inline mr-1' : 'inline mr-1'} />
                  {checking ? 'Retrying...' : 'Retry now'}
                </button>
              </div>
            ) : (
              /* Normal waiting state — code is valid, polling for partner. */
              <>
                <div className="text-xs text-t-secondary mb-2">Share your code with a friend:</div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(partner.code);
                    setCopied(true);
                    vibrate(10);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-lg tracking-widest border border-indigo-500/30 dark:border-indigo-500/25"
                >
                  {partner.code}
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <div className="text-[10px] text-t-muted mt-2 flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Checking every 8s
                  </span>
                  {lastChecked && (
                    <span className="text-t-muted/70">
                      · last check {Math.max(0, Math.floor((Date.now() - lastChecked) / 1000))}s ago
                    </span>
                  )}
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={checking}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
                  {checking ? 'Checking...' : 'Check now'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* === PAIR NOT FOUND BANNER === */}
            {/* Only shows when the pair code exists in localStorage but NOT on the server.
                This is RARE — only happens if the server database was completely reset.
                Pairs are permanent by design and never auto-delete. */}
            {syncError === 'notfound' && (
              <div className="space-y-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="text-xs text-amber-500 dark:text-amber-400 font-bold">
                  ⚠ Server was reset
                </div>
                <div className="text-[10px] text-t-muted">
                  Your pair <span className="font-mono font-bold">{partner.code}</span> was removed
                  because the server database was reset. This is rare and won't happen again.
                  Create a new pair with your partner — it will be permanent.
                </div>
                <button
                  onClick={() => { vibrate(10); disconnect(); }}
                  className="w-full py-2 rounded-xl bg-amber-500 text-white font-semibold text-xs"
                >
                  Reset & Create New Pair
                </button>
              </div>
            )}

            {/* === Two progress bars: YOU and PARTNER, each vs their daily goal === */}
            {syncError !== 'notfound' && (
            <div className="space-y-3">
              {/* YOU bar */}
              <div className="flex items-center gap-2.5">
                <PartnerAvatar
                  initials={(partner.name || 'Y').charAt(0).toUpperCase()}
                  accentColor="#14b8a6"
                  status={myIsStudying ? 'studying' : myIsWasting ? 'wasting' : myIsPaused ? 'paused' : 'online'}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">YOU · {partner.name || 'You'}</span>
                    <span className="tabular text-t-secondary font-semibold">
                      {formatHM(myTodaySec)} <span className="text-t-muted font-normal">/ {dailyGoalHours}h</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      animate={{ width: `${Math.min(100, (myTodaySec / (dailyGoalHours * 3600)) * 100)}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-green-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] mt-0.5">
                    <span style={{ color: myStatusColor }} className="font-bold">{myStatusText}</span>
                    {/* Live practice/focus timer badge — ticks every second */}
                    {myIsPracticing && livePracticeSec > 0 && (
                      <span className="tabular font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        {formatHM(livePracticeSec)}
                      </span>
                    )}
                    {!myIsPracticing && myIsStudying && liveSec > 0 && (
                      <span className="tabular font-bold px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-600 dark:text-green-400">
                        {formatHM(liveSec)}
                      </span>
                    )}
                    {myTodayWastedSec > 0 && (
                      <span className="text-red-500 dark:text-red-400 tabular">⚠ {formatHM(myTodayWastedSec)}</span>
                    )}
                    {myCurrentSubject && (
                      <span className="text-t-muted truncate">{myCurrentSubject}{myCurrentChapter ? ` · ${myCurrentChapter}` : ''}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* PARTNER bar */}
              <div className="flex items-center gap-2.5">
                <PartnerAvatar
                  initials={(partner.partnerName || 'P').charAt(0).toUpperCase()}
                  accentColor="#8b5cf6"
                  status={partnerIsPracticing ? 'studying' : partnerIsStudying ? 'studying' : partnerIsWasting ? 'wasting' : partnerIsPaused ? 'paused' : partnerIsOffline ? 'offline' : 'online'}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="font-bold text-violet-600 dark:text-violet-400 uppercase truncate">
                      {partner.partnerName || '—'}
                    </span>
                    <span className="tabular text-t-secondary font-semibold">
                      {formatHM(partnerLiveSec)} <span className="text-t-muted font-normal">/ {dailyGoalHours}h</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      animate={{ width: `${Math.min(100, (partnerLiveSec / (dailyGoalHours * 3600)) * 100)}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] mt-0.5">
                    <span style={{ color: partnerStatusColor }} className="font-bold">{partnerStatusText}</span>
                    {partnerWastedSec > 0 && (
                      <span className="text-red-500 dark:text-red-400 tabular">⚠ {formatHM(partnerWastedSec)}</span>
                    )}
                    {partnerLastSubject && (
                      <span className="text-t-muted truncate">{partnerLastSubject}{partnerLastChapter ? ` · ${partnerLastChapter}` : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* === Live Status Badge === */}
            <div className="flex items-center justify-center">
              {partnerDataAge !== null && partnerDataAge < 20_000 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Live</span>
                </div>
              ) : partnerDataAge !== null && partnerDataAge < 120_000 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Last seen {Math.floor(partnerDataAge/1000)}s ago</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Offline · {formatAge(partnerDataAge)}</span>
                </div>
              )}
            </div>

            {/* === Partner studying banner ===
                Renders "Practicing X" if the partner is in practice mode (activityType='practice'),
                otherwise the default "studying X" banner. */}
            {(partnerIsStudying || partnerIsPracticing) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-2 text-[11px] rounded-xl px-3 py-2 border",
                  partnerIsPracticing
                    ? "bg-blue-500/10 border-blue-500/20"
                    : "bg-green-500/10 border-green-500/20"
                )}
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    partnerIsPracticing ? "bg-blue-500" : "bg-green-500"
                  )}
                />
                <Play size={11} className={cn("shrink-0", partnerIsPracticing ? "text-blue-500" : "text-green-500")} />
                <span className="truncate text-t-secondary flex-1">
                  <strong className={cn(partnerIsPracticing ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400")}>
                    {partner.partnerName}
                  </strong>{' '}
                  {partnerIsPracticing ? 'practicing' : 'studying'}
                  {partnerLastSubject ? ` · ${partnerLastSubject}` : ''}
                  {partnerLastChapter ? ` · ${partnerLastChapter}` : ''}
                </span>
                {/* Live session timer — ticks locally every second using
                    practiceStartedAt/focusStartedAt from the sync payload.
                    Shows "12m 34s" format so it's easy to read at a glance. */}
                {partnerLiveSessionSec > 0 && (
                  <span className={cn(
                    "tabular font-bold text-[11px] shrink-0 px-1.5 py-0.5 rounded-md",
                    partnerIsPracticing
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : "bg-green-500/15 text-green-600 dark:text-green-400"
                  )}>
                    {formatHM(partnerLiveSessionSec)}
                  </span>
                )}
              </motion.div>
            )}
            {partnerIsWasting && !partnerIsStudying && (
              <div className="flex items-center gap-2 text-[11px] bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20">
                <span className="text-red-500">⚠</span>
                <span className="truncate text-t-secondary">
                  <strong className="text-red-600 dark:text-red-400">{partner.partnerName}</strong> is wasting time
                </span>
              </div>
            )}

            {/* === Collapsible stats === */}
            <details className="group">
              <summary className="flex items-center justify-center gap-1 text-[10px] text-t-muted cursor-pointer hover:text-t-secondary py-1">
                <span>Stats</span>
                <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
              </summary>
              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="glass rounded-xl p-2">
                  <div className="flex items-center justify-center gap-0.5 text-[9px] text-t-muted uppercase mb-1">
                    <Flame size={8} /> Streak
                  </div>
                  <div className="text-xs font-bold tabular font-mono">
                    <span className="text-teal-500 dark:text-teal-400">{myStreak}</span>
                    <span className="text-t-muted/40 mx-0.5">·</span>
                    <span className="text-violet-500 dark:text-violet-400">{partnerStreak}</span>
                  </div>
                </div>
                <div className="glass rounded-xl p-2">
                  <div className="flex items-center justify-center gap-0.5 text-[9px] text-t-muted uppercase mb-1">
                    <Target size={8} /> Targets
                  </div>
                  <div className="text-xs font-bold tabular font-mono">
                    <span className="text-teal-500 dark:text-teal-400">{myTargetsDone}/{myTargetsTotal}</span>
                    <span className="text-t-muted/40 mx-0.5">·</span>
                    <span className="text-violet-500 dark:text-violet-400">{partnerTargetsDone}/{partnerTargetsTotal}</span>
                  </div>
                </div>
                <div className="glass rounded-xl p-2">
                  <div className="flex items-center justify-center gap-0.5 text-[9px] text-t-muted uppercase mb-1">
                    <Trophy size={8} /> Test
                  </div>
                  <div className="text-xs font-bold tabular font-mono">
                    <span className="text-teal-500 dark:text-teal-400">{myLastTestScore ?? '—'}</span>
                    <span className="text-t-muted/40 mx-0.5">·</span>
                    <span className="text-violet-500 dark:text-violet-400">{partnerLastTestScore ?? '—'}</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSetup && <PartnerSetupSheet onClose={() => setShowSetup(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showComparison && <PartnerComparisonSheet onClose={() => setShowComparison(false)} />}
      </AnimatePresence>
    </>
  );
}

/**
 * PartnerSetupSheet — create or join a pair.
 * Two modes: "Create" (get a code to share) or "Join" (enter friend's code).
 */
function PartnerSetupSheet({ onClose }: { onClose: () => void }) {
  const partner = usePartner();
  const createPair = usePartner((s) => s.createPair);
  const joinPair = usePartner((s) => s.joinPair);
  const disconnect = usePartner((s) => s.disconnect);

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(partner.code ? 'menu' : 'menu');
  const [name, setName] = useState(partner.name || '');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    const result = await createPair(name.trim());
    setLoading(false);
    if (result.code) {
      setMode('menu');
      // No toast — silent success.
    } else {
      setError(result.error || 'Failed to create. Try again.');
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !joinCode.trim()) return;
    setLoading(true);
    setError('');
    const result = await joinPair(joinCode.trim(), name.trim());
    setLoading(false);
    if (result.ok) {
      onClose();
      // No toast — silent success.
    } else {
      setError(result.error || 'Invalid code or pair is full.');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
    // No toast — silent.
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8"
      >
        <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-purple-400" />
            <h2 className="text-lg font-bold">Study with Friend</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        {partner.code && mode !== 'join' ? (
          /* Already has a code — show status with clear context + options.
             This branch covers BOTH "freshly created, waiting for partner"
             and "stale code from a previous session that needs resetting".
             If the user clicked "Join a different code" (mode==='join'), we
             fall through to the join form below instead. */
          <div className="space-y-3">
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-xs text-t-muted mb-1">
                {partner.isUserB ? "Code you joined with" : "Your pairing code"}
              </div>
              <div className="text-2xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">{partner.code}</div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-xs text-t-muted">You</div>
              <div className="text-sm font-bold">{partner.name || '(no name)'}</div>
              {partner.partnerName && (
                <>
                  <div className="text-xs text-t-muted mt-2">Partner</div>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{partner.partnerName}</div>
                </>
              )}
            </div>
            {!partner.partnerName && (
              <div className="text-[10px] text-t-muted bg-white/5 rounded-lg p-2 text-center">
                {partner.isUserB
                  ? "Connected to a pair. Waiting for the creator's data..."
                  : "Share your code with a friend. They tap 'Join with a code' on their device."}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode('join'); setError(''); }}
                className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-t-primary font-semibold text-xs"
              >
                Join a different code
              </button>
              <button
                onClick={handleDisconnect}
                className="py-2.5 rounded-xl bg-red-500/15 text-red-500 dark:text-red-400 font-semibold text-xs"
              >
                Reset connection
              </button>
            </div>
            <p className="text-[9px] text-t-muted text-center">
              "Reset connection" clears this device's pairing data so you can create or join a fresh pair.
            </p>
          </div>
        ) : (
          /* Not paired, OR user chose to join a different code — show create/join menu */
          <>
            <div className="space-y-2 mb-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/50"
              />
            </div>

            {mode === 'menu' && (
              <div className="space-y-2">
                <button
                  onClick={() => setMode('create')}
                  className="w-full p-3 rounded-xl bg-purple-500/15 border border-purple-500/20 text-left"
                >
                  <div className="text-sm font-bold text-purple-300">Create a pair</div>
                  <div className="text-[10px] text-white/40">Get a code to share with your friend</div>
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-left"
                >
                  <div className="text-sm font-bold">Join with a code</div>
                  <div className="text-[10px] text-white/40">Enter your friend's 6-char code</div>
                </button>
              </div>
            )}

            {mode === 'create' && (
              <div className="space-y-3">
                {error && <div className="text-xs text-red-500 dark:text-red-400 text-center bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || loading}
                  className={cn('w-full py-3 rounded-xl font-bold text-sm',
                    name.trim() && !loading ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/30')}
                >
                  {loading ? 'Creating...' : 'Generate Code'}
                </button>
                <button onClick={() => setMode('menu')} className="w-full text-xs text-white/40">← Back</button>
              </div>
            )}

            {mode === 'join' && (
              <div className="space-y-3">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold tracking-widest text-center uppercase focus:outline-none focus:border-purple-400/50"
                />
                {error && <div className="text-xs text-red-500 dark:text-red-400 text-center bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
                <button
                  onClick={handleJoin}
                  disabled={!name.trim() || !joinCode.trim() || loading}
                  className={cn('w-full py-3 rounded-xl font-bold text-sm',
                    name.trim() && joinCode.trim() && !loading ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/30')}
                >
                  {loading ? 'Joining...' : 'Join Pair'}
                </button>
                <button
                  onClick={() => { setMode(partner.code ? 'menu' : 'menu'); setError(''); }}
                  className="w-full text-xs text-white/40"
                >
                  ← Back
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
