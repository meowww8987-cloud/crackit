'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Calendar, X, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CountUp } from '@/components/shared/CountUp';
import { vibrate, cn } from '@/lib/utils';

/**
 * CountdownCard — modern NEET countdown card with circular progress ring.
 *
 * RING = 365-day prep countdown
 *  - Ring shows how much of the 365-day prep period (before exam) has elapsed
 *  - Calculated from (examDate - 365 days) to today
 *  - E.g. if 146 days passed out of 365 → ring is 40% filled
 *
 * PACE = study-time based (NOT syllabus based)
 *  - avgStudyHours = total study hours / days since prep start
 *  - ratio = avgStudyHours / dailyGoalHours
 *  - ratio ≥ 1.0 → Excellent (green)
 *  - ratio 0.75-0.99 → On track (green)
 *  - ratio 0.50-0.74 → Slightly behind (amber)
 *  - ratio 0.25-0.49 → Behind (orange)
 *  - ratio < 0.25 → Very poor (red)
 *
 * CARD shows:
 *  - Ring (365-day elapsed %)
 *  - Big days-left number (urgency-colored)
 *  - Exam date
 *  - Day X of Y + urgency label
 *  - Prep Timeline (compact, with "You are here" marker)
 *  - Pace indicator (study-based) + days studied
 *
 * DETAIL SHEET shows:
 *  - Big countdown
 *  - 4 stat cards (Prep Day / Pace / Syllabus % / Weighted %)
 *  - Full timeline with dates
 *  - Smart insights (including study pace analysis)
 */

interface Props {
  daysToExam: number;
  examDate: string;
  prepStart: string | null;
  prepDay: number;
  prepTotal: number;
  prepPct: number;
  syllabusPct: number;
  syllabusWeightedPct: number;
  daysStudied: number;
  dailyGoalHours: number;
  avgStudyHours: number; // total study hours / prep days
  totalStudyHours: number;
}

function getUrgencyColor(days: number): { color: string; label: string; ringColor: string } {
  if (days >= 200) return { color: '#14b8a6', label: 'Plenty of time', ringColor: '#14b8a6' };
  if (days >= 100) return { color: '#22c55e', label: 'On track', ringColor: '#22c55e' };
  if (days >= 50) return { color: '#f59e0b', label: 'Focus up', ringColor: '#f59e0b' };
  if (days >= 30) return { color: '#f97316', label: 'Getting serious', ringColor: '#f97316' };
  return { color: '#ef4444', label: 'Crunch time!', ringColor: '#ef4444' };
}

function getPaceInfo(ratio: number): { label: string; color: string; key: string } {
  if (ratio >= 1.0) return { label: 'Excellent', color: '#22c55e', key: 'excellent' };
  if (ratio >= 0.75) return { label: 'On track', color: '#22c55e', key: 'on-track' };
  if (ratio >= 0.50) return { label: 'Slightly behind', color: '#f59e0b', key: 'slightly-behind' };
  if (ratio >= 0.25) return { label: 'Behind', color: '#f97316', key: 'behind' };
  return { label: 'Very poor', color: '#ef4444', key: 'very-poor' };
}

export function CountdownCard({
  daysToExam,
  examDate,
  prepStart,
  prepDay,
  prepTotal,
  prepPct,
  syllabusPct,
  syllabusWeightedPct,
  daysStudied,
  dailyGoalHours,
  avgStudyHours,
  totalStudyHours,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const urgency = getUrgencyColor(daysToExam);
  const examDateObj = new Date(examDate + 'T00:00:00');
  const examDateStr = examDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const examWeekday = examDateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // === 365-day prep ring ===
  // Ring shows how much of the 365-day period (before exam) has elapsed.
  // Start = examDate - 365 days. End = examDate.
  // elapsedDays = days from start to today.
  // ringPct = elapsedDays / 365 * 100 (capped at 100).
  const prep365Start = useMemo(() => {
    const d = new Date(examDate + 'T00:00:00');
    d.setDate(d.getDate() - 365);
    return d;
  }, [examDate]);

  const elapsed365Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - prep365Start.getTime();
    return Math.max(0, Math.min(365, Math.floor(diffMs / 86400000)));
  }, [prep365Start]);

  const ringPct = Math.min(100, Math.round((elapsed365Days / 365) * 100));

  // === Study-based pace ===
  const paceRatio = dailyGoalHours > 0 ? avgStudyHours / dailyGoalHours : 0;
  const paceInfo = getPaceInfo(paceRatio);

  // Ring dimensions
  const ringSize = 72;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringOffset = circumference - (ringPct / 100) * circumference;

  // Timeline milestones (based on 365-day period)
  const milestones = useMemo(() => {
    return [25, 50, 75].map((pct) => {
      const daysFromStart = Math.round((365 * pct) / 100);
      const date = new Date(prep365Start);
      date.setDate(date.getDate() + daysFromStart);
      return {
        pct,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        passed: ringPct >= pct,
      };
    });
  }, [prep365Start, ringPct]);

  const startDateStr = prep365Start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => { vibrate(8); setShowDetail(true); }}
        className="glass rounded-2xl p-4 cursor-pointer select-none"
        style={{
          background: 'linear-gradient(135deg, var(--card), color-mix(in srgb, var(--card) 90%, ' + urgency.color + '10))',
        }}
      >
        {/* Top row: Ring + Big number */}
        <div className="flex items-center gap-4 mb-3">
          {/* Circular progress ring — 365-day elapsed */}
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={strokeWidth}
              />
              <motion.circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={urgency.ringColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                whileInView={{ strokeDashoffset: ringOffset }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 3px ${urgency.ringColor}80)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold tabular" style={{ color: urgency.color }}>
                {ringPct}%
              </span>
              <span className="text-[7px] uppercase" style={{ color: 'var(--muted-foreground)' }}>
                of 365d
              </span>
            </div>
          </div>

          {/* Big number + context */}
          <div className="flex-1 min-w-0">
            <CountUp
              value={daysToExam}
              duration={1200}
              className="text-4xl font-bold tabular leading-none"
              style={{ color: urgency.color }}
            />
            <div className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              days to NEET
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              <Calendar size={10} style={{ color: urgency.color }} />
              <span>{examDateStr}</span>
            </div>
          </div>
        </div>

        {/* Elapsed info */}
        <div className="flex items-center justify-between text-[10px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <span>{elapsed365Days}/365 days elapsed</span>
          <span className="font-semibold" style={{ color: urgency.color }}>
            {urgency.label}
          </span>
        </div>

        {/* Compact Prep Timeline */}
        <div className="mb-3">
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Prep Timeline
          </div>
          <div className="relative px-1">
            {/* Timeline line */}
            <div className="absolute left-1 right-1 top-2 h-0.5" style={{ background: 'var(--muted)' }} />
            {/* Progress portion */}
            <div
              className="absolute left-1 top-2 h-0.5"
              style={{ width: `calc((100% - 8px) * ${ringPct / 100})`, background: urgency.color }}
            />
            {/* Milestones */}
            <div className="relative flex justify-between">
              {/* Start */}
              <div className="flex flex-col items-center" style={{ width: '20%' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: urgency.color }} />
                <span className="text-[7px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{startDateStr}</span>
              </div>
              {/* 25/50/75 milestones */}
              {milestones.map((m) => (
                <div key={m.pct} className="flex flex-col items-center" style={{ width: '20%' }}>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: m.passed ? urgency.color : 'var(--muted)',
                      border: ringPct >= m.pct - 3 && ringPct <= m.pct + 3 ? `1.5px solid ${urgency.color}` : 'none',
                    }}
                  />
                  <span className="text-[7px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.pct}%</span>
                </div>
              ))}
              {/* Exam */}
              <div className="flex flex-col items-center" style={{ width: '20%' }}>
                <div className="w-3 h-3 rounded-full" style={{ border: `1.5px solid var(--muted-foreground)` }} />
                <span className="text-[7px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{examDateStr}</span>
              </div>
            </div>
            {/* "You are here" marker */}
            <div
              className="absolute top-0"
              style={{ left: `calc(4px + (100% - 8px) * ${ringPct / 100})`, transform: 'translateX(-50%)' }}
            >
              <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent" style={{ borderTopColor: urgency.color }} />
            </div>
          </div>
        </div>

        {/* Pace indicator (study-based) */}
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px]"
          style={{ background: `${paceInfo.color}15` }}
        >
          <div className="flex items-center gap-1">
            {paceInfo.key === 'excellent' || paceInfo.key === 'on-track' ? (
              <CheckCircle2 size={11} style={{ color: paceInfo.color }} />
            ) : (
              <AlertTriangle size={11} style={{ color: paceInfo.color }} />
            )}
            <span className="font-bold" style={{ color: paceInfo.color }}>{paceInfo.label}</span>
          </div>
          <span style={{ color: 'var(--muted-foreground)' }}>
            {avgStudyHours.toFixed(1)}h/{dailyGoalHours}h avg
          </span>
        </div>
      </motion.div>

      {/* Detail sheet */}
      <AnimatePresence>
        {showDetail && (
          <CountdownDetailSheet
            daysToExam={daysToExam}
            examDate={examDate}
            examDateStr={examDateStr}
            examWeekday={examWeekday}
            prepStart={prepStart}
            prepDay={prepDay}
            prepTotal={prepTotal}
            prepPct={prepPct}
            syllabusPct={syllabusPct}
            syllabusWeightedPct={syllabusWeightedPct}
            daysStudied={daysStudied}
            urgency={urgency}
            paceInfo={paceInfo}
            paceRatio={paceRatio}
            dailyGoalHours={dailyGoalHours}
            avgStudyHours={avgStudyHours}
            totalStudyHours={totalStudyHours}
            elapsed365Days={elapsed365Days}
            ringPct={ringPct}
            milestones={milestones}
            startDateStr={startDateStr}
            onClose={() => setShowDetail(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// Detail Sheet
// =====================================================

function CountdownDetailSheet({
  daysToExam,
  examDate,
  examDateStr,
  examWeekday,
  prepStart,
  prepDay,
  prepTotal,
  prepPct,
  syllabusPct,
  syllabusWeightedPct,
  daysStudied,
  urgency,
  paceInfo,
  paceRatio,
  dailyGoalHours,
  avgStudyHours,
  totalStudyHours,
  elapsed365Days,
  ringPct,
  milestones,
  startDateStr,
  onClose,
}: {
  daysToExam: number;
  examDate: string;
  examDateStr: string;
  examWeekday: string;
  prepStart: string | null;
  prepDay: number;
  prepTotal: number;
  prepPct: number;
  syllabusPct: number;
  syllabusWeightedPct: number;
  daysStudied: number;
  urgency: { color: string; label: string; ringColor: string };
  paceInfo: { label: string; color: string; key: string };
  paceRatio: number;
  dailyGoalHours: number;
  avgStudyHours: number;
  totalStudyHours: number;
  elapsed365Days: number;
  ringPct: number;
  milestones: { pct: number; date: string; passed: boolean }[];
  startDateStr: string;
  onClose: () => void;
}) {
  // Insights
  const insights = useMemo(() => {
    const list: string[] = [];
    list.push(`${elapsed365Days} of 365 prep days elapsed (${ringPct}%).`);

    // Study pace insight
    if (paceRatio >= 1.0) {
      list.push(`Averaging ${avgStudyHours.toFixed(1)}h/day vs ${dailyGoalHours}h goal — excellent! 🎉`);
    } else if (paceRatio >= 0.75) {
      list.push(`Averaging ${avgStudyHours.toFixed(1)}h/day vs ${dailyGoalHours}h goal — on track!`);
    } else if (paceRatio >= 0.50) {
      list.push(`Averaging ${avgStudyHours.toFixed(1)}h/day vs ${dailyGoalHours}h goal — slightly behind.`);
    } else if (paceRatio >= 0.25) {
      list.push(`Averaging ${avgStudyHours.toFixed(1)}h/day vs ${dailyGoalHours}h goal — behind schedule.`);
    } else {
      list.push(`Averaging ${avgStudyHours.toFixed(1)}h/day vs ${dailyGoalHours}h goal — very poor. Need to study more!`);
    }

    // Catch-up calculation
    if (paceRatio < 1.0 && daysToExam > 0) {
      const neededAvg = (dailyGoalHours * 365 - totalStudyHours) / daysToExam;
      if (neededAvg > dailyGoalHours) {
        list.push(`To hit your goal, study ${neededAvg.toFixed(1)}h/day for remaining ${daysToExam} days.`);
      }
    }

    // Syllabus insight
    if (syllabusPct > 0) {
      list.push(`Syllabus: ${syllabusPct}% done${syllabusWeightedPct !== syllabusPct ? ` · ${syllabusWeightedPct}% weighted` : ''}.`);
    }

    // Next milestone
    const nextMilestone = milestones.find((m) => !m.passed);
    if (nextMilestone) {
      list.push(`Next milestone: ${nextMilestone.pct}% (${nextMilestone.date}).`);
    }

    return list;
  }, [elapsed365Days, ringPct, paceRatio, avgStudyHours, dailyGoalHours, daysToExam, totalStudyHours, syllabusPct, syllabusWeightedPct, milestones]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{ background: `${urgency.color}20`, border: `1px solid ${urgency.color}40` }}
          >
            <Target size={24} style={{ color: urgency.color }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            NEET 2027 Countdown
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {examWeekday}, {examDateStr}
          </p>
        </div>

        {/* Big countdown */}
        <div
          className="rounded-2xl p-4 mb-4 text-center"
          style={{ background: `${urgency.color}10`, border: `1px solid ${urgency.color}30` }}
        >
          <div className="text-5xl font-bold tabular" style={{ color: urgency.color }}>
            {daysToExam}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            days left
          </div>
          <div className="text-[10px] mt-1" style={{ color: urgency.color }}>
            {urgency.label}
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard
            icon={<Clock size={12} style={{ color: '#14b8a6' }} />}
            label="365d Elapsed"
            value={`${elapsed365Days}/365`}
            color="#14b8a6"
          />
          <StatCard
            icon={paceInfo.key === 'excellent' || paceInfo.key === 'on-track' ? <CheckCircle2 size={12} style={{ color: paceInfo.color }} /> : <AlertTriangle size={12} style={{ color: paceInfo.color }} />}
            label="Study Pace"
            value={paceInfo.label}
            color={paceInfo.color}
          />
          <StatCard
            icon={<TrendingUp size={12} style={{ color: '#22c55e' }} />}
            label="Syllabus"
            value={`${syllabusPct}%`}
            color="#22c55e"
          />
          <StatCard
            icon={<Target size={12} style={{ color: '#f59e0b' }} />}
            label="Weighted"
            value={`${syllabusWeightedPct}%`}
            color="#f59e0b"
          />
        </div>

        {/* Study pace detail */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: `${paceInfo.color}10`, border: `1px solid ${paceInfo.color}30` }}
        >
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Study Pace Analysis
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                {avgStudyHours.toFixed(1)}h
              </div>
              <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>Your avg/day</div>
            </div>
            <div>
              <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                {dailyGoalHours}h
              </div>
              <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>Daily goal</div>
            </div>
            <div>
              <div className="text-sm font-bold tabular" style={{ color: paceInfo.color }}>
                {Math.round(paceRatio * 100)}%
              </div>
              <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>Of goal</div>
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, paceRatio * 100)}%`, background: paceInfo.color }}
            />
          </div>
          <div className="text-[9px] mt-1 text-center" style={{ color: 'var(--muted-foreground)' }}>
            Total: {totalStudyHours.toFixed(1)}h studied · {daysStudied} active days
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-4">
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            365-Day Prep Timeline
          </div>
          <div className="relative px-2">
            <div className="absolute left-2 right-2 top-2 h-0.5" style={{ background: 'var(--muted)' }} />
            <div
              className="absolute left-2 top-2 h-0.5"
              style={{ width: `calc((100% - 16px) * ${ringPct / 100})`, background: urgency.color }}
            />
            <div className="relative flex justify-between">
              <div className="flex flex-col items-center" style={{ width: '20%' }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: urgency.color }}>
                  <CheckCircle2 size={10} className="text-white" />
                </div>
                <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>Start</span>
                <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>{startDateStr}</span>
              </div>
              {milestones.map((m) => (
                <div key={m.pct} className="flex flex-col items-center" style={{ width: '20%' }}>
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{
                      background: m.passed ? urgency.color : 'var(--muted)',
                      border: ringPct >= m.pct - 3 && ringPct <= m.pct + 3 ? `2px solid ${urgency.color}` : 'none',
                    }}
                  >
                    {m.passed && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>{m.pct}%</span>
                  <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>{m.date}</span>
                </div>
              ))}
              <div className="flex flex-col items-center" style={{ width: '20%' }}>
                <div className="w-4 h-4 rounded-full" style={{ border: `2px solid var(--muted-foreground)` }} />
                <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>Exam</span>
                <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>{examDateStr}</span>
              </div>
            </div>
            <div
              className="absolute top-0"
              style={{ left: `calc(8px + (100% - 16px) * ${ringPct / 100})`, transform: 'translateX(-50%)' }}
            >
              <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: urgency.color }} />
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
            💡 Insights
          </div>
          <div className="space-y-1.5">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="rounded-xl p-2.5 text-[11px] flex items-start gap-2"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <span style={{ color: urgency.color }}>•</span>
                <span style={{ color: 'var(--foreground)' }}>{insight}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap outside to close
        </p>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl p-2.5 flex flex-col gap-0.5"
      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
        {icon} {label}
      </div>
      <div className="text-sm font-bold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
