'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHistory } from '@/lib/store/history';
import { todayKey } from '@/lib/utils';

interface Props {
  streak: number;
  className?: string;
}

export function StreakFlame({ streak, className }: Props) {
  const [atRisk, setAtRisk] = useState(false);
  const sessions = useHistory((s) => s.sessions);

  // Check if streak is at risk: it's past 6 PM and no study today
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
    const interval = setInterval(check, 60000); // re-check every minute
    return () => clearInterval(interval);
  }, [sessions, streak]);

  if (streak <= 0) return null;

  // Flame intensity levels
  const level = streak >= 30 ? 'epic' : streak >= 14 ? 'fire' : streak >= 7 ? 'blaze' : 'spark';
  const config = {
    spark: { size: 14, duration: '1.6s', glow: 'rgba(251,146,60,0.3)' },
    blaze: { size: 16, duration: '1.2s', glow: 'rgba(251,146,60,0.5)' },
    fire: { size: 18, duration: '0.9s', glow: 'rgba(239,68,68,0.5)' },
    epic: { size: 20, duration: '0.7s', glow: 'rgba(239,68,68,0.7)' },
  };
  const c = config[level];

  return (
    <motion.div
      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border relative', className)}
      style={{
        background: c.glow,
        borderColor: level === 'epic' ? 'rgba(239,68,68,0.4)' : 'rgba(251,146,60,0.3)',
      }}
      animate={
        atRisk
          ? {
              scale: [1, 1.08, 1],
              boxShadow: [
                '0 0 0px rgba(239,68,68,0)',
                '0 0 16px rgba(239,68,68,0.6)',
                '0 0 0px rgba(239,68,68,0)',
              ],
            }
          : {}
      }
      transition={{ duration: 0.8, repeat: atRisk ? Infinity : 0 }}
    >
      <motion.span
        animate={
          atRisk
            ? {
                scale: [1, 1.25, 0.85, 1.2, 1],
                rotate: [-3, 2, 3, -2, -3],
                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(0.8)', 'brightness(1.4)', 'brightness(1)'],
              }
            : {
                scale: [1, 1.15, 0.95, 1.1, 1],
                rotate: [-2, 1, 2, -1, -2],
                filter: ['brightness(1)', 'brightness(1.3)', 'brightness(0.9)', 'brightness(1.2)', 'brightness(1)'],
              }
        }
        transition={{
          duration: atRisk ? parseFloat(c.duration) * 0.6 : parseFloat(c.duration),
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ fontSize: c.size, display: 'inline-block' }}
      >
        🔥
      </motion.span>
      <span
        className="text-sm font-bold tabular"
        style={{ color: level === 'epic' ? '#ef4444' : '#fb923c' }}
      >
        {streak}
      </span>
      {level === 'epic' && (
        <motion.span
          className="absolute"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 8, color: '#fbbf24' }}
        >
          ✨
        </motion.span>
      )}
      {/* "AT RISK" pulse badge — appears when streak is in danger */}
      {atRisk && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-full"
        >
          !
        </motion.span>
      )}
    </motion.div>
  );
}
