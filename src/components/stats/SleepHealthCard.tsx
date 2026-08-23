'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, TrendingUp, TrendingDown, Star, Clock, ChevronRight, Plus, Bed } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import {
  buildWeeklySleepReport,
  sleepLast7Days,
  verdictColor,
  formatHour,
} from '@/lib/sleepHealth';
import { formatHM, vibrate } from '@/lib/utils';
import { SleepBackfillSheet } from '@/components/dailylog/SleepBackfillSheet';

/**
 * SleepHealthCard — modernized sleep health summary card for Stats tab.
 *
 * Shows:
 *  - Sleep score ring (color-coded by verdict) — from reported nights
 *  - Last night summary OR "Sleeping now" (if active) OR "Not reported" CTA
 *  - 7-day strip showing ALL calendar days:
 *      • Reported nights: day name, hours, color bar, quality dots
 *      • Naps: small nap icon (☀️ noon, 🌆 evening, 💤 short) under the bar
 *      • Unreported days: "—" + "Tap to add" prompt
 *      • Today: highlighted
 *      • Currently sleeping: live duration + animated moon
 *  - Trend badge (vs previous 7 nights)
 *  - "X/7 days reported" counter — nudges user to log forgotten days
 *  - Tap card → open full SleepReportSheet
 *
 * THEME COMPLIANCE: all colors use CSS variables, no hardcoded whites.
 */

export function SleepHealthCard({ onTap }: { onTap: () => void }) {
  const history = useSleep((s) => s.history);
  const activeSleep = useSleep((s) => s.activeSleep);
  const report = useMemo(() => buildWeeklySleepReport(history), [history]);
  const last7 = useMemo(() => sleepLast7Days(history, activeSleep), [history, activeSleep]);

  // Backfill sheet state
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillDate, setBackfillDate] = useState<string | undefined>(undefined);

  const openBackfill = (date?: string) => {
    setBackfillDate(date);
    setBackfillOpen(true);
    vibrate(8);
  };

  // Live tick — update every 1s while sleeping, every 30s otherwise
  const [, setTick] = useState(0);
  const isSleepingNow = last7.activeSleepDurationSec > 0;
  useEffect(() => {
    const interval = isSleepingNow ? 1000 : 30000;
    const t = setInterval(() => setTick((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [isSleepingNow]);

  // === Empty state: no sleep data at all ===
  if (report.nights.length === 0 && !activeSleep) {
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
  const todayEntry = last7.days[6]; // last entry = today
  const reportedCount = last7.reportedCount;
  const notReportedCount = last7.notReportedCount;

  // Trend calc (sorted history)
  const prevNights = history
    .filter((e) => (e.durationSec || 0) >= 4 * 3600)
    .sort((a, b) => b.bedTime - a.bedTime)
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

      {/* Score ring + Last night / Sleeping now / Not reported */}
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
              {report.verdict === 'excellent' ? 'Great' : report.verdict === 'good' ? 'Good' : report.verdict === 'fair' ? 'Fair' : 'Poor'}
            </span>
          </div>
        </div>

        {/* Right side: last night OR sleeping now OR not reported */}
        <div className="flex-1 min-w-0">
          {todayEntry.isSleepingNow ? (
            // === Currently sleeping ===
            <div
              className="rounded-xl p-2.5"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Bed size={12} style={{ color: '#818cf8' }} />
                </motion.div>
                <span className="text-[9px] uppercase tracking-wide font-bold" style={{ color: '#818cf8' }}>
                  Sleeping now
                </span>
              </div>
              <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                {formatHM(last7.activeSleepDurationSec)}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                Since {formatHour(new Date(activeSleep!.bedTime).getHours() + new Date(activeSleep!.bedTime).getMinutes() / 60)}
              </div>
            </div>
          ) : todayEntry.night ? (
            // === Last night reported ===
            <div
              className="rounded-xl p-2.5"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
                Last Night
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {(todayEntry.night.durationSec / 3600).toFixed(1)}h
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {todayEntry.night.emoji}
                </span>
              </div>
              <div className="text-[9px] tabular" style={{ color: 'var(--muted-foreground)' }}>
                {formatHour(new Date(todayEntry.night.bedTime).getHours() + new Date(todayEntry.night.bedTime).getMinutes() / 60)} →{' '}
                {todayEntry.night.wakeTime
                  ? formatHour(new Date(todayEntry.night.wakeTime).getHours() + new Date(todayEntry.night.wakeTime).getMinutes() / 60)
                  : '—'}
              </div>
              {todayEntry.quality != null && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={8}
                      className={star <= (todayEntry.quality ?? 0) ? 'text-amber-400 fill-amber-400' : ''}
                      style={{ color: star <= (todayEntry.quality ?? 0) ? '#fbbf24' : 'var(--muted)' }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // === Today not reported ===
            <button
              onClick={(e) => { e.stopPropagation(); openBackfill(todayEntry.date); }}
              className="w-full rounded-xl p-2.5 text-left transition active:scale-[0.98]"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px dashed rgba(245, 158, 11, 0.4)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Plus size={12} style={{ color: '#f59e0b' }} />
                <span className="text-[9px] uppercase tracking-wide font-bold" style={{ color: '#f59e0b' }}>
                  Not reported
                </span>
              </div>
              <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Tap to log last night
              </div>
              <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                You forgot to mark sleep
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 7-day strip — ALL days (reported + unreported + naps) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            Last 7 Days
          </span>
          <span className="text-[9px] font-bold tabular" style={{ color: notReportedCount > 0 ? '#f59e0b' : '#22c55e' }}>
            {reportedCount}/7 reported
          </span>
        </div>
        <div className="flex items-end justify-between gap-1">
          {last7.days.map((day, i) => {
            const hours = day.totalSleepSec / 3600;
            const isLastNight = i === 6;
            // Bar height: scale 0-10h to 8-48px
            const barHeight = day.hasAnySleep
              ? Math.max(8, Math.min(48, (hours / 10) * 48))
              : 4; // tiny stub for unreported
            const dayColor = day.verdict === 'excellent' ? '#22c55e'
              : day.verdict === 'good' ? '#84cc16'
              : day.verdict === 'fair' ? '#f59e0b'
              : day.verdict === 'poor' ? '#ef4444'
              : 'var(--muted)'; // no night sleep (maybe nap only or unreported)

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
                style={{
                  background: isLastNight ? 'rgba(99,102,241,0.08)' : 'transparent',
                  borderRadius: 6,
                  padding: '2px 0',
                }}
              >
                {/* Day name (3 letters) */}
                <span
                  className="text-[8px] font-bold uppercase"
                  style={{ color: isLastNight ? '#818cf8' : 'var(--muted-foreground)' }}
                >
                  {day.dayName}
                </span>
                {/* Hours or — */}
                <span className="text-[9px] font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {day.hasAnySleep ? `${hours.toFixed(1)}h` : '—'}
                </span>
                {/* Color bar */}
                <div
                  className="w-full rounded-t-sm relative"
                  style={{
                    height: barHeight,
                    background: dayColor,
                    minHeight: 4,
                    opacity: day.notReported ? 0.3 : (isLastNight ? 1 : 0.85),
                    boxShadow: isLastNight && day.hasAnySleep ? `0 0 6px ${dayColor}80` : 'none',
                  }}
                >
                  {/* Sleeping now indicator */}
                  {day.isSleepingNow && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ background: '#818cf8' }}
                    />
                  )}
                </div>
                {/* Quality dots OR nap icons OR "add" prompt */}
                {day.notReported ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); openBackfill(day.date); }}
                    className="text-[7px] font-bold uppercase"
                    style={{ color: '#f59e0b' }}
                  >
                    Add
                  </button>
                ) : (
                  <>
                    {/* Quality dots (only if night sleep + rated) */}
                    {day.quality != null ? (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className="w-1 h-1 rounded-full"
                            style={{
                              background: star <= (day.quality ?? 0) ? '#fbbf24' : 'var(--muted)',
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-[4px]" /> /* spacer for unrated */
                    )}
                    {/* Nap icons */}
                    {day.naps.length > 0 && (
                      <div className="flex gap-0.5">
                        {day.naps.slice(0, 2).map((nap, ni) => (
                          <span key={ni} className="text-[8px]" title={`${nap.label}: ${(nap.durationSec/60).toFixed(0)}m`}>
                            {nap.emoji}
                          </span>
                        ))}
                        {day.naps.length > 2 && (
                          <span className="text-[7px]" style={{ color: 'var(--muted-foreground)' }}>
                            +{day.naps.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-2 text-[8px] flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
          <span className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#22c55e' }} /> 85+
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#f59e0b' }} /> 45-84
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: '#ef4444' }} /> &lt;45
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--muted)', opacity: 0.4 }} /> N/A
          </span>
          <span className="flex items-center gap-0.5">☀️ Nap</span>
        </div>
      </div>

      {/* One-line summary */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--muted-foreground)' }}>
            Avg: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{(last7.avgPerDaySec / 3600).toFixed(1)}h/day</span>
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

      {/* Nudge: if user forgot days, show a gentle reminder */}
      {notReportedCount > 0 && (
        <div
          className="mt-2 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}
        >
          <span>💡</span>
          <span>
            You forgot to log <strong>{notReportedCount} day{notReportedCount > 1 ? 's' : ''}</strong> this week. Tap any &ldquo;Add&rdquo; above to backfill.
          </span>
        </div>
      )}

      {/* Backfill sheet — for adding forgotten sleep entries */}
      <SleepBackfillSheet
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        defaultDate={backfillDate}
      />
    </motion.div>
  );
}
