'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { dateKey, addDays } from '@/lib/utils';

export function MiniHeatmap() {
  const sessions = useHistory((s) => s.sessions);

  const last7Days = useMemo(() => {
    const result: { date: string; label: string; hours: number; intensity: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const daySec = sessions.filter((s) => s.date === key).reduce((a, s) => a + s.studySeconds, 0);
      const hours = daySec / 3600;
      const intensity = hours >= 7 ? 4 : hours >= 4 ? 3 : hours >= 1 ? 2 : hours > 0 ? 1 : 0;
      result.push({
        date: key,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        hours,
        intensity,
      });
    }
    return result;
  }, [sessions]);

  const intensityColors = ['rgba(255,255,255,0.05)', 'rgba(34,197,94,0.25)', 'rgba(34,197,94,0.5)', 'rgba(34,197,94,0.75)', 'rgba(34,197,94,1)'];
  const avgHours = last7Days.reduce((a, d) => a + d.hours, 0) / 7;

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} className="text-teal-400" />
        <span className="text-xs font-bold text-white/70">Last 7 Days</span>
        <span className="text-[10px] text-white/40 ml-auto tabular">avg {avgHours.toFixed(1)}h/day</span>
      </div>
      <div className="flex gap-1.5">
        {last7Days.map((day, i) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <div
              className="w-full aspect-square rounded-lg flex items-center justify-center"
              style={{ background: intensityColors[day.intensity] }}
              title={`${day.hours.toFixed(1)}h studied`}
            >
              {day.intensity > 0 && (
                <span className="text-[8px] font-bold text-black/70 tabular">
                  {day.hours >= 1 ? `${Math.round(day.hours)}h` : ''}
                </span>
              )}
            </div>
            <span className="text-[8px] text-white/30">{day.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
