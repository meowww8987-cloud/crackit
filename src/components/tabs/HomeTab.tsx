'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Calendar, FileText, Brain, Clock, ChevronRight } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useTimetable } from '@/lib/store/timetable';
import { useRecall } from '@/lib/store/recall';
import { formatHM, longDate, diffDays, todayKey, isRevisionOverdue } from '@/lib/utils';
import { triggerRecallChallenge } from '@/components/app/AppShell';
import { AchievementBadges } from '@/components/shared/AchievementBadges';
import { ScorePredictionCard } from '@/components/home/ScorePredictionCard';
import { CountdownCard } from '@/components/home/CountdownCard';
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
  const syllabusLectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);
  const timetableSlots = useTimetable((s) => s.slots);
  const recallChallenges = useRecall((s) => s.challenges);

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

  const todayRecall = useMemo(
    () => recallChallenges.find((c) => c.date === todayKey()),
    [recallChallenges]
  );

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
        <div className="flex items-center gap-2">
          {/* NEET logo mark — replaces the generic Target icon for brand identity */}
          <img src="/logo.svg" alt="" className="w-7 h-7" />
          <h1 className="text-xl font-bold">NEET 2027</h1>
        </div>
        {/* StreakFlame is gated behind `mounted` because `streak` is derived
            from persisted Zustand state (sessions) — 0 on server, real value
            on client after rehydration. Rendering conditionally without this
            guard causes a hydration mismatch. */}
        {mounted && <StreakFlame streak={streak} />}
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-sm text-t-muted -mt-2" suppressHydrationWarning>{longDate()}</motion.p>

      {/* === Merged Countdown + Score Prediction Card === */}
      <CountdownCard />

      {/* Test Day Mode — only renders when today is a test day. */}
      <TestDayMode />

      {/* === Today/Yesterday + This Week/Last Week comparison rings === */}
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
          accent="teal"
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
          accent="violet"
        />
      </div>

      {/* === Study Partner — compact card, tap > for full comparison === */}
      <PartnerCard />

      {/* === AI Study Coach === */}
      <CoachCard />

      {/* Active Recall Challenge CTA */}
      {!todayRecall?.completedAt && (
        <button
          onClick={() => triggerRecallChallenge()}
          className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/[0.07] transition border border-amber-500/30 dark:border-amber-500/25"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <Brain size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">Daily Recall Challenge</div>
            <div className="text-[10px] text-t-muted">Test your memory of recent topics</div>
          </div>
          <ChevronRight size={16} className="text-t-muted" />
        </button>
      )}

      {/* Next Test — collapsible readiness card. */}
      <NextTestCard />

      {/* Today's Schedule */}
      {todaySlots.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-t-secondary">Today's Schedule</span>
          </div>
          <div className="space-y-1">
            {todaySlots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 text-xs">
                <Clock size={12} className="text-t-muted" />
                <span className="tabular text-t-secondary">{slot.startHour}:00 - {slot.endHour}:00</span>
                <span className="text-t-primary">{slot.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject Health Scores */}
      <SubjectHealthCard />

      {/* Sleep & Energy + Doubts */}
      <SleepAndDoubtCard />

      {/* Weekly Goals */}
      <WeeklyGoalCard />

      {/* Achievement Badges */}
      <AchievementBadges />

      {/* Mini Heatmap */}
      <MiniHeatmap />

      {/* Sessions count */}
      <div className="glass rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-t-secondary mb-1">Total Sessions</div>
          <NumberMorph
            value={sessions.length}
            duration={700}
            className="text-2xl font-bold"
          />
        </div>
        <TrendingUp size={24} className="text-teal-500/70 dark:text-teal-400/60" />
      </div>
    </div>
  );
}

function RingComparison({
  title, innerSec, outerSec, innerPct, outerPct, trend, label, sublabel, accent = 'teal',
}: {
  title: string; innerSec: number; outerSec: number; innerPct: number; outerPct: number; trend: number; label: string; sublabel: string;
  accent?: 'teal' | 'violet';
}) {
  const innerColor = trend >= 5 ? '#22c55e' : trend <= -5 ? '#ef4444' : '#f59e0b';
  const trendColor = trend >= 5 ? 'text-green-500 dark:text-green-400' : trend <= -5 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400';
  const trendArrow = trend >= 5 ? '↑' : trend <= -5 ? '↓' : '→';

  // Differentiate the two cards by outer-ring color and accent border so
  // they don't look identical (left=teal, right=violet).
  const outerRingColor = accent === 'teal' ? '#14b8a6' : '#8b5cf6';
  const accentBorder = accent === 'teal'
    ? 'border-teal-500/25 dark:border-teal-500/20'
    : 'border-violet-500/25 dark:border-violet-500/20';
  const labelColor = accent === 'teal'
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-violet-600 dark:text-violet-400';

  return (
    <div className={`glass rounded-2xl p-3 flex flex-col items-center border ${accentBorder}`}>
      <div className="text-[10px] uppercase tracking-widest text-t-muted mb-2 text-center">{title}</div>
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="4" />
          <motion.circle
            cx="48" cy="48" r="42" fill="none" stroke={outerRingColor} strokeWidth="4" strokeLinecap="round"
            initial={{ strokeDasharray: '0 263.89' }}
            animate={{ strokeDasharray: `${(outerPct / 100) * 263.89} 263.89` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <circle cx="48" cy="48" r="32" fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="4" />
          <motion.circle
            cx="48" cy="48" r="32" fill="none" stroke={innerColor} strokeWidth="4" strokeLinecap="round"
            initial={{ strokeDasharray: '0 201.06' }}
            animate={{ strokeDasharray: `${(innerPct / 100) * 201.06} 201.06` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-[9px] font-bold ${labelColor}`}>{label}</div>
          <div className="text-sm font-bold tabular text-t-primary">{formatHM(innerSec)}</div>
        </div>
      </div>
      <div className={`text-xs font-semibold mt-2 tabular ${trendColor}`}>
        {trendArrow} {trend > 0 ? '+' : ''}{trend}%
      </div>
      <div className="text-[10px] text-t-muted mt-0.5">{sublabel}</div>
    </div>
  );
}

function SleepAndDoubtCard() {
  const todayLog = useDailyLog((s) => s.getToday());
  const [showSleep, setShowSleep] = useState(false);
  const pendingDoubts = useDoubts((s) => s.getPendingCount());
  const resolvedDoubts = useDoubts((s) => s.doubts.filter(d => d.status === 'resolved').length);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowSleep(true)} className="glass rounded-2xl p-3 text-left hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">😴</span>
            <span className="text-[10px] font-bold text-t-secondary">Sleep</span>
          </div>
          {todayLog ? (
            <>
              <div className="text-lg font-bold tabular text-indigo-500 dark:text-indigo-400">{todayLog.sleepHours}h</div>
              <div className="text-[9px] text-t-muted">{'⚡'.repeat(todayLog.energyLevel)}</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-t-secondary">Log sleep</div>
              <div className="text-[9px] text-t-muted">Tap to log</div>
            </>
          )}
        </button>
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">❓</span>
            <span className="text-[10px] font-bold text-t-secondary">Doubts</span>
          </div>
          <div className="text-lg font-bold tabular text-amber-500 dark:text-amber-400">{pendingDoubts}</div>
          <div className="text-[9px] text-t-muted">pending · {resolvedDoubts} resolved</div>
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
        <span className="text-xs font-bold text-t-secondary">Subject Health</span>
      </div>
      <div className="space-y-2">
        {healthScores.filter(h => h.score > 0 || lectures.some(l => {
          const ch = chapters.find(c => c.id === l.chapterId);
          const subj = subjects.find(s => s.id === ch?.subjectId);
          return subj?.name === h.subject;
        })).map((h, i) => (
          <div key={h.subject} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-t-secondary w-16 shrink-0">{h.subject}</span>
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
