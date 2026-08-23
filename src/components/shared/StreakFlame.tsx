'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHistory } from '@/lib/store/history';
import { todayKey } from '@/lib/utils';

interface Props {
  streak: number;
  className?: string;
}

/**
 * StreakFlame — modern animated streak indicator.
 *
 * Features:
 *  - SVG-based flame with flicker animation (not emoji)
 *  - Gradient fill (yellow → orange → red) matching streak level
 *  - Glow filter behind flame (blurred halo)
 *  - Count-up number animation with spring bounce on increase
 *  - "day streak" context label
 *  - Milestone celebrations (7/14/30/100 days) — confetti burst
 *  - At-risk state: pill pulses red, flame turns cold blue, "Save streak!" text
 *  - Theme-aware text colors
 *  - Tap → streak history popup (last 14 days as mini tiles)
 */

export function StreakFlame({ streak, className }: Props) {
  const [atRisk, setAtRisk] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [celebrated, setCelebrated] = useState<Set<number>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);
  const prevStreakRef = useRef(streak);
  const sessions = useHistory((s) => s.sessions);

  // Check if streak is at risk: past 6 PM and no study today
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      const today = todayKey();
      const studiedToday = sessions.some(
        (s) => s.date === today && s.studySeconds >= 60,
      );
      setAtRisk(hour >= 18 && !studiedToday && streak > 0);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [sessions, streak]);

  // Milestone celebration — fires when streak crosses 7/14/30/100
  useEffect(() => {
    const milestones = [7, 14, 30, 100];
    if (streak > prevStreakRef.current && milestones.includes(streak) && !celebrated.has(streak)) {
      setShowCelebration(true);
      setCelebrated(prev => new Set(prev).add(streak));
      setTimeout(() => setShowCelebration(false), 3000);
    }
    prevStreakRef.current = streak;
  }, [streak, celebrated]);

  if (streak <= 0) return null;

  // Flame level config
  const level = streak >= 100 ? 'golden' : streak >= 30 ? 'epic' : streak >= 14 ? 'fire' : streak >= 7 ? 'blaze' : 'spark';

  const config = {
    spark:  {
      size: 16,
      glow: 'rgba(251,146,60,0.3)',
      borderColor: 'rgba(251,146,60,0.3)',
      gradientId: 'flame-spark',
      gradient: ['#fde047', '#fb923c'],
      glowColor: 'rgba(251,146,60,0.5)',
    },
    blaze:  {
      size: 18,
      glow: 'rgba(251,146,60,0.4)',
      borderColor: 'rgba(251,146,60,0.4)',
      gradientId: 'flame-blaze',
      gradient: ['#fbbf24', '#f97316'],
      glowColor: 'rgba(251,146,60,0.6)',
    },
    fire:   {
      size: 20,
      glow: 'rgba(239,68,68,0.4)',
      borderColor: 'rgba(239,68,68,0.4)',
      gradientId: 'flame-fire',
      gradient: ['#fbbf24', '#ef4444'],
      glowColor: 'rgba(239,68,68,0.6)',
    },
    epic:   {
      size: 22,
      glow: 'rgba(239,68,68,0.5)',
      borderColor: 'rgba(239,68,68,0.5)',
      gradientId: 'flame-epic',
      gradient: ['#f97316', '#dc2626'],
      glowColor: 'rgba(239,68,68,0.7)',
    },
    golden: {
      size: 24,
      glow: 'rgba(251,191,36,0.6)',
      borderColor: 'rgba(251,191,36,0.5)',
      gradientId: 'flame-golden',
      gradient: ['#fef08a', '#fbbf24'],
      glowColor: 'rgba(251,191,36,0.8)',
    },
  };

  // At-risk overrides — cold blue flame (dying)
  if (atRisk) {
    config[level] = {
      ...config[level],
      glow: 'rgba(59,130,246,0.3)',
      borderColor: 'rgba(239,68,68,0.5)',
      gradientId: 'flame-cold',
      gradient: ['#93c5fd', '#3b82f6'],
      glowColor: 'rgba(59,130,246,0.4)',
    };
  }

  const c = config[level];
  const numberColor = atRisk ? '#3b82f6' : (level === 'golden' ? '#fbbf24' : level === 'epic' ? '#ef4444' : '#fb923c');

  return (
    <>
      <motion.div
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full border relative cursor-pointer select-none',
          className
        )}
        style={{
          background: atRisk ? 'rgba(239,68,68,0.1)' : c.glow,
          borderColor: atRisk ? 'rgba(239,68,68,0.5)' : c.borderColor,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={
          atRisk
            ? {
                scale: [1, 1.05, 1],
                opacity: 1,
                boxShadow: [
                  '0 0 0px rgba(239,68,68,0)',
                  '0 0 12px rgba(239,68,68,0.5)',
                  '0 0 0px rgba(239,68,68,0)',
                ],
              }
            : { scale: 1, opacity: 1 }
        }
        transition={
          atRisk
            ? { duration: 1, repeat: Infinity }
            : { type: 'spring', stiffness: 400, damping: 20 }
        }
        onClick={() => setShowHistory(true)}
      >
        {/* SVG Flame */}
        <motion.div
          animate={
            atRisk
              ? {
                  scale: [1, 0.9, 1.1, 0.95, 1],
                  rotate: [-2, 1, 2, -1, -2],
                }
              : {
                  scale: [1, 1.12, 0.95, 1.08, 1],
                  rotate: [-2, 1, 2, -1, -2],
                }
          }
          transition={{
            duration: atRisk ? 1.5 : 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ width: c.size, height: c.size, position: 'relative' }}
        >
          {/* Glow halo */}
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: c.glowColor,
              filter: 'blur(6px)',
              opacity: 0.6,
            }}
          />
          {/* Flame SVG */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
          >
            <defs>
              <linearGradient id={c.gradientId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={c.gradient[1]} />
                <stop offset="100%" stopColor={c.gradient[0]} />
              </linearGradient>
            </defs>
            {/* Flame shape — teardrop with wavy edges */}
            <path
              d="M12 2 C 10 6, 7 8, 7 13 C 7 17, 9 21, 12 22 C 15 21, 17 17, 17 13 C 17 10, 15 8, 14 6 C 13.5 7, 13 7.5, 12 8 C 12 6, 12 4, 12 2 Z"
              fill={`url(#${c.gradientId})`}
            />
            {/* Inner flame highlight */}
            <path
              d="M12 8 C 11 10, 10 11, 10 14 C 10 16, 11 18, 12 19 C 13 18, 14 16, 14 14 C 14 12, 13 11, 12.5 10 C 12.3 10.5, 12 11, 12 11 Z"
              fill={c.gradient[0]}
              opacity="0.6"
            />
          </svg>
        </motion.div>

        {/* Streak number — count-up animation */}
        <motion.div className="flex flex-col items-start leading-none">
          <motion.span
            key={streak}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="text-sm font-bold tabular"
            style={{ color: numberColor }}
          >
            {streak}
          </motion.span>
          <span
            className="text-[7px] font-semibold uppercase tracking-wide"
            style={{ color: atRisk ? '#ef4444' : 'var(--muted-foreground)' }}
          >
            {atRisk ? 'Save!' : 'streak'}
          </span>
        </motion.div>

        {/* Particle sparks for epic (30+) + golden (100+) */}
        {(level === 'epic' || level === 'golden') && !atRisk && (
          <>
            {[...Array(level === 'golden' ? 4 : 2)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute pointer-events-none"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.5, 2],
                  y: [0, -15 - i * 5],
                  x: [0, (i % 2 === 0 ? 8 : -8)],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: 'easeOut',
                }}
                style={{ fontSize: 8, color: level === 'golden' ? '#fbbf24' : '#fbbf24' }}
              >
                ✨
              </motion.span>
            ))}
          </>
        )}
      </motion.div>

      {/* Milestone celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: 3 }}
                className="text-6xl mb-2"
              >
                {streak >= 100 ? '🔱' : '🎉'}
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {streak} Day Streak!
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm mt-1"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {streak >= 100 ? 'Legendary! 🔱' : streak >= 30 ? 'One month! Incredible!' : streak >= 14 ? 'Two weeks! Keep going!' : 'One week! Great start!'}
              </motion.p>
            </div>
            {/* Confetti particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'][i % 5],
                }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: (Math.random() - 0.5) * 300,
                  y: (Math.random() - 0.5) * 300,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 1.5, delay: i * 0.05 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak history popup */}
      <AnimatePresence>
        {showHistory && (
          <StreakHistoryPopup
            streak={streak}
            sessions={sessions}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// Streak History Popup
// =====================================================

function StreakHistoryPopup({
  streak,
  sessions,
  onClose,
}: {
  streak: number;
  sessions: ReturnType<typeof useHistory.getState>['sessions'];
  onClose: () => void;
}) {
  // Build last 14 days
  const days: { key: string; dayName: string; dateNum: number; studied: boolean; studySec: number; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const studied = sessions.some((s) => s.date === key && s.studySeconds >= 60);
    const studySec = sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0);
    days.push({
      key,
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dateNum: d.getDate(),
      studied,
      studySec,
      isToday: i === 0,
    });
  }

  // Best streak (simple calc from history)
  let bestStreak = 0;
  let currentRun = 0;
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const studyDates = new Set(sortedSessions.filter(s => s.studySeconds >= 60).map(s => s.date));
  const allDates = Array.from(studyDates).sort();
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      currentRun = 1;
    } else {
      const prev = new Date(allDates[i - 1] + 'T00:00:00');
      const curr = new Date(allDates[i] + 'T00:00:00');
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) currentRun++;
      else currentRun = 1;
    }
    bestStreak = Math.max(bestStreak, currentRun);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🔥</div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
            {streak} Day Streak
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Study every day to keep it going!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-bold tabular" style={{ color: '#fb923c' }}>{streak}</div>
            <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Current</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-bold tabular" style={{ color: '#fbbf24' }}>{bestStreak}</div>
            <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Best Ever</div>
          </div>
        </div>

        {/* Last 14 days */}
        <div>
          <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Last 14 Days
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-full aspect-square rounded-md flex items-center justify-center"
                  style={{
                    background: day.studied
                      ? `rgba(251,146,60,${Math.min(1, 0.3 + (day.studySec / 14400))})`
                      : 'var(--muted)',
                    border: day.isToday ? '1.5px solid #fbbf24' : 'none',
                    boxShadow: day.isToday ? '0 0 6px rgba(251,191,36,0.4)' : 'none',
                  }}
                >
                  {day.studied && (
                    <span className="text-[8px] font-bold" style={{ color: '#fff' }}>✓</span>
                  )}
                </div>
                <span className="text-[7px]" style={{ color: day.isToday ? '#fbbf24' : 'var(--muted-foreground)' }}>
                  {day.dayName}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap outside to close
        </p>
      </motion.div>
    </motion.div>
  );
}
