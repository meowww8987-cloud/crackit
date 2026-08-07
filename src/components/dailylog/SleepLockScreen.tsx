'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSleep } from '@/lib/store/sleep';
import { useSettings } from '@/lib/store/settings';
import { cn, formatHM, vibrate } from '@/lib/utils';

/**
 * SleepLockScreen — full-screen immersive sleep mode.
 *
 * Two phases:
 *   1. SLEEPING — full-screen bluish gradient + animated night scenery
 *      (moon, twinkling stars, floating clouds, shooting stars, gentle hills).
 *      Live sleep timer at top. Hint: "Double-tap to wake up".
 *
 *   2. CHALLENGE — shown after double-tap. A medium-difficulty math problem.
 *      If solved → app unlocks (wakeUp called) with a SUNRISE TRANSITION:
 *      the night gradient morphs to a warm sunrise (dark blue → purple →
 *      orange → warm yellow) over 2 seconds before the lock screen fades away.
 *      If wrong → stays locked, returns to SLEEPING after 2s.
 */
export function SleepLockScreen() {
  const activeSleep = useSleep((s) => s.activeSleep);
  const wakeUp = useSleep((s) => s.wakeUp);
  const cancelSleep = useSleep((s) => s.cancelSleep);
  const haptics = useSettings((s) => s.haptics);

  const [phase, setPhase] = useState<'sleeping' | 'challenge' | 'sunrise'>('sleeping');
  const [, setTick] = useState(0);

  // Live timer
  useEffect(() => {
    if (!activeSleep) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [activeSleep]);

  // Reset to sleeping phase when challenge is dismissed
  useEffect(() => {
    if (!activeSleep) setPhase('sleeping');
  }, [activeSleep]);

  if (!activeSleep) return null;

  const elapsedSec = Math.floor((Date.now() - activeSleep.bedTime) / 1000);
  const bedTime = new Date(activeSleep.bedTime);
  const bedTimeStr = bedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Background gradient changes based on phase
  const bgGradient = phase === 'sunrise'
    ? 'linear-gradient(180deg, #1a0a27 0%, #4a1a3e 20%, #8a3a2e 45%, #d4691a 70%, #f5b04a 100%)'
    : 'linear-gradient(180deg, #0a0e27 0%, #1a1f4e 35%, #2d3582 70%, #4a5db0 100%)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="fixed inset-0 z-[9999] overflow-hidden"
        style={{
          background: bgGradient,
          transition: 'background 2s ease-in-out',
        }}
      >
        {/* === Animated night scenery === */}
        {phase !== 'sunrise' && <NightScenery />}
        {/* Sunrise scenery during sunrise transition */}
        {phase === 'sunrise' && <SunriseScenery />}

        {/* === Top: sleep timer === */}
        <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] pt-6 z-10">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-200/60 font-semibold mb-1">
              Sleeping since {bedTimeStr}
            </div>
            <motion.div
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="text-5xl font-bold tabular text-white"
              style={{ textShadow: '0 0 30px rgba(165,180,252,0.4)' }}
            >
              {formatHM(elapsedSec)}
            </motion.div>
          </motion.div>
        </div>

        {/* === Center content === */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <AnimatePresence mode="wait">
            {phase === 'sleeping' && (
              <SleepingPhase
                key="sleeping"
                onDoubleTap={() => {
                  if (haptics) vibrate([10, 30, 10]);
                  setPhase('challenge');
                }}
                onCancel={() => {
                  if (haptics) vibrate(15);
                  cancelSleep();
                }}
              />
            )}
            {phase === 'challenge' && (
              <ChallengePhase
                key="challenge"
                onSolve={() => {
                  if (haptics) vibrate([10, 30, 10, 30, 50]);
                  // Start sunrise transition, THEN wake up after it completes
                  setPhase('sunrise');
                  setTimeout(() => wakeUp(), 2500);
                }}
                onFail={() => {
                  if (haptics) vibrate(8);
                  setTimeout(() => setPhase('sleeping'), 2000);
                }}
                onBack={() => setPhase('sleeping')}
              />
            )}
            {phase === 'sunrise' && (
              <motion.div
                key="sunrise"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  className="text-7xl mb-4"
                  style={{ filter: 'drop-shadow(0 0 40px rgba(255,200,100,0.8))' }}
                >
                  ☀️
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-lg font-light text-amber-50"
                >
                  Good morning!
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== Sleeping Phase — scenery + double-tap hint =====
function SleepingPhase({ onDoubleTap, onCancel }: { onDoubleTap: () => void; onCancel: () => void }) {
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      onDoubleTap();
    }
    lastTapRef.current = now;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center"
      onClick={handleTap}
    >
      {/* Breathing moon logo — 4-second breathing cycle */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="text-8xl mb-6"
        style={{ filter: 'drop-shadow(0 0 40px rgba(165,180,252,0.6))' }}
      >
        🌙
      </motion.div>

      <motion.div
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="text-2xl font-light text-indigo-100 mb-2 tracking-wide"
      >
        Sleeping
      </motion.div>

      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-sm text-indigo-200/60 font-medium"
      >
        Double-tap anywhere to wake up
      </motion.div>

      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="absolute bottom-[env(safe-area-inset-bottom,0px)] bottom-8 text-[11px] text-indigo-300/40 hover:text-indigo-200/70 transition underline"
      >
        Cancel sleep
      </button>
    </motion.div>
  );
}

// ===== Challenge Phase — math problem to unlock =====
function ChallengePhase({ onSolve, onFail, onBack }: { onSolve: () => void; onFail: () => void; onBack: () => void }) {
  const problem = useMemo(() => {
    const type = Math.floor(Math.random() * 3);
    let a, b, c, question, answer;
    if (type === 0) {
      a = 12 + Math.floor(Math.random() * 80);
      b = 3 + Math.floor(Math.random() * 7);
      question = `${a} × ${b}`;
      answer = a * b;
    } else if (type === 1) {
      a = 15 + Math.floor(Math.random() * 60);
      b = 10 + Math.floor(Math.random() * 50);
      c = 5 + Math.floor(Math.random() * 30);
      question = `(${a} + ${b}) − ${c}`;
      answer = a + b - c;
    } else {
      b = 3 + Math.floor(Math.random() * 7);
      answer = 8 + Math.floor(Math.random() * 30);
      a = b * answer;
      question = `${a} ÷ ${b}`;
    }
    return { question, answer };
  }, []);

  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle');

  const handleSubmit = () => {
    if (input.trim() === '') return;
    const val = parseInt(input.trim(), 10);
    if (val === problem.answer) {
      setStatus('correct');
      setTimeout(onSolve, 600);
    } else {
      setStatus('wrong');
      onFail();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex flex-col items-center w-full max-w-xs px-6"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-5xl mb-4"
        style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.5))' }}
      >
        ☀️
      </motion.div>
      <h2 className="text-xl font-bold text-white mb-1">Good morning!</h2>
      <p className="text-sm text-indigo-200/70 mb-6 text-center">Solve this to prove you're awake</p>

      <div className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 mb-4 text-center">
        <div className="text-3xl font-bold tabular text-white mb-3">{problem.question} = ?</div>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={input}
          onChange={(e) => { setInput(e.target.value); setStatus('idle'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="?"
          className={cn(
            'w-24 text-center text-2xl font-bold tabular bg-white/10 border-2 rounded-xl py-2 text-white placeholder:text-white/30 focus:outline-none transition',
            status === 'wrong' ? 'border-red-400 bg-red-500/10' : status === 'correct' ? 'border-green-400 bg-green-500/10' : 'border-white/20 focus:border-indigo-300'
          )}
        />
        <div className="h-5 mt-2">
          <AnimatePresence>
            {status === 'wrong' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-red-300 font-semibold">✗ Wrong. Still sleeping...</motion.p>
            )}
            {status === 'correct' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-green-300 font-semibold">✓ Correct! Unlocking...</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-sm active:scale-[0.98] transition mb-2">Unlock</button>
      <button onClick={onBack} className="text-xs text-indigo-200/50 hover:text-indigo-200/80 transition underline">Back to sleep</button>
    </motion.div>
  );
}

// ===== Night Scenery — stars, breathing moon, floating clouds, shooting stars, hills =====
function NightScenery() {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 60,
    size: 1 + Math.random() * 2, delay: Math.random() * 4, duration: 2 + Math.random() * 3,
  })), []);

  // Floating clouds — 3 clouds drifting slowly across the sky
  const clouds = useMemo(() => [
    { id: 1, top: '15%', duration: 60, delay: 0, scale: 1 },
    { id: 2, top: '25%', duration: 80, delay: 20, scale: 0.7 },
    { id: 3, top: '8%', duration: 70, delay: 40, scale: 0.85 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Twinkling stars */}
      {stars.map((s) => (
        <motion.div key={s.id} className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.5, 1] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* === Floating clouds — slow drift across the sky === */}
      {clouds.map((c) => (
        <motion.div
          key={`cloud-${c.id}`}
          className="absolute"
          style={{ top: c.top, scale: c.scale }}
          initial={{ x: '-150px' }}
          animate={{ x: 'calc(100vw + 150px)' }}
          transition={{ duration: c.duration, repeat: Infinity, delay: c.delay, ease: 'linear' }}
        >
          <Cloud />
        </motion.div>
      ))}

      {/* === Shooting stars — streak across every 30-60s === */}
      <ShootingStars />

      {/* === Breathing moon glow — 4-second breathing cycle === */}
      <motion.div
        className="absolute rounded-full"
        style={{ right: '15%', top: '12%', width: 80, height: 80,
          background: 'radial-gradient(circle, rgba(255,255,230,0.9) 0%, rgba(255,255,200,0.3) 40%, transparent 70%)',
          filter: 'blur(8px)',
        }}
        animate={{ opacity: [0.5, 0.95, 0.5], scale: [0.95, 1.1, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Aurora-like breathing light (bottom) */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '50%', background: 'radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.12) 30%, transparent 70%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5], scaleY: [0.95, 1.05, 0.95] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Rolling hills silhouette */}
      <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ height: '25%' }}>
        <path d="M0,80 Q50,60 100,75 T200,70 T300,80 T400,65 L400,120 L0,120 Z" fill="rgba(10,14,39,0.6)" />
        <path d="M0,95 Q60,80 120,90 T240,85 T360,95 T400,90 L400,120 L0,120 Z" fill="rgba(10,14,39,0.8)" />
      </svg>
    </div>
  );
}

// ===== Cloud SVG shape =====
function Cloud() {
  return (
    <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
      <ellipse cx="30" cy="35" rx="25" ry="15" fill="rgba(255,255,255,0.08)" />
      <ellipse cx="60" cy="28" rx="30" ry="18" fill="rgba(255,255,255,0.06)" />
      <ellipse cx="90" cy="35" rx="22" ry="14" fill="rgba(255,255,255,0.08)" />
    </svg>
  );
}

// ===== Shooting Stars — streaks across the sky every 30-60s =====
function ShootingStars() {
  const [stars, setStars] = useState<{ id: number; startX: number; startY: number }[]>([]);

  useEffect(() => {
    let id = 0;
    const spawn = () => {
      const startX = Math.random() * 60;
      const startY = Math.random() * 30;
      setStars((prev) => [...prev, { id: id++, startX, startY }]);
      // Remove after animation (1.5s)
      setTimeout(() => setStars((prev) => prev.filter((s) => s.id !== id - 1)), 1500);
      // Schedule next shooting star (30-60s)
      setTimeout(spawn, 30000 + Math.random() * 30000);
    };
    const initialTimer = setTimeout(spawn, 5000 + Math.random() * 10000);
    return () => clearTimeout(initialTimer);
  }, []);

  return (
    <>
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute pointer-events-none"
          style={{ left: `${s.startX}%`, top: `${s.startY}%` }}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], x: 200, y: 150 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          {/* Shooting star = bright dot + trailing line */}
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-white" style={{ boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }} />
            <div className="absolute top-1/2 right-full w-16 h-px bg-gradient-to-l from-white to-transparent" style={{ transform: 'translateY(-50%) rotate(37deg)', transformOrigin: 'right center' }} />
          </div>
        </motion.div>
      ))}
    </>
  );
}

// ===== Sunrise Scenery — warm gradient + rising sun =====
function SunriseScenery() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Rising sun glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: '50%', bottom: '20%', width: 120, height: 120, marginLeft: -60,
          background: 'radial-gradient(circle, rgba(255,220,150,1) 0%, rgba(255,180,80,0.5) 40%, transparent 70%)',
          filter: 'blur(4px)',
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
      />
      {/* Warm horizon glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '40%', background: 'radial-gradient(ellipse at 50% 100%, rgba(255,160,60,0.4) 0%, rgba(255,100,40,0.15) 40%, transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />
    </div>
  );
}
