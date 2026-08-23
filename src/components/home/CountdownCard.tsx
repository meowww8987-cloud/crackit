'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Calendar, X, Clock, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { CountUp } from '@/components/shared/CountUp';
import { vibrate, cn } from '@/lib/utils';

/**
 * CountdownCard — modern NEET countdown card with circular progress ring.
 *
 * Card shows ONLY essential info (clean, modern):
 *  - Circular ring (prep % elapsed, urgency-colored)
 *  - Big days-left number (urgency-colored, animated count-up)
 *  - Exam date with 📅 icon
 *  - "Day X of Y" + "% elapsed"
 *  - Syllabus % bar with weighted marker
 *  - Pace indicator (on track / behind)
 *  - Tap → detail sheet (everything else)
 *
 * Urgency color system:
 *  - 200+ days: teal (calm)
 *  - 100-199: green (on track)
 *  - 50-99: amber (focus up)
 *  - 30-49: orange (serious)
 *  - <30: red (crunch time!)
 *
 * THEME COMPLIANCE: all text uses CSS variables.
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
}

function getUrgencyColor(days: number): { color: string; label: string; ringColor: string } {
  if (days >= 200) return { color: '#14b8a6', label: 'Plenty of time', ringColor: '#14b8a6' };
  if (days >= 100) return { color: '#22c55e', label: 'On track', ringColor: '#22c55e' };
  if (days >= 50) return { color: '#f59e0b', label: 'Focus up', ringColor: '#f59e0b' };
  if (days >= 30) return { color: '#f97316', label: 'Getting serious', ringColor: '#f97316' };
  return { color: '#ef4444', label: 'Crunch time!', ringColor: '#ef4444' };
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
}: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const urgency = getUrgencyColor(daysToExam);
  const examDateObj = new Date(examDate + 'T00:00:00');
  const examDateStr = examDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const examWeekday = examDateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // Pace: is syllabus % keeping up with prep %?
  const paceDiff = syllabusPct - prepPct;
  const pace = paceDiff >= -5 ? 'on-track' : paceDiff >= -15 ? 'behind' : 'critical';
  const paceLabel = pace === 'on-track' ? 'On track' : pace === 'behind' ? 'Slightly behind' : 'Behind schedule';
  const paceColor = pace === 'on-track' ? '#22c55e' : pace === 'behind' ? '#f59e0b' : '#ef4444';

  // Ring dimensions
  const ringSize = 72;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringOffset = circumference - (prepPct / 100) * circumference;

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
          {/* Circular progress ring */}
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              {/* Background circle */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
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
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold tabular" style={{ color: urgency.color }}>
                {prepPct}%
              </span>
              <span className="text-[7px] uppercase" style={{ color: 'var(--muted-foreground)' }}>
                elapsed
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

        {/* Prep day info */}
        {prepStart && (
          <div className="flex items-center justify-between text-[10px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
            <span>Day {prepDay} of {prepTotal}</span>
            <span className="font-semibold" style={{ color: urgency.color }}>
              {urgency.label}
            </span>
          </div>
        )}

        {/* Syllabus progress — single bar with weighted marker */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] mb-1">
            <span style={{ color: 'var(--muted-foreground)' }}>📚 Syllabus</span>
            <span className="tabular font-semibold" style={{ color: 'var(--foreground)' }}>
              {syllabusPct}%
              {syllabusWeightedPct !== syllabusPct && (
                <span style={{ color: '#f59e0b' }}> · {syllabusWeightedPct}%⚡</span>
              )}
            </span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${syllabusPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #14b8a6, #22c55e)' }}
            />
            {/* Weighted marker */}
            {syllabusWeightedPct !== syllabusPct && (
              <div
                className="absolute top-0 bottom-0 w-0.5"
                style={{ left: `${syllabusWeightedPct}%`, background: '#f59e0b' }}
              />
            )}
          </div>
        </div>

        {/* Pace indicator */}
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px]"
          style={{ background: `${paceColor}15` }}
        >
          <div className="flex items-center gap-1">
            {pace === 'on-track' ? (
              <CheckCircle2 size={11} style={{ color: paceColor }} />
            ) : (
              <TrendingDown size={11} style={{ color: paceColor }} />
            )}
            <span className="font-bold" style={{ color: paceColor }}>{paceLabel}</span>
          </div>
          <span style={{ color: 'var(--muted-foreground)' }}>
            {daysStudied} days studied
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
            pace={pace}
            paceLabel={paceLabel}
            paceColor={paceColor}
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
  pace,
  paceLabel,
  paceColor,
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
  pace: string;
  paceLabel: string;
  paceColor: string;
  onClose: () => void;
}) {
  // Timeline milestones
  const milestones = useMemo(() => {
    if (!prepStart) return [];
    const startDate = new Date(prepStart + 'T00:00:00');
    const endDate = new Date(examDate + 'T00:00:00');
    const totalMs = endDate.getTime() - startDate.getTime();
    return [25, 50, 75].map((pct) => {
      const date = new Date(startDate.getTime() + (totalMs * pct) / 100);
      return {
        pct,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        passed: prepPct >= pct,
      };
    });
  }, [prepStart, examDate, prepPct]);

  // Insights
  const insights = useMemo(() => {
    const list: string[] = [];
    list.push(`You're ${prepPct}% through your prep time.`);

    if (pace === 'on-track') {
      list.push(`Syllabus is ${syllabusPct}% done — you're on track! ✓`);
    } else if (pace === 'behind') {
      list.push(`Syllabus is ${syllabusPct}% done — ${prepPct - syllabusPct}% behind schedule.`);
    } else {
      list.push(`Syllabus is ${syllabusPct}% done — ${prepPct - syllabusPct}% behind. Focus on high-weightage chapters!`);
    }

    const nextMilestone = milestones.find((m) => !m.passed);
    if (nextMilestone) {
      list.push(`Next milestone: ${nextMilestone.pct}% (${nextMilestone.date}).`);
    }

    // Pace projection
    if (syllabusPct > 0 && prepPct > 0) {
      const rate = syllabusPct / prepPct;
      const projected = Math.round(rate * 100);
      if (projected >= 100) {
        list.push(`At current pace, you'll finish syllabus before exam! 🎉`);
      } else {
        list.push(`At current pace, you'll reach ${projected}% by exam day.`);
      }
    }

    return list;
  }, [prepPct, syllabusPct, pace, milestones]);

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
            label="Prep Day"
            value={`${prepDay}/${prepTotal}`}
            color="#14b8a6"
          />
          <StatCard
            icon={<CheckCircle2 size={12} style={{ color: paceColor }} />}
            label="Pace"
            value={paceLabel}
            color={paceColor}
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

        {/* Timeline */}
        {prepStart && milestones.length > 0 && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Prep Timeline
            </div>
            <div className="relative px-2">
              {/* Timeline line */}
              <div
                className="absolute left-2 right-2 top-2 h-0.5"
                style={{ background: 'var(--muted)' }}
              />
              {/* Progress portion */}
              <div
                className="absolute left-2 top-2 h-0.5"
                style={{ width: `calc((100% - 16px) * ${prepPct / 100})`, background: urgency.color }}
              />
              {/* Milestones */}
              <div className="relative flex justify-between">
                {/* Start */}
                <div className="flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: urgency.color }}>
                    <CheckCircle2 size={10} className="text-white" />
                  </div>
                  <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>Start</span>
                  <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(prepStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {/* Milestones */}
                {milestones.map((m) => (
                  <div key={m.pct} className="flex flex-col items-center" style={{ width: '20%' }}>
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: m.passed ? urgency.color : 'var(--muted)',
                        border: prepPct >= m.pct - 5 && prepPct <= m.pct + 5 ? `2px solid ${urgency.color}` : 'none',
                      }}
                    >
                      {m.passed && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>{m.pct}%</span>
                    <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>{m.date}</span>
                  </div>
                ))}
                {/* Exam */}
                <div className="flex flex-col items-center" style={{ width: '20%' }}>
                  <div className="w-4 h-4 rounded-full" style={{ border: `2px solid var(--muted-foreground)` }} />
                  <span className="text-[8px] mt-1 font-semibold" style={{ color: 'var(--muted-foreground)' }}>Exam</span>
                  <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>{examDateStr}</span>
                </div>
              </div>
              {/* "You are here" marker */}
              <div
                className="absolute top-0"
                style={{ left: `calc(8px + (100% - 16px) * ${prepPct / 100})`, transform: 'translateX(-50%)' }}
              >
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: urgency.color }} />
              </div>
            </div>
          </div>
        )}

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
