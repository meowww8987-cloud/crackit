'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/lib/store/settings';

/**
 * SplashScreen — Countdown to NEET.
 *
 * A giant number rapidly counts down from 365 to the user's actual days
 * to NEET (30 steps, ~25ms each). Each number change is animated.
 * Then the N7 logo + "Days to NEET" label fade in below.
 *
 * Total duration: ~1.8s, then fades out to reveal the app.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const examDate = useSettings((s) => s.examDate);
  const [displayNum, setDisplayNum] = useState(365);

  // Calculate actual days to exam
  const actualDays = useMemo(() => {
    const exam = new Date(examDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86400000));
  }, [examDate]);

  // Rapidly count down from 365 to actualDays
  useEffect(() => {
    const start = 365;
    const end = actualDays;
    const steps = 30;
    const stepValue = (start - end) / steps;
    let current = start;
    const interval = setInterval(() => {
      current -= stepValue;
      if (current <= end) {
        setDisplayNum(end);
        clearInterval(interval);
      } else {
        setDisplayNum(Math.round(current));
      }
    }, 25);
    return () => clearInterval(interval);
  }, [actualDays]);

  // Auto-dismiss after 1.8s
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden force-dark-ui"
        style={{ background: '#000000' }}
      >
        <div className="flex flex-col items-center">
          {/* Giant countdown number */}
          <motion.div
            key={displayNum}
            initial={{ scale: 1.1, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.05 }}
            className="text-7xl font-black tabular"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #22c55e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {displayNum}
          </motion.div>

          {/* "Days to NEET" label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold mt-1"
          >
            Days to NEET
          </motion.div>

          {/* N7 logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center mt-8"
          >
            <div
              className="text-6xl font-black tracking-tighter"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #22c55e, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 20px rgba(20,184,166,0.4))',
              }}
            >
              N7
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1.2 }}
              className="text-[10px] font-bold tracking-[0.4em] text-white/40 mt-1"
            >
              NEET 2027
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
