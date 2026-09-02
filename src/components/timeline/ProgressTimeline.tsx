'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Undo2, Trophy, RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { useProgress, type ProgressEvent } from '@/lib/store/progress';
import { subjectColor } from '@/lib/colors';
import { cn, todayKey } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

const EVENT_META = {
  lecture_done: { icon: Check, color: '#22c55e', label: 'Marked done', bg: 'rgba(34,197,94,0.15)' },
  lecture_undone: { icon: Undo2, color: '#f59e0b', label: 'Marked undone', bg: 'rgba(245,158,11,0.15)' },
  chapter_complete: { icon: Trophy, color: '#a855f7', label: 'Chapter complete!', bg: 'rgba(168,85,247,0.15)' },
  revision_done: { icon: RefreshCw, color: '#14b8a6', label: 'Revision done', bg: 'rgba(20,184,166,0.15)' },
};

export function ProgressTimeline({ onClose }: Props) {
  const events = useProgress((s) => s.events);

  // Compute derived values with useMemo (avoid method-call selectors that cause infinite loops)
  const totalDone = useMemo(
    () => events.filter((e) => e.type === 'lecture_done').length,
    [events]
  );
  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return events.filter((e) => e.type === 'lecture_done' && e.timestamp >= weekAgo).length;
  }, [events]);
  const todayDone = useMemo(() => {
    const today = todayKey();
    return events.filter((e) => e.date === today && e.type === 'lecture_done').length;
  }, [events]);
  const milestones = useMemo(
    () => events.filter((e) => e.type === 'chapter_complete'),
    [events]
  );

  const grouped = useMemo(() => {
    return [...events]
      .sort((a, b) => b.timestamp - a.timestamp)
      .reduce<{ date: string; events: ProgressEvent[] }[]>((acc, e) => {
        const last = acc[acc.length - 1];
        if (last && last.date === e.date) {
          last.events.push(e);
        } else {
          acc.push({ date: e.date, events: [e] });
        }
        return acc;
      }, []);
  }, [events]);

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-[#0a0a0f] flex flex-col force-dark-ui"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-teal-400" />
          <h1 className="text-lg font-bold">Progress Timeline</h1>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2 px-5 py-3">
        <StatCard label="Today" value={todayDone} color="#22c55e" />
        <StatCard label="This Week" value={thisWeek} color="#14b8a6" />
        <StatCard label="Total Done" value={totalDone} color="#a855f7" />
      </div>

      {/* Milestones banner */}
      {milestones.length > 0 && (
        <div className="px-5 pb-2">
          <div className="glass rounded-xl p-2.5 flex items-center gap-2 border border-purple-500/20">
            <Trophy size={14} className="text-purple-400" />
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-purple-300">{milestones.length}</span> chapter{milestones.length !== 1 ? 's' : ''} completed
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scroll-area px-5 pb-8">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TrendingUp size={48} className="text-muted-foreground/15 mb-4" />
            <p className="text-muted-foreground text-sm max-w-xs">
              No progress yet. Mark lectures as done in the Syllabus tab to see your milestones appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {grouped.map((day) => {
              const d = new Date(day.date + 'T00:00:00');
              const isToday = day.date === todayKey();
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
              const dayLabel = isToday ? 'Today' : day.date === yKey ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
              const dayDoneCount = day.events.filter((e) => e.type === 'lecture_done').length;

              return (
                <div key={day.date}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={12} className="text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{dayLabel}</span>
                    {dayDoneCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">
                        {dayDoneCount} done
                      </span>
                    )}
                  </div>

                  {/* Events */}
                  <div className="relative pl-6 space-y-2">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-foreground/5" />

                    {day.events.map((e, i) => {
                      const meta = EVENT_META[e.type];
                      const Icon = meta.icon;
                      const color = subjectColor(e.subject);
                      const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                      return (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="relative"
                        >
                          {/* Dot on timeline */}
                          <div
                            className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-[#0a0a0f] z-10"
                            style={{ background: meta.color }}
                          />

                          {/* Event card */}
                          <div
                            className={cn(
                              'glass rounded-xl p-2.5 flex items-center gap-2.5',
                              e.type === 'chapter_complete' && 'border border-purple-500/30'
                            )}
                            style={e.type !== 'chapter_complete' ? { borderLeft: `2px solid ${color.hex}` } : undefined}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: meta.bg }}
                            >
                              <Icon size={14} style={{ color: meta.color }} strokeWidth={2.5} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span
                                  className="text-[9px] font-bold uppercase px-1 py-0.5 rounded"
                                  style={{ background: `${color.hex}22`, color: color.hex }}
                                >
                                  {e.subject}
                                </span>
                                {e.lectureLabel && (
                                  <span className="text-[9px] font-bold text-muted-foreground tabular">{e.lectureLabel}</span>
                                )}
                                <span className="text-[9px] text-muted-foreground/60 ml-auto tabular">{time}</span>
                              </div>
                              <div className={cn(
                                'text-xs truncate',
                                e.type === 'chapter_complete' ? 'font-bold text-purple-300' : 'text-foreground'
                              )}>
                                {e.topic}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {e.chapterName} · {meta.label}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center">
      <div className="text-2xl font-bold tabular" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
