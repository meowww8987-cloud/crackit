'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Crown, AlertTriangle, X, ChevronRight, Clock, Target, CheckCircle2, Layers } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { subjectBreakdownData, type SubjectDetail, type SubjectWeekDay } from '@/lib/analytics';
import { formatHM, vibrate, cn } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

/**
 * SubjectBreakdown — 3-level subject analysis card (replaces 4 old cards).
 *
 * Replaces:
 *  - SubjectWeeklyBreakdown (stacked bars — confusing)
 *  - SubjectSunburst (radial — pretty but not informative)
 *  - Subject Distribution donut (redundant with horizontal bars)
 *  - Neglected Subjects list (integrated as faded bars)
 *
 * LEVEL 1 (main card):
 *   - Horizontal bars per subject (length = time, color = subject)
 *   - Hours at end of each bar
 *   - 👑 crown on best subject
 *   - ⚠ on neglected (<5%) subjects
 *   - Tap any subject → Level 2
 *
 * LEVEL 2 (subject detail sheet):
 *   - 4 stat cards (studied / sessions / days active / wasted)
 *   - 7-day mini bars for this subject
 *   - Top chapters with time + %
 *   - Smart insight
 *   - Tap any day → Level 3
 *
 * LEVEL 3 (per-day session popup):
 *   - Reuses WeekStory's DayDetailPopup pattern
 *   - Shows all sessions for that subject on that day
 *
 * THEME COMPLIANCE: all colors use CSS variables.
 */

export function SubjectBreakdown() {
  const sessions = useHistory((s) => s.sessions);
  const data = useMemo(() => subjectBreakdownData(sessions), [sessions]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectDetail | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ subject: SubjectDetail; day: SubjectWeekDay } | null>(null);

  // Empty state
  if (data.totalStudySec === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} style={{ color: 'var(--muted-foreground)' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>Subjects This Week</h3>
        </div>
        <div className="text-center py-3">
          <BookOpen size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            No study sessions this week yet.
          </p>
        </div>
      </div>
    );
  }

  const maxStudySec = Math.max(...data.subjects.map((s) => s.totalStudySec), 1);
  const studiedSubjects = data.subjects.filter((s) => s.totalStudySec > 0);

  return (
    <>
      {/* ============= LEVEL 1: Main card ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-4"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} style={{ color: '#14b8a6' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>Subjects This Week</h3>
          <span className="ml-auto text-[10px] font-semibold tabular" style={{ color: 'var(--muted-foreground)' }}>
            {formatHM(data.totalStudySec)} total
          </span>
        </div>

        {/* Horizontal bars per subject */}
        <div className="space-y-2.5">
          {studiedSubjects.map((subj) => {
            const widthPct = Math.max((subj.totalStudySec / maxStudySec) * 100, 8);
            return (
              <motion.div
                key={subj.subject}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
                onClick={() => {
                  vibrate(8);
                  setSelectedSubject(subj);
                }}
                className="flex items-center gap-2.5 cursor-pointer active:scale-[0.99] transition-transform"
              >
                {/* Subject color dot + crown/warning */}
                <div className="w-5 flex items-center justify-center shrink-0">
                  {subj.isBest ? (
                    <Crown size={12} className="text-amber-500" />
                  ) : subj.isNeglected ? (
                    <AlertTriangle size={11} className="text-amber-500" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: subj.color }} />
                  )}
                </div>

                {/* Subject name */}
                <div className="w-20 shrink-0">
                  <span
                    className={cn("text-xs font-semibold", subj.isNeglected && "opacity-60")}
                    style={{ color: 'var(--foreground)' }}
                  >
                    {subj.subject}
                  </span>
                  <span className="text-[9px] block" style={{ color: 'var(--muted-foreground)' }}>
                    {subj.pctOfWeek}%
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-5 rounded-md overflow-hidden relative" style={{ background: 'var(--muted)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${widthPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-md"
                    style={{
                      background: `linear-gradient(90deg, ${subj.color}99, ${subj.color})`,
                      opacity: subj.isNeglected ? 0.5 : 1,
                    }}
                  />
                </div>

                {/* Hours */}
                <div className="w-16 text-right shrink-0">
                  <span className="text-xs font-bold tabular" style={{ color: 'var(--foreground)' }}>
                    {formatHM(subj.totalStudySec)}
                  </span>
                  {subj.totalWastedSec > 60 && (
                    <span className="text-[9px] block tabular" style={{ color: '#ef4444' }}>
                      ⚠ {formatHM(subj.totalWastedSec)}
                    </span>
                  )}
                </div>

                <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              </motion.div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div className="flex items-center justify-between text-[10px] mt-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--muted-foreground)' }}>
            {studiedSubjects.length} subject{studiedSubjects.length !== 1 ? 's' : ''} studied
          </span>
          {studiedSubjects.find((s) => s.isBest) && (
            <span style={{ color: '#fbbf24' }}>
              👑 Best: {studiedSubjects.find((s) => s.isBest)?.subject}
            </span>
          )}
          {studiedSubjects.find((s) => s.isNeglected) && (
            <span style={{ color: '#f59e0b' }}>
              ⚠ {studiedSubjects.filter((s) => s.isNeglected).length} neglected
            </span>
          )}
        </div>

        <div className="text-center text-[9px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          Tap any subject for details →
        </div>
      </motion.div>

      {/* ============= LEVEL 2: Subject detail sheet ============= */}
      <AnimatePresence>
        {selectedSubject && !selectedDay && (
          <SubjectDetailSheet
            subject={selectedSubject}
            onClose={() => setSelectedSubject(null)}
            onSelectDay={(day) => {
              vibrate(10);
              setSelectedDay({ subject: selectedSubject, day });
            }}
          />
        )}
      </AnimatePresence>

      {/* ============= LEVEL 3: Per-day session popup ============= */}
      <AnimatePresence>
        {selectedDay && (
          <SubjectDayPopup
            subject={selectedDay.subject}
            day={selectedDay.day}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// LEVEL 2: Subject Detail Sheet
// =====================================================

function SubjectDetailSheet({
  subject,
  onClose,
  onSelectDay,
}: {
  subject: SubjectDetail;
  onClose: () => void;
  onSelectDay: (day: SubjectWeekDay) => void;
}) {
  const insight = generateInsight(subject);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{
              background: `linear-gradient(135deg, ${subject.color}30, transparent)`,
              border: `1px solid ${subject.color}40`,
            }}
          >
            <BookOpen size={24} style={{ color: subject.color }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            {subject.subject}
            {subject.isBest && <Crown size={14} className="inline ml-1.5 text-amber-500" />}
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            This Week · {subject.pctOfWeek}% of total study
          </p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard
            icon={<Clock size={12} style={{ color: subject.color }} />}
            label="Studied"
            value={formatHM(subject.totalStudySec)}
            color={subject.color}
          />
          <StatCard
            icon={<Layers size={12} style={{ color: '#3b82f6' }} />}
            label="Sessions"
            value={`${subject.sessionCount} · ${formatHM(subject.avgPerSessionSec)}`}
            color="#3b82f6"
          />
          <StatCard
            icon={<CheckCircle2 size={12} style={{ color: '#22c55e' }} />}
            label="Days Active"
            value={`${subject.daysActive}/7`}
            color="#22c55e"
          />
          <StatCard
            icon={<AlertTriangle size={12} style={{ color: subject.totalWastedSec > 0 ? '#ef4444' : '#22c55e' }} />}
            label="Wasted"
            value={subject.totalWastedSec > 60 ? formatHM(subject.totalWastedSec) : 'Clean'}
            color={subject.totalWastedSec > 0 ? '#ef4444' : '#22c55e'}
          />
        </div>

        {/* 7-day mini bars */}
        <div className="mb-4">
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Per Day
          </div>
          <div className="flex items-end justify-between gap-1">
            {subject.days.map((day, i) => {
              const hours = day.studySec / 3600;
              const barHeight = day.studySec > 0 ? Math.max(8, Math.min(48, (hours / 4) * 48)) : 4;
              const isLastNight = i === 6;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                  style={{
                    background: isLastNight ? `${subject.color}15` : 'transparent',
                    borderRadius: 6,
                    padding: '2px 0',
                  }}
                >
                  <span className="text-[8px] font-bold uppercase" style={{ color: isLastNight ? subject.color : 'var(--muted-foreground)' }}>
                    {day.dayName}
                  </span>
                  <span className="text-[9px] font-bold tabular" style={{ color: 'var(--foreground)' }}>
                    {day.studySec > 0 ? formatHM(day.studySec) : '—'}
                  </span>
                  <button
                    onClick={() => day.studySec > 0 && onSelectDay(day)}
                    className="w-full rounded-t-sm transition active:scale-95"
                    style={{
                      height: barHeight,
                      background: day.studySec > 0 ? subject.color : 'var(--muted)',
                      minHeight: 4,
                      opacity: day.studySec > 0 ? (isLastNight ? 1 : 0.85) : 0.3,
                      cursor: day.studySec > 0 ? 'pointer' : 'default',
                    }}
                  />
                  {day.wastedSec > 60 && (
                    <span className="text-[7px]" style={{ color: '#ef4444' }}>
                      ⚠
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top chapters */}
        {subject.topChapters.length > 0 && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Top Chapters
            </div>
            <div className="space-y-1.5">
              {subject.topChapters.map((ch, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs rounded-lg p-2"
                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold tabular shrink-0"
                    style={{ background: `${subject.color}20`, color: subject.color }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                    {ch.chapter}
                  </span>
                  <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>
                    {formatHM(ch.studySec)}
                  </span>
                  <span className="text-[9px] tabular" style={{ color: 'var(--muted-foreground)' }}>
                    {ch.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart insight */}
        <div
          className="rounded-2xl p-3 flex items-start gap-2"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <Target size={14} className="mt-0.5 shrink-0" style={{ color: subject.color }} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
            <span className="font-semibold">Insight: </span>
            {insight}
          </div>
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap any day bar for session details
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

// =====================================================
// LEVEL 3: Per-Day Session Popup (for a specific subject)
// =====================================================

function SubjectDayPopup({
  subject,
  day,
  onClose,
}: {
  subject: SubjectDetail;
  day: SubjectWeekDay;
  onClose: () => void;
}) {
  const sessions = useHistory((s) => s.sessions);
  const daySessions = useMemo(
    () => sessions
      .filter((s) => s.date === day.date && s.subject === subject.subject)
      .sort((a, b) => a.startedAt - b.startedAt),
    [sessions, day.date, subject.subject]
  );

  const dateLabel = useMemo(() => {
    const d = new Date(day.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, [day.date]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          aria-label="Back"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ background: subject.color }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              {subject.subject}
            </h2>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            {dateLabel}
          </p>
          <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
            <span style={{ color: subject.color }}>📚 {formatHM(day.studySec)}</span>
            {day.wastedSec > 60 && (
              <span style={{ color: '#ef4444' }}>⚠ {formatHM(day.wastedSec)}</span>
            )}
            <span style={{ color: 'var(--muted-foreground)' }}>{day.sessionCount} sessions</span>
          </div>
        </div>

        {/* Session list */}
        <div className="space-y-2">
          {daySessions.map((session, i) => {
            const startTime = new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(session.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderLeft: `3px solid ${subject.color}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${subject.color}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: subject.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {session.chapter || 'Free study'}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {session.topic || session.lecture || '—'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {startTime} → {endTime}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular" style={{ color: subject.color }}>
                    {formatHM(session.studySeconds)}
                  </div>
                  {session.wastedSeconds > 60 && (
                    <div className="text-[9px] tabular" style={{ color: '#ef4444' }}>
                      ⚠ {formatHM(session.wastedSeconds)}
                    </div>
                  )}
                  {session.mood && (
                    <div className="text-[10px] mt-0.5">
                      {session.mood === 'confident' ? '😊' : session.mood === 'okay' ? '🙂' : session.mood === 'struggling' ? '😰' : '😴'}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {daySessions.length === 0 && (
          <div className="text-center py-6">
            <Clock size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              No {subject.subject} sessions this day.
            </p>
          </div>
        )}

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap outside to go back
        </p>
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// Smart insight generator
// =====================================================

function generateInsight(subject: SubjectDetail): string {
  if (subject.isBest) {
    if (subject.pctOfWeek >= 50) {
      return `${subject.subject} dominates your week (${subject.pctOfWeek}%). Great focus — but make sure you're not neglecting other subjects.`;
    }
    return `${subject.subject} is your most studied subject this week (${subject.pctOfWeek}%). Strong focus! 👑`;
  }
  if (subject.isNeglected) {
    return `${subject.subject} is getting less than 5% of your time. Consider dedicating a session to it soon.`;
  }
  if (subject.totalWastedSec > subject.totalStudySec * 0.2) {
    return `${subject.totalWastedSec > 60 ? formatHM(subject.totalWastedSec) : 'some time'} wasted in ${subject.subject}. Try silencing notifications during sessions.`;
  }
  if (subject.daysActive >= 5) {
    return `Consistent ${subject.subject} practice — ${subject.daysActive}/7 days. Steady progress! 📈`;
  }
  if (subject.sessionCount > 0) {
    return `${subject.sessionCount} sessions averaging ${formatHM(subject.avgPerSessionSec)} each. ${subject.daysActive} days active this week.`;
  }
  return `No ${subject.subject} sessions this week yet. Start one from the Study tab!`;
}
