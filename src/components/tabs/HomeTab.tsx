'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Calendar, FileText, Clock, Moon } from 'lucide-react';
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
// Fix #6: whileTap for all cards
const cardTap = { scale: 0.98 };
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useTimetable } from '@/lib/store/timetable';
import { useRecall } from '@/lib/store/recall';
import { formatHM, longDate, diffDays, todayKey, isRevisionOverdue, vibrate } from '@/lib/utils';
import { AchievementBadges } from '@/components/shared/AchievementBadges';
import { ScorePredictionCard } from '@/components/home/ScorePredictionCard';
import { MiniHeatmap } from '@/components/home/MiniHeatmap';
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
                background: 'linear-gradient(135deg, #14b8a6, #22c55e)',
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

      {/* Today's Schedule */}
      {todaySlots.length > 0 && (
        <motion.div {...cardEntrance} className="glass rounded-2xl p-3 minimal-hide">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Today's Schedule</span>
          </div>
          <div className="space-y-1">
            {todaySlots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 text-xs">
                <Clock size={12} style={{ color: 'var(--muted-foreground)' }} />
                <span className="tabular" style={{ color: 'var(--muted-foreground)' }}>{slot.startHour}:00 - {slot.endHour}:00</span>
                <span style={{ color: 'var(--foreground)' }}>{slot.subject}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Subject Health Scores */}
      <motion.div {...cardEntrance} className="minimal-hide"><SubjectHealthCard /></motion.div>

      {/* Sleep & Energy + Doubts — sheets are rendered at top level to avoid transform positioning issues */}
      <motion.div {...cardEntrance} className="minimal-hide">
        <SleepAndDoubtCard
          onOpenSleepLog={() => setShowSleepLog(true)}
          onOpenReport={() => setShowSleepReport(true)}
          onOpenPlan={() => setShowSleepPlan(true)}
        />
      </motion.div>

      {/* Weekly Goals — moved to Home tab long-press overlay */}

      {/* Predicted Score */}
      <motion.div {...cardEntrance}><ScorePredictionCard /></motion.div>

      {/* Achievement Badges */}
      <motion.div {...cardEntrance} className="minimal-hide"><AchievementBadges /></motion.div>

      {/* Mini Heatmap */}
      <motion.div {...cardEntrance} className="minimal-hide"><MiniHeatmap /></motion.div>

      {/* Sessions count */}
      <motion.div {...cardEntrance} className="glass rounded-2xl p-4 flex items-center justify-between minimal-hide">
        <div>
          <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Total Sessions</div>
          <NumberMorph
            key={sessions.length}
            value={sessions.length}
            duration={400}
            className="text-2xl font-bold"
          />
        </div>
        <TrendingUp size={24} className="text-teal-400/60" />
      </motion.div>
    </div>
  );
}

function RingComparison({
  title, innerSec, outerSec, innerPct, outerPct, trend, label, sublabel,
}: {
  title: string; innerSec: number; outerSec: number; innerPct: number; outerPct: number; trend: number; label: string; sublabel: string;
}) {
  const innerColor = trend >= 5 ? '#22c55e' : trend <= -5 ? '#ef4444' : '#f59e0b';
  const trendColor = trend >= 5 ? 'text-green-400' : trend <= -5 ? 'text-red-400' : 'text-amber-400';
  const trendArrow = trend >= 5 ? '↑' : trend <= -5 ? '↓' : '→';

  return (
    <div className="glass rounded-2xl p-3 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest mb-2 text-center" style={{ color: 'var(--muted-foreground)' }}>{title}</div>
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r="42" fill="none" stroke="var(--ring-track)" strokeWidth="4" />
          <motion.circle
            cx="48" cy="48" r="42" fill="none" stroke="var(--ring-outer)" strokeWidth="4" strokeLinecap="round"
            animate={{ strokeDasharray: `${(outerPct / 100) * 263.89} 263.89` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <circle cx="48" cy="48" r="32" fill="none" stroke="var(--ring-track)" strokeWidth="4" />
          <motion.circle
            cx="48" cy="48" r="32" fill="none" stroke={innerColor} strokeWidth="4" strokeLinecap="round"
            animate={{ strokeDasharray: `${(innerPct / 100) * 201.06} 201.06` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
          <div className="text-sm font-bold tabular">{formatHM(innerSec)}</div>
        </div>
      </div>
      <div className={`text-xs font-semibold mt-2 tabular ${trendColor}`}>
        {trendArrow} {trend > 0 ? '+' : ''}{trend}%
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sublabel}</div>
    </div>
  );
}

function SleepAndDoubtCard({ onOpenSleepLog, onOpenReport, onOpenPlan }: {
  onOpenSleepLog: () => void;
  onOpenReport: () => void;
  onOpenPlan: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  // FIXED: Subscribe to raw data (stable references) + compute derived values
  // in useMemo. Previous code called s.getToday(), s.getDurationForDate(),
  // s.getAverageHours(), s.doubts.filter() in the selector — these create
  // NEW values on every render, causing excessive re-renders.
  const dailyLogState = useDailyLog((s) => s);
  const todayLog = useMemo(() => dailyLogState.getToday(), [dailyLogState]);
  const allDoubts = useDoubts((s) => s.doubts);
  const pendingDoubts = useMemo(() => allDoubts.filter(d => d.status === 'pending').length, [allDoubts]);
  const resolvedDoubts = useMemo(() => allDoubts.filter(d => d.status === 'resolved').length, [allDoubts]);
  const sleepHistory = useSleep((s) => s.history);
  const activeSleep = useSleep((s) => s.activeSleep);
  const setEnergy = useDailyLog((s) => s.setEnergy);
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

  return (
    <>
      <div className="glass rounded-2xl p-3" style={{ border: '1px solid var(--border)' }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">😴</span>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Sleep & Energy</span>
          </div>
          <button
            onClick={() => onOpenPlan()}
            className="text-[9px] px-2 py-0.5 rounded-full font-semibold active:scale-95 transition"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}
          >
            Sleep Plan →
          </button>
        </div>

        {/* === Sleep block — tap to start sleep OR view report === */}
        <button
          onClick={() => {
            if (activeSleep) return;
            if (hasAnySleepHistory) onOpenReport();
            else onOpenSleepLog();
          }}
          onTouchStart={() => {
            longPressTimer.current = setTimeout(() => onOpenReport(), 500);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          }}
          onTouchCancel={() => {
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          }}
          className="w-full text-left rounded-xl p-2.5 transition mb-2 active:scale-[0.99]"
          style={{ background: 'var(--muted)' }}
        >
          {activeSleep ? (
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: animate ? Infinity : 0 }}
                className="text-xl"
              >🌙</motion.div>
              <div className="flex-1">
                <div className="text-xs font-semibold" style={{ color: '#6366f1' }}>Sleeping now…</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Tap NEET logo to wake · Long-press for report</div>
              </div>
            </div>
          ) : hasTodaySleep ? (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-bold tabular" style={{ color: '#6366f1' }}>{todaySleepHours.toFixed(1)}h today</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>7-day avg: {avgSleepHours.toFixed(1)}h · Long-press for report</div>
              </div>
              <Moon size={14} style={{ color: '#6366f1', opacity: 0.6 }} />
            </div>
          ) : todayLog ? (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-bold tabular" style={{ color: '#6366f1' }}>{todayLog.sleepHours}h (manual)</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Long-press for report</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tap NEET logo to sleep</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Long-press here for sleep report</div>
              </div>
              <Moon size={14} style={{ color: '#6366f1', opacity: 0.6 }} />
            </div>
          )}
        </button>

        {/* === Energy block === */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Energy</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{todayLog ? `last: ${todayLog.energyLevel}/5` : 'tap to rate'}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const current = todayLog?.energyLevel ?? 0;
            const isFilled = lvl <= current;
            const fillColor = lvl <= 2 ? '#dc2626' : lvl === 3 ? '#d97706' : '#16a34a';
            return (
              <button
                key={lvl}
                onClick={() => setEnergy(lvl)}
                className="flex-1 py-1.5 rounded-lg text-sm transition active:scale-95"
                style={{
                  background: isFilled ? `${fillColor}20` : 'var(--muted)',
                  color: isFilled ? fillColor : 'var(--muted-foreground)',
                  border: isFilled ? `1px solid ${fillColor}40` : '1px solid var(--border)',
                }}
              >
                {lvl <= 1 ? '😫' : lvl === 2 ? '😦' : lvl === 3 ? '😐' : lvl === 4 ? '🙂' : '😄'}
              </button>
            );
          })}
        </div>

        {/* Doubts mini-row */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('navigate-doubts'));
          }}
          className="w-full mt-2 flex items-center gap-2 rounded-lg p-2 transition"
          style={{ background: 'var(--muted)' }}
        >
          <span className="text-sm">❓</span>
          <span className="text-[10px] font-bold flex-1 text-left" style={{ color: 'var(--muted-foreground)' }}>Doubts</span>
          <span className="text-xs font-bold tabular" style={{ color: '#d97706' }}>{pendingDoubts}</span>
          <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>· {resolvedDoubts} resolved</span>
        </button>
      </div>
    </>
  );
}

function SubjectHealthCard() {
  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const chapters = useSyllabus((s) => s.chapters);
  const subjects = useSyllabus((s) => s.subjects);
  const tests = useTests((s) => s.tests);

  const healthScores = useMemo(() => {
    const weightage: Record<string, number> = { Physics: 100, Chemistry: 100, Botany: 100, Zoology: 100, General: 0 };
    return getSubjectHealthScores(lectures, chapters, subjects, sessions, tests, weightage);
  }, [lectures, chapters, subjects, sessions, tests]);

  const weakest = healthScores.filter(h => h.score > 0).sort((a, b) => a.score - b.score)[0];
  const strongest = healthScores.filter(h => h.score > 0).sort((a, b) => b.score - a.score)[0];

  return (
    <div className="glass rounded-2xl p-3" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🏥</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Subject Health</span>
      </div>
      <div className="space-y-2.5">
        {healthScores.filter(h => h.score > 0 || lectures.some(l => {
          const ch = chapters.find(c => c.id === l.chapterId);
          const subj = subjects.find(s => s.id === ch?.subjectId);
          return subj?.name === h.subject;
        })).map((h, i) => {
          const isWeakest = weakest?.subject === h.subject && h.score > 0 && h.score < 40;
          const isStrongest = strongest?.subject === h.subject && h.score >= 70;
          return (
            <div key={h.subject} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold w-16 shrink-0" style={{ color: 'var(--foreground)' }}>{h.subject}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden relative" style={{ background: 'var(--muted)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${h.color}, ${h.color}cc)`,
                    boxShadow: h.score > 0 ? `0 0 4px ${h.color}80` : 'none',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${h.score}%` }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                />
                {/* Glow overlay for strong subjects */}
                {isStrongest && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${h.color}20)`, width: `${h.score}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] font-bold tabular w-7 text-right" style={{ color: h.color }}>
                {h.score}
              </span>
              {isWeakest && <span className="text-[9px]">⚠</span>}
              {isStrongest && <span className="text-[9px]">👑</span>}
            </div>
          );
        })}
      </div>
      {weakest && weakest.score < 40 && (
        <p className="text-[10px] mt-2" style={{ color: '#dc2626' }}>⚠ {weakest.subject} needs urgent attention</p>
      )}
      {strongest && strongest.score >= 70 && (
        <p className="text-[10px] mt-1" style={{ color: '#16a34a' }}>👑 {strongest.subject} is your strongest subject</p>
      )}
    </div>
  );
}
