'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { dateKey, addDays, formatHM } from '@/lib/utils';

export function SubjectWeeklyBreakdown() {
  const sessions = useHistory((s) => s.sessions);

  const data = useMemo(() => {
    const days: { label: string; date: string; subjects: Record<string, { study: number; wasted: number }> }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
      const daySessions = sessions.filter((s) => s.date === key);
      const subjects: Record<string, { study: number; wasted: number }> = {};
      for (const subj of SUBJECTS) {
        const subjSessions = daySessions.filter((s) => s.subject === subj);
        subjects[subj] = {
          study: subjSessions.reduce((a, s) => a + s.studySeconds, 0),
          wasted: subjSessions.reduce((a, s) => a + s.wastedSeconds, 0),
        };
      }
      days.push({ label, date: key, subjects });
    }

    const totals: Record<string, { study: number; wasted: number }> = {};
    for (const subj of SUBJECTS) {
      totals[subj] = {
        study: days.reduce((a, d) => a + d.subjects[subj].study, 0),
        wasted: days.reduce((a, d) => a + d.subjects[subj].wasted, 0),
      };
    }

    const maxStudy = Math.max(...days.map(d => Object.values(d.subjects).reduce((a, s) => a + s.study, 0)), 1);

    return { days, totals, maxStudy };
  }, [sessions]);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-teal-400" />
        <span className="text-xs font-bold text-muted-foreground">7-Day Subject Breakdown</span>
      </div>

      {/* Stacked bar chart — one bar per day */}
      <div className="flex items-end justify-between gap-1.5 h-32 mb-3">
        {data.days.map((day, i) => {
          const totalStudy = Object.values(day.subjects).reduce((a, s) => a + s.study, 0);
          const totalWasted = Object.values(day.subjects).reduce((a, s) => a + s.wasted, 0);
          const heightPct = data.maxStudy > 0 ? Math.max(2, (totalStudy / data.maxStudy) * 100) : 0;

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              {/* Wasted indicator (red dot above bar) */}
              {totalWasted > 0 && (
                <div className="text-[8px] text-red-400 tabular leading-none">
                  ⚠{Math.round(totalWasted / 60)}m
                </div>
              )}
              {/* Stacked bar */}
              <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${heightPct}%`, minHeight: totalStudy > 0 ? '4px' : '0' }}>
                {SUBJECTS.map((subj) => {
                  const sec = day.subjects[subj].study;
                  if (sec === 0) return null;
                  const segPct = totalStudy > 0 ? (sec / totalStudy) * 100 : 0;
                  const c = subjectColor(subj);
                  return (
                    <motion.div
                      key={subj}
                      initial={{ height: 0 }}
                      animate={{ height: `${segPct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      style={{ background: c.hex }}
                      title={`${subj}: ${formatHM(sec)}`}
                    />
                  );
                })}
              </div>
              {/* Day label */}
              <span className="text-[9px] text-muted-foreground">{day.label}</span>
            </div>
          );
        })}
      </div>

      {/* Subject legend with weekly totals */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        {SUBJECTS.filter(subj => data.totals[subj].study > 0 || data.totals[subj].wasted > 0).map((subj) => {
          const c = subjectColor(subj);
          const t = data.totals[subj];
          return (
            <div key={subj} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.hex }} />
              <span className="text-muted-foreground flex-1">{subj}</span>
              <span className="tabular font-semibold" style={{ color: c.hex }}>
                {formatHM(t.study)}
              </span>
              {t.wasted > 0 && (
                <span className="tabular text-red-400/70 text-[10px]">
                  ⚠ {formatHM(t.wasted)}
                </span>
              )}
            </div>
          );
        })}
        {SUBJECTS.every(subj => data.totals[subj].study === 0) && (
          <p className="text-xs text-muted-foreground text-center py-2">No study data this week yet</p>
        )}
      </div>
    </div>
  );
}
