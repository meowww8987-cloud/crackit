'use client';

import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Clock, AlertTriangle, Moon } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useRecall } from '@/lib/store/recall';
import { useSyllabus } from '@/lib/store/syllabus';
import { useSettings } from '@/lib/store/settings';
import { useProgress } from '@/lib/store/progress';
import { useSleep } from '@/lib/store/sleep';
import { subjectColor } from '@/lib/colors';
import { triggerTimeline } from '@/components/app/AppShell';
import { SubjectWeeklyBreakdown } from '@/components/stats/SubjectWeeklyBreakdown';
import { HeatmapCalendar } from '@/components/stats/HeatmapCalendar';
import { SubjectSunburst } from '@/components/stats/SubjectSunburst';
import { PeakStudyTime } from '@/components/stats/PeakStudyTime';
import { SleepReportSheet } from '@/components/dailylog/SleepReportSheet';
import { buildWeeklySleepReport, verdictColor, verdictLabel } from '@/lib/sleepHealth';
import {
  weeklyBarData,
  subjectDistribution,
  trendData,
  moodDistribution,
  wastedRatio,
  weeklyComparison,
  neglectedSubjects,
} from '@/lib/analytics';
import { formatHM, isRevisionOverdue } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

export function StatsTab() {
  const sessions = useHistory((s) => s.sessions);
  const retentionTrend = useRecall((s) => s.challenges);
  const lectures = useSyllabus((s) => s.lectures);
  const prefer2D = useSettings((s) => s.prefer2D);
  const sleepHistory = useSleep((s) => s.history);
  const [showSleepReport, setShowSleepReport] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sleepReport = useMemo(() => buildWeeklySleepReport(sleepHistory), [sleepHistory]);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekly = useMemo(() => weeklyBarData(sessions, weekOffset), [sessions, weekOffset]);
  const weekTouchStartX = useRef<number | null>(null);
  const weekTouchStartY = useRef<number | null>(null);
  const onWeekTouchStart = (e: React.TouchEvent) => {
    weekTouchStartX.current = e.touches[0].clientX;
    weekTouchStartY.current = e.touches[0].clientY;
  };
  const onWeekTouchEnd = (e: React.TouchEvent) => {
    if (weekTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - weekTouchStartX.current;
    const dy = e.changedTouches[0].clientY - (weekTouchStartY.current ?? 0);
    weekTouchStartX.current = null;
    weekTouchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) setWeekOffset(o => Math.max(0, o - 1)); // swipe right = previous week
    else setWeekOffset(o => o + 1); // swipe left = next week
  };
  const distribution = useMemo(() => subjectDistribution(sessions), [sessions]);
  const trend = useMemo(() => trendData(sessions, 30), [sessions]);
  const moods = useMemo(() => moodDistribution(sessions), [sessions]);
  const wasted = useMemo(() => wastedRatio(sessions), [sessions]);
  const comparison = useMemo(() => weeklyComparison(sessions), [sessions]);
  const neglected = useMemo(() => neglectedSubjects(sessions), [sessions]);
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

      {/* Weekly bar chart — swipe left/right to navigate weeks */}
      <div
        data-card
        onTouchStart={onWeekTouchStart}
        onTouchEnd={onWeekTouchEnd}
      >
      <ChartCard title={`Weekly Study Time${weekOffset > 0 ? ` (${weekOffset} week${weekOffset > 1 ? 's' : ''} ago)` : ' (this week)'}`}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'var(--foreground)' }}
              />
              <Bar dataKey="study" radius={[4, 4, 0, 0]} fill="#14b8a6" name="Study (min)" />
              <Bar dataKey="wasted" radius={[4, 4, 0, 0]} fill="#ef4444" name="Wasted (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      {weekOffset > 0 && (
        <div className="text-center text-[9px] text-white/50 mt-1">
          ← swipe right for previous week · swipe left for next week →
        </div>
      )}
      </div>

      {/* === Sleep Health Card — long-press for full report === */}
      {sleepHistory.length > 0 && (
        <motion.div
          className="glass rounded-2xl p-4 border border-indigo-500/25 relative select-none"
          onTouchStart={() => {
            longPressTimer.current = setTimeout(() => {
              setShowSleepReport(true);
            }, 500);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
          onTouchCancel={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Moon size={16} className="text-indigo-300" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">Sleep Health</div>
              <div className="text-[10px] text-white/60">Long-press for full report</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular" style={{ color: verdictColor(sleepReport.verdict) }}>
                {sleepReport.healthScore}
              </div>
              <div className="text-[9px]" style={{ color: verdictColor(sleepReport.verdict) }}>
                {verdictLabel(sleepReport.verdict)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] uppercase text-white/60">Avg</div>
              <div className="text-sm font-semibold tabular">{sleepReport.avgNightHours.toFixed(1)}h</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-white/60">Quality</div>
              <div className="text-sm font-semibold tabular">
                {sleepReport.avgQuality > 0 ? `${sleepReport.avgQuality.toFixed(1)}★` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-white/60">Consist.</div>
              <div className="text-sm font-semibold tabular">{sleepReport.bedtimeConsistency}%</div>
            </div>
          </div>
        </motion.div>
      )}

      <SleepReportSheet open={showSleepReport} onClose={() => setShowSleepReport(false)} />

      {/* 7-Day Subject Breakdown */}
      <SubjectWeeklyBreakdown />

      {/* 365-day Heatmap Calendar */}
      <HeatmapCalendar />

      {/* Subject Sunburst — radial time distribution */}
      <SubjectSunburst />

      {/* Subject distribution donut */}
      {distribution.length > 0 && (
        <ChartCard title="Subject Distribution">
          <div className="flex items-center gap-3">
            <div className="h-36 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                  >
                    {distribution.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 flex-1">
              {distribution.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-white/70 flex-1">{d.name}</span>
                  <span className="tabular text-white/50">{d.value}m</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}

      {/* 30-day trend */}
      <ChartCard title="Study Time Trend (30 days)">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              />
              <Line type="monotone" dataKey="minutes" stroke="#22c55e" strokeWidth={2} dot={false} name="Study (min)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Mood distribution + Wasted ratio */}
      <div className="grid grid-cols-2 gap-3">
        {moods.length > 0 && (
          <ChartCard title="Mood Distribution">
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={moods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
                    {moods.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {moods.map((m) => (
                <span key={m.name} className="text-[9px] flex items-center gap-0.5">
                  <span>{m.emoji}</span>
                  <span className="text-white/50">{m.value}</span>
                </span>
              ))}
            </div>
          </ChartCard>
        )}

        <ChartCard title="Wasted Ratio">
          <div className="h-28 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={[{ name: 'wasted', value: wasted.ratio, fill: '#ef4444' }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background={{ fill: 'var(--border)' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular text-red-400">{wasted.ratio}%</span>
              <span className="text-[9px] text-white/60">wasted</span>
            </div>
          </div>
          <div className="text-[10px] text-white/60 mt-1 text-center tabular">
            {formatHM(wasted.studyMin * 60)} study · {formatHM(wasted.wastedMin * 60)} wasted
          </div>
        </ChartCard>
      </div>

      {/* Weekly comparison */}
      <ChartCard title="Weekly Comparison">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-white/60 mb-1">This Week</div>
            <div className="text-lg font-bold tabular text-teal-400">{formatHM(comparison.thisWeekStudy * 60)}</div>
            <div className="text-[10px] text-red-400 tabular">⚠ {formatHM(comparison.thisWeekWasted * 60)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/60 mb-1">Last Week</div>
            <div className="text-lg font-bold tabular text-white/60">{formatHM(comparison.lastWeekStudy * 60)}</div>
            <div className="text-[10px] text-white/60 tabular">⚠ {formatHM(comparison.lastWeekWasted * 60)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className={`flex items-center gap-1 text-xs font-semibold ${comparison.studyTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {comparison.studyTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {comparison.studyTrend > 0 ? '+' : ''}{comparison.studyTrend}% study
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold ${comparison.wastedTrend <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {comparison.wastedTrend <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {comparison.wastedTrend > 0 ? '+' : ''}{comparison.wastedTrend}% wasted
          </div>
        </div>
      </ChartCard>

      {/* Best study hour — 3-level Peak Study Time card */}
      <PeakStudyTime />

      {/* Neglected subjects */}
      {neglected.length > 0 && (
        <ChartCard title="Neglected Subjects (<5% time)">
          <div className="space-y-1.5">
            {neglected.map((n) => {
              const c = subjectColor(n.subject);
              return (
                <div key={n.subject} className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
                  <span className="text-white/70 flex-1">{n.subject}</span>
                  <span className="tabular text-white/60">{n.minutes}m ({n.pct}%)</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

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
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                />
                <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Retention %" />
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
              <div className="text-[8px] text-white/60">{r.label}</div>
              <div className="text-[8px] text-white/50 tabular">/ {lectures.length}</div>
            </div>
          ))}
        </div>
        {lectures.length > 0 && (
          <div className="mt-3 pt-2 border-t border-white/5">
            <div className="flex justify-between text-[10px] text-white/60 mb-1">
              <span>Overall completion</span>
              <span className="tabular font-bold text-teal-400">
                {Math.round(
                  ((lectures.filter(l => l.done).length +
                    lectures.filter(l => l.dppDone).length +
                    lectures.filter(l => l.notesDone).length +
                    lectures.filter(l => l.revisionDone).length) /
                    (lectures.length * 4)) * 100
                )}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
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
            <div className="text-xl font-bold tabular text-green-400">{lectures.filter(l => l.done && l.revisionStage >= 0 && !isRevisionOverdue(l.nextRevisionAt)).length}</div>
            <div className="text-[9px] text-white/60">On track</div>
          </div>
          <div className="glass rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold tabular text-amber-400">{overdueRevisions.length}</div>
            <div className="text-[9px] text-white/60">Overdue</div>
          </div>
          <div className="glass rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold tabular text-white/60">{dueRevisions.length}</div>
            <div className="text-[9px] text-white/60">Total due</div>
          </div>
        </div>
      </ChartCard>

      {/* Progress Timeline trigger */}
      <ProgressTimelineSection />

      {prefer2D && (
        <p className="text-center text-[10px] text-white/50">2D graph mode enabled in settings</p>
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
        <h3 className="text-xs font-bold text-white/70 flex items-center gap-1.5">
          <TrendingUp size={12} /> Progress Timeline
        </h3>
        <button
          onClick={() => triggerTimeline()}
          className="text-[10px] px-2 py-1 rounded-full bg-teal-500/20 text-teal-400 font-semibold"
        >
          View All →
        </button>
      </div>

      {recentEvents.length === 0 ? (
        <p className="text-xs text-white/60 text-center py-3">
          No progress yet. Mark lectures done to see your timeline.
        </p>
      ) : (
        <div className="space-y-1.5">
          {recentEvents.map((e) => {
            const color = subjectColor(e.subject);
            const time = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: color.hex }} />
                <span className="text-white/70 truncate flex-1">{e.topic}</span>
                <span className="text-[10px] text-white/50 tabular">{time}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
        <span className="text-white/60">Total lectures done</span>
        <span className="font-bold tabular text-green-400">{totalDone}</span>
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
      <h3 className="text-xs font-bold text-white/70 mb-3">{title}</h3>
      {children}
    </motion.div>
  );
}
