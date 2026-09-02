'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useHistory } from '@/lib/store/history';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { formatHM } from '@/lib/utils';
import type { Subject } from '@/lib/types';

/**
 * SubjectSunburst — radial chart showing study time distribution across subjects.
 *
 * Visual: a sunburst where each subject gets a slice sized proportionally to
 * time studied. Slices are colored with subject colors. Center shows total time.
 *
 * Differs from the existing pie chart:
 *  - Slices radiate from center as arcs (sunburst) instead of full pie wedges
 *  - Inner ring shows last 7 days, outer ring shows all-time (2 concentric rings)
 *  - Animated sweep-in on mount
 */
export function SubjectSunburst() {
  const sessions = useHistory((s) => s.sessions);

  const data = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const allTime: Record<string, number> = {};
    const week: Record<string, number> = {};

    for (const subj of SUBJECTS) {
      allTime[subj] = 0;
      week[subj] = 0;
    }
    for (const s of sessions) {
      allTime[s.subject] = (allTime[s.subject] || 0) + s.studySeconds;
      if (s.endedAt >= weekAgo) {
        week[s.subject] = (week[s.subject] || 0) + s.studySeconds;
      }
    }

    const subjects = SUBJECTS.filter((s) => s !== 'General' && allTime[s] > 0);
    const totalAll = subjects.reduce((a, s) => a + allTime[s], 0);
    const totalWeek = subjects.reduce((a, s) => a + week[s], 0);

    return {
      subjects: subjects.map((subj) => ({
        subject: subj as Subject,
        allTime: allTime[subj],
        week: week[subj],
        allTimePct: totalAll > 0 ? (allTime[subj] / totalAll) * 100 : 0,
        weekPct: totalWeek > 0 ? (week[subj] / totalWeek) * 100 : 0,
      })),
      totalAll,
      totalWeek,
    };
  }, [sessions]);

  if (data.subjects.length === 0) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 35;
  const weekR = 60;  // inner ring outer edge
  const allR = 90;   // outer ring outer edge

  // Build SVG arc paths for each subject slice
  // Inner ring (week) goes from innerR to weekR
  // Outer ring (all-time) goes from weekR to allR
  let weekAngle = 0;
  let allAngle = 0;
  const slices = data.subjects.map((s) => {
    const color = subjectColor(s.subject);
    const weekStart = weekAngle;
    const weekEnd = weekAngle + (s.weekPct / 100) * 360;
    const allStart = allAngle;
    const allEnd = allAngle + (s.allTimePct / 100) * 360;
    weekAngle = weekEnd;
    allAngle = allEnd;
    return {
      ...s,
      color: color.hex,
      weekPath: arcPath(cx, cy, innerR, weekR, weekStart, weekEnd),
      allPath: arcPath(cx, cy, weekR + 2, allR, allStart, allEnd),
    };
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">☀️</span>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Subject Sunburst
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* SVG sunburst */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {/* Background circles */}
            <circle cx={cx} cy={cy} r={allR} fill="none" stroke="var(--ring-track)" strokeWidth={1} />
            <circle cx={cx} cy={cy} r={weekR} fill="none" stroke="var(--ring-track)" strokeWidth={1} />

            {/* Slices */}
            {slices.map((s, i) => (
              <motion.g
                key={s.subject}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                {/* Outer ring — all time */}
                <path
                  d={s.allPath}
                  fill={s.color}
                  opacity={0.85}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.5}
                />
                {/* Inner ring — this week */}
                <path
                  d={s.weekPath}
                  fill={s.color}
                  opacity={0.5}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.5}
                />
              </motion.g>
            ))}

            {/* Center hole */}
            <circle cx={cx} cy={cy} r={innerR} fill="var(--card)" />
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[8px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="text-sm font-bold tabular text-white">
              {formatHM(data.totalAll)}
            </div>
            <div className="text-[8px] text-muted-foreground/60">all-time</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {slices.map((s) => (
            <div key={s.subject} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-foreground flex-1 truncate">{s.subject}</span>
              <span className="tabular text-muted-foreground">{formatHM(s.allTime)}</span>
              <span className="tabular text-muted-foreground text-[10px] w-8 text-right">
                {Math.round(s.allTimePct)}%
              </span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-border text-[10px] text-muted-foreground">
            <div className="flex justify-between">
              <span>This week:</span>
              <span className="tabular text-teal-400">{formatHM(data.totalWeek)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Build an SVG arc path (donut slice) from angle start to angle end,
 * between inner radius r1 and outer radius r2.
 * Angles in degrees, 0 = top, clockwise.
 */
function arcPath(cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number): string {
  // Handle full circle (single subject = 100%)
  if (endDeg - startDeg >= 359.99) {
    return `M ${cx + r1} ${cy} A ${r1} ${r1} 0 1 1 ${cx - r1} ${cy} A ${r1} ${r1} 0 1 1 ${cx + r1} ${cy} M ${cx + r2} ${cy} A ${r2} ${r2} 0 1 0 ${cx - r2} ${cy} A ${r2} ${r2} 0 1 0 ${cx + r2} ${cy} Z`;
  }
  const start1 = polarToCartesian(cx, cy, r1, startDeg);
  const end1 = polarToCartesian(cx, cy, r1, endDeg);
  const start2 = polarToCartesian(cx, cy, r2, endDeg);
  const end2 = polarToCartesian(cx, cy, r2, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${start1.x} ${start1.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${end1.x} ${end1.y}`,
    `L ${start2.x} ${start2.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${end2.x} ${end2.y}`,
    `Z`,
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
