'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  /** Initials to show (1-2 chars). */
  initials: string;
  /** Accent color hex — used for the gradient fill and ring. */
  accentColor: string;
  /** Online status: 'online' | 'idle' | 'offline'. */
  status: 'online' | 'idle' | 'offline';
  /** Size in pixels. */
  size?: number;
  /** Whether the user is actively studying — adds a pulsing glow. */
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
 * - Status dot bottom-right (green=idle grey, pulsing green=online+studying)
 * - Optional subject-color glow ring when studying
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
  const glowColor = subjectColor || accentColor;
  const statusColor = status === 'online' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#6b7280';

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring — only when studying */}
      {isStudying && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
        {/* Pulsing animation when online + studying */}
        {status === 'online' && isStudying && (
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 rounded-full"
            style={{ background: statusColor }}
          />
        )}
      </div>
    </div>
  );
}
