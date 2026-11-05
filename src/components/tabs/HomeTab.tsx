'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { usePractice } from '@/lib/store/practice';

// === Shared animation variants for Home tab cards ===
// Fix #1 + #7: Staggered entrance + scroll-triggered (whileInView)
const cardEntrance = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  viewport: { once: true, margin: '-30px' as const },
};
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useTimetable } from '@/lib/store/timetable';
import { useNav } from '@/lib/store/nav';
import { subjectColor } from '@/lib/colors';
import type { Subject, TimetableSlot } from '@/lib/types';
import { useRecall } from '@/lib/store/recall';
import { formatHM, longDate, diffDays, todayKey, isRevisionOverdue, vibrate } from '@/lib/utils';
import { AchievementBadges } from '@/components/shared/AchievementBadges';
import { ScorePredictionCard } from '@/components/home/ScorePredictionCard';
import { JourneyCard } from '@/components/home/JourneyCard';
import { CoachCard } from '@/components/home/CoachCard';
import { PartnerCard } from '@/components/home/PartnerCard';
import { NextTestCard, TestDayMode } from '@/components/home/NextTestCard';
import { CountdownCard } from '@/components/home/CountdownCard';
import { ProgressRings } from '@/components/home/ProgressRings';
import { useMounted } from '@/lib/hooks/useMounted';
import { CountUp } from '@/components/shared/CountUp';
import { NumberMorph } from '@/components/shared/NumberMorph';
import { StreakFlame } from '@/components/shared/StreakFlame';
import { useDailyLog } from '@/lib/store/dailyLog';
import { SleepLogSheet } from '@/components/dailylog/SleepLogSheet';
import { SleepReportSheet } from '@/components/dailylog/SleepReportSheet';
import { SleepPlanSheet } from '@/components/dailylog/SleepPlanSheet';
import { useSleep } from '@/lib/store/sleep';
import { useDoubts } from '@/lib/store/doubts';
import { getSubjectHealthScores } from '@/lib/healthScore';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';

export function HomeTab() {
  // Hydration guard — gates rendering of any UI derived from persisted
  // Zustand state (sessions, tests, syllabus) so server and first client
  // render produce identical HTML.
  const mounted = useMounted();
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  // Select raw data (stable references), compute derived values in component
  const sessions = useHistory((s) => s.sessions);
  const dailyGoal = useSettings((s) => s.dailyGoalHours);
  const examDate = useSettings((s) => s.examDate);
  const prepStart = useSettings((s) => s.prepStartDate);
  const haptics = useSettings((s) => s.haptics);
  // Sleep — tapping the NEET logo starts sleep mode (the logo is the universal
  // sleep trigger; no extra banner needed).
  const startSleep = useSleep((s) => s.startSleep);
  const activeSleep = useSleep((s) => s.activeSleep);
  const syllabusLectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);
  const timetableSlots = useTimetable((s) => s.slots);
  const recallChallenges = useRecall((s) => s.challenges);
  void recallChallenges; // kept for future use; recall trigger now lives in Study tab long-press

  // === Live activity subscriptions ===
  // Subscribe to focus-session + practice stores so the Today ring includes
  // LIVE time from the currently-running session (not just saved sessions).
  // Also subscribe to a 1s tick so the ring updates in real-time.
  const activeFocusSession = useSession((s) => s.active);
  const activePractice = usePractice((s) => s.activePractice);
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    // Only tick when there's a live activity (focus session OR practice).
    // When idle, no need to re-render every second.
    if (!activeFocusSession && !activePractice) return;
    // 3-second tick for passive displays (progress rings, stats) — saves CPU
    // Active timers (FocusTimer, LockTimer) have their own 1s tick.
    // === HEAT FIX: Skip when tab hidden ===
    const i = setInterval(() => {
      if (document.hidden) return;
      setLiveTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(i);
  }, [activeFocusSession, activePractice]);

  // Compute derived values with useMemo
  const todaySec = useMemo(() => {
    const today = todayKey();
    const saved = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);
    // Add LIVE time from currently-running focus session + practice.
    // Practice time IS study time — it should be counted everywhere.
    const liveFocus = (activeFocusSession && (activeFocusSession as any).date === today) ? getLiveStudySeconds(activeFocusSession) : 0;
    const livePractice = activePractice
      ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
      : 0;
    return saved + liveFocus + livePractice;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeFocusSession, activePractice]);

  const yestSec = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return sessions.filter((s) => s.date === y).reduce((a, s) => a + s.studySeconds, 0);
  }, [sessions]);

  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const saved = sessions.filter((s) => s.endedAt >= weekAgo).reduce((a, s) => a + s.studySeconds, 0);
    const liveFocus = (activeFocusSession && (activeFocusSession as any).date === todayKey()) ? getLiveStudySeconds(activeFocusSession) : 0;
    const livePractice = activePractice
      ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
      : 0;
    return saved + liveFocus + livePractice;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeFocusSession, activePractice]);

  const lastWeek = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;
    return sessions.filter((s) => s.endedAt >= twoWeeksAgo && s.endedAt < weekAgo).reduce((a, s) => a + s.studySeconds, 0);
  }, [sessions]);

  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const days = new Set<string>();
    for (const s of sessions) {
      if (s.studySeconds >= 60) days.add(s.date);
    }
    if (days.size === 0) return 0;
    let st = 0;
    const d = new Date();
    const todayKeyStr = todayKey();
    if (!days.has(todayKeyStr)) d.setDate(d.getDate() - 1);
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (days.has(key)) { st++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return st;
  }, [sessions]);

  // Total study hours (for study-based pace calculation)
  const totalStudyHours = useMemo(() => {
    return sessions.reduce((a, s) => a + s.studySeconds, 0) / 3600;
  }, [sessions]);

  const syllabusPct = useMemo(() => {
    const total = syllabusLectures.length;
    if (total === 0) return 0;
    return Math.round((syllabusLectures.filter((l) => l.done).length / total) * 100);
  }, [syllabusLectures]);

  // Weighted completion % (by chapter NEET weightage)
  const syllabusChapters = useSyllabus((s) => s.chapters);
  const syllabusWeightedPct = useMemo(() => {
    if (syllabusLectures.length === 0 || syllabusChapters.length === 0) return syllabusPct;
    // Build chapter weightage map (default 1 if no weightage set)
    const chapterWeight = new Map<string, number>();
    for (const ch of syllabusChapters) {
      chapterWeight.set(ch.id, ch.weightage ?? 1);
    }
    // Group lectures by chapter, count done per chapter
    const chapterLectures = new Map<string, { total: number; done: number }>();
    for (const lec of syllabusLectures) {
      const entry = chapterLectures.get(lec.chapterId) || { total: 0, done: 0 };
      entry.total++;
      if (lec.done) entry.done++;
      chapterLectures.set(lec.chapterId, entry);
    }
    // Calculate weighted completion
    let totalWeight = 0;
    let doneWeight = 0;
    for (const [chId, stats] of chapterLectures) {
      const weight = chapterWeight.get(chId) ?? 1;
      totalWeight += weight * stats.total;
      doneWeight += weight * stats.done;
    }
    if (totalWeight === 0) return syllabusPct;
    return Math.round((doneWeight / totalWeight) * 100);
  }, [syllabusLectures, syllabusChapters, syllabusPct]);

  // nextTest computation moved into the NextTestCard component (which also
  // handles Test Day Mode detection). HomeTab no longer needs direct access.

  const todaySlots = useMemo(() => {
    const today = new Date().getDay();
    return timetableSlots
      .filter((s) => s.day === today)
      .sort((a, b) => a.startHour - b.startHour);
  }, [timetableSlots]);

  // Fix #10: Date updates at midnight (poll every 60s)
  // === HEAT FIX: Skip when tab hidden — AppShell visibilitychange catches up ===
  const [dateText, setDateText] = useState('');
  useEffect(() => {
    const update = () => setDateText(longDate());
    update();
    const interval = setInterval(() => {
      if (document.hidden) return;
      update();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const todayPct = Math.min(100, Math.round((todaySec / (dailyGoal * 3600)) * 100));
  const yestPct = Math.min(100, Math.round((yestSec / (dailyGoal * 3600)) * 100));

  // === Confetti on Goal Hit ===
  // Fires once when the user crosses 100% of their daily goal.
  const goalHitRef = useRef(false);
  useEffect(() => {
    if (todayPct >= 100 && !goalHitRef.current) {
      goalHitRef.current = true;
      // Trigger confetti from the Effects module
      import('@/components/shared/Effects').then(({ triggerConfetti }) => {
        triggerConfetti('big');
      });
      import('@/lib/sounds').then(({ playSound }) => playSound('success'));
    }
    // Reset if user drops below 100% (e.g., a session was deleted)
    if (todayPct < 100) {
      goalHitRef.current = false;
    }
  }, [todayPct]);

  const trendToday = yestSec > 0 ? Math.round(((todaySec - yestSec) / yestSec) * 100) : todaySec > 0 ? 100 : 0;
  const trendWeek = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

  const daysToExam = diffDays(todayKey(), examDate);
  const prepDay = prepStart ? diffDays(prepStart, todayKey()) + 1 : (sessions.length > 0 ? 1 : 0);
  const prepTotal = prepStart ? diffDays(prepStart, examDate) : 326;
  const prepPct = prepTotal > 0 ? Math.min(100, Math.round((prepDay / prepTotal) * 100)) : 0;

  // Average study hours per day (for pace calculation)
  const avgStudyHours = useMemo(() => {
    const daysElapsed = prepStart ? Math.max(1, prepDay) : Math.max(1, Math.ceil((Date.now() - (sessions[0]?.startedAt || Date.now())) / 86400000));
    return totalStudyHours / daysElapsed;
  }, [totalStudyHours, prepStart, prepDay, sessions]);

  // === Lifted sheet state (rendered OUTSIDE motion.div wrappers to avoid
  //     the CSS transform → position:fixed containing block issue) ===
  const [showSleepLog, setShowSleepLog] = useState(false);
  const [showSleepReport, setShowSleepReport] = useState(false);
  const [showSleepPlan, setShowSleepPlan] = useState(false);

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* === Sheets rendered at TOP LEVEL (outside motion.div wrappers) ===
          This prevents the CSS transform → position:fixed containing block
          issue that caused glitchy sheet positioning. */}
      {showSleepLog && <SleepLogSheet key="sleeplog" onClose={() => setShowSleepLog(false)} />}
      <SleepReportSheet open={showSleepReport} onClose={() => setShowSleepReport(false)} />
      <SleepPlanSheet open={showSleepPlan} onClose={() => setShowSleepPlan(false)} />

      {/* Mission Control Header — modernized */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between">
        {/* Left: Greeting + Logo + Title + Date */}
        <div className="flex flex-col gap-0.5">
          {/* Time-based greeting */}
          {(() => {
            const hour = new Date().getHours();
            let greeting: string;
            let icon: string;
            let iconColor: string;
            if (hour >= 5 && hour < 12) {
              greeting = 'Good morning';
              icon = '☀️';
              iconColor = '#fbbf24';
            } else if (hour >= 12 && hour < 17) {
              greeting = 'Good afternoon';
              icon = '🌤️';
              iconColor = '#14b8a6';
            } else if (hour >= 17 && hour < 21) {
              greeting = 'Good evening';
              icon = '🌙';
              iconColor = '#818cf8';
            } else {
              greeting = 'Studying late?';
              icon = '🌃';
              iconColor = '#a78bfa';
            }
            return (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: 'var(--muted-foreground)' }}
                suppressHydrationWarning
              >
                <span style={{ boxShadow: `0 0 3px ${iconColor}80` }}>{icon}</span>
                <span>{greeting}</span>
              </motion.div>
            );
          })()}

          {/* Logo + Title row */}
          <button
            onClick={() => {
              if (activeSleep) return;
              if (haptics) vibrate(12);
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
              }
              startSleep();
            }}
            className="flex items-center gap-2 group active:scale-[0.97] transition"
            title="Tap to start sleep mode"
            aria-label="Tap logo to start sleep mode"
          >
            {/* Logo with glowing ring */}
            <div className="relative">
              {/* Glowing ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
              />
              <motion.img
                src="/logo.svg"
                alt=""
                className="w-9 h-9 relative z-10"
                whileTap={haptics ? { scale: 0.92, rotate: -3 } : {}}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.25 }}
              />
              {/* Sleep mode indicator */}
              {activeSleep && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ background: '#818cf8', border: '1.5px solid var(--card)' }}
                >
                  <span className="text-[7px]">💤</span>
                </motion.div>
              )}
            </div>
            {/* Gradient title */}
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{
                // backgroundImage (long-form) instead of background (shorthand)
                // to avoid React's "mixing shorthand and non-shorthand" warning
                // when combined with backgroundClip below.
                backgroundImage: 'linear-gradient(135deg, #14b8a6, #22c55e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              NEET 2027
            </h1>
          </button>

          {/* Date text — theme-aware */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[11px] flex items-center gap-1"
            style={{ color: 'var(--muted-foreground)' }}
            suppressHydrationWarning
          >
            <span>📅</span>
            <span>{dateText}</span>
          </motion.p>
        </div>

        {/* Right: Streak Flame */}
        {mounted && <StreakFlame streak={streak} />}
      </motion.div>

      {/* Countdown Card — modern ring + urgency colors + study-based pace */}
      <CountdownCard
        daysToExam={daysToExam}
        examDate={examDate}
        prepStart={prepStart}
        prepDay={prepDay}
        prepTotal={prepTotal}
        prepPct={prepPct}
        syllabusPct={syllabusPct}
        syllabusWeightedPct={syllabusWeightedPct}
        daysStudied={streak}
        dailyGoalHours={dailyGoal}
        avgStudyHours={avgStudyHours}
        totalStudyHours={totalStudyHours}
      />

      {/* Test Day Mode — only renders when today is a test day. Replaces
          the regular "Next Test" card (which returns null in this case) with
          a focused, calming test-day layout. */}
      <motion.div {...cardEntrance}><TestDayMode /></motion.div>

      {/* Progress Rings — advanced animated dual-ring card */}
      <ProgressRings
        todaySec={todaySec}
        yestSec={yestSec}
        todayPct={todayPct}
        yestPct={yestPct}
        trendToday={trendToday}
        thisWeek={thisWeek}
        lastWeek={lastWeek}
        weekPct={Math.min(100, Math.round((thisWeek / (dailyGoal * 3600 * 7)) * 100))}
        lastWeekPct={Math.min(100, Math.round((lastWeek / (dailyGoal * 3600 * 7)) * 100))}
        trendWeek={trendWeek}
        dailyGoalHours={dailyGoal}
      />

      {/* Next Test — collapsible readiness card.
          On test day, NextTestCard returns null and TestDayMode renders instead
          (TestDayMode is placed above the Rings so it's the first thing seen). */}
      <motion.div {...cardEntrance}><NextTestCard /></motion.div>

      {/* === Study with Friend — compare with a friend === */}
      <motion.div {...cardEntrance}><PartnerCard /></motion.div>

      {/* === AI Study Coach === */}
      <motion.div {...cardEntrance}><CoachCard /></motion.div>

      {/* === DAILY VITALS ZONE (redesigned) ===
          Order matches approved mockup: Subject Pulse -> Schedule timeline -> Vitals strip */}
      <motion.div {...cardEntrance} className="minimal-hide"><SubjectPulseCard /></motion.div>

      {todaySlots.length > 0 && (
        <motion.div {...cardEntrance} className="minimal-hide"><ScheduleStrip slots={todaySlots} /></motion.div>
      )}

      {/* Daily Vitals strip — sheets are rendered at top level to avoid transform positioning issues */}
      <motion.div {...cardEntrance} className="minimal-hide">
        <DailyVitalsCard
          onOpenSleepLog={() => setShowSleepLog(true)}
          onOpenReport={() => setShowSleepReport(true)}
          onOpenPlan={() => setShowSleepPlan(true)}
        />
      </motion.div>

      {/* Weekly Goals — moved to Home tab long-press overlay */}

      {/* Predicted Score */}
      <motion.div {...cardEntrance}><ScorePredictionCard /></motion.div>

      {/* Achievement Badges — kept as its own card (DECISION 8: untouched) */}
      <motion.div {...cardEntrance} className="minimal-hide"><AchievementBadges /></motion.div>

      {/* Your Journey — Phase 2: merges old MiniHeatmap + Total Sessions into one hero card */}
      <JourneyCard
        sessions={sessions}
        todaySec={todaySec}
        prepStart={prepStart}
        prepDay={prepDay}
        streak={streak}
        totalStudyHours={totalStudyHours}
      />
    </div>
  );
}

/* =========================================================================
   DAILY VITALS (REDESIGNED — was the tall "Sleep & Energy + Doubts" card)
   8. Three compact tiles: Sleep / Energy / Doubts (~40% shorter)
   9. Zero functionality lost: tap sleep -> report (or log when no history),
      long-press -> report, NEET-logo sleep start untouched, energy inline
      picker, doubts navigation, Sleep Plan pill preserved.
   ========================================================================= */
function DailyVitalsCard({ onOpenSleepLog, onOpenReport, onOpenPlan }: {
  onOpenSleepLog: () => void;
  onOpenReport: () => void;
  onOpenPlan: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  const dailyLogState = useDailyLog((s) => s);
  const todayLog = useMemo(() => dailyLogState.getToday(), [dailyLogState]);
  const allDoubts = useDoubts((s) => s.doubts);
  const pendingDoubts = useMemo(() => allDoubts.filter(d => d.status === 'pending').length, [allDoubts]);
  const resolvedDoubts = useMemo(() => allDoubts.filter(d => d.status === 'resolved').length, [allDoubts]);
  const sleepHistory = useSleep((s) => s.history);
  const activeSleep = useSleep((s) => s.activeSleep);
  const setEnergy = useDailyLog((s) => s.setEnergy);
  const [showEnergyPicker, setShowEnergyPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todaySleepSec = useMemo(() => {
    const today = todayKey();
    return sleepHistory.filter(s => s.date === today).reduce((a, s) => a + (s.durationSec || 0), 0);
  }, [sleepHistory]);
  const avgSleepHours = useMemo(() => {
    if (sleepHistory.length === 0) return 0;
    const last7 = sleepHistory.slice(0, 7);
    return last7.reduce((a, s) => a + (s.durationSec || 0), 0) / 3600 / Math.min(7, last7.length);
  }, [sleepHistory]);

  const todaySleepHours = todaySleepSec / 3600;
  const hasTodaySleep = todaySleepSec > 0;
  const hasAnySleepHistory = sleepHistory.length > 0;
  const energyLevel = todayLog?.energyLevel ?? 0;
  const energyEmoji = energyLevel === 0 ? '➕' : energyLevel <= 1 ? '😫' : energyLevel === 2 ? '😦' : energyLevel === 3 ? '😐' : energyLevel === 4 ? '🙂' : '😄';
  const energyColor = energyLevel <= 2 ? '#dc2626' : energyLevel === 3 ? '#d97706' : '#16a34a';

  // Sleep tile tap = same semantics as the old sleep block
  const handleSleepTap = () => {
    if (activeSleep) return;
    if (hasAnySleepHistory) onOpenReport();
    else onOpenSleepLog();
  };

  // Sleep tile content by state
  const sleepTile = activeSleep
    ? { big: 'Sleeping', sub: 'logo to wake' }
    : hasTodaySleep
      ? { big: `${todaySleepHours.toFixed(1)}h`, sub: `avg ${avgSleepHours.toFixed(1)}h` }
      : todayLog
        ? { big: `${todayLog.sleepHours}h`, sub: 'manual' }
        : { big: '—', sub: hasAnySleepHistory ? 'tap for report' : 'tap to log' };

  return (
    <div
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(99,102,241,0.08), transparent 55%), color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid rgba(99,102,241,0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px]">🔋</span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.8px]" style={{ color: 'var(--foreground)' }}>Daily Vitals</span>
        <button
          onClick={() => onOpenPlan()}
          className="ml-auto text-[9px] px-2.5 py-1 rounded-full font-bold active:scale-95 transition"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}
        >
          Sleep Plan →
        </button>
      </div>

      {/* Three tiles */}
      <div className="grid grid-cols-3 gap-2">
        {/* Sleep tile */}
        <button
          onClick={handleSleepTap}
          onTouchStart={() => { longPressTimer.current = setTimeout(() => onOpenReport(), 500); }}
          onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onTouchCancel={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">
            {activeSleep ? (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: animate ? Infinity : 0 }}
                className="inline-block"
              >
                💤
              </motion.span>
            ) : '😴'}
          </div>
          <div className="text-[13px] font-extrabold leading-none tabular-nums" style={{ color: '#818cf8' }} suppressHydrationWarning>
            {sleepTile.big}
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Sleep</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>{sleepTile.sub}</div>
        </button>

        {/* Energy tile */}
        <button
          onClick={() => { vibrate(8); setShowEnergyPicker(v => !v); }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: showEnergyPicker ? `1px solid ${energyColor}55` : '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">{energyEmoji}</div>
          <div
            className="text-[13px] font-extrabold leading-none"
            style={{ color: energyLevel > 0 ? energyColor : 'var(--muted-foreground)' }}
            suppressHydrationWarning
          >
            {energyLevel > 0 ? energyLevel : '?'}<span className="text-[9px] font-bold" style={{ color: 'var(--muted-foreground)' }}>/5</span>
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Energy</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{energyLevel > 0 ? 'tap to adjust' : 'tap to rate'}</div>
        </button>

        {/* Doubts tile */}
        <button
          onClick={() => { vibrate(8); window.dispatchEvent(new CustomEvent('navigate-doubts')); }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">❓</div>
          <div
            className="text-[13px] font-extrabold leading-none tabular-nums"
            style={{ color: pendingDoubts > 0 ? '#d97706' : 'var(--foreground)' }}
            suppressHydrationWarning
          >
            {pendingDoubts}
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Doubts</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>{resolvedDoubts} solved</div>
        </button>
      </div>

      {/* Inline energy picker (slides open on energy tile tap) */}
      <AnimatePresence>
        {showEnergyPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 pt-2.5">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const current = todayLog?.energyLevel ?? 0;
                const isFilled = lvl <= current;
                const fillColor = lvl <= 2 ? '#dc2626' : lvl === 3 ? '#d97706' : '#16a34a';
                return (
                  <button
                    key={lvl}
                    onClick={() => {
                      vibrate(6);
                      setEnergy(lvl);
                      setShowEnergyPicker(false);
                    }}
                    className="flex-1 py-2 rounded-lg text-base transition active:scale-95"
                    style={{
                      background: isFilled ? `${fillColor}20` : 'var(--muted)',
                      border: isFilled ? `1px solid ${fillColor}40` : '1px solid var(--border)',
                    }}
                  >
                    {lvl <= 1 ? '😫' : lvl === 2 ? '😦' : lvl === 3 ? '😐' : lvl === 4 ? '🙂' : '😄'}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
   SUBJECT PULSE (REDESIGNED — was flat "Subject Health" list)
   1. Teal halo hero header + formula hint + average chip
   2. Per-subject colored halo icons (geometric shapes, matches Study tab)
   3. Gradient glow bars in each subject's own color
   4. Status chips (Strong / Steady / Needs work) + crown/warn badges
   5. Smart insight footer about weakest subject -> tap opens Syllabus
   ========================================================================= */
function SubjectPulseCard() {
  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const chapters = useSyllabus((s) => s.chapters);
  const subjects = useSyllabus((s) => s.subjects);
  const tests = useTests((s) => s.tests);
  const setTab = useNav((s) => s.setTab);

  const healthScores = useMemo(() => {
    const weightage: Record<string, number> = { Physics: 100, Chemistry: 100, Botany: 100, Zoology: 100, General: 0 };
    return getSubjectHealthScores(lectures, chapters, subjects, sessions, tests, weightage);
  }, [lectures, chapters, subjects, sessions, tests]);

  // Same visibility rule as the old card: scored subjects OR subjects with lectures
  const visible = useMemo(() => healthScores.filter(h => h.score > 0 || lectures.some(l => {
    const ch = chapters.find(c => c.id === l.chapterId);
    const subj = subjects.find(s => s.id === ch?.subjectId);
    return subj?.name === h.subject;
  })), [healthScores, lectures, chapters, subjects]);

  const scored = visible.filter(h => h.score > 0);
  const weakest = scored.length > 0 ? [...scored].sort((a, b) => a.score - b.score)[0] : null;
  const strongest = scored.length > 0 ? [...scored].sort((a, b) => b.score - a.score)[0] : null;
  const avg = scored.length > 0 ? Math.round(scored.reduce((a, h) => a + h.score, 0) / scored.length) : 0;

  const statusFor = (score: number) => {
    if (score >= 70) return { label: 'Strong', color: '#16a34a', bg: 'rgba(34,197,94,0.13)', border: 'rgba(34,197,94,0.30)' };
    if (score >= 40) return { label: 'Steady', color: '#d97706', bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.30)' };
    return { label: 'Needs work', color: '#dc2626', bg: 'rgba(239,68,68,0.13)', border: 'rgba(239,68,68,0.30)' };
  };

  const insight = (() => {
    if (weakest && weakest.score < 40) {
      return {
        emoji: '⚠️',
        text: `${weakest.subject} needs attention — your weakest subject (${weakest.score}). A focused session on it today would help.`,
        bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.22)',
      };
    }
    if (strongest && strongest.score >= 70) {
      return {
        emoji: '👑',
        text: `${strongest.subject} is leading with ${strongest.score} — keep the momentum.`,
        bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.22)',
      };
    }
    return {
      emoji: '📈',
      text: 'Scores update as you study, take tests and rate confidence.',
      bg: 'var(--muted)', border: 'var(--border)',
    };
  })();

  return (
    <div
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(20,184,166,0.08), transparent 55%), color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid rgba(20,184,166,0.30)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Hero header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0 text-[15px]"
          style={{
            background: 'radial-gradient(circle at 30% 25%, rgba(20,184,166,0.35), rgba(20,184,166,0.10))',
            boxShadow: '0 0 0 1px rgba(20,184,166,0.35), 0 4px 14px -4px rgba(20,184,166,0.4)',
          }}
        >
          🩺
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold" style={{ color: 'var(--foreground)' }}>Subject Pulse</div>
          <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>completion · confidence · time · tests</div>
        </div>
        {scored.length > 0 && (
          <span
            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: 'rgba(20,184,166,0.12)', color: '#0d9488', border: '1px solid rgba(20,184,166,0.30)' }}
            suppressHydrationWarning
          >
            avg {avg}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        /* Empty hint — no lectures & nothing scored yet */
        <button
          onClick={() => { vibrate(8); setTab('syllabus'); }}
          className="w-full rounded-xl p-3 text-center active:scale-[0.99] transition"
          style={{ background: 'var(--muted)', border: '1px dashed var(--border)' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Add syllabus lectures to unlock your pulse</div>
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Tap to open the Syllabus tab</div>
        </button>
      ) : (
        <>
          {/* Subject rows */}
          <div className="space-y-2.5">
            {visible.map((h, i) => {
              const color = subjectColor(h.subject);
              const st = statusFor(h.score);
              // Old thresholds kept (warn < 40, crown >= 70) + mutual exclusion so
              // a single subject can never wear both badges (ties on empty data)
              const isWeakest = scored.length > 1 && weakest?.subject === h.subject && strongest?.subject !== h.subject && h.score < 40;
              const isStrongest = scored.length > 1 && strongest?.subject === h.subject && weakest?.subject !== h.subject && h.score >= 70;
              return (
                <button
                  key={h.subject}
                  onClick={() => { vibrate(8); setTab('syllabus'); }}
                  className="w-full text-left active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color.hex}1f`, boxShadow: `0 0 0 1px ${color.hex}55` }}
                    >
                      <SubjectIcon subject={h.subject} color={color.hex} size={13} />
                    </div>
                    <span className="text-[11.5px] font-bold truncate" style={{ color: 'var(--foreground)' }}>{h.subject}</span>
                    {isWeakest && <span className="text-[10px] shrink-0">⚠️</span>}
                    {isStrongest && <span className="text-[10px] shrink-0">👑</span>}
                    <span
                      className="ml-auto text-[9px] font-extrabold px-2 py-[3px] rounded-full shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                      suppressHydrationWarning
                    >
                      {st.label} · {h.score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)', marginLeft: 34 }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                        boxShadow: h.score > 0 ? `0 0 8px ${color.hex}66` : 'none',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${h.score}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Smart insight footer */}
          <button
            onClick={() => { vibrate(8); setTab('syllabus'); }}
            className="mt-3 w-full rounded-xl p-2.5 flex items-start gap-2 text-left active:scale-[0.99] transition"
            style={{ background: insight.bg, border: `1px solid ${insight.border}` }}
          >
            <span className="text-[11px] leading-none mt-[2px] shrink-0">{insight.emoji}</span>
            <span className="flex-1 text-[10px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{insight.text}</span>
            <span className="text-[9px] font-bold shrink-0 self-center" style={{ color: 'var(--muted-foreground)' }}>→</span>
          </button>
        </>
      )}
    </div>
  );
}

/* === Subject shapes — same geometric language as the Study tab === */
function SubjectIcon({ subject, color, size = 13 }: { subject: Subject; color: string; size?: number }) {
  const shape = subject === 'Physics'
    ? <circle cx="8" cy="8" r="6" fill={color} />
    : subject === 'Chemistry'
      ? <rect x="2" y="2" width="12" height="12" rx="3" fill={color} />
      : subject === 'Botany'
        ? <path d="M8 2 L14 14 L2 14 Z" fill={color} />
        : subject === 'Zoology'
          ? <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color} />
          : <rect x="4" y="4" width="8" height="8" rx="1" fill={color} />;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
      {shape}
    </svg>
  );
}

/* =========================================================================
   SCHEDULE STRIP (REDESIGNED — was plain "Today's Schedule" text list)
   6. 6AM–12AM timeline rail with colored subject segments (matches Study tab)
      + pulsing "now" line
   7. Next-up row with gradient Start CTA that launches a real session
   ========================================================================= */
function ScheduleStrip({ slots }: { slots: TimetableSlot[] }) {
  const startSession = useSession((s) => s.startSession);
  const setFocusOpen = useSession((s) => s.setFocusOpen);
  const activeSession = useSession((s) => s.active);

  // 60s tick so the "now" line keeps moving
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      if (!document.hidden) tick(t => t + 1);
    }, 60000);
    return () => clearInterval(i);
  }, []);

  // 6 AM – 12 AM window (same as Study tab CurrentBlockCard)
  const DAY_START = 6;
  const DAY_HOURS = 18;
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const pct = (h: number) => ((h - DAY_START) / DAY_HOURS) * 100;
  const nowPct = pct(nowHour);

  const fmtTime = (h: number) => {
    const hr = ((h % 24) + 11) % 12 + 1;
    const ap = h < 12 || h >= 24 ? 'AM' : 'PM';
    return `${hr}:00 ${ap}`;
  };

  const current = slots.find(s => nowHour >= s.startHour && nowHour < s.endHour) || null;
  const next = slots.find(s => s.startHour > nowHour) || null;
  // Current block takes priority ("Now:"), otherwise fall forward to the
  // next upcoming block ("Next:"). When a block is live we show that one —
  // starting the currently-running block is the most relevant CTA.
  const featured = current || next;
  const featuredColor = featured ? subjectColor(featured.subject) : null;

  const handleStart = (slot: TimetableSlot) => {
    vibrate(12);
    startSession({
      targetId: null,
      subject: slot.subject,
      chapter: 'Timetable',
      topic: `${slot.subject} (scheduled)`,
      mode: 'focus',
      expectedMinutes: Math.round((slot.endHour - slot.startHour) * 60),
    });
    setFocusOpen(true);
  };

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: 'color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[13px]">📅</span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.8px]" style={{ color: 'var(--foreground)' }}>Today's Schedule</span>
        <span
          className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          {slots.length} block{slots.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline rail */}
      <div className="relative mx-1 mt-5 mb-1.5" suppressHydrationWarning>
        <div className="h-3.5 rounded-full relative overflow-hidden" style={{ background: 'var(--muted)' }}>
          {slots.map((slot) => {
            const color = subjectColor(slot.subject);
            const left = Math.max(0, pct(slot.startHour));
            const right = Math.min(100, pct(slot.endHour));
            const width = Math.max(0, right - left);
            if (width <= 0) return null;
            const isActive = current?.id === slot.id;
            return (
              <div
                key={slot.id}
                className="absolute top-0 h-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  borderRadius: 4,
                  background: `linear-gradient(180deg, ${color.hex}, ${color.hex}cc)`,
                  boxShadow: isActive ? `0 0 10px ${color.hex}` : 'none',
                }}
              />
            );
          })}
        </div>
        {/* Now line (inside window only) */}
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="absolute top-[-3px] bottom-[-3px] z-10"
            style={{ left: `${nowPct}%`, width: 2, background: 'var(--foreground)', boxShadow: '0 0 6px var(--foreground)', borderRadius: 1 }}
          >
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{ background: 'var(--foreground)', boxShadow: '0 0 8px var(--foreground)', animation: 'pulse-soft 1.6s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between px-1 text-[8px] font-bold" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
        <span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
      </div>

      {/* Next-up / now row */}
      {featured && featuredColor && (
        <div
          className="mt-3 rounded-xl p-2.5 flex items-center gap-2.5"
          style={{ background: 'var(--muted)', border: `1px solid ${featuredColor.hex}33` }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: featuredColor.hex,
              boxShadow: `0 0 6px ${featuredColor.hex}`,
              animation: current ? 'pulse-soft 1.6s ease-in-out infinite' : 'none',
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold leading-tight truncate" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
              {current ? 'Now: ' : 'Next: '}{featured.subject}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
              {current
                ? `until ${fmtTime(featured.endHour)}`
                : `at ${fmtTime(featured.startHour)} · ${featured.endHour - featured.startHour}h`}
            </div>
          </div>
          {!activeSession && (
            <button
              onClick={() => handleStart(featured)}
              className="px-3.5 py-1.5 rounded-full text-[10px] font-extrabold text-white shrink-0 active:scale-95 transition"
              style={{
                background: `linear-gradient(135deg, ${featuredColor.hex}, ${featuredColor.hex}cc)`,
                boxShadow: `0 4px 12px -2px ${featuredColor.hex}66`,
              }}
            >
              Start
            </button>
          )}
        </div>
      )}
    </div>
  );
}
