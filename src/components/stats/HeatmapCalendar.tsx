'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { dateKey, addDays, formatHM } from '@/lib/utils';

/**
 * HeatmapCalendar — GitHub-style full-year study intensity heatmap.
 *
 * Renders the last 365 days as a grid of small squares. Each square's color
 * intensity reflects total study time that day (0h → faint, 7h+ → bright green).
 *
 * Tap any day to see that day's total study time in a tooltip / expandable row.
 *
 * Used in the Stats tab as a long-term motivation visualization.
 */
export function HeatmapCalendar() {
  const sessions = useHistory((s) => s.sessions);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build last 365 days of data
  const days = useMemo(() => {
    const result: { date: string; day: Date; hours: number; intensity: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dateKey(d);
      const daySec = sessions.filter((s) => s.date === key).reduce((a, s) => a + s.studySeconds, 0);
      const hours = daySec / 3600;
      const intensity = hours >= 7 ? 4 : hours >= 4 ? 3 : hours >= 1 ? 2 : hours > 0 ? 1 : 0;
      result.push({ date: key, day: d, hours, intensity });
    }
    return result;
  }, [sessions]);

  // Group into weeks (columns of 7 days). GitHub-style layout.
  const weeks = useMemo(() => {
    const w: typeof days[] = [];
    let currentWeek: typeof days = [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i].day;
      // Start a new week on Sunday
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

  // Month labels (positioned above the week columns)
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

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-green-400" />
        <span className="text-xs font-bold uppercase tracking-wide text-white/60">
          Study Heatmap · 365 days
        </span>
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

      {/* Heatmap grid — horizontal scroll on mobile */}
      <div className="overflow-x-auto no-scrollbar pb-2">
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
              {['Mon', 'Wed', 'Fri'].map((d) => (
                <div key={d} className="text-[8px] text-white/30 h-[10px] leading-[10px] w-6">
                  {d}
                </div>
              ))}
            </div>
            {/* Week columns */}
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <motion.div
                    key={day.date}
                    whileHover={{ scale: 1.4, zIndex: 10 }}
                    onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                    className="w-[10px] h-[10px] rounded-sm cursor-pointer transition-colors"
                    style={{
                      background: intensityColors[day.intensity],
                      outline: day.date === selectedDate ? '1.5px solid #fff' : undefined,
                      outlineOffset: 1,
                    }}
                    title={`${day.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${formatHM(day.hours * 3600)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-[8px] text-white/40">
        <span>Less</span>
        {intensityColors.map((c, i) => (
          <div key={i} className="w-[10px] h-[10px] rounded-sm" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold">
              {selectedDay.day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-[10px] text-white/50">
              {selectedDay.hours > 0 ? `${formatHM(selectedDay.hours * 3600)} studied` : 'No study this day'}
            </div>
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-white/40"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </div>
  );
}
