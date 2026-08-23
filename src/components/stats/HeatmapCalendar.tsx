'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, BookOpen, FileText, Brain, TrendingUp, TrendingDown, Flame, Target, AlertCircle } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { dateKey, formatHM, cn, vibrate } from '@/lib/utils';
import type { SavedSession } from '@/lib/types';

/**
 * HeatmapCalendar — Monthly study heatmap with date numbers + month navigation.
 *
 * Shows ONE month at a time as a 7-column calendar grid. Each day cell:
 * - Has the date number visible inside
 * - Background color = study intensity (0h→faint, 7h+→bright green)
 * - Today is highlighted with an amber ring
 * - Tap any day → detail sheet with ALL sessions for that day
 *
 * Navigation:
 * - Prev/Next month buttons (← →)
 * - Swipe left/right inside the calendar (doesn't trigger tab change)
 */
export function HeatmapCalendar({ embedded = false }: { embedded?: boolean }) {
  const sessions = useHistory((s) => s.sessions);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const todayKey = dateKey(new Date());

  // Precompute a Map<dateKey, studySec> in O(N) instead of O(N × 365)
  // MUST be declared before monthData + yearlyStats which use it.
  const sessionMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      m.set(s.date, (m.get(s.date) || 0) + s.studySeconds);
    }
    return m;
  }, [sessions]);

  // Build days for the current month
  const monthData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0=Sun, 6=Sat

    // Build calendar grid: array of {date, dayNum, isCurrentMonth, key, studySec, wastedSec, hours, intensity}
    const cells: {
      date: Date | null;
      dayNum: number | null;
      key: string | null;
      studySec: number;
      wastedSec: number;
      hours: number;
      intensity: number;
    }[] = [];

    // Leading blanks (days before the 1st of the month)
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, dayNum: null, key: null, studySec: 0, wastedSec: 0, hours: 0, intensity: 0 });
    }

    // Days of the month — use sessionMap for O(1) lookup instead of O(N) filter
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = dateKey(date);
      const daySessions = sessions.filter((s) => s.date === key);
      const studySec = sessionMap.get(key) || 0;
      const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
      const hours = studySec / 3600;
      const intensity = hours >= 7 ? 4 : hours >= 4 ? 3 : hours >= 1 ? 2 : hours > 0 ? 1 : 0;
      cells.push({ date, dayNum: d, key, studySec, wastedSec, hours, intensity });
    }

    // Trailing blanks to fill the last week
    const remaining = cells.length % 7;
    if (remaining > 0) {
      for (let i = 0; i < 7 - remaining; i++) {
        cells.push({ date: null, dayNum: null, key: null, studySec: 0, wastedSec: 0, hours: 0, intensity: 0 });
      }
    }

    return cells;
  }, [currentMonth, sessions, sessionMap]);

  // Intensity colors
  const intensityColors = [
    'rgba(255,255,255,0.06)',
    'rgba(34,197,94,0.25)',
    'rgba(34,197,94,0.5)',
    'rgba(34,197,94,0.75)',
    'rgba(34,197,94,1)',
  ];

  // Stats for the full 365 days — uses precomputed sessionMap (O(365) lookups, not O(365×N))
  const yearlyStats = useMemo(() => {
    const today = new Date();
    let totalSec = 0;
    let activeDays = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const daySec = sessionMap.get(key) || 0;
      if (daySec > 0) {
        totalSec += daySec;
        activeDays++;
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    return { totalHours: totalSec / 3600, activeDays, bestStreak };
  }, [sessionMap]);

  // === Month summary (for the currently-viewed month) ===
  // Merges Month Story features: total, trend, streak, goal, days, best, avg
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);
  const monthSummary = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const today = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyGoalSec = Math.round(dailyGoalHours * 3600);
    const monthlyGoalSec = dailyGoalSec * (isCurrentMonth ? today : daysInMonth);

    let totalStudySec = 0;
    let totalWastedSec = 0;
    let daysStudied = 0;
    let bestDaySec = 0;
    let currentStreak = 0;

    for (let d = 1; d <= today; d++) {
      const date = new Date(year, month, d);
      const key = dateKey(date);
      const study = sessionMap.get(key) || 0;
      const daySessions = sessions.filter((s) => s.date === key);
      const wasted = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
      totalStudySec += study;
      totalWastedSec += wasted;
      if (study > 0) {
        daysStudied++;
        if (study > bestDaySec) bestDaySec = study;
      }
    }

    // Current streak (only meaningful for current month)
    if (isCurrentMonth) {
      for (let d = today; d >= 1; d--) {
        const date = new Date(year, month, d);
        const key = dateKey(date);
        const study = sessionMap.get(key) || 0;
        if (study > 0) currentStreak++;
        else break;
      }
    }

    const goalPct = monthlyGoalSec > 0 ? Math.round((totalStudySec / monthlyGoalSec) * 100) : 0;
    const dailyAvgSec = today > 0 ? Math.round(totalStudySec / today) : 0;

    // Trend: compare to same-day-last-month
    let prevStudySec = 0;
    const lastMonth = new Date(year, month - 1, 1);
    const lmy = lastMonth.getFullYear();
    const lmm = lastMonth.getMonth();
    for (let d = 1; d <= today; d++) {
      const date = new Date(lmy, lmm, d);
      const key = dateKey(date);
      prevStudySec += sessionMap.get(key) || 0;
    }
    const trendPct = prevStudySec > 0
      ? Math.round(((totalStudySec - prevStudySec) / prevStudySec) * 100)
      : totalStudySec > 0 ? 100 : 0;

    return {
      totalStudySec, totalWastedSec, goalPct, monthlyGoalSec,
      daysStudied, daysInMonth: isCurrentMonth ? today : daysInMonth,
      currentStreak, bestDaySec, dailyAvgSec, trendPct, isCurrentMonth,
    };
  }, [currentMonth, sessionMap, sessions, dailyGoalHours]);

  // Touch handlers for swipe-to-navigate (doesn't bubble to AppShell)
  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const now = new Date();
  const canGoPrev = currentMonth > new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const canGoNext = currentMonth < new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Selected day detail
  const selectedDayData = selectedDate
    ? monthData.find((c) => c.key === selectedDate)
    : null;
  const selectedDaySessions = selectedDate
    ? sessions.filter((s) => s.date === selectedDate)
    : [];

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className={cn("data-card data-heatmap", !embedded && "glass rounded-2xl p-4")}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-green-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-white/60">
            Study Heatmap
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (canGoPrev) { vibrate(8); setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); } }}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 disabled:opacity-30 transition active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-white/80 min-w-[120px] text-center">{monthLabel}</span>
          <button
            onClick={() => { if (canGoNext) { vibrate(8); setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); } }}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 disabled:opacity-30 transition active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* === Month summary (merged from Month Story) === */}
      {/* Big total + trend badge */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold tabular" style={{ color: 'var(--foreground)' }}>
          {formatHM(monthSummary.totalStudySec)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          studied
        </span>
        {monthSummary.totalStudySec > 0 && (
          <div
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: monthSummary.trendPct >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: monthSummary.trendPct >= 0 ? '#22c55e' : '#ef4444',
            }}
          >
            {monthSummary.trendPct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {monthSummary.trendPct > 0 ? '+' : ''}{monthSummary.trendPct}%
          </div>
        )}
      </div>
      {monthSummary.totalWastedSec > 60 && (
        <div className="text-[10px] mb-2" style={{ color: '#ef4444' }}>
          ⚠ {formatHM(monthSummary.totalWastedSec)} wasted
        </div>
      )}

      {/* Goal progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
          <span>{monthSummary.goalPct}% of goal</span>
          <span className="tabular">{formatHM(monthSummary.totalStudySec)} / {formatHM(monthSummary.monthlyGoalSec)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, monthSummary.goalPct)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: monthSummary.goalPct >= 100
                ? 'linear-gradient(90deg, #14b8a6, #22c55e)'
                : 'linear-gradient(90deg, #14b8a6, #2dd4bf)',
            }}
          />
        </div>
      </div>

      {/* Quick stats: streak + days + avg */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center rounded-lg py-1.5" style={{ background: 'var(--muted)' }}>
          <div className="flex items-center justify-center gap-0.5">
            <Flame size={10} style={{ color: '#f59e0b' }} />
            <span className="text-sm font-bold tabular" style={{ color: '#f59e0b' }}>{monthSummary.currentStreak}</span>
          </div>
          <div className="text-[8px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Streak</div>
        </div>
        <div className="text-center rounded-lg py-1.5" style={{ background: 'var(--muted)' }}>
          <div className="text-sm font-bold tabular" style={{ color: '#22c55e' }}>
            {monthSummary.daysStudied}/{monthSummary.daysInMonth}
          </div>
          <div className="text-[8px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Days</div>
        </div>
        <div className="text-center rounded-lg py-1.5" style={{ background: 'var(--muted)' }}>
          <div className="text-sm font-bold tabular" style={{ color: '#14b8a6' }}>{formatHM(monthSummary.dailyAvgSec)}</div>
          <div className="text-[8px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Avg/day</div>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((wd, i) => (
          <div key={i} className="text-[9px] text-white/60 text-center font-bold uppercase">{wd}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthData.map((cell, i) => {
          if (!cell.date) {
            return <div key={i} className="aspect-square rounded-md" />;
          }
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDate;
          return (
            <button
              key={i}
              onClick={() => {
                vibrate(6);
                setSelectedDate(isSelected ? null : cell.key);
              }}
              className={cn(
                'aspect-square rounded-md flex items-center justify-center text-[11px] font-bold transition active:scale-90 relative',
                cell.intensity > 0 ? 'text-white' : 'text-white/60'
              )}
              style={{
                background: intensityColors[cell.intensity],
                outline: isSelected ? '2px solid #fff' : isToday ? '2px solid #fbbf24' : undefined,
                outlineOffset: -2,
              }}
              title={cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + (cell.hours > 0 ? formatHM(cell.studySec) : 'No study')}
            >
              {cell.dayNum}
              {isToday && !isSelected && (
                <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend + hint */}
      <div className="flex items-center justify-between mt-3 text-[8px] text-white/60">
        <span>← swipe to navigate →</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {intensityColors.map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Day detail popup — full screen overlay */}
      <AnimatePresence>
        {selectedDayData && (
          <DayDetailPopup
            date={selectedDayData.date!}
            sessions={selectedDaySessions}
            totalStudySec={selectedDayData.studySec}
            totalWastedSec={selectedDayData.wastedSec}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ Day Detail Popup — full screen, horizontal scroll subjects ============ */

function DayDetailPopup({
  date,
  sessions,
  totalStudySec,
  totalWastedSec,
  onClose,
}: {
  date: Date;
  sessions: SavedSession[];
  totalStudySec: number;
  totalWastedSec: number;
  onClose: () => void;
}) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Group sessions by subject
  const subjectData = useMemo(() => {
    const map: Record<string, { study: number; wasted: number; sessions: SavedSession[] }> = {};
    for (const s of sessions) {
      const subj = s.subject || 'Other';
      if (!map[subj]) map[subj] = { study: 0, wasted: 0, sessions: [] };
      map[subj].study += s.studySeconds;
      map[subj].wasted += s.wastedSeconds;
      map[subj].sessions.push(s);
    }
    return map;
  }, [sessions]);

  const subjectList = Object.keys(subjectData).sort((a, b) => subjectData[b].study - subjectData[a].study);

  // Filtered sessions based on selected subject
  const displaySessions = selectedSubject
    ? subjectData[selectedSubject]?.sessions || []
    : sessions;

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-3xl overflow-hidden glass-strong"
        data-card
      >
        {/* Cross button — top right, high contrast */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* === Header: Date + Total Study + Total Wasted === */}
        <div className="shrink-0 px-4 pt-5 pb-3 border-b border-white/10">
          <div className="text-sm font-bold text-foreground pr-8">{dateStr}</div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-green-400" />
              <span className="text-lg font-bold tabular text-green-400">{formatHM(totalStudySec)}</span>
              <span className="text-[9px] text-muted-foreground uppercase">studied</span>
            </div>
            {totalWastedSec > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-red-400" />
                <span className="text-sm font-bold tabular text-red-400">{formatHM(totalWastedSec)}</span>
                <span className="text-[9px] text-muted-foreground uppercase">wasted</span>
              </div>
            )}
          </div>
        </div>

        {/* === Subject chips — horizontal scroll === */}
        <div className="shrink-0 py-2 px-4">
          <div
            className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1"
            data-card
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* "All" chip */}
            <button
              onClick={() => { vibrate(6); setSelectedSubject(null); }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition active:scale-95',
                selectedSubject === null
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              All ({sessions.length})
            </button>
            {/* Per-subject chips */}
            {subjectList.map((subj) => {
              const data = subjectData[subj];
              const sc = subjectColor(subj as any);
              const isActive = selectedSubject === subj;
              return (
                <button
                  key={subj}
                  onClick={() => { vibrate(6); setSelectedSubject(isActive ? null : subj); }}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition active:scale-95 flex items-center gap-1.5',
                  )}
                  style={isActive
                    ? { background: `${sc.hex}25`, color: sc.hex, border: `1px solid ${sc.hex}40` }
                    : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                  }
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: sc.hex }} />
                  {subj} · {formatHM(data.study)}
                  {data.wasted > 0 && <span className="text-red-400/60">⚠{Math.round(data.wasted / 60)}m</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* === Session list — scrollable === */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {displaySessions.length > 0 ? (
            <div className="space-y-1.5">
              {displaySessions.map((s, i) => {
                const isPractice = s.topic?.includes('·') && s.mode === 'free';
                const isTest = s.lecture?.toLowerCase().includes('test');
                const Icon = isPractice ? Brain : isTest ? FileText : BookOpen;
                const iconColor = isPractice ? '#3b82f6' : isTest ? '#a855f7' : '#22c55e';
                const sc = subjectColor(s.subject as any);
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    style={{ borderLeft: `3px solid ${sc.hex}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${iconColor}20` }}>
                      <Icon size={14} style={{ color: iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-foreground truncate">
                        {s.subject}{s.chapter && s.chapter !== 'All' ? ` · ${s.chapter}` : ''}
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate">
                        {s.lecture || s.topic || ''}
                        {s.mood && ` · ${s.mood}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold tabular" style={{ color: iconColor }}>
                        {formatHM(s.studySeconds)}
                      </div>
                      {s.wastedSeconds > 0 && (
                        <div className="text-[9px] text-red-400/70 tabular">⚠ {formatHM(s.wastedSeconds)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-[10px] text-white/50">No sessions recorded this day.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
