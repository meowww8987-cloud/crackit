'use client';

import { motion } from 'framer-motion';

interface Props {
  /** Percentage 0-100 for the liquid fill level. */
  pct: number;
  /** Color of the liquid (hex like #14b8a6). */
  color: string;
  /** Diameter in pixels. Default 96. */
  size?: number;
  /** Stroke width. Default 8. */
  strokeWidth?: number;
  /** Optional center label (rendered on top of the liquid). */
  children?: React.ReactNode;
}

/**
 * LiquidRing — circular progress ring that looks like a glass filling with
 * liquid. The fill line waves gently, bubbles rise inside, and the subject
 * color shows as the liquid.
 *
 * Implementation: SVG ring + animated wave path that clips to the fill level.
 * Bubbles are CSS-animated dots inside the ring.
 */
export function LiquidRing({ pct, color, size = 96, strokeWidth = 8, children }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const fillHeight = (clampedPct / 100) * (size - strokeWidth);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — drawn from top, clockwise */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * clampedPct) / 100 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>

      {/* Liquid fill inside the ring — only visible when pct > 0 */}
      {clampedPct > 0 && (
        <div
          className="absolute rounded-full overflow-hidden pointer-events-none"
          style={{
            inset: strokeWidth,
            clipPath: `inset(${100 - clampedPct}% 0 0 0)`,
          }}
        >
          {/* Solid liquid color */}
          <div
            className="absolute inset-0"
            style={{ background: `${color}40` }}
          />
          {/* Wavy top edge */}
          <motion.div
            className="absolute left-0 right-0"
            style={{
              top: 0,
              height: 4,
              background: color,
              borderRadius: '50%',
            }}
            animate={{
              x: [-2, 2, -2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          {/* Rising bubbles */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 3,
                height: 3,
                background: `${color}aa`,
                left: `${25 + i * 25}%`,
              }}
              animate={{
                y: [10, -fillHeight + 10],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.7,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Center content (label, percentage) */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
