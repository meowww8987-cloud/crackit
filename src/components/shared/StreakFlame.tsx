'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHistory } from '@/lib/store/history';
import { todayKey } from '@/lib/utils';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';

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
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  // Pause animations when tab hidden OR reduceMotion is on
  const animate = isVisible && !reduceMotion;

  // === HEAT FIX: Freeze flame flicker after 3 seconds ===
  // The flame flicker animation (scale + rotate + skewX) runs infinitely on
  // the Home tab whenever streak > 0 (always). After 3 seconds, the user has
  // already seen the flame "alive" — we freeze it to a static state to save
  // GPU. The flame still shows, just doesn't flicker. Re-animates for 3s
  // whenever the component re-mounts (e.g., returning to Home tab).
  const [flickerActive, setFlickerActive] = useState(true);
  useEffect(() => {
    setFlickerActive(true); // Re-activate on mount / visibility return
    const t = setTimeout(() => setFlickerActive(false), 3000);
    return () => clearTimeout(t);
  }, [isVisible]); // Re-run when tab becomes visible again
  // Combine: only flicker if visible + motion allowed + within 3s window
  const flickerAnimate = animate && flickerActive;

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
    const interval = setInterval(() => { if (!document.hidden) check(); }, 60000);
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

  // Flame level config — chunky flame, strong outline for light-theme visibility
  const config = {
    spark:  {
      size: 18,
      glow: 'rgba(234,88,12,0.2)',
      borderColor: 'rgba(234,88,12,0.5)',
      gradientId: 'flame-spark',
      gradient: ['#fde047', '#f97316', '#c2410c'],
      glowColor: 'rgba(234,88,12,0.6)',
      numberColor: '#c2410c',
    },
    blaze:  {
      size: 20,
      glow: 'rgba(220,38,38,0.25)',
      borderColor: 'rgba(220,38,38,0.5)',
      gradientId: 'flame-blaze',
      gradient: ['#fbbf24', '#f97316', '#b91c1c'],
      glowColor: 'rgba(220,38,38,0.7)',
      numberColor: '#b91c1c',
    },
    fire:   {
      size: 22,
      glow: 'rgba(220,38,38,0.3)',
      borderColor: 'rgba(220,38,38,0.55)',
      gradientId: 'flame-fire',
      gradient: ['#fbbf24', '#ef4444', '#991b1b'],
      glowColor: 'rgba(220,38,38,0.7)',
      numberColor: '#b91c1c',
    },
    epic:   {
      size: 24,
      glow: 'rgba(185,28,28,0.35)',
      borderColor: 'rgba(185,28,28,0.6)',
      gradientId: 'flame-epic',
      gradient: ['#f97316', '#dc2626', '#7f1d1d'],
      glowColor: 'rgba(185,28,28,0.8)',
      numberColor: '#991b1b',
    },
    golden: {
      size: 26,
      glow: 'rgba(217,119,6,0.4)',
      borderColor: 'rgba(217,119,6,0.6)',
      gradientId: 'flame-golden',
      gradient: ['#fef08a', '#fbbf24', '#b45309'],
      glowColor: 'rgba(217,119,6,0.9)',
      numberColor: '#b45309',
    },
  };

  // At-risk overrides — cold blue flame (dying)
  if (atRisk) {
    config[level] = {
      ...config[level],
      glow: 'rgba(37,99,235,0.2)',
      borderColor: 'rgba(37,99,235,0.5)',
      gradientId: 'flame-cold',
      gradient: ['#bfdbfe', '#3b82f6', '#1e40af'],
      glowColor: 'rgba(37,99,235,0.5)',
      numberColor: '#1e40af',
    };
  }

  const c = config[level];
  const numberColor = atRisk ? '#1e40af' : c.numberColor;

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
            ? { duration: 1, repeat: animate ? Infinity : 0 }
            : { type: 'spring', stiffness: 400, damping: 20 }
        }
        onClick={() => setShowHistory(true)}
      >
        {/* SVG Flame — with dark outline for light-theme visibility */}
        <motion.div
          animate={
            !flickerAnimate
              ? {} // Frozen — no animation after 3s (HEAT FIX)
              : atRisk
              ? {
                  // Cold/dying — weak flicker
                  scale: [1, 0.92, 1.05, 0.95, 1],
                  rotate: [-1, 1, -1, 1, -1],
                }
              : {
                  // Realistic fire flicker — multiple micro-movements
                  scale: [1, 1.15, 0.92, 1.1, 0.96, 1.08, 1],
                  rotate: [-3, 2, -1, 3, -2, 1, -3],
                  skewX: [0, 2, -1, 1, 0],
                }
          }
          transition={
            !flickerAnimate
              ? { duration: 0 }
              : {
                  duration: atRisk ? 2 : 0.8,
                  repeat: animate ? Infinity : 0,
                  ease: 'easeInOut',
                }
          }
          style={{
            width: c.size,
            height: c.size,
            position: 'relative',
            filter: `drop-shadow(0 0 4px ${c.glowColor}) drop-shadow(0 1px 2px rgba(0,0,0,0.2))`,
          }}
        >
          {/* Glow halo — stronger */}
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${c.glowColor} 0%, transparent 70%)`,
              opacity: 0.7,
            }}
          />
          {/* Flame SVG — CHUNKY shape, strong dark outline for light-theme visibility */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
          >
            <defs>
              <linearGradient id={c.gradientId} x1="0.5" y1="1" x2="0.5" y2="0">
                <stop offset="0%" stopColor={c.gradient[2]} />
                <stop offset="50%" stopColor={c.gradient[1]} />
                <stop offset="100%" stopColor={c.gradient[0]} />
              </linearGradient>
              <radialGradient id={`${c.gradientId}-inner`} cx="0.5" cy="0.65" r="0.45">
                <stop offset="0%" stopColor={c.gradient[0]} stopOpacity="0.95" />
                <stop offset="100%" stopColor={c.gradient[1]} stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* CHUNKY flame — wide body, strong dark outline for visibility */}
            <path
              d="M12 1 C 8.5 5, 5 8, 5 13.5 C 5 18, 8 22.5, 12 23 C 16 22.5, 19 18, 19 13.5 C 19 9.5, 16 6.5, 14.5 4 C 14 5.5, 13 6.5, 12 7 C 12.5 5, 12.5 3, 12 1 Z"
              fill={`url(#${c.gradientId})`}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Inner flame — bright core */}
            <path
              d="M12 6.5 C 10 9.5, 8.5 12, 8.5 15 C 8.5 18, 10 20.5, 12 21 C 14 20.5, 15.5 18, 15.5 15 C 15.5 12, 14 9.5, 13 8 C 12.5 9, 12 10, 12 10 Z"
              fill={`url(#${c.gradientId}-inner)`}
            />
            {/* Hot tip — bright ellipse */}
            <ellipse cx="12" cy="8.5" rx="2" ry="3" fill={c.gradient[0]} opacity="0.85" />
          </svg>
        </motion.div>

        {/* Streak number + label — compact, inline */}
        <div className="flex items-baseline gap-0.5 leading-none">
          <motion.span
            key={streak}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="text-xs font-bold tabular"
            style={{ color: numberColor }}
          >
            {streak}
          </motion.span>
          <span
            className="text-[8px] font-semibold"
            style={{ color: atRisk ? '#ef4444' : 'var(--muted-foreground)' }}
          >
            {atRisk ? '⚠' : 'd'}
          </span>
        </div>

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
                  repeat: 0, // Disabled — sparkles are static (saves GPU)
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
      <div className="absolute inset-0 bg-black/85" />
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
