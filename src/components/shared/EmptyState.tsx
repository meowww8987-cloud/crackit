'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  tab: 'study' | 'syllabus' | 'history' | 'tests' | 'stats';
  className?: string;
}

const EMPTY_STATES: Record<Props['tab'], { emoji: string; title: string; message: string; color: string }> = {
  study: {
    emoji: '🎯',
    title: 'No targets yet',
    message: 'Tap "+" to add your first study target. Start with one subject — momentum builds from there.',
    color: '#14b8a6',
  },
  syllabus: {
    emoji: '📚',
    title: 'Your syllabus is empty',
    message: 'Long-press the Syllabus tab → "Build Syllabus" to add subjects, chapters, and lectures.',
    color: '#a855f7',
  },
  history: {
    emoji: '📜',
    title: 'No history yet',
    message: 'Your study sessions will appear here once you start studying. Every session tells a story.',
    color: '#f59e0b',
  },
  tests: {
    emoji: '🏆',
    title: 'No tests logged',
    message: 'Add your first mock test to track your score progression. Even a low score is a starting point.',
    color: '#ef4444',
  },
  stats: {
    emoji: '📊',
    title: 'No data to analyze',
    message: 'Study for a few days and your analytics will appear here. Patterns will emerge.',
    color: '#3b82f6',
  },
};

/**
 * EmptyState — beautiful SVG illustration + motivational message for empty tabs.
 * Each tab has a unique illustration + message.
 */
export function EmptyState({ tab, className }: Props) {
  const state = EMPTY_STATES[tab];

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {/* Animated illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mb-4"
      >
        {/* Glow circle behind the emoji */}
        <div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ background: state.color, opacity: 0.1 }}
        />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative text-6xl"
          style={{ filter: `drop-shadow(0 4px 12px ${state.color}40)` }}
        >
          {state.emoji}
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-base font-bold mb-2"
        style={{ color: state.color }}
      >
        {state.title}
      </motion.h3>

      {/* Message */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xs text-t-muted leading-snug max-w-[260px]"
      >
        {state.message}
      </motion.p>
    </div>
  );
}
