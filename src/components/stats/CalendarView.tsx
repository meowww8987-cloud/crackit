'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { cn, formatHM, dateKey, addDays } from '@/lib/utils';

/**
 * CalendarView — monthly calendar showing study time per day.
 * Each day cell is color-coded by study intensity (like Apple Calendar).
 * Tap any day to see that day's total study time.
 *
 * Sits above the 365-day heatmap in the Stats tab.
 */
export function CalendarView() {
  const sessions = useHistory((s) => s.sessions);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build study time map for the current month
  const studyMap = useMemo(() => {
    const map: Record<string, number> = {};
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    for (const s of sessions) {
      const d = new Date(s.date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        map[s.date] = (map[s.date] || 0) + s.studySeconds;
      }
    }
    return map;
  }, [sessions, currentMonth]);

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();
  const today = dateKey(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getColor = (sec: number) => {
    if (sec === 0) return 'transparent';
    const hours = sec / 3600;
    if (hours >= 6) return 'rgba(34, 197, 94, 0.9)';
    if (hours >= 4) return 'rgba(34, 197, 94, 0.6)';
    if (hours >= 2) return 'rgba(34, 197, 94, 0.4)';
    if (hours >= 1) return 'rgba(34, 197, 94, 0.2)';
    return 'rgba(34, 197, 94, 0.1)';
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const selectedSec = selectedDate ? studyMap[selectedDate] || 0 : 0;
  const selectedSessions = selectedDate
    ? sessions.filter((s) => s.date === selectedDate)
    : [];

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalIcon size={14} className="text-green-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{monthName}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-foreground/10">
            <ChevronLeft size={14} />
          </button>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground hover:bg-foreground/10">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-muted-foreground/60 uppercase">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const day = parseInt(dateStr.split('-')[2]);
          const sec = studyMap[dateStr] || 0;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center transition text-[10px] font-bold',
                isSelected && 'ring-2 ring-teal-400',
              )}
              style={{
                background: getColor(sec),
                color: sec > 0 ? '#000' : 'rgba(255,255,255,0.4)',
              }}
            >
              {day}
              {isToday && <div className="w-1 h-1 rounded-full bg-teal-400 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-border"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            <span className="text-xs tabular text-green-400 font-bold">{formatHM(selectedSec)}</span>
          </div>
          {selectedSessions.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto scroll-area">
              {selectedSessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground tabular">
                    {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{s.subject} · {s.chapter}</span>
                  <span className="text-green-400 tabular">{formatHM(s.studySeconds)}</span>
                  {s.wastedSeconds > 0 && <span className="text-red-400 tabular">⚠ {formatHM(s.wastedSeconds)}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No study sessions on this day.</p>
          )}
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-2 text-[8px] text-muted-foreground/60">
        <span>Less</span>
        {[0.1, 0.2, 0.4, 0.6, 0.9].map((o) => (
          <div key={o} className="w-2.5 h-2.5 rounded-sm" style={{ background: `rgba(34,197,94,${o})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
