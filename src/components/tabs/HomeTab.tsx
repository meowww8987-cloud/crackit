'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Calendar, FileText, Clock, Moon } from 'lucide-react';

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

export function HomeTab() {
  // Hydration guard — gates rendering of any UI derived from persisted
  // Zustand state (sessions, tests, syllabus) so server and first client
  // render produce identical HTML.
  const mounted = useMounted();

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

  // Compute derived values with useMemo
  const todaySec = useMemo(() => {
    const today = todayKey();
    return sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);
  }, [sessions]);

  const yestSec = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return sessions.filter((s) => s.date === y).reduce((a, s) => a + s.studySeconds, 0);
  }, [sessions]);

  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return sessions.filter((s) => s.endedAt >= weekAgo).reduce((a, s) => a + s.studySeconds, 0);
  }, [sessions]);

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
  const [dateText, setDateText] = useState('');
  useEffect(() => {
    const update = () => setDateText(longDate());
    update();
    const interval = setInterval(update, 60000);
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

      {/* Mission Control Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between">
        {/* NEET logo + title — TAPPING THE LOGO starts sleep mode.
            The logo is the universal sleep trigger (no extra banner needed).
            Long-press the logo to open the manual sleep log sheet. */}
        <button
          onClick={() => {
            if (activeSleep) return; // already sleeping — lock screen handles it
            if (haptics) vibrate(12);
            // Request notification permission if not granted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
            startSleep();
          }}
          className="flex items-center gap-2 group active:scale-[0.97] transition"
          title="Tap to start sleep mode"
          aria-label="Tap logo to start sleep mode"
        >
          <motion.img
            src="/logo.svg"
            alt=""
            className="w-7 h-7"
            whileTap={haptics ? { scale: 0.92, rotate: -3 } : {}}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.25 }}
          />
          <h1 className="text-xl font-bold">NEET 2027</h1>
        </button>
        {/* StreakFlame is gated behind `mounted` because `streak` is derived
            from persisted Zustand state (sessions) — 0 on server, real value
            on client after rehydration. Rendering conditionally without this
            guard causes a hydration mismatch. */}
        {mounted && <StreakFlame streak={streak} />}
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-sm text-white/50 -mt-2" suppressHydrationWarning>{dateText}</motion.p>

      {/* Countdown Card */}
      <motion.div
        {...cardEntrance}
        whileTap={cardTap}
        className="glass rounded-2xl p-4 bg-gradient-to-br from-teal-500/10 to-green-500/5"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              {prepStart ? `Prep Day ${prepDay}` : 'Days to NEET'}
            </div>
            <CountUp
              value={daysToExam}
              duration={1200}
              className="text-4xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent"
            />
            <div className="text-xs text-white/50">days left</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">
              EXAM {new Date(examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {prepStart && (
              <div className="text-[10px] text-white/40 mt-0.5">
                Since {new Date(prepStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-white/40 mb-1 tabular">
            <span>Day {prepDay} of {prepTotal}</span>
            <span>{prepPct}% elapsed</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              animate={{ width: `${prepPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-teal-500 to-green-500"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Syllabus</span>
            <span className="tabular">
              {syllabusPct}% done
              {syllabusWeightedPct !== syllabusPct && (
                <span className="text-amber-400/70 ml-1">· {syllabusWeightedPct}% weighted</span>
              )}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${syllabusPct}%` }} />
          </div>
          {syllabusWeightedPct !== syllabusPct && (
            <div className="text-[8px] text-amber-400/50 mt-0.5">
              {syllabusWeightedPct < syllabusPct
                ? `Focus on high-weightage chapters — you're ${syllabusPct - syllabusWeightedPct}% ahead on easy ones`
                : `Great — high-weightage chapters are ahead (${syllabusWeightedPct - syllabusPct}% ahead)`}
            </div>
          )}
        </div>
      </motion.div>

      {/* Test Day Mode — only renders when today is a test day. Replaces
          the regular "Next Test" card (which returns null in this case) with
          a focused, calming test-day layout. */}
      <motion.div {...cardEntrance}><TestDayMode /></motion.div>

      <motion.div {...cardEntrance} className="grid grid-cols-2 gap-3">
        <RingComparison
          title="Today vs Yesterday"
          innerSec={todaySec}
          outerSec={yestSec}
          innerPct={todayPct}
          outerPct={yestPct}
          trend={trendToday}
          label="TODAY"
          sublabel={`Yesterday: ${formatHM(yestSec)}`}
        />
        <RingComparison
          title="This Week vs Last"
          innerSec={thisWeek}
          outerSec={lastWeek}
          innerPct={Math.min(100, Math.round((thisWeek / (dailyGoal * 3600 * 7)) * 100))}
          outerPct={Math.min(100, Math.round((lastWeek / (dailyGoal * 3600 * 7)) * 100))}
          trend={trendWeek}
          label="WEEK"
          sublabel={`Last: ${formatHM(lastWeek)}`}
        />
      </motion.div>

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
            <span className="text-xs font-bold uppercase tracking-wide text-white/60">Today's Schedule</span>
          </div>
          <div className="space-y-1">
            {todaySlots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 text-xs">
                <Clock size={12} className="text-white/40" />
                <span className="tabular text-white/60">{slot.startHour}:00 - {slot.endHour}:00</span>
                <span className="text-white/80">{slot.subject}</span>
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
          <div className="text-xs text-white/50 mb-1">Total Sessions</div>
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
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2 text-center">{title}</div>
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
          <div className="text-[9px] text-white/40">{label}</div>
          <div className="text-sm font-bold tabular">{formatHM(innerSec)}</div>
        </div>
      </div>
      <div className={`text-xs font-semibold mt-2 tabular ${trendColor}`}>
        {trendArrow} {trend > 0 ? '+' : ''}{trend}%
      </div>
      <div className="text-[10px] text-white/40 mt-0.5">{sublabel}</div>
    </div>
  );
}

function SleepAndDoubtCard({ onOpenSleepLog, onOpenReport, onOpenPlan }: {
  onOpenSleepLog: () => void;
  onOpenReport: () => void;
  onOpenPlan: () => void;
}) {
  const todayLog = useDailyLog((s) => s.getToday());
  const pendingDoubts = useDoubts((s) => s.getPendingCount());
  const resolvedDoubts = useDoubts((s) => s.doubts.filter(d => d.status === 'resolved').length);
  // Real sleep data from the new sleep store
  const todaySleepSec = useSleep((s) => s.getDurationForDate(todayKey()));
  const avgSleepHours = useSleep((s) => s.getAverageHours(7));
  const sleepHistory = useSleep((s) => s.history);
  const activeSleep = useSleep((s) => s.activeSleep);
  const setEnergy = useDailyLog((s) => s.setEnergy);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todaySleepHours = todaySleepSec / 3600;
  const hasTodaySleep = todaySleepSec > 0;
  const hasAnySleepHistory = sleepHistory.length > 0;

  return (
    <>
      <div className="glass rounded-2xl p-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">😴</span>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">Sleep & Energy</span>
          </div>
          <button
            onClick={() => onOpenPlan()}
            className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold active:scale-95 transition"
          >
            Sleep Plan →
          </button>
        </div>

        {/* === Sleep block — tap to start sleep OR view report if has history === */}
        <button
          onClick={() => {
            // If active sleep → no-op (lock screen handles it)
            if (activeSleep) return;
            // If has sleep history → open report; else open manual log
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
          className="w-full text-left rounded-xl p-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition mb-2 active:scale-[0.99]"
        >
          {activeSleep ? (
            <div className="flex items-center gap-2">
              <div className="text-xl">🌙</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-indigo-300">Sleeping now…</div>
                <div className="text-[9px] text-white/40">Tap NEET logo to wake · Long-press for report</div>
              </div>
            </div>
          ) : hasTodaySleep ? (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-bold tabular text-indigo-300">{todaySleepHours.toFixed(1)}h today</div>
                <div className="text-[9px] text-white/40">7-day avg: {avgSleepHours.toFixed(1)}h · Long-press for report</div>
              </div>
              <Moon size={14} className="text-indigo-400/60" />
            </div>
          ) : todayLog ? (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-bold tabular text-indigo-300">{todayLog.sleepHours}h (manual)</div>
                <div className="text-[9px] text-white/40">Long-press for report</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-xl">😴</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white/60">Tap NEET logo to sleep</div>
                <div className="text-[9px] text-white/40">Long-press here for sleep report</div>
              </div>
              <Moon size={14} className="text-indigo-400/60" />
            </div>
          )}
        </button>

        {/* === Energy block — quick 1-5 energy level picker === */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-wide">Energy</span>
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[9px] text-white/30">{todayLog ? `last: ${todayLog.energyLevel}/5` : 'tap to rate'}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const current = todayLog?.energyLevel ?? 0;
            const isFilled = lvl <= current;
            return (
              <button
                key={lvl}
                onClick={() => setEnergy(lvl)}
                className="flex-1 py-1.5 rounded-lg text-sm transition active:scale-95"
                style={{
                  background: isFilled
                    ? `rgba(${lvl <= 2 ? '239,68,68' : lvl === 3 ? '245,158,11' : '34,197,94'},0.18)`
                    : 'rgba(255,255,255,0.03)',
                  color: isFilled
                    ? (lvl <= 2 ? '#f87171' : lvl === 3 ? '#fbbf24' : '#4ade80')
                    : 'rgba(255,255,255,0.3)',
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
            // navigate to doubts (handled by AppShell via custom event)
            window.dispatchEvent(new CustomEvent('navigate-doubts'));
          }}
          className="w-full mt-2 flex items-center gap-2 rounded-lg p-2 bg-white/[0.02] hover:bg-white/[0.05] transition"
        >
          <span className="text-sm">❓</span>
          <span className="text-[10px] font-bold text-white/50 flex-1 text-left">Doubts</span>
          <span className="text-xs font-bold tabular text-amber-400">{pendingDoubts}</span>
          <span className="text-[9px] text-white/30">· {resolvedDoubts} resolved</span>
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

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🏥</span>
        <span className="text-xs font-bold text-white/70">Subject Health</span>
      </div>
      <div className="space-y-2">
        {healthScores.filter(h => h.score > 0 || lectures.some(l => {
          const ch = chapters.find(c => c.id === l.chapterId);
          const subj = subjects.find(s => s.id === ch?.subjectId);
          return subj?.name === h.subject;
        })).map((h, i) => (
          <div key={h.subject} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-white/60 w-16 shrink-0">{h.subject}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: h.color }}
                initial={{ width: 0 }}
                animate={{ width: `${h.score}%` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              />
            </div>
            <span className="text-[10px] font-bold tabular w-7 text-right" style={{ color: h.color }}>{h.score}</span>
          </div>
        ))}
      </div>
      {weakest && weakest.score < 40 && (
        <p className="text-[10px] text-red-400 mt-2">⚠ {weakest.subject} needs urgent attention</p>
      )}
    </div>
  );
}
