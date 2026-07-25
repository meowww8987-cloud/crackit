'use client';

import { motion } from 'framer-motion';

interface Props {
  /** Your seconds studied. */
  mySec: number;
  /** Partner's seconds studied. */
  partnerSec: number;
  /** Your accent color. */
  myColor: string;
  /** Partner's accent color. */
  partnerColor: string;
  /** Size in pixels (default 120). */
  size?: number;
  /** Center label (e.g. "1h 24m"). */
  centerLabel?: string;
  /** Center sublabel (e.g. "you"). */
  centerSublabel?: string;
}

/**
 * PartnerProgressRing — two concentric SVG progress rings (Apple Watch style).
 *
 * - Outer ring = partner's progress (relative to max)
 * - Inner ring = your progress (relative to max)
 * - Center shows the hero number
 *
 * Saves space vs horizontal bars and looks premium.
 */
export function PartnerProgressRing({
  mySec,
  partnerSec,
  myColor,
  partnerColor,
  size = 120,
  centerLabel,
  centerSublabel,
}: Props) {
  const max = Math.max(mySec, partnerSec, 1);
  const myPct = Math.min(1, mySec / max);
  const partnerPct = Math.min(1, partnerSec / max);

  const stroke = size * 0.07; // proportional stroke width
  const outerR = (size - stroke) / 2;
  const innerR = outerR - stroke * 1.8;
  const circumference = (r: number) => 2 * Math.PI * r;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Outer track (partner) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outerR}
          fill="none"
          stroke="rgba(128,128,128,0.1)"
          strokeWidth={stroke}
        />
        {/* Outer progress (partner) */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={outerR}
          fill="none"
          stroke={partnerColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference(outerR)}` }}
          animate={{ strokeDasharray: `${partnerPct * circumference(outerR)} ${circumference(outerR)}` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Inner track (you) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill="none"
          stroke="rgba(128,128,128,0.1)"
          strokeWidth={stroke}
        />
        {/* Inner progress (you) */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill="none"
          stroke={myColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference(innerR)}` }}
          animate={{ strokeDasharray: `${myPct * circumference(innerR)} ${circumference(innerR)}` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </svg>

      {/* Center label */}
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-bold tabular text-t-primary leading-none">{centerLabel}</div>
          {centerSublabel && (
            <div className="text-[9px] text-t-muted uppercase tracking-wider mt-0.5">{centerSublabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
