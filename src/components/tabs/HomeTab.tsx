'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Calendar, FileText, Clock } from 'lucide-react';
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
import { WeeklyGoalCard } from '@/components/home/WeeklyGoalCard';
import { NextTestCard, TestDayMode } from '@/components/home/NextTestCard';
import { useMounted } from '@/lib/hooks/useMounted';
import { CountUp } from '@/components/shared/CountUp';
import { NumberMorph } from '@/components/shared/NumberMorph';
import { StreakFlame } from '@/components/shared/StreakFlame';
import { useDailyLog } from '@/lib/store/dailyLog';
import { SleepLogSheet } from '@/components/dailylog/SleepLogSheet';
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

  // nextTest computation moved into the NextTestCard component (which also
  // handles Test Day Mode detection). HomeTab no longer needs direct access.

  const todaySlots = useMemo(() => {
    const today = new Date().getDay();
    return timetableSlots
      .filter((s) => s.day === today)
      .sort((a, b) => a.startHour - b.startHour);
  }, [timetableSlots]);

  const todayPct = Math.min(100, Math.round((todaySec / (dailyGoal * 3600)) * 100));
  const yestPct = Math.min(100, Math.round((yestSec / (dailyGoal * 3600)) * 100));

  const trendToday = yestSec > 0 ? Math.round(((todaySec - yestSec) / yestSec) * 100) : todaySec > 0 ? 100 : 0;
  const trendWeek = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

  const daysToExam = diffDays(todayKey(), examDate);
  const prepDay = prepStart ? diffDays(prepStart, todayKey()) + 1 : (sessions.length > 0 ? 1 : 0);
  const prepTotal = prepStart ? diffDays(prepStart, examDate) : 326;
  const prepPct = prepTotal > 0 ? Math.min(100, Math.round((prepDay / prepTotal) * 100)) : 0;

  return (
    <div className="pt-2 pb-4 space-y-4">
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
            animate={haptics ? { rotate: [0, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            whileHover={{ scale: 1.1 }}
          />
          <h1 className="text-xl font-bold">NEET 2027</h1>
        </button>
        {/* StreakFlame is gated behind `mounted` because `streak` is derived
            from persisted Zustand state (sessions) — 0 on server, real value
            on client after rehydration. Rendering conditionally without this
            guard causes a hydration mismatch. */}
        {mounted && <StreakFlame streak={streak} />}
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-sm text-white/50 -mt-2" suppressHydrationWarning>{longDate()}</motion.p>

      {/* Countdown Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
        className="glass rounded-2xl p-4 bg-gradient-to-br from-teal-500/10 to-green-500/5"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              {prepStart ? `Prep Day ${prepDay}` : 'Days to NEET'}
            </div>
            <CountUp
              value={daysToExam}
              duration={1000}
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
              initial={{ width: 0 }}
              animate={{ width: `${prepPct}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-teal-500 to-green-500"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Syllabus</span>
            <span className="tabular">{syllabusPct}% done</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${syllabusPct}%` }} />
          </div>
        </div>
      </motion.div>

      {/* Test Day Mode — only renders when today is a test day. Replaces
          the regular "Next Test" card (which returns null in this case) with
          a focused, calming test-day layout. */}
      <TestDayMode />

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      {/* Next Test — collapsible readiness card.
          On test day, NextTestCard returns null and TestDayMode renders instead
          (TestDayMode is placed above the Rings so it's the first thing seen). */}
      <NextTestCard />

      {/* === Study with Friend — compare with a friend === */}
      <PartnerCard />

      {/* === AI Study Coach === */}
      <CoachCard />

      {/* Today's Schedule */}
      {todaySlots.length > 0 && (
        <div className="glass rounded-2xl p-3 minimal-hide">
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
        </div>
      )}

      {/* Subject Health Scores */}
      <div className="minimal-hide"><SubjectHealthCard /></div>

      {/* Sleep & Energy + Doubts */}
      <div className="minimal-hide"><SleepAndDoubtCard /></div>

      {/* Weekly Goals */}
      <div className="minimal-hide"><WeeklyGoalCard /></div>

      {/* Predicted Score */}
      <ScorePredictionCard />

      {/* Achievement Badges */}
      <div className="minimal-hide"><AchievementBadges /></div>

      {/* Mini Heatmap */}
      <div className="minimal-hide"><MiniHeatmap /></div>

      {/* Sessions count */}
      <div className="glass rounded-2xl p-4 flex items-center justify-between minimal-hide">
        <div>
          <div className="text-xs text-white/50 mb-1">Total Sessions</div>
          <NumberMorph
            value={sessions.length}
            duration={700}
            className="text-2xl font-bold"
          />
        </div>
        <TrendingUp size={24} className="text-teal-400/60" />
      </div>
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
            initial={{ strokeDasharray: '0 263.89' }}
            animate={{ strokeDasharray: `${(outerPct / 100) * 263.89} 263.89` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <circle cx="48" cy="48" r="32" fill="none" stroke="var(--ring-track)" strokeWidth="4" />
          <motion.circle
            cx="48" cy="48" r="32" fill="none" stroke={innerColor} strokeWidth="4" strokeLinecap="round"
            initial={{ strokeDasharray: '0 201.06' }}
            animate={{ strokeDasharray: `${(innerPct / 100) * 201.06} 201.06` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
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

function SleepAndDoubtCard() {
  const todayLog = useDailyLog((s) => s.getToday());
  const [showSleep, setShowSleep] = useState(false);
  const pendingDoubts = useDoubts((s) => s.getPendingCount());
  const resolvedDoubts = useDoubts((s) => s.doubts.filter(d => d.status === 'resolved').length);
  // Real sleep data from the new sleep store
  const todaySleepSec = useSleep((s) => s.getDurationForDate(todayKey()));
  const avgSleepHours = useSleep((s) => s.getAverageHours(7));

  const todaySleepHours = todaySleepSec / 3600;
  const hasTodaySleep = todaySleepSec > 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowSleep(true)} className="glass rounded-2xl p-3 text-left hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">😴</span>
            <span className="text-[10px] font-bold text-white/50">Sleep</span>
          </div>
          {hasTodaySleep ? (
            <>
              <div className="text-lg font-bold tabular text-indigo-400">{todaySleepHours.toFixed(1)}h</div>
              <div className="text-[9px] text-white/40">7-day avg: {avgSleepHours.toFixed(1)}h</div>
            </>
          ) : todayLog ? (
            <>
              <div className="text-lg font-bold tabular text-indigo-400">{todayLog.sleepHours}h</div>
              <div className="text-[9px] text-white/40">{'⚡'.repeat(todayLog.energyLevel)} · manual</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-white/50">Log sleep</div>
              <div className="text-[9px] text-white/30">Tap banner to start</div>
            </>
          )}
        </button>
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">❓</span>
            <span className="text-[10px] font-bold text-white/50">Doubts</span>
          </div>
          <div className="text-lg font-bold tabular text-amber-400">{pendingDoubts}</div>
          <div className="text-[9px] text-white/40">pending · {resolvedDoubts} resolved</div>
        </div>
      </div>
      <AnimatePresence>
        {showSleep && <SleepLogSheet key="sleep" onClose={() => setShowSleep(false)} />}
      </AnimatePresence>
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
