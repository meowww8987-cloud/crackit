'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, AlertCircle, BookOpen, FileText, Brain } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { dateKey, addDays, formatHM, cn } from '@/lib/utils';

/**
 * HeatmapCalendar — GitHub-style 365-day study heatmap with month navigation.
 *
 * Features:
 * - 365-day grid with color intensity (0h→faint, 7h+→bright green)
 * - Month navigation: prev/next buttons + swipe left/right inside the heatmap
 * - Today's date highlighted with a ring
 * - Tap any day → detail sheet showing ALL sessions for that day
 *   (study time, wasted time, free study, practice, test — all visible)
 * - data-card attribute on outer container to prevent AppShell swipe interference
 */
export function HeatmapCalendar() {
  const sessions = useHistory((s) => s.sessions);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Build last 365 days of data
  const days = useMemo(() => {
    const result: { date: string; day: Date; hours: number; intensity: number; wastedSec: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dateKey(d);
      const daySessions = sessions.filter((s) => s.date === key);
      const daySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
      const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
      const hours = daySec / 3600;
      const intensity = hours >= 7 ? 4 : hours >= 4 ? 3 : hours >= 1 ? 2 : hours > 0 ? 1 : 0;
      result.push({ date: key, day: d, hours, intensity, wastedSec });
    }
    return result;
  }, [sessions]);

  // Group into weeks (columns of 7 days)
  const weeks = useMemo(() => {
    const w: typeof days[] = [];
    let currentWeek: typeof days = [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i].day;
      if (d.getDay() === 0 && currentWeek.length > 0) {
        w.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(days[i]);
    }
    if (currentWeek.length > 0) w.push(currentWeek);
    return w;
  }, [days]);

  const intensityColors = [
    'rgba(255,255,255,0.06)',
    'rgba(34,197,94,0.25)',
    'rgba(34,197,94,0.5)',
    'rgba(34,197,94,0.75)',
    'rgba(34,197,94,1)',
  ];

  const todayKey = dateKey(new Date());

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, idx) => {
      const month = week[0]?.day.getMonth();
      if (month !== lastMonth && week[0]?.day.getDate() <= 7) {
        labels.push({
          weekIdx: idx,
          label: week[0].day.toLocaleDateString('en-US', { month: 'short' }),
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  // Scroll to current month on mount + when currentMonth changes
  useEffect(() => {
    if (!scrollRef.current) return;
    // Find the week index of the first day of currentMonth
    const targetKey = dateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    const weekIdx = weeks.findIndex(w => w.some(d => d.date === targetKey));
    if (weekIdx >= 0) {
      const cellWidth = 13; // 10px cell + 3px gap
      scrollRef.current.scrollTo({ left: weekIdx * cellWidth, behavior: 'smooth' });
    }
  }, [currentMonth, weeks]);

  // Touch handlers for swipe-to-navigate-month (doesn't bubble to AppShell)
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
      // Swipe right → previous month
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      // Swipe left → next month
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Stats
  const totalHours = days.reduce((a, d) => a + d.hours, 0);
  const activeDays = days.filter((d) => d.hours > 0).length;
  const bestStreak = useMemo(() => {
    let max = 0; let current = 0;
    for (const d of days) {
      if (d.hours > 0) { current++; max = Math.max(max, current); }
      else current = 0;
    }
    return max;
  }, [days]);

  const selectedDay = selectedDate ? days.find((d) => d.date === selectedDate) : null;
  const selectedDaySessions = selectedDate ? sessions.filter((s) => s.date === selectedDate) : [];

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const canGoPrev = currentMonth > new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
  const canGoNext = currentMonth < new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <div className="glass rounded-2xl p-4" data-card>
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
            onClick={() => canGoPrev && setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            disabled={!canGoPrev}
            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 disabled:opacity-30 transition"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-white/80 min-w-[100px] text-center">{monthLabel}</span>
          <button
            onClick={() => canGoNext && setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            disabled={!canGoNext}
            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 disabled:opacity-30 transition"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold tabular text-green-400">{Math.round(totalHours)}h</div>
          <div className="text-[9px] text-white/40 uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold tabular text-teal-400">{activeDays}</div>
          <div className="text-[9px] text-white/40 uppercase">Active days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold tabular text-amber-400">{bestStreak}</div>
          <div className="text-[9px] text-white/40 uppercase">Best streak</div>
        </div>
      </div>

      {/* Heatmap grid — horizontal scroll + swipe to navigate months */}
      <div
        ref={scrollRef}
        className="overflow-x-auto no-scrollbar pb-2"
        data-heatmap
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Month labels row */}
          <div className="flex gap-[3px] pl-6">
            {weeks.map((_, idx) => {
              const label = monthLabels.find((m) => m.weekIdx === idx);
              return (
                <div key={idx} className="w-[10px] text-[8px] text-white/40 h-3 flex items-end">
                  {label ? <span className="absolute -translate-x-1/2 ml-[5px]">{label.label}</span> : null}
                </div>
              );
            })}
          </div>

          {/* Days grid */}
          <div className="flex gap-[3px]">
            {/* Weekday labels column */}
            <div className="flex flex-col gap-[3px] pr-1">
              {['Mon', 'Wed', 'Fri'].map((d, i) => (
                <div key={d} className={cn('text-[8px] text-white/30 leading-[10px] w-6',
                  i === 0 ? 'h-[10px]' : i === 1 ? 'h-[10px] mt-[13px]' : 'h-[10px] mt-[13px]'
                )}>
                  {d}
                </div>
              ))}
            </div>
            {/* Week columns */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const isToday = day.date === todayKey;
                  const isSelected = day.date === selectedDate;
                  return (
                    <motion.div
                      key={day.date}
                      whileHover={{ scale: 1.4, zIndex: 10 }}
                      onClick={() => setSelectedDate(isSelected ? null : day.date)}
                      className="w-[10px] h-[10px] rounded-sm cursor-pointer transition-colors"
                      style={{
                        background: intensityColors[day.intensity],
                        outline: isSelected ? '1.5px solid #fff' : isToday ? '1.5px solid #fbbf24' : undefined,
                        outlineOffset: 1,
                      }}
                      title={`${day.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${formatHM(day.hours * 3600)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-[8px] text-white/40">
        <span>Swipe ←/→ to navigate months</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {intensityColors.map((c, i) => (
            <div key={i} className="w-[10px] h-[10px] rounded-sm" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Selected day detail sheet */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="pt-3 border-t border-white/10">
              {/* Date header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-bold">
                    {selectedDay.day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-white/50">
                    {selectedDay.hours > 0 ? `${formatHM(selectedDay.hours * 3600)} studied` : 'No study this day'}
                    {selectedDay.wastedSec > 0 && (
                      <span className="text-red-400/70 ml-2">⚠ {formatHM(selectedDay.wastedSec)} wasted</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Session list */}
              {selectedDaySessions.length > 0 ? (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {selectedDaySessions.map((s, i) => {
                    const isPractice = s.topic?.includes('·') && s.mode === 'free';
                    const isTest = s.lecture?.includes('test') || s.lecture?.includes('Test');
                    const isFreeStudy = s.mode === 'free' && !isPractice;
                    const Icon = isPractice ? Brain : isTest ? FileText : isFreeStudy ? BookOpen : Clock;
                    const iconColor = isPractice ? '#3b82f6' : isTest ? '#a855f7' : isFreeStudy ? '#22c55e' : '#6b7280';
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}20` }}>
                          <Icon size={13} style={{ color: iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold truncate">
                            {s.subject}{s.chapter && s.chapter !== 'All' ? ` · ${s.chapter}` : ''}
                          </div>
                          <div className="text-[9px] text-white/40 truncate">
                            {s.lecture || s.topic || ''}
                            {s.mood && ` · ${s.mood}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold tabular" style={{ color: iconColor }}>
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
                <div className="text-center py-4">
                  <p className="text-[10px] text-white/30">No sessions recorded this day.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
