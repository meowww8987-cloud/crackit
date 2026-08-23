'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useRecall } from '@/lib/store/recall';
import { useSyllabus } from '@/lib/store/syllabus';
import { useSettings } from '@/lib/store/settings';
import { useProgress } from '@/lib/store/progress';
import { subjectColor } from '@/lib/colors';
import { triggerTimeline } from '@/components/app/AppShell';
import { PeakStudyTime } from '@/components/stats/PeakStudyTime';
import { ActivityCard } from '@/components/stats/ActivityCard';
import { SleepHealthCard } from '@/components/stats/SleepHealthCard';
import { SubjectBreakdown } from '@/components/stats/SubjectBreakdown';
import { ProgressGraph } from '@/components/stats/ProgressGraph';
import { SleepReportSheet } from '@/components/dailylog/SleepReportSheet';
import {
  moodDistribution,
} from '@/lib/analytics';
import { formatHM, isRevisionOverdue } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

export function StatsTab() {
  const sessions = useHistory((s) => s.sessions);
  const retentionTrend = useRecall((s) => s.challenges);
  const lectures = useSyllabus((s) => s.lectures);
  const prefer2D = useSettings((s) => s.prefer2D);
  const [showSleepReport, setShowSleepReport] = useState(false);

  const moods = useMemo(() => moodDistribution(sessions), [sessions]);
  const retentionData = useMemo(
    () => retentionTrend.filter((c) => c.completedAt > 0).map((c) => ({ date: c.date, score: c.retentionScore })),
    [retentionTrend]
  );
  const overdueRevisions = lectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt));
  const dueRevisions = lectures.filter((l) => l.done && l.nextRevisionAt);

  if (sessions.length === 0) {
    return (
      <div className="pt-2 pb-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 size={20} className="text-teal-400" />
          Stats
        </h1>
        <div className="glass rounded-2xl p-8 text-center">
          <BarChart3 size={40} className="text-white/40 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Complete study sessions to see analytics here.</p>
        </div>
        <ProgressTimelineSection />
      </div>
    );
  }

  return (
    <div className="pt-2 pb-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <BarChart3 size={20} className="text-teal-400" />
        Stats
      </h1>

      {/* === Activity card — Week | Month segmented control === */}
      <ActivityCard />

      {/* === Sleep Health — modernized card with score ring === */}
      <SleepHealthCard onTap={() => setShowSleepReport(true)} />

      <SleepReportSheet open={showSleepReport} onClose={() => setShowSleepReport(false)} />

      {/* Subject Breakdown — 3-level card (replaces stacked bars + sunburst + donut + neglected) */}
      <SubjectBreakdown />

      {/* 30-Day Progress Graph — modern area chart with goal line */}
      <ProgressGraph />

      {/* Mood distribution */}
      <div className="grid grid-cols-1 gap-3">
        {moods.length > 0 && (
          <ChartCard title="Mood Distribution">
            <div className="flex items-center gap-3">
              <div className="h-28 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
                      {moods.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--foreground)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1">
                {moods.map((m) => (
                  <div key={m.name} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{m.emoji}</span>
                    <span className="flex-1" style={{ color: 'var(--muted-foreground)' }}>{m.name}</span>
                    <span className="tabular font-bold" style={{ color: 'var(--foreground)' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      {/* Best study hour — 3-level Peak Study Time card */}
      <PeakStudyTime />

      {/* Retention trend */}
      {retentionData.length > 0 && (
        <ChartCard title="Active Recall Retention">
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--foreground)' }}
                  labelStyle={{ color: 'var(--foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: '#a855f7' }} name="Retention %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Resource completion breakdown */}
      <ChartCard title="Syllabus Resource Completion">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Lectures', icon: '📺', done: lectures.filter(l => l.done).length, color: '#14b8a6' },
            { label: 'DPPs', icon: '📝', done: lectures.filter(l => l.dppDone).length, color: '#22c55e' },
            { label: 'Notes', icon: '📖', done: lectures.filter(l => l.notesDone).length, color: '#3b82f6' },
            { label: 'Revisions', icon: '🔄', done: lectures.filter(l => l.revisionDone).length, color: '#f59e0b' },
          ].map((r) => (
            <div key={r.label} className="glass rounded-xl p-2.5 text-center">
              <div className="text-base mb-0.5">{r.icon}</div>
              <CountUp value={r.done} duration={900} animateOnChange className="text-lg font-bold tabular" style={{ color: r.color }} />
              <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>{r.label}</div>
              <div className="text-[8px] tabular" style={{ color: 'var(--muted-foreground)' }}>/ {lectures.length}</div>
            </div>
          ))}
        </div>
        {lectures.length > 0 && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex justify-between text-[10px] mb-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Overall completion</span>
              <span className="tabular font-bold" style={{ color: '#14b8a6' }}>
                {Math.round(
                  ((lectures.filter(l => l.done).length +
                    lectures.filter(l => l.dppDone).length +
                    lectures.filter(l => l.notesDone).length +
                    lectures.filter(l => l.revisionDone).length) /
                    (lectures.length * 4)) * 100
                )}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-green-500"
                style={{
                  width: `${Math.round(
                    ((lectures.filter(l => l.done).length +
                      lectures.filter(l => l.dppDone).length +
                      lectures.filter(l => l.notesDone).length +
                      lectures.filter(l => l.revisionDone).length) /
                      (lectures.length * 4)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </ChartCard>

      {/* Spaced repetition status */}
      <ChartCard title="Spaced Repetition Status">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold tabular" style={{ color: '#22c55e' }}>{lectures.filter(l => l.done && l.revisionStage >= 0 && !isRevisionOverdue(l.nextRevisionAt)).length}</div>
            <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>On track</div>
          </div>
          <div className="glass rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold tabular" style={{ color: '#f59e0b' }}>{overdueRevisions.length}</div>
            <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Overdue</div>
          </div>
          <div className="glass rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold tabular" style={{ color: 'var(--foreground)' }}>{dueRevisions.length}</div>
            <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Total due</div>
          </div>
        </div>
      </ChartCard>

      {/* Progress Timeline trigger */}
      <ProgressTimelineSection />

      {prefer2D && (
        <p className="text-center text-[10px]" style={{ color: 'var(--muted-foreground)' }}>2D graph mode enabled in settings</p>
      )}
    </div>
  );
}

function ProgressTimelineSection() {
  const allEvents = useProgress((s) => s.events);
  const recentEvents = useMemo(
    () => [...allEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [allEvents]
  );
  const totalDone = useMemo(
    () => allEvents.filter((e) => e.type === 'lecture_done').length,
    [allEvents]
  );

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
          <TrendingUp size={12} style={{ color: '#14b8a6' }} /> Progress Timeline
        </h3>
        <button
          onClick={() => triggerTimeline()}
          className="text-[10px] px-2 py-1 rounded-full font-semibold"
          style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}
        >
          View All →
        </button>
      </div>

      {recentEvents.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--muted-foreground)' }}>
          No progress yet. Mark lectures done to see your timeline.
        </p>
      ) : (
        <div className="space-y-1.5">
          {recentEvents.map((e) => {
            const color = subjectColor(e.subject);
            const time = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.hex }} />
                <span className="truncate flex-1" style={{ color: 'var(--foreground)' }}>{e.topic}</span>
                <span className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>{time}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 flex items-center justify-between text-[10px]" style={{ borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>Total lectures done</span>
        <span className="font-bold tabular" style={{ color: '#22c55e' }}>{totalDone}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass rounded-2xl p-4"
    >
      <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--foreground)' }}>{title}</h3>
      {children}
    </motion.div>
  );
}
