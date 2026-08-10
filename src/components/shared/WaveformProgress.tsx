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
 * WaveformProgress — Samsung One UI 9 music visualizer-inspired progress.
 *
 * Replaces the flat left-to-right progress bar with a live animated waveform:
 * - A row of vertical bars (like an audio equalizer)
 * - Bars are ALWAYS animating (bouncing up/down) for a "live" feel
 * - The HEIGHT of all bars increases as progress increases
 *   (0% = tiny ripples, 100% = tall energetic bars)
 * - Bars use a gradient color (color → color2)
 * - Completed portion (left side, up to pct%) is bright + energetic
 * - Remaining portion (right side) is dim + subtle
 * - When 100%, all bars pulse brightly
 *
 * The waveform uses sine waves with per-bar phase offsets for organic motion.
 */
export function WaveformProgress({ pct, color = '#14b8a6', color2 = '#22c55e', className, height = 'h-12' }: Props) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const isComplete = clampedPct >= 100;

  // Number of bars — more bars = finer waveform
  const BAR_COUNT = 28;

  // Generate per-bar config (stable across re-renders)
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    // Each bar has a unique phase + speed for organic motion
    const phase = (i / BAR_COUNT) * Math.PI * 2;
    const speed = 0.8 + (i % 3) * 0.15; // slight variation
    const amplitude = 0.6 + Math.sin(i * 0.5) * 0.2 + (i % 4) * 0.05;
    return { phase, speed, amplitude, index: i };
  });

  return (
    <div
      className={cn('relative flex items-end justify-between gap-[2px] rounded-2xl overflow-hidden', height, className)}
      style={{
        background: 'var(--bar-track, rgba(255,255,255,0.04))',
        padding: '4px 6px',
      }}
    >
      {bars.map((bar) => {
        // Is this bar in the "completed" portion?
        const barProgress = (bar.index / (BAR_COUNT - 1)) * 100;
        const isFilled = barProgress <= clampedPct;

        // Base height scales with overall progress
        // 0% → bars are 15% of max height (tiny ripples)
        // 100% → bars are 95% of max height (tall + energetic)
        const progressScale = 0.15 + (clampedPct / 100) * 0.80;

        // Per-bar height variation using sine wave
        const barHeightPercent = 30 + Math.sin(bar.phase) * 25 + Math.cos(bar.phase * 1.7) * 15;

        // Filled bars are taller + brighter; unfilled are shorter + dimmer
        const finalHeight = isFilled
          ? Math.min(95, barHeightPercent * progressScale * 1.2)
          : Math.min(40, barHeightPercent * 0.3);

        return (
          <motion.div
            key={bar.index}
            className="flex-1 rounded-full"
            style={{
              background: isFilled
                ? `linear-gradient(to top, ${color}, ${color2})`
                : `linear-gradient(to top, ${color}30, ${color2}30)`,
              opacity: isFilled ? (isComplete ? 1 : 0.85) : 0.25,
              boxShadow: isFilled && isComplete
                ? `0 0 8px ${color2}60`
                : isFilled
                ? `0 0 4px ${color}30`
                : 'none',
              minHeight: 3,
            }}
            animate={{
              height: [
                `${finalHeight * 0.5}%`,
                `${finalHeight}%`,
                `${finalHeight * 0.7}%`,
                `${finalHeight * 1.1}%`,
                `${finalHeight * 0.5}%`,
              ],
            }}
            transition={{
              duration: bar.speed * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: bar.index * 0.03, // stagger for wave effect
            }}
          />
        );
      })}

      {/* Completion glow overlay */}
      {isComplete && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${color2}20, transparent 70%)`,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
