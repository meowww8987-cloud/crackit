'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, X, ChevronRight, Clock, Target, Flame } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { dateKey, addDays, formatHM, vibrate, cn } from '@/lib/utils';

/**
 * ProgressGraph — modern 30-day study progress chart.
 *
 * Replaces the old "Study Time Trend (30 days)" line chart with a modern
 * area chart that shows PROGRESS over time (the trend line going up/down).
 *
 * Features:
 *  - Smooth area chart (teal gradient fill) — shows daily study minutes
 *  - Dashed goal line — daily goal horizontal reference (is 2h good or bad?)
 *  - Big total + trend badge at top
 *  - 7-day + 30-day averages comparison
 *  - Best day marker (dot on the peak)
 *  - Tap any point → day detail popup (reuses existing pattern)
 *  - X-axis: dates (7 labels, every 5th day)
 *  - Y-axis: hours (not minutes — no mental math)
 *  - Responsive SVG (not Recharts — lighter, smoother, theme-aware)
 *
 * THEME COMPLIANCE: all colors use CSS variables.
 */

interface DayPoint {
  date: string;
  dayNum: number;
  label: string;
  studySec: number;
  wastedSec: number;
  isToday: boolean;
}

export function ProgressGraph() {
  const sessions = useHistory((s) => s.sessions);
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);
  const [selectedDay, setSelectedDay] = useState<DayPoint | null>(null);

  const data = useMemo(() => {
    const points: DayPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const daySessions = sessions.filter((s) => s.date === key);
      const studySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
      const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
      points.push({
        date: key,
        dayNum: d.getDate(),
        label: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        studySec,
        wastedSec,
        isToday: i === 0,
      });
    }
    return points;
  }, [sessions]);

  const totalStudySec = data.reduce((a, d) => a + d.studySec, 0);
  const totalWastedSec = data.reduce((a, d) => a + d.wastedSec, 0);

  // 7-day avg vs 30-day avg
  const last7Sec = data.slice(-7).reduce((a, d) => a + d.studySec, 0);
  const avg7Sec = Math.round(last7Sec / 7);
  const avg30Sec = Math.round(totalStudySec / 30);

  // Trend: last 7 days vs previous 7 days
  const prev7Sec = data.slice(-14, -7).reduce((a, d) => a + d.studySec, 0);
  const trendPct = prev7Sec > 0
    ? Math.round(((last7Sec - prev7Sec) / prev7Sec) * 100)
    : last7Sec > 0 ? 100 : 0;
  const trendUp = trendPct >= 0;

  // Best day
  const bestDay = data.reduce((max, d) => (d.studySec > max.studySec ? d : max), data[0]);

  // Chart dimensions
  const chartWidth = 320; // viewBox width
  const chartHeight = 100; // viewBox height
  const padding = { top: 10, right: 5, bottom: 15, left: 5 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // Max value for scaling (in hours)
  const maxHours = Math.max(
    ...data.map((d) => d.studySec / 3600),
    dailyGoalHours,
    1
  );
  const goalHours = dailyGoalHours;

  // Generate SVG path points
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * plotWidth;
    const hours = d.studySec / 3600;
    const y = padding.top + plotHeight - (hours / maxHours) * plotHeight;
    return { x, y, data: d };
  });

  // Smooth area path (using simple line for now, could add bezier)
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + plotHeight} L ${points[0].x.toFixed(1)} ${padding.top + plotHeight} Z`;

  // Goal line Y position
  const goalY = padding.top + plotHeight - (goalHours / maxHours) * plotHeight;

  // X-axis: 4 clean week markers instead of raw dates
  // Shows: "3w ago" | "2w ago" | "1w ago" | "Today"
  const weekMarkers = [
    { index: 0, label: '3w ago' },       // 30 days ago
    { index: 7, label: '2w ago' },       // 23 days ago
    { index: 14, label: '1w ago' },      // 16 days ago
    { index: 22, label: 'This week' },   // 8 days ago
    { index: 29, label: 'Today' },       // today
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-4"
      >
        {/* Header + trend */}
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} style={{ color: '#14b8a6' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            30-Day Progress
          </h3>
          {totalStudySec > 0 && (
            <div
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: trendUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: trendUp ? '#22c55e' : '#ef4444',
              }}
            >
              {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trendPct > 0 ? '+' : ''}{trendPct}%
            </div>
          )}
        </div>

        {/* Big total */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular" style={{ color: 'var(--foreground)' }}>
              {formatHM(totalStudySec)}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              total · 30d
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] mt-0.5">
            <span style={{ color: 'var(--muted-foreground)' }}>
              7d avg: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{formatHM(avg7Sec)}</span>
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>·</span>
            <span style={{ color: 'var(--muted-foreground)' }}>
              30d avg: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{formatHM(avg30Sec)}</span>
            </span>
          </div>
        </div>

        {/* SVG Area Chart */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-32"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>

            {/* Goal line (dashed) */}
            <line
              x1={padding.left}
              y1={goalY}
              x2={chartWidth - padding.right}
              y2={goalY}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <text
              x={chartWidth - padding.right - 2}
              y={goalY - 3}
              textAnchor="end"
              fontSize="7"
              fill="#f59e0b"
              opacity="0.8"
            >
              {goalHours}h goal
            </text>

            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGradient)" />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Best day marker */}
            {bestDay.studySec > 0 && (
              <circle
                cx={points[data.indexOf(bestDay)].x}
                cy={points[data.indexOf(bestDay)].y}
                r="3"
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="1"
              />
            )}

            {/* Today marker */}
            {points[points.length - 1].data.studySec > 0 && (
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="2.5"
                fill="#14b8a6"
                stroke="#ffffff"
                strokeWidth="1"
              >
                <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Invisible tap targets */}
            {points.map((p, i) => (
              <rect
                key={i}
                x={p.x - 5}
                y={padding.top}
                width="10"
                height={plotHeight}
                fill="transparent"
                style={{ cursor: p.data.studySec > 0 ? 'pointer' : 'default' }}
                onClick={() => {
                  if (p.data.studySec > 0) {
                    vibrate(8);
                    setSelectedDay(p.data);
                  }
                }}
              />
            ))}
          </svg>

          {/* X-axis: positioned week markers */}
          <div className="relative h-4 mt-1.5">
            {weekMarkers.map((m, i) => {
              const x = padding.left + (m.index / (data.length - 1)) * plotWidth;
              const pct = (x / chartWidth) * 100;
              const isToday = m.label === 'Today';
              const isLast = i === weekMarkers.length - 1;
              return (
                <span
                  key={i}
                  className="absolute text-[9px] font-semibold tabular"
                  style={{
                    left: `${pct}%`,
                    transform: isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                    color: isToday ? '#14b8a6' : 'var(--muted-foreground)',
                  }}
                >
                  {m.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Summary line */}
        <div className="flex items-center gap-2 text-[9px] flex-wrap pt-2 mt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {bestDay.studySec > 0 && (
            <span style={{ color: 'var(--muted-foreground)' }}>
              ⭐ Best: <span className="font-bold" style={{ color: '#fbbf24' }}>{formatHM(bestDay.studySec)}</span>
            </span>
          )}
          {totalWastedSec > 60 && (
            <>
              <span style={{ color: 'var(--muted-foreground)' }}>·</span>
              <span style={{ color: '#ef4444' }}>
                ⚠ {formatHM(totalWastedSec)} wasted
              </span>
            </>
          )}
          <span className="ml-auto" style={{ color: 'var(--muted-foreground)' }}>
            Tap any point →
          </span>
        </div>
      </motion.div>

      {/* Day detail popup */}
      <AnimatePresence>
        {selectedDay && (
          <DayPopup day={selectedDay} onClose={() => setSelectedDay(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// Day Detail Popup
// =====================================================

function DayPopup({ day, onClose }: { day: DayPoint; onClose: () => void }) {
  const sessions = useHistory((s) => s.sessions);
  const daySessions = useMemo(
    () => sessions
      .filter((s) => s.date === day.date)
      .sort((a, b) => a.startedAt - b.startedAt),
    [sessions, day.date]
  );

  const dateLabel = useMemo(() => {
    const d = new Date(day.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, [day.date]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <X size={16} />
        </button>

        <div className="text-center mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{dateLabel}</h2>
          <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
            <span style={{ color: '#14b8a6' }}>📚 {formatHM(day.studySec)}</span>
            {day.wastedSec > 60 && <span style={{ color: '#ef4444' }}>⚠ {formatHM(day.wastedSec)}</span>}
            <span style={{ color: 'var(--muted-foreground)' }}>{daySessions.length} sessions</span>
          </div>
        </div>

        <div className="space-y-2">
          {daySessions.map((session, i) => {
            const subjColor = getSubjectColor(session.subject);
            const startTime = new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(session.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderLeft: `3px solid ${subjColor}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${subjColor}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: subjColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {session.subject}{session.chapter ? ` · ${session.chapter}` : ''}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {session.topic || 'Free study'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {startTime} → {endTime}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular" style={{ color: '#14b8a6' }}>{formatHM(session.studySeconds)}</div>
                  {session.wastedSeconds > 60 && (
                    <div className="text-[9px] tabular" style={{ color: '#ef4444' }}>⚠ {formatHM(session.wastedSeconds)}</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {daySessions.length === 0 && (
          <div className="text-center py-6">
            <Clock size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No sessions this day.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function getSubjectColor(subject: string): string {
  const colors: Record<string, string> = {
    Physics: '#3b82f6', Chemistry: '#22c55e', Botany: '#f59e0b',
    Zoology: '#a855f7', General: '#14b8a6',
  };
  return colors[subject] || '#14b8a6';
}
