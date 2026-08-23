'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Flame, X, ChevronRight, Clock, Target, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { monthStoryData, type MonthDayData, type MonthStoryData } from '@/lib/analytics';
import { formatHM, vibrate, cn } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

/**
 * MonthStory — 30-day study trend card with 3 levels of detail.
 *
 * Replaces:
 *  - Study Time Trend (30-day line chart)
 *  - Weekly Comparison (this vs last week)
 *  - Wasted Ratio (radial gauge)
 *
 * LEVEL 1 (main card):
 *   - Big animated total ("62h 30m")
 *   - Trend badge (↑12% vs previous 30 days)
 *   - Gradient progress bar toward monthly goal
 *   - 30 intensity tiles (GitHub-style contribution graph)
 *   - Streak + days studied + best day + avg in one line
 *   - Tap → Level 2
 *
 * LEVEL 2 (breakdown sheet):
 *   - 4 stat cards (total / avg / days / streak)
 *   - 4-5 weekly strips with day tiles + weekly total
 *   - Current week highlighted
 *   - Tap any day → Level 3
 *
 * LEVEL 3 (per-day session popup):
 *   - Reuses existing session list pattern
 *
 * THEME COMPLIANCE: all colors use CSS variables.
 */

const TILE_COLORS = [
  'var(--muted)', // 0 — no study
  'rgba(20, 184, 166, 0.25)', // 1 — light
  'rgba(20, 184, 166, 0.50)', // 2 — medium
  'rgba(20, 184, 166, 0.75)', // 3 — strong
  'rgba(34, 197, 94, 0.85)',  // 4 — goal hit
];

export function MonthStory() {
  const sessions = useHistory((s) => s.sessions);
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);
  const data = useMemo(
    () => monthStoryData(sessions, dailyGoalHours),
    [sessions, dailyGoalHours]
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<MonthDayData | null>(null);

  const trendUp = data.trendPct >= 0;

  return (
    <>
      {/* ============= LEVEL 1: Main card ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-4 cursor-pointer select-none active:scale-[0.99] transition-transform"
        onClick={() => { vibrate(8); setSheetOpen(true); }}
      >
        {/* Header + trend */}
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            {data.monthLabel}
          </h3>
          {data.totalStudySec > 0 && (
            <div
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: trendUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: trendUp ? '#22c55e' : '#ef4444',
              }}
            >
              {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {data.trendPct > 0 ? '+' : ''}{data.trendPct}%
            </div>
          )}
        </div>

        {/* Big total */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <CountUp
              value={Math.round(data.totalStudySec / 60)}
              duration={1000}
              animateOnChange
              format={(v) => formatHM(v * 60)}
              className="text-3xl font-bold tabular"
              style={{ color: 'var(--foreground)' }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              studied
            </span>
          </div>
          {data.totalWastedSec > 60 && (
            <div className="text-[10px] mt-0.5" style={{ color: '#ef4444' }}>
              ⚠ {formatHM(data.totalWastedSec)} wasted
            </div>
          )}
        </div>

        {/* Progress bar to monthly goal */}
        <div className="mb-4">
          <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
            <span>{data.goalPct}% of monthly goal</span>
            <span className="tabular">{formatHM(data.totalStudySec)} / {formatHM(data.monthlyGoalSec)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min(100, data.goalPct)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: data.goalPct >= 100
                  ? 'linear-gradient(90deg, #14b8a6, #22c55e)'
                  : 'linear-gradient(90deg, #14b8a6, #2dd4bf)',
                boxShadow: data.goalPct >= 100 ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
              }}
            />
          </div>
        </div>

        {/* 30 intensity tiles (GitHub-style, 6 columns × 5 rows) */}
        <div className="grid grid-cols-10 gap-1 mb-3">
          {data.days.map((day, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (day.hasStudy) {
                  vibrate(8);
                  setSelectedDay(day);
                  setSheetOpen(true);
                }
              }}
              className="aspect-square rounded-sm relative"
              style={{
                background: TILE_COLORS[day.intensity],
                boxShadow: day.isToday ? '0 0 6px rgba(251,191,36,0.6)' : 'none',
                border: day.isToday ? '1.5px solid #fbbf24' : 'none',
              }}
              title={`${day.date}: ${day.hasStudy ? formatHM(day.studySec) : 'No study'}`}
            />
          ))}
        </div>

        {/* Date range labels */}
        <div className="flex justify-between text-[8px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <span>{new Date(data.days[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>Today</span>
        </div>

        {/* Summary line */}
        {data.bestDay && (
          <div className="flex items-center gap-2 text-[9px] flex-wrap pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {data.currentStreak > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                <Flame size={10} />
                <span className="font-bold">{data.currentStreak}-day streak</span>
              </span>
            )}
            <span style={{ color: 'var(--muted-foreground)' }}>
              📅 <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{data.daysStudied}/30 days</span>
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>·</span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              ⭐ Best: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatHM(data.bestDay.studySec)}</span>
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>·</span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              Avg: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatHM(data.dailyAvgSec)}/day</span>
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-2 text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
          <span>Less</span>
          <span className="w-2 h-2 rounded-sm" style={{ background: TILE_COLORS[0] }} />
          <span className="w-2 h-2 rounded-sm" style={{ background: TILE_COLORS[1] }} />
          <span className="w-2 h-2 rounded-sm" style={{ background: TILE_COLORS[2] }} />
          <span className="w-2 h-2 rounded-sm" style={{ background: TILE_COLORS[3] }} />
          <span className="w-2 h-2 rounded-sm" style={{ background: TILE_COLORS[4] }} />
          <span>More</span>
        </div>

        <div className="text-center text-[9px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
          Tap any tile for details →
        </div>
      </motion.div>

      {/* ============= LEVEL 2: Month breakdown sheet ============= */}
      <AnimatePresence>
        {sheetOpen && !selectedDay && (
          <MonthBreakdownSheet
            data={data}
            onClose={() => setSheetOpen(false)}
            onSelectDay={(day) => {
              vibrate(10);
              setSelectedDay(day);
            }}
          />
        )}
      </AnimatePresence>

      {/* ============= LEVEL 3: Per-day session popup ============= */}
      <AnimatePresence>
        {sheetOpen && selectedDay && (
          <MonthDayPopup
            day={selectedDay}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// LEVEL 2: Month Breakdown Sheet
// =====================================================

function MonthBreakdownSheet({
  data,
  onClose,
  onSelectDay,
}: {
  data: MonthStoryData;
  onClose: () => void;
  onSelectDay: (day: MonthDayData) => void;
}) {
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
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.2), transparent)', border: '1px solid rgba(20,184,166,0.3)' }}
          >
            <Calendar size={24} style={{ color: '#14b8a6' }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            30-Day Breakdown
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Tap any day for session details
          </p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard
            icon={<Clock size={12} style={{ color: '#14b8a6' }} />}
            label="Total"
            value={formatHM(data.totalStudySec)}
            color="#14b8a6"
          />
          <StatCard
            icon={<Target size={12} style={{ color: '#f59e0b' }} />}
            label="Daily Avg"
            value={formatHM(data.dailyAvgSec)}
            color="#f59e0b"
          />
          <StatCard
            icon={<CheckCircle2 size={12} style={{ color: '#22c55e' }} />}
            label="Days Studied"
            value={`${data.daysStudied}/30`}
            color="#22c55e"
          />
          <StatCard
            icon={<Flame size={12} style={{ color: '#ef4444' }} />}
            label="Streak"
            value={`${data.currentStreak} days`}
            color="#ef4444"
          />
        </div>

        {/* Weekly strips */}
        <div className="space-y-3">
          {data.weeks.map((week) => (
            <div
              key={week.weekNum}
              className="rounded-xl p-3"
              style={{
                background: week.isCurrent ? 'rgba(20,184,166,0.08)' : 'var(--muted)',
                border: week.isCurrent ? '1px solid rgba(20,184,166,0.3)' : '1px solid var(--border)',
              }}
            >
              {/* Week header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                    {week.label}
                  </span>
                  {week.isCurrent && (
                    <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(20,184,166,0.2)', color: '#14b8a6' }}>
                      CURRENT
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {formatHM(week.totalStudySec)}
                </span>
              </div>
              <div className="text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>
                {week.dateRange}
              </div>

              {/* Day tiles */}
              <div className="grid grid-cols-7 gap-1">
                {week.days.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => day.hasStudy && onSelectDay(day)}
                    className="flex flex-col items-center gap-0.5"
                    style={{ cursor: day.hasStudy ? 'pointer' : 'default' }}
                  >
                    <div
                      className="w-full aspect-square rounded-sm relative"
                      style={{
                        background: TILE_COLORS[day.intensity],
                        boxShadow: day.isToday ? '0 0 6px rgba(251,191,36,0.6)' : 'none',
                        border: day.isToday ? '1.5px solid #fbbf24' : 'none',
                      }}
                    />
                    <span className="text-[8px] tabular" style={{ color: day.isToday ? '#fbbf24' : 'var(--muted-foreground)' }}>
                      {day.dayNum}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap any day with study time for session list
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
// LEVEL 3: Per-Day Session Popup
// =====================================================

function MonthDayPopup({ day, onClose }: { day: MonthDayData; onClose: () => void }) {
  const sessions = useHistory((s) => s.sessions);
  const daySessions = useMemo(
    () => sessions
      .filter((s) => s.date === day.date)
      .sort((a, b) => a.startedAt - b.startedAt),
    [sessions, day.date]
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
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
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            {dateLabel}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
            <span style={{ color: '#14b8a6' }}>📚 {formatHM(day.studySec)}</span>
            {day.wastedSec > 60 && (
              <span style={{ color: '#ef4444' }}>⚠ {formatHM(day.wastedSec)}</span>
            )}
            <span style={{ color: 'var(--muted-foreground)' }}>{day.sessionCount} sessions</span>
          </div>
        </div>

        {/* Session list */}
        <div className="space-y-2">
          {daySessions.map((session, i) => {
            const subjColor = getSubjectColor(session.subject);
            const startTime = new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(session.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderLeft: `3px solid ${subjColor}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${subjColor}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: subjColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {session.subject}
                    {session.chapter ? ` · ${session.chapter}` : ''}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {session.topic || 'Free study'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {startTime} → {endTime}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular" style={{ color: '#14b8a6' }}>
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
              No sessions recorded this day.
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

// Helper to get subject color
function getSubjectColor(subject: string): string {
  const colors: Record<string, string> = {
    Physics: '#3b82f6',
    Chemistry: '#22c55e',
    Botany: '#f59e0b',
    Zoology: '#a855f7',
    General: '#14b8a6',
  };
  return colors[subject] || '#14b8a6';
}
