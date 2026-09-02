'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerParticleBurst, triggerConfetti } from '@/components/shared/Effects';
import { playSound } from '@/lib/sounds';

export interface UnlockData {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface Props {
  data: UnlockData | null;
  onClose: () => void;
}

export function AchievementCinematic({ data, onClose }: Props) {
  // When a new achievement unlocks: trigger particle burst + confetti + sound
  useEffect(() => {
    if (!data) return;
    // Delay slightly so the cinematic backdrop appears first
    const t1 = setTimeout(() => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      triggerParticleBurst(cx, cy, '#fbbf24');
      triggerConfetti('medium');
      playSound('achievement');
    }, 250);
    return () => clearTimeout(t1);
  }, [data]);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9996] flex flex-col items-center justify-center force-dark-ui"
          style={{ background: 'rgba(0,0,0,0.88)' }}
        >
          {/* Pulsing glow behind badge */}
          <motion.div
            className="absolute"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 2.4, 2, 2.4, 2.1],
              opacity: [0, 0.5, 0.3, 0.45, 0.35],
            }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
            style={{
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(168,85,247,0.15) 50%, transparent 70%)',
            }}
          />

          {/* Rotating sparkle ring */}
          <motion.div
            className="absolute"
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: 1.5, rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: '2px dashed rgba(251,191,36,0.3)',
            }}
          />

          {/* Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: [0, 1.6, 1], rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
            className="relative z-10 w-32 h-32 rounded-3xl flex items-center justify-center text-7xl"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(168,85,247,0.25))',
              border: '2px solid rgba(251,191,36,0.6)',
              boxShadow: '0 0 80px rgba(251,191,36,0.4), inset 0 0 30px rgba(255,255,255,0.1)',
            }}
          >
            <motion.span
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-block' }}
            >
              {data.icon}
            </motion.span>
          </motion.div>

          {/* "ACHIEVEMENT UNLOCKED" label */}
          <motion.div
            initial={{ opacity: 0, y: 20, letterSpacing: '0.5em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.3em' }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-[10px] uppercase text-amber-400 font-bold mt-6"
          >
            ✦ Achievement Unlocked ✦
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-2xl font-bold text-white mt-2 text-center"
          >
            {data.title}
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-sm text-muted-foreground mt-1 text-center max-w-xs px-4"
          >
            {data.description}
          </motion.div>

          {/* Tap to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 1, 0.5] }}
            transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
            className="text-[10px] text-muted-foreground mt-8 uppercase tracking-wider"
          >
            Tap to continue
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
