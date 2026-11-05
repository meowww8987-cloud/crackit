'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NumberMorph } from '@/components/shared/NumberMorph';
import { useNav } from '@/lib/store/nav';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';
import { addDays, dateKey, todayKey, vibrate } from '@/lib/utils';

/* =========================================================================
   JourneyCard — Phase 2 modernization of the Home tail zone.

   Replaces the two disconnected cards (MiniHeatmap + Total Sessions) with
   one hero card that tells a story: how long you've been at it, the last
   7 days as bars (not flat squares), three meaningful stats, and the best
   day. Tap → Stats tab for the full breakdown.

   9 design decisions documented inline (search "DECISION N").
   ========================================================================= */

interface Props {
  /** All saved history sessions. */
  sessions: { date: string; studySeconds: number; startedAt: number }[];
  /** Today's study seconds, INCLUDING any live-session time. */
  todaySec: number;
  /** Prep start date (ISO yyyy-mm-dd) or null. */
  prepStart: string | null;
  /** Days since prep start (1-indexed). */
  prepDay: number;
  /** Current streak in days. */
  streak: number;
  /** Total focused hours across all sessions. */
  totalStudyHours: number;
}

interface DayBar {
  date: string;
  label: string;       // "Mon", "Tue", ... "Today"
  isToday: boolean;
  hours: number;       // includes live session for today
  valueLabel: string;  // "6.5h" / "45m" / "·"
}

export function JourneyCard({
  sessions,
  todaySec,
  prepStart,
  prepDay,
  streak,
  totalStudyHours,
}: Props) {
  const setTab = useNav((s) => s.setTab);
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  // === DECISION 2: 7-day bars replace flat squares ===
  // height ∝ hours studied. Today bar = todaySec (live), other days = saved only.
  const last7: DayBar[] = useMemo(() => {
    const today = todayKey();
    const out: DayBar[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const isToday = key === today;
      const savedSec = sessions
        .filter((s) => s.date === key)
        .reduce((a, s) => a + s.studySeconds, 0);
      const sec = isToday ? todaySec : savedSec;
      const hours = sec / 3600;
      // Value label: "·" for empty, "Xh" for ≥1h, "Xm" otherwise
      let valueLabel = '·';
      if (sec > 0) {
        valueLabel = hours >= 1 ? `${hours.toFixed(hours >= 10 ? 0 : 1)}h` : `${Math.round(sec / 60)}m`;
      }
      const label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
      out.push({ date: key, label, isToday, hours, valueLabel });
    }
    return out;
  }, [sessions, todaySec]);

  // Max hours across the 7 days → bar height scaling.
  // Floor of 4h so single short days don't fill the whole chart.
  const maxHours = Math.max(4, ...last7.map((d) => d.hours));

  // === DECISION 4: stats row ===
  // Sessions (NumberMorph) · Total focused hours · Avg / day
  // BUG FIX: when prepStart is null, prepDay falls back to 1 in HomeTab which
  // makes avgPerDay = totalStudyHours (duplicate of Focused). Instead, use the
  // number of distinct study days OR days since first session — whichever is larger.
  const sessionCount = sessions.length;
  const studyDays = useMemo(() => {
    if (sessions.length === 0) return 0;
    const days = new Set<string>();
    for (const s of sessions) if (s.studySeconds >= 60) days.add(s.date);
    return Math.max(1, days.size);
  }, [sessions]);
  const daysSinceFirst = useMemo(() => {
    if (sessions.length === 0) return 0;
    const first = Math.min(...sessions.map((s) => s.startedAt || Date.now()));
    return Math.max(1, Math.ceil((Date.now() - first) / 86400000));
  }, [sessions]);
  // Use prepDay if prepStart is set; otherwise days since first session.
  // (Avoids the "divide by 1" duplication when no prep start date is set.)
  const denom = prepStart && prepDay > 0 ? prepDay : daysSinceFirst;
  const avgPerDay = denom > 0 ? totalStudyHours / denom : 0;
  const avgLabel = avgPerDay >= 1 ? `${avgPerDay.toFixed(1)}h` : `${Math.round(avgPerDay * 60)}m`;

  // === DECISION 5: Best-day callout (max studySeconds day in last 7) ===
  const bestDay = useMemo(() => {
    let best = { label: '', hours: 0, date: '' };
    for (const d of last7) {
      if (d.hours > best.hours) best = { label: d.label, hours: d.hours, date: d.date };
    }
    if (best.hours < 0.1) return null; // no meaningful best day
    const dateObj = new Date(best.date + 'T00:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const hoursLabel = best.hours >= 1
      ? `${best.hours.toFixed(best.hours >= 10 ? 0 : 1)}h`
      : `${Math.round(best.hours * 60)}m`;
    return { dateStr, hoursLabel };
  }, [last7]);

  // === DECISION 1: Header subtitle "since <prepStart> · N days in" ===
  const sinceLabel = useMemo(() => {
    if (prepStart) {
      const d = new Date(prepStart + 'T00:00:00');
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `since ${dateStr} · ${prepDay} day${prepDay === 1 ? '' : 's'} in`;
    }
    // Fallback when no prep start date set
    return sessionCount > 0 ? `${sessionCount} session${sessionCount === 1 ? '' : 's'} logged` : 'No sessions yet';
  }, [prepStart, prepDay, sessionCount]);

  const handleClick = () => {
    vibrate(8);
    setTab('stats');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      className="minimal-hide cursor-pointer relative overflow-hidden rounded-2xl"
      style={{
        padding: '14px 14px 12px',
        border: '1px solid rgba(249,115,22,0.28)',
        background:
          'radial-gradient(ellipse 90% 60% at 85% -10%, rgba(249,115,22,0.14) 0%, transparent 60%),' +
          'linear-gradient(160deg, rgba(20,184,166,0.06), transparent 50%),' +
          'var(--glass-bg, rgba(255,255,255,0.035))',
        boxShadow: '0 12px 32px -10px rgba(249,115,22,0.15)',
      }}
    >
      {/* ============ DECISION 1: Header ============ */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: 12, fontSize: 15,
            background: 'radial-gradient(circle at 30% 25%, rgba(249,115,22,0.40), rgba(249,115,22,0.10))',
            boxShadow: '0 0 0 1px rgba(249,115,22,0.40), 0 4px 14px -4px rgba(249,115,22,0.45)',
          }}
        >
          🔥
        </div>
        <div className="flex flex-col min-w-0">
          <div className="text-[13px] font-extrabold" style={{ color: 'var(--foreground)' }}>
            Your Journey
          </div>
          <div className="text-[9.5px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {sinceLabel}
          </div>
        </div>
        {streak > 0 && (
          <div
            className="ml-auto text-[10px] font-extrabold flex-shrink-0"
            style={{
              color: '#f97316',
              background: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.35)',
              padding: '4px 10px',
              borderRadius: 99,
            }}
          >
            {streak}-day streak
          </div>
        )}
      </div>

      {/* ============ DECISION 2 + 3: 7-day bars ============ */}
      <div
        className="flex items-end gap-1.5"
        style={{ height: 88, margin: '4px 2px 6px' }}
      >
        {last7.map((d, i) => {
          const isRest = d.hours <= 0;
          const heightPct = isRest ? 0 : Math.max(8, Math.min(100, (d.hours / maxHours) * 100));
          // Bar fill: static height via inline style. No framer-motion on the bar
          // itself (the parent card already has an entrance animation, and motion
          // on individual bars was unreliable when the card mounts in-view).
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="text-[8.5px] font-extrabold mb-1 tabular"
                style={{ color: d.isToday ? '#2dd4bf' : 'var(--muted-foreground)' }}
              >
                {d.valueLabel}
              </div>
              <div
                className="w-full"
                style={{
                  height: isRest ? 3 : `${heightPct}%`,
                  minHeight: isRest ? 3 : 6,
                  borderRadius: isRest ? 3 : '7px 7px 3px 3px',
                  background: isRest
                    ? 'rgba(127,127,127,0.18)'
                    : d.isToday
                      ? 'linear-gradient(180deg, #34d399, #22c55e 60%, rgba(34,197,94,0.45))'
                      : 'linear-gradient(180deg, #2dd4bf, #14b8a6 60%, rgba(20,184,166,0.45))',
                  boxShadow: isRest
                    ? 'none'
                    : d.isToday
                      ? '0 0 14px 0 rgba(34,197,94,0.5)'
                      : '0 0 12px -2px rgba(20,184,166,0.45)',
                  animation: d.isToday && animate ? 'pulse-soft 2.4s ease-in-out infinite' : undefined,
                  transition: animate ? `height 0.5s ease-out ${0.04 * i + 0.15}s` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Day labels */}
      <div className="flex gap-1.5 mx-0.5">
        {last7.map((d) => (
          <div
            key={d.date}
            className="flex-1 text-center text-[8px] font-bold"
            style={{ color: d.isToday ? '#22c55e' : 'var(--muted-foreground)' }}
          >
            {d.label}
          </div>
        ))}
      </div>

      {/* ============ DECISION 4: Stats row ============ */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <StatCell value={sessionCount} label="Sessions" color="#2dd4bf" useMorph />
        <StatCell
          value={totalStudyHours >= 100 ? `${Math.round(totalStudyHours)}h` : `${totalStudyHours.toFixed(1)}h`}
          label="Focused"
          color="#4ade80"
        />
        <StatCell value={avgLabel} label="Avg / day" color="var(--foreground)" />
      </div>

      {/* ============ DECISION 5: Best-day callout ============ */}
      {bestDay && (
        <div
          className="mt-2.5 rounded-xl flex items-center gap-2"
          style={{
            padding: '8px 11px',
            background: 'rgba(250,204,21,0.07)',
            border: '1px solid rgba(250,204,21,0.22)',
            fontSize: 10,
            color: 'var(--foreground)',
          }}
        >
          <span>🏆</span>
          <span>
            <b style={{ fontWeight: 800 }}>Best day: {bestDay.dateStr}</b> — {bestDay.hoursLabel} of deep focus
          </span>
        </div>
      )}
    </motion.div>
  );
}

/* ---- Stat cell (DECISION 4) ---- */
function StatCell({
  value,
  label,
  color,
  useMorph = false,
}: {
  value: number | string;
  label: string;
  color: string;
  useMorph?: boolean;
}) {
  return (
    <div
      className="rounded-xl text-center"
      style={{
        padding: '9px 6px',
        background: 'rgba(127,127,127,0.06)',
        border: '1px solid var(--border, rgba(127,127,127,0.12))',
      }}
    >
      <div className="text-[15px] font-extrabold leading-tight tabular" style={{ color }}>
        {useMorph && typeof value === 'number' ? (
          <NumberMorph value={value} duration={500} />
        ) : (
          value
        )}
      </div>
      <div
        className="text-[8px] font-extrabold mt-0.5"
        style={{ letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}
      >
        {label}
      </div>
    </div>
  );
}
