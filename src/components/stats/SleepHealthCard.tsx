'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Moon, TrendingUp, TrendingDown, Star, Clock, ChevronRight } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import {
  buildWeeklySleepReport,
  verdictColor,
  verdictLabel,
  formatHour,
} from '@/lib/sleepHealth';
import { formatHM, vibrate } from '@/lib/utils';

/**
 * SleepHealthCard — modernized sleep health summary card for Stats tab.
 *
 * Shows:
 *  - Circular sleep score ring (color-coded by verdict)
 *  - Last night summary (duration, bedtime→wake, quality stars)
 *  - 7-night mini bar chart (each bar = 1 night, height = hours)
 *  - Trend badge (vs previous week)
 *  - One-line summary (avg hours + consistency)
 *  - Tap (not long-press) to open full SleepReportSheet
 *
 * Empty state: friendly CTA when no sleep data.
 *
 * THEME COMPLIANCE: all colors use CSS variables, no hardcoded whites.
 */

export function SleepHealthCard({ onTap }: { onTap: () => void }) {
  const history = useSleep((s) => s.history);
  const report = useMemo(() => buildWeeklySleepReport(history), [history]);

  // Empty state
  if (report.nights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-4 border border-indigo-500/25"
      >
        <div className="flex items-center gap-2 mb-3">
          <Moon size={14} className="text-indigo-400" />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            Sleep Health
          </h3>
        </div>
        <div className="text-center py-3">
          <Moon size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            No sleep data yet.<br />Log your first night to start tracking.
          </p>
          <button
            onClick={() => { vibrate(8); onTap(); }}
            className="text-[11px] px-3 py-1.5 rounded-full font-semibold"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Log last night →
          </button>
        </div>
      </motion.div>
    );
  }

  const scoreColor = verdictColor(report.verdict);
  const lastNight = report.nights[report.nights.length - 1];
  const maxHours = Math.max(...report.nights.map((n) => n.durationSec / 3600), 9);

  // Compute trend (vs previous 7 nights)
  const prevNights = history
    .filter((e) => (e.durationSec || 0) >= 4 * 3600)
    .slice(7, 14);
  const prevAvg = prevNights.length > 0
    ? prevNights.reduce((a, e) => a + (e.durationSec || 0), 0) / prevNights.length / 3600
    : 0;
  const trendPct = prevAvg > 0
    ? Math.round(((report.avgNightHours - prevAvg) / prevAvg) * 100)
    : 0;
  const trendUp = trendPct >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass rounded-2xl p-4 border border-indigo-500/25 cursor-pointer select-none active:scale-[0.99] transition-transform"
      onClick={() => { vibrate(8); onTap(); }}
    >
      {/* Header + trend */}
      <div className="flex items-center gap-2 mb-3">
        <Moon size={14} className="text-indigo-400" />
        <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
          Sleep Health
        </h3>
        {trendPct !== 0 && (
          <div
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: trendUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: trendUp ? '#22c55e' : '#ef4444',
            }}
          >
            {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trendPct)}%
          </div>
        )}
      </div>

      {/* Score ring + Last night card */}
      <div className="flex items-center gap-3 mb-4">
        {/* Score ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={scoreColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              whileInView={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - report.healthScore / 100) }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ filter: `drop-shadow(0 0 4px ${scoreColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular" style={{ color: scoreColor }}>
              {report.healthScore}
            </span>
            <span className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {verdictLabel(report.verdict)}
            </span>
          </div>
        </div>

        {/* Last night card */}
        {lastNight && (
          <div
            className="flex-1 rounded-xl p-2.5"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Last Night
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                {(lastNight.durationSec / 3600).toFixed(1)}h
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                {lastNight.emoji}
              </span>
            </div>
            <div className="text-[9px] tabular" style={{ color: 'var(--muted-foreground)' }}>
              {formatHour(new Date(lastNight.bedTime).getHours() + new Date(lastNight.bedTime).getMinutes() / 60)} →{' '}
              {lastNight.wakeTime
                ? formatHour(new Date(lastNight.wakeTime).getHours() + new Date(lastNight.wakeTime).getMinutes() / 60)
                : '—'}
            </div>
            {lastNight.quality != null && (
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={8}
                    className={star <= (lastNight.quality ?? 0) ? 'text-amber-400 fill-amber-400' : ''}
                    style={{ color: star <= (lastNight.quality ?? 0) ? '#fbbf24' : 'var(--muted)' }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7-night mini bars */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
          Last {report.nights.length} Nights
        </div>
        <div className="flex items-end justify-between gap-1 h-12">
          {report.nights.map((night, i) => {
            const hours = night.durationSec / 3600;
            const heightPct = Math.max((hours / maxHours) * 100, 8);
            const nightColor = night.score >= 85 ? '#22c55e' : night.score >= 65 ? '#84cc16' : night.score >= 45 ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full h-full flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${heightPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                    className="w-full rounded-t-sm"
                    style={{
                      background: nightColor,
                      minHeight: 4,
                    }}
                  />
                </div>
                <span className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(night.bedTime).toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* One-line summary */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--muted-foreground)' }}>
            Avg: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{report.avgNightHours.toFixed(1)}h</span>
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>·</span>
          <span style={{ color: 'var(--muted-foreground)' }}>
            Consistency: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{report.bedtimeConsistency}%</span>
          </span>
        </div>
        <div className="flex items-center gap-0.5" style={{ color: 'var(--muted-foreground)' }}>
          <Clock size={9} />
          <span className="text-[9px]">Tap for report</span>
          <ChevronRight size={10} />
        </div>
      </div>
    </motion.div>
  );
}
