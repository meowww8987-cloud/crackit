'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, BookOpen, FileText, Brain } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { dateKey, formatHM, cn, vibrate } from '@/lib/utils';

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
export function HeatmapCalendar() {
  const sessions = useHistory((s) => s.sessions);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const todayKey = dateKey(new Date());

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

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = dateKey(date);
      const daySessions = sessions.filter((s) => s.date === key);
      const studySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
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
  }, [currentMonth, sessions]);

  // Intensity colors
  const intensityColors = [
    'rgba(255,255,255,0.06)',
    'rgba(34,197,94,0.25)',
    'rgba(34,197,94,0.5)',
    'rgba(34,197,94,0.75)',
    'rgba(34,197,94,1)',
  ];

  // Stats for the full 365 days
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
      const daySec = sessions.filter((s) => s.date === key).reduce((a, s) => a + s.studySeconds, 0);
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
  }, [sessions]);

  // Touch handlers for swipe-to-navigate (doesn't bubble to AppShell)
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
    <div className="glass rounded-2xl p-4" data-card data-heatmap
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

      {/* Yearly stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center rounded-lg bg-white/5 py-1.5">
          <div className="text-base font-bold tabular text-green-400">{Math.round(yearlyStats.totalHours)}h</div>
          <div className="text-[8px] text-white/60 uppercase">365d Total</div>
        </div>
        <div className="text-center rounded-lg bg-white/5 py-1.5">
          <div className="text-base font-bold tabular text-teal-400">{yearlyStats.activeDays}</div>
          <div className="text-[8px] text-white/60 uppercase">Active days</div>
        </div>
        <div className="text-center rounded-lg bg-white/5 py-1.5">
          <div className="text-base font-bold tabular text-amber-400">{yearlyStats.bestStreak}</div>
          <div className="text-[8px] text-white/60 uppercase">Best streak</div>
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

      {/* Selected day detail sheet */}
      <AnimatePresence>
        {selectedDayData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/10">
              {/* Date header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-bold">
                    {selectedDayData.date!.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-white/50">
                    {selectedDayData.hours > 0
                      ? `${formatHM(selectedDayData.studySec)} studied`
                      : 'No study this day'}
                    {selectedDayData.wastedSec > 0 && (
                      <span className="text-red-400/70 ml-2">⚠ {formatHM(selectedDayData.wastedSec)} wasted</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Session list */}
              {selectedDaySessions.length > 0 ? (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {selectedDaySessions.map((s, i) => {
                    const isPractice = s.topic?.includes('·') && s.mode === 'free';
                    const isTest = s.lecture?.toLowerCase().includes('test');
                    const Icon = isPractice ? Brain : isTest ? FileText : BookOpen;
                    const iconColor = isPractice ? '#3b82f6' : isTest ? '#a855f7' : '#22c55e';
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}20` }}>
                          <Icon size={14} style={{ color: iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold truncate">
                            {s.subject}{s.chapter && s.chapter !== 'All' ? ` · ${s.chapter}` : ''}
                          </div>
                          <div className="text-[9px] text-white/60 truncate">
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
                <div className="text-center py-3">
                  <p className="text-[10px] text-white/50">No sessions recorded this day.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
