'use client';

import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, TrendingUp, TrendingDown, Flame, X, ChevronRight, Clock, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { weekStoryData, type WeekDayData, type WeekStoryData } from '@/lib/analytics';
import { formatHM, vibrate, cn } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

/**
 * WeekStory — redesigned "Weekly Study Time" card with 3 levels of detail.
 *
 * LEVEL 1 (main card in Stats tab):
 *   - Big animated total ("23h 45m")
 *   - Trend badge (↑12% vs last week)
 *   - Gradient progress bar toward weekly goal
 *   - 7 intensity tiles (color intensity = study amount, red dot = wasted)
 *   - One-line summary (best day + daily avg)
 *   - Swipe left/right to navigate weeks
 *   - Tap → opens Level 2 sheet
 *
 * LEVEL 2 (bottom sheet, week breakdown):
 *   - 4 glassmorphic stat cards (studied / wasted / days active / avg per day)
 *   - 7 day-cards (date, time, goal %, subjects, wasted, sessions)
 *   - Best day gets 🔥, today gets glowing ring
 *   - Tap any day → opens Level 3
 *
 * LEVEL 3 (per-day session popup):
 *   - Full session list for that day
 *   - Per-session: subject color dot, chapter/topic, time, mood, wasted
 *
 * THEME COMPLIANCE:
 *   - All colors use CSS variables
 *   - No hardcoded text-white/bg-white outside force-dark-ui
 *   - Tile colors use teal/green gradients with rgba opacity
 */

const TILE_COLORS = [
  'var(--muted)', // intensity 0 — no study
  'rgba(20, 184, 166, 0.25)', // 1 — faint
  'rgba(20, 184, 166, 0.50)', // 2 — medium
  'rgba(20, 184, 166, 0.75)', // 3 — strong
  'rgba(34, 197, 94, 0.85)',  // 4 — goal hit (green)
];

export function WeekStory({ embedded = false }: { embedded?: boolean }) {
  const sessions = useHistory((s) => s.sessions);
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<WeekDayData | null>(null);

  const data = useMemo(
    () => weekStoryData(sessions, weekOffset, dailyGoalHours),
    [sessions, weekOffset, dailyGoalHours]
  );

  // Swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    vibrate(8);
    if (dx > 0) setWeekOffset((o) => Math.max(0, o - 1));
    else setWeekOffset((o) => o + 1);
  };

  const trendUp = data.trendPct >= 0;

  return (
    <>
      {/* ============= LEVEL 1: Main card ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          "cursor-pointer select-none active:scale-[0.99] transition-transform",
          !embedded && "glass rounded-2xl p-4"
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          vibrate(8);
          setSheetOpen(true);
        }}
      >
        {/* Header: title + trend badge */}
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            {data.weekLabel}
          </h3>
          {weekOffset > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(8); setWeekOffset(0); }}
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold ml-1"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              Today
            </button>
          )}
          {/* Trend badge */}
          {data.totalStudyMin > 0 && (
            <div
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: trendUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: trendUp ? '#22c55e' : '#ef4444',
              }}
            >
              {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {data.trendPct > 0 ? '+' : ''}{data.trendPct}%
            </div>
          )}
        </div>

        {/* Big total + subtitle */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <CountUp
              value={data.totalStudyMin}
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
          {data.totalWastedMin > 0 && (
            <div className="text-[10px] mt-0.5" style={{ color: '#ef4444' }}>
              ⚠ {formatHM(data.totalWastedMin * 60)} wasted
            </div>
          )}
        </div>

        {/* Gradient progress bar toward weekly goal */}
        <div className="mb-4">
          <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
            <span>{data.goalPct}% of weekly goal</span>
            <span className="tabular">{formatHM(data.totalStudyMin * 60)} / {formatHM(data.weeklyGoalMin * 60)}</span>
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
                boxShadow: data.goalPct >= 100 ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
              }}
            />
          </div>
        </div>

        {/* 7 intensity tiles */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {data.days.map((day, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5"
              onClick={(e) => {
                e.stopPropagation();
                if (day.studyMinutes > 0) {
                  vibrate(8);
                  setSelectedDay(day);
                  setSheetOpen(true);
                }
              }}
            >
              {/* Tile */}
              <div
                className={cn(
                  "w-full aspect-square rounded-lg flex flex-col items-center justify-center relative transition-transform",
                  day.isToday && "ring-2"
                )}
                style={{
                  background: TILE_COLORS[day.intensity],
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': day.isToday ? '#fbbf24' : 'transparent',
                  boxShadow: day.isToday ? '0 0 8px rgba(251, 191, 36, 0.4)' : 'none',
                }}
              >
                <span
                  className="text-[9px] font-bold leading-none"
                  style={{
                    color: day.intensity >= 3 ? '#ffffff' : 'var(--foreground)',
                  }}
                >
                  {day.studyMinutes > 0 ? formatHM(day.studyMinutes * 60).replace(' ', '') : '—'}
                </span>
                {/* Wasted dot */}
                {day.wastedMinutes > 0 && (
                  <span
                    className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#ef4444' }}
                  />
                )}
              </div>
              {/* Day letter */}
              <span className="text-[8px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                {day.dayLetter}
              </span>
              {/* Date number */}
              <span
                className={cn(
                  "text-[9px] tabular",
                  day.isToday && "font-bold"
                )}
                style={{
                  color: day.isToday ? '#fbbf24' : 'var(--muted-foreground)',
                }}
              >
                {day.dateNum}
              </span>
            </div>
          ))}
        </div>

        {/* One-line summary */}
        {data.bestDay && (
          <div className="flex items-center gap-2 text-[9px] mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <Flame size={10} className="text-amber-500" />
            <span style={{ color: 'var(--muted-foreground)' }}>
              Best: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{data.bestDay.dayLetter} {formatHM(data.bestDay.studyMinutes * 60)}</span>
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>·</span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              Avg: <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{formatHM(data.dailyAvgMin * 60)}/day</span>
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>·</span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{data.daysHitGoal}/7</span> goal days
            </span>
          </div>
        )}

        {/* Swipe hint */}
        <div className="text-center text-[9px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
          {weekOffset > 0 ? '← swipe right for recent · left for older →' : '← swipe left for previous weeks →'}
        </div>
      </motion.div>

      {/* ============= LEVEL 2: Week breakdown sheet ============= */}
      <AnimatePresence>
        {sheetOpen && !selectedDay && (
          <WeekBreakdownSheet
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
          <DayDetailPopup
            day={selectedDay}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// LEVEL 2: Week Breakdown Sheet
// =====================================================

function WeekBreakdownSheet({
  data,
  onClose,
  onSelectDay,
}: {
  data: WeekStoryData;
  onClose: () => void;
  onSelectDay: (day: WeekDayData) => void;
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.2), transparent)', border: '1px solid rgba(20,184,166,0.3)' }}
          >
            <Calendar size={24} style={{ color: '#14b8a6' }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            {data.weekLabel} Breakdown
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Tap any day for session details
          </p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard
            icon={<Clock size={12} style={{ color: '#14b8a6' }} />}
            label="Studied"
            value={formatHM(data.totalStudyMin * 60)}
            color="#14b8a6"
          />
          <StatCard
            icon={<AlertTriangle size={12} style={{ color: '#ef4444' }} />}
            label="Wasted"
            value={data.totalWastedMin > 0 ? formatHM(data.totalWastedMin * 60) : 'None'}
            color={data.totalWastedMin > 0 ? '#ef4444' : '#22c55e'}
          />
          <StatCard
            icon={<CheckCircle2 size={12} style={{ color: '#22c55e' }} />}
            label="Days Active"
            value={`${data.daysActive}/7`}
            color="#22c55e"
          />
          <StatCard
            icon={<Target size={12} style={{ color: '#f59e0b' }} />}
            label="Daily Avg"
            value={formatHM(data.dailyAvgMin * 60)}
            color="#f59e0b"
          />
        </div>

        {/* Day cards */}
        <div className="space-y-2">
          {data.days.slice().reverse().map((day) => {
            const isBest = data.bestDay?.date === day.date && day.studyMinutes > 0;
            const dayGoalPct = data.dailyGoalMin > 0 ? Math.round((day.studyMinutes / data.dailyGoalMin) * 100) : 0;
            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => day.studyMinutes > 0 && onSelectDay(day)}
                className={cn(
                  "rounded-xl p-3 transition active:scale-[0.98]",
                  day.studyMinutes > 0 && "cursor-pointer"
                )}
                style={{
                  background: 'var(--muted)',
                  border: day.isToday ? '1.5px solid #fbbf24' : '1px solid var(--border)',
                  boxShadow: day.isToday ? '0 0 12px rgba(251,191,36,0.2)' : 'none',
                }}
              >
                {/* Top row: day + time + goal% */}
                <div className="flex items-center gap-2 mb-1.5">
                  {isBest && <Flame size={12} className="text-amber-500 shrink-0" />}
                  <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                    {day.dayLetter} {day.dateNum}
                    {day.isToday && <span className="ml-1 text-[9px]" style={{ color: '#fbbf24' }}>TODAY</span>}
                  </span>
                  <span className="text-xs font-bold tabular ml-auto" style={{ color: 'var(--foreground)' }}>
                    {day.studyMinutes > 0 ? formatHM(day.studyMinutes * 60) : 'No study'}
                  </span>
                  {day.studyMinutes > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold tabular"
                      style={{
                        background: day.hitGoal ? 'rgba(34,197,94,0.15)' : 'var(--muted)',
                        color: day.hitGoal ? '#22c55e' : 'var(--muted-foreground)',
                      }}
                    >
                      {dayGoalPct}%
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {day.studyMinutes > 0 && (
                  <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, dayGoalPct)}%`,
                        background: day.hitGoal ? 'linear-gradient(90deg, #14b8a6, #22c55e)' : '#14b8a6',
                      }}
                    />
                  </div>
                )}

                {/* Bottom row: subjects + wasted + sessions */}
                {day.studyMinutes > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                    {day.subjects.slice(0, 3).map((subj, i) => (
                      <span key={i} className="flex items-center gap-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: subj.color }} />
                        {subj.name} {formatHM(subj.minutes * 60)}
                      </span>
                    ))}
                    {day.subjects.length > 3 && (
                      <span style={{ color: 'var(--muted-foreground)' }}>+{day.subjects.length - 3}</span>
                    )}
                    <span className="ml-auto" style={{ color: 'var(--muted-foreground)' }}>
                      {day.wastedMinutes > 0 ? (
                        <span style={{ color: '#ef4444' }}>⚠ {formatHM(day.wastedMinutes * 60)}</span>
                      ) : (
                        <span style={{ color: '#22c55e' }}>✓ clean</span>
                      )}
                      <span className="ml-1">· {day.sessionCount}s</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Rest day</div>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap any day with study time for full session list
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

function DayDetailPopup({ day, onClose }: { day: WeekDayData; onClose: () => void }) {
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
            <span style={{ color: '#14b8a6' }}>📚 {formatHM(day.studyMinutes * 60)}</span>
            {day.wastedMinutes > 0 && (
              <span style={{ color: '#ef4444' }}>⚠ {formatHM(day.wastedMinutes * 60)}</span>
            )}
            <span style={{ color: 'var(--muted-foreground)' }}>{day.sessionCount} sessions</span>
          </div>
        </div>

        {/* Subject chips */}
        {day.subjects.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-center mb-4">
            {day.subjects.map((subj, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: `${subj.color}20`, color: subj.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: subj.color }} />
                {subj.name} {formatHM(subj.minutes * 60)}
              </div>
            ))}
          </div>
        )}

        {/* Session list */}
        <div className="space-y-2">
          {daySessions.map((session, i) => {
            const subjColor = day.subjects.find((s) => s.name === session.subject)?.color || '#14b8a6';
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
                {/* Subject color dot */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${subjColor}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: subjColor }} />
                </div>
                {/* Session info */}
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
                {/* Time + mood */}
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
