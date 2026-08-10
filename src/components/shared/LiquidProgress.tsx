'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  pct: number;
  color?: string;
  color2?: string;
  className?: string;
  height?: string;
}

/**
 * LiquidProgress — Samsung One UI 9 inspired fluid progress bar.
 *
 * Design:
 * - Rounded pill track with a subtle inner shadow (depth)
 * - Fill uses a gradient that shifts hue as it fills
 * - The fill's leading edge has a "fluid blob" — a larger rounded cap
 *   that gives the impression of liquid filling up
 * - Smooth spring animation (not linear) — overshoots slightly then settles
 *   like a water surface finding its level
 * - Shimmer sweeps across the fill continuously
 * - When 100%, the fill glows brighter + a subtle pulse
 */
export function LiquidProgress({ pct, color = '#14b8a6', color2, className, height = 'h-1.5' }: Props) {
  const c2 = color2 || color;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const isComplete = clampedPct >= 100;
  const gradient = `linear-gradient(90deg, ${color}, ${c2})`;

  return (
    <div
      className={cn('rounded-full overflow-hidden relative', height, className)}
      style={{
        background: 'var(--bar-track, rgba(255,255,255,0.06))',
        // Inner shadow for depth — like a container holding liquid
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {/* === Fluid fill === */}
      {clampedPct > 0 && (
        <motion.div
          className="h-full rounded-full relative liquid-shimmer"
          style={{
            backgroundImage: gradient,
            // The leading edge is a larger rounded cap — gives "liquid" feel
            borderRadius: '999px',
            // Brighter glow when complete
            boxShadow: isComplete
              ? `0 0 12px ${c2}80, 0 0 4px ${color}60`
              : `0 0 6px ${color}30`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedPct}%` }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 18,
            mass: 0.8,
            // Slight overshoot for fluid feel
            restSpeed: 0.01,
          }}
        >
          {/* === Fluid blob at leading edge ===
              A semi-transparent circle that sits at the right edge of the fill,
              slightly larger than the bar height. Creates the "liquid surface" look. */}
          {clampedPct > 2 && clampedPct < 100 && (
            <div
              className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none"
              style={{
                width: '140%',
                aspectRatio: '1',
                background: `radial-gradient(circle, ${c2}CC 0%, ${c2}00 70%)`,
                opacity: 0.6,
              }}
            />
          )}

          {/* === Completion pulse === */}
          {isComplete && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: c2 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
