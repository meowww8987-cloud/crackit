'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';

type PartnerStatus = 'studying' | 'paused' | 'wasting' | 'offline' | 'online' | 'idle';

interface Props {
  /** Initials to show (1-2 chars). */
  initials: string;
  /** Accent color hex — used for the gradient fill and ring. */
  accentColor: string;
  /** Status: 'studying' | 'paused' | 'wasting' | 'offline' | 'online' | 'idle'.
   *
   * Canonical states (5) shown on the friend card:
   *  - studying: green dot + pulsing glow ring (actively studying right now)
   *  - online:   green dot, NO pulse (online but idle)
   *  - paused:   amber dot
   *  - wasting:  red dot
   *  - offline:  gray dot
   *
   * 'idle' is an alias for 'paused' (kept for backward compat).
   */
  status: PartnerStatus;
  /** Size in pixels. */
  size?: number;
  /** Whether the user is actively studying — legacy flag, now inferred from status.
   *  Kept for backward compatibility. */
  isStudying?: boolean;
  /** Subject color for the ring glow (defaults to accentColor). */
  subjectColor?: string;
  className?: string;
}

/**
 * PartnerAvatar — circular avatar with status ring.
 *
 * Design:
 * - Gradient fill using accentColor
 * - White initials centered
 * - Status dot bottom-right:
 *     studying → green, pulsing glow ring around avatar
 *     online   → green (no pulse)
 *     paused   → amber
 *     wasting  → red
 *     offline  → gray
 *
 * Modern avatar pattern used by Notion, Linear, Slack.
 */
export function PartnerAvatar({
  initials,
  accentColor,
  status,
  size = 48,
  isStudying = false,
  subjectColor,
  className,
}: Props) {
  // Normalize legacy status values
  const normalized: 'studying' | 'online' | 'paused' | 'wasting' | 'offline' =
    status === 'idle' ? 'paused' : status;
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  const glowColor = subjectColor || accentColor;
  const activelyStudying = normalized === 'studying' || isStudying;

  const statusColor =
    normalized === 'studying' || normalized === 'online' ? '#22c55e'
    : normalized === 'paused' ? '#f59e0b'
    : normalized === 'wasting' ? '#ef4444'
    : '#9ca3af';

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring — only when studying */}
      {activelyStudying && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${glowColor}40, transparent 70%)`,
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* Avatar circle with gradient */}
      <div
        className="relative rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.36,
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
          boxShadow: `0 4px 12px -2px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
        }}
      >
        {/* Subtle inner highlight */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
          }}
        />
        <span className="relative z-10">{initials.slice(0, 2).toUpperCase()}</span>
      </div>

      {/* Status dot — bottom right */}
      <div
        className="absolute rounded-full border-2 border-white dark:border-[#0a0b15]"
        style={{
          width: size * 0.28,
          height: size * 0.28,
          right: 0,
          bottom: 0,
          background: statusColor,
        }}
      >
        {/* Pulsing animation when studying */}
        {activelyStudying && (
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: animate ? Infinity : 0 }}
            className="absolute inset-0 rounded-full"
            style={{ background: statusColor }}
          />
        )}
      </div>
    </div>
  );
}
