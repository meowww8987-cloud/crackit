'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/lib/store/settings';

/**
 * SplashScreen — cycles through 6 splash animations SEQUENTIALLY (not random).
 *
 * Uses localStorage to track which splash to show next:
 *   Launch 1 → Splash A (atom assembly)
 *   Launch 2 → Splash B (liquid drop)
 *   Launch 3 → Splash C (countdown)
 *   Launch 4 → Splash D (DNA helix)
 *   Launch 5 → Splash E (pulse line)
 *   Launch 6 → Splash F (minimal fade — N7 logo only)
 *   Launch 7 → Splash A again (cycles back to start)
 *
 * A: Atom Assembly — orbital rings draw themselves, nucleus pops in
 * B: Liquid Drop — teal drop falls + splashes into N7 logo
 * C: Countdown to NEET — counts down from 365 to actual days left
 * D: DNA Helix — double helix spins + unwinds into N7
 * E: Pulse Line — ECG heartbeat line morphs into N7
 * F: Minimal Fade — N7 logo fades in (Apple-style, clean)
 */

const TOTAL_SPLASHES = 6;
const STORAGE_KEY = 'neet-splash-index';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  // Read the next splash index from localStorage (sequential, not random)
  const [splashIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(STORAGE_KEY);
    const current = stored ? parseInt(stored, 10) : 0;
    const nextIndex = (current + 1) % TOTAL_SPLASHES; // advance for next launch
    localStorage.setItem(STORAGE_KEY, String(nextIndex));
    return current; // show the CURRENT one (0-5)
  });

  // Auto-dismiss after 1.8s
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  const splashTypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
  const splashType = splashTypes[splashIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
        style={{ background: '#000000' }}
      >
        {splashType === 'A' && <SplashA />}
        {splashType === 'B' && <SplashB />}
        {splashType === 'C' && <SplashC />}
        {splashType === 'D' && <SplashD />}
        {splashType === 'E' && <SplashE />}
        {splashType === 'F' && <SplashF />}

        {/* Splash index indicator (tiny, bottom-right — for debugging) */}
        <div className="absolute bottom-2 right-3 text-[8px] text-white/10 font-mono">
          {splashType} ({splashIndex + 1}/{TOTAL_SPLASHES})
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// === Shared N7 Logo (appears at the end of each animation) ===
function N7Logo({ delay = 0.8 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center"
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
        transition={{ delay: delay + 0.2 }}
        className="text-[10px] font-bold tracking-[0.4em] text-white/40 mt-1"
      >
        NEET 2027
      </motion.div>
    </motion.div>
  );
}

// ===================================================================
// A: Atom Assembly — 3 orbital rings draw themselves + nucleus pops in
// ===================================================================
function SplashA() {
  return (
    <div className="relative">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="atom-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#14b8a6"/>
            <stop offset="50%" stop-color="#22c55e"/>
            <stop offset="100%" stop-color="#a855f7"/>
          </linearGradient>
        </defs>
        {/* Ring 1 — horizontal ellipse */}
        <motion.ellipse
          cx="80" cy="80" rx="60" ry="24"
          fill="none" stroke="url(#atom-grad-a)" strokeWidth="2.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
        {/* Ring 2 — rotated 60° */}
        <motion.ellipse
          cx="80" cy="80" rx="60" ry="24"
          fill="none" stroke="url(#atom-grad-a)" strokeWidth="2.5"
          transform="rotate(60 80 80)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeInOut' }}
        />
        {/* Ring 3 — rotated 120° */}
        <motion.ellipse
          cx="80" cy="80" rx="60" ry="24"
          fill="none" stroke="url(#atom-grad-a)" strokeWidth="2.5"
          transform="rotate(120 80 80)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 0.5, delay: 0.4, ease: 'easeInOut' }}
        />
        {/* Nucleus — medical cross */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: 'spring', stiffness: 300, damping: 15 }}
          style={{ transformOrigin: '80px 80px' }}
        >
          <circle cx="80" cy="80" r="10" fill="#22c55e" opacity="0.3"/>
          <rect x="76" y="72" width="8" height="16" rx="2" fill="#fff"/>
          <rect x="72" y="76" width="16" height="8" rx="2" fill="#fff"/>
        </motion.g>
      </svg>
      <div className="absolute top-full mt-6 left-1/2 -translate-x-1/2">
        <N7Logo delay={1.0} />
      </div>
    </div>
  );
}

// ===================================================================
// B: Liquid Drop — teal drop falls + splashes into N7
// ===================================================================
function SplashB() {
  return (
    <div className="relative flex flex-col items-center">
      {/* The drop falls from top */}
      <motion.div
        className="w-6 h-10 rounded-full"
        style={{ background: 'linear-gradient(180deg, #14b8a6, #22c55e)', filter: 'blur(0.5px)' }}
        initial={{ y: -200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeIn' }}
      >
        {/* Splash particles on impact */}
      </motion.div>
      {/* Splash particles */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 0], opacity: [0, 0.8, 0] }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="absolute top-0 w-1 h-1 rounded-full bg-teal-400"
        style={{ boxShadow: '0 0 20px 8px rgba(20,184,166,0.3)' }}
      />
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: i % 2 === 0 ? '#14b8a6' : '#22c55e',
              top: 0,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: Math.cos(angle) * 40,
              y: Math.sin(angle) * 40,
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
      <div className="mt-12">
        <N7Logo delay={0.9} />
      </div>
    </div>
  );
}

// ===================================================================
// C: Countdown to NEET — counts down from 365 to actual days left
// ===================================================================
function SplashC() {
  const examDate = useSettings((s) => s.examDate);
  const [displayNum, setDisplayNum] = useState(365);

  // Calculate actual days to exam
  const actualDays = useMemo(() => {
    const exam = new Date(examDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86400000));
  }, [examDate]);

  useEffect(() => {
    // Rapidly count down from 365 to actualDays
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

  return (
    <div className="flex flex-col items-center">
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-xs uppercase tracking-[0.3em] text-white/40 font-semibold mt-1"
      >
        Days to NEET
      </motion.div>
      <div className="mt-8">
        <N7Logo delay={1.0} />
      </div>
    </div>
  );
}

// ===================================================================
// D: DNA Helix — double helix spins + unwinds into N7
// ===================================================================
function SplashD() {
  const dots = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      y: i * 12,
      color: i % 2 === 0 ? '#14b8a6' : '#22c55e',
    }));
  }, []);

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ rotateY: 0, opacity: 0 }}
        animate={{ rotateY: 360, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d', perspective: 200 }}
      >
        <svg width="40" height="150" viewBox="0 0 40 150">
          {/* Left strand */}
          {dots.map((d) => (
            <motion.circle
              key={`l-${d.id}`}
              cx="20" cy={d.y + 5} r="4"
              fill={d.color}
              initial={{ cx: 20 }}
              animate={{ cx: [20, 32, 20, 8, 20] }}
              transition={{ duration: 1, repeat: 0, ease: 'easeInOut' }}
            />
          ))}
          {/* Right strand */}
          {dots.map((d) => (
            <motion.circle
              key={`r-${d.id}`}
              cx="20" cy={d.y + 5} r="4"
              fill={d.color}
              initial={{ cx: 20 }}
              animate={{ cx: [20, 8, 20, 32, 20] }}
              transition={{ duration: 1, repeat: 0, ease: 'easeInOut' }}
            />
          ))}
          {/* Connecting lines */}
          {dots.map((d) => (
            <motion.line
              key={`line-${d.id}`}
              x1="8" y1={d.y + 5} x2="32" y2={d.y + 5}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 1, delay: d.id * 0.05 }}
            />
          ))}
        </svg>
      </motion.div>
      <div className="mt-6">
        <N7Logo delay={1.0} />
      </div>
    </div>
  );
}

// ===================================================================
// E: Pulse Line — ECG heartbeat line morphs into N7
// ===================================================================
function SplashE() {
  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="60" viewBox="0 0 200 60">
        <motion.path
          d="M0,30 L60,30 L70,30 L75,10 L80,50 L85,15 L90,30 L110,30 L120,30 L125,8 L130,52 L135,12 L140,30 L200,30"
          fill="none"
          stroke="#14b8a6"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />
        {/* Glow effect */}
        <motion.path
          d="M0,30 L60,30 L70,30 L75,10 L80,50 L85,15 L90,30 L110,30 L120,30 L125,8 L130,52 L135,12 L140,30 L200,30"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.2"
          filter="blur(3px)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        />
      </svg>
      {/* Heartbeat dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-teal-400 mt-2"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
          style={{ boxShadow: '0 0 8px rgba(20,184,166,0.6)' }}
        />
      ))}
      <div className="mt-6">
        <N7Logo delay={0.9} />
      </div>
    </div>
  );
}

// ===================================================================
// F: Minimal Fade — N7 logo fades in (Apple-style, clean)
// ===================================================================
function SplashF() {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-7xl font-black tracking-tighter"
        style={{
          background: 'linear-gradient(135deg, #14b8a6, #22c55e, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 30px rgba(20,184,166,0.3))',
        }}
      >
        N7
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="text-xs font-bold tracking-[0.4em] text-white/40 mt-2"
      >
        NEET 2027
      </motion.div>
    </div>
  );
}
