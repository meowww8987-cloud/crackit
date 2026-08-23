'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSleep } from '@/lib/store/sleep';
import { useSettings } from '@/lib/store/settings';
import { cn, formatHM, vibrate } from '@/lib/utils';

/**
 * SleepLockScreen — full-screen immersive sleep mode.
 *
 * Phases:
 *   1. SLEEPING — time-of-day aware scenery (night/dawn/morning/noon/dusk/evening).
 *      The gradient + celestial body + ambient elements adapt to the current hour.
 *      Live sleep timer at top. Hint: "Double-tap to wake up".
 *
 *   2. CHALLENGE — math problem to prove the user is awake.
 *
 *   3. WAKING — cinematic transition. For night sleep → sunrise (dark→warm).
 *      Multi-stage: sky brightens → sun rises → light expands.
 *
 *   4. QUALITY — asks "How was your sleep?" with 5 emoji options.
 *      Shows sleep calculation: duration, bedtime→wake time, cycles, score, stage.
 *
 *   5. CELEBRATING — brief confirmation animation before exit.
 *      Sparkle expands, then entire screen exits with scale + blur.
 */

type Phase = 'sleeping' | 'challenge' | 'waking' | 'quality' | 'celebrating';
type TimeOfDay = 'night' | 'dawn' | 'morning' | 'noon' | 'dusk' | 'evening';

// Premium easing curves
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
const EASE_IN_OUT_QUINT = [0.83, 0, 0.17, 1] as const;

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 22 || hour < 5) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 16) return 'noon';
  if (hour < 19) return 'dusk';
  return 'evening';
}

const SCENES: Record<TimeOfDay, {
  gradient: string;
  wakingGradient: string;
  emoji: string;
  label: string;
  textGlow: string;
}> = {
  night: {
    gradient: 'linear-gradient(180deg, #0a0e27 0%, #1a1f4e 35%, #2d3582 70%, #4a5db0 100%)',
    wakingGradient: 'linear-gradient(180deg, #1a0a27 0%, #4a1a3e 20%, #8a3a2e 45%, #d4691a 70%, #f5b04a 100%)',
    emoji: '🌙',
    label: 'Night Sleep',
    textGlow: 'rgba(165,180,252,0.4)',
  },
  dawn: {
    gradient: 'linear-gradient(180deg, #2d1b4e 0%, #6b2d5c 30%, #c44569 60%, #f8b195 100%)',
    wakingGradient: 'linear-gradient(180deg, #4a1a3e 0%, #8a3a2e 30%, #d4691a 60%, #f5b04a 100%)',
    emoji: '🌅',
    label: 'Dawn Sleep',
    textGlow: 'rgba(244,162,97,0.4)',
  },
  morning: {
    gradient: 'linear-gradient(180deg, #4a90d9 0%, #74b9ff 40%, #a8d8ea 70%, #d6eaf8 100%)',
    wakingGradient: 'linear-gradient(180deg, #74b9ff 0%, #a8d8ea 40%, #d6eaf8 70%, #fffacd 100%)',
    emoji: '☀️',
    label: 'Morning Sleep',
    textGlow: 'rgba(255,223,87,0.5)',
  },
  noon: {
    gradient: 'linear-gradient(180deg, #2980b9 0%, #5dade2 40%, #aed6f1 70%, #d4e6f1 100%)',
    wakingGradient: 'linear-gradient(180deg, #5dade2 0%, #aed6f1 40%, #d4e6f1 70%, #fffacd 100%)',
    emoji: '🌞',
    label: 'Midday Nap',
    textGlow: 'rgba(255,235,59,0.5)',
  },
  dusk: {
    gradient: 'linear-gradient(180deg, #4a235a 0%, #8e44ad 25%, #e67e22 55%, #f39c12 80%, #f1c40f 100%)',
    wakingGradient: 'linear-gradient(180deg, #6b2d5c 0%, #c44569 30%, #e67e22 60%, #f1c40f 100%)',
    emoji: '🌇',
    label: 'Evening Nap',
    textGlow: 'rgba(243,156,18,0.5)',
  },
  evening: {
    gradient: 'linear-gradient(180deg, #1a1a2e 0%, #2d2d5c 35%, #4a3a6b 65%, #6b5b8a 100%)',
    wakingGradient: 'linear-gradient(180deg, #2d1b4e 0%, #6b2d5c 30%, #c44569 60%, #f8b195 100%)',
    emoji: '🌆',
    label: 'Early Night',
    textGlow: 'rgba(165,180,252,0.4)',
  },
};

// ===== Sleep metrics calculation =====
function calcSleepMetrics(elapsedSec: number) {
  const hours = elapsedSec / 3600;
  const sleepCycles = Math.floor(elapsedSec / (90 * 60)); // 90-min sleep cycles
  const cycleRemainder = elapsedSec % (90 * 60);
  const cycleProgress = cycleRemainder / (90 * 60);

  // Sleep score based on duration (7-9h optimal)
  let sleepScore: number;
  if (hours >= 7 && hours <= 9) sleepScore = 100;
  else if (hours >= 6 && hours < 7) sleepScore = 85;
  else if (hours >= 9 && hours < 10) sleepScore = 82;
  else if (hours >= 5 && hours < 6) sleepScore = 65;
  else if (hours >= 10 && hours < 11) sleepScore = 72;
  else if (hours >= 4 && hours < 5) sleepScore = 45;
  else if (hours >= 11) sleepScore = 55;
  else sleepScore = 30;

  // Sleep stage label
  let stageLabel: string;
  if (elapsedSec < 900) stageLabel = 'Just fell asleep';
  else if (elapsedSec < 2700) stageLabel = 'Light sleep';
  else if (elapsedSec < 5400) stageLabel = 'Deep sleep';
  else if (elapsedSec < 21600) stageLabel = 'REM cycle';
  else stageLabel = 'Overslept';

  return { hours, sleepCycles, cycleProgress, sleepScore, stageLabel };
}

export function SleepLockScreen() {
  const activeSleep = useSleep((s) => s.activeSleep);
  const wakeUp = useSleep((s) => s.wakeUp);
  const cancelSleep = useSleep((s) => s.cancelSleep);
  const haptics = useSettings((s) => s.haptics);

  const [phase, setPhase] = useState<Phase>('sleeping');
  const [, setTick] = useState(0);
  const [tod, setTod] = useState<TimeOfDay>(() => getTimeOfDay(new Date().getHours()));

  // Hold the last activeSleep so exit animations can play after wakeUp() is called.
  // Without this, the component returns null immediately and AnimatePresence exit never runs.
  const [visibleSleep, setVisibleSleep] = useState(activeSleep);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (activeSleep) {
      setVisibleSleep(activeSleep);
      setExiting(false);
    } else if (visibleSleep && !exiting) {
      setExiting(true);
      const t = setTimeout(() => {
        setVisibleSleep(null);
        setExiting(false);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [activeSleep, visibleSleep, exiting]);

  // Live timer + time-of-day updater
  useEffect(() => {
    if (!visibleSleep) return;
    const i = setInterval(() => {
      setTick((t) => t + 1);
      setTod(getTimeOfDay(new Date().getHours()));
    }, 1000);
    return () => clearInterval(i);
  }, [visibleSleep]);

  // Reset to sleeping phase when sleep is cleared
  useEffect(() => {
    if (!visibleSleep) setPhase('sleeping');
  }, [visibleSleep]);

  if (!visibleSleep) return null;

  const elapsedSec = Math.floor((Date.now() - visibleSleep.bedTime) / 1000);
  const bedTime = new Date(visibleSleep.bedTime);
  const bedTimeStr = bedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const scene = SCENES[tod];

  const isWakingPhase = phase === 'waking' || phase === 'quality' || phase === 'celebrating';
  const bgGradient = isWakingPhase ? scene.wakingGradient : scene.gradient;

  return (
    <AnimatePresence>
      <motion.div
        key="sleep-lock-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
        transition={{ duration: 1.2, ease: EASE_SMOOTH }}
        className="fixed inset-0 z-[9999] overflow-hidden force-dark-ui"
        style={{
          background: bgGradient,
          transition: 'background 1.8s ease-in-out',
        }}
      >
        {/* === Scenery with crossfade between sleeping and waking === */}
        <AnimatePresence mode="popLayout">
          {!isWakingPhase && (
            <motion.div
              key="time-scenery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: EASE_SMOOTH }}
              className="absolute inset-0"
            >
              <TimeScenery tod={tod} />
            </motion.div>
          )}
          {isWakingPhase && (
            <motion.div
              key="waking-scenery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: EASE_SMOOTH }}
              className="absolute inset-0"
            >
              <WakingScenery tod={tod} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Top: sleep timer (only during sleeping phase) === */}
        <AnimatePresence>
          {phase === 'sleeping' && (
            <motion.div
              key="top-timer"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_QUART, delay: 0.3 }}
              className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] pt-6 z-10"
            >
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-semibold mb-1">
                  {scene.label} · since {bedTimeStr}
                </div>
                <motion.div
                  animate={{ opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-5xl font-bold tabular text-white"
                  style={{ textShadow: `0 0 30px ${scene.textGlow}` }}
                >
                  {formatHM(elapsedSec)}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.8 }}
                  className="text-[9px] text-white/40 mt-1 uppercase tracking-wider"
                >
                  {elapsedSec < 1800 ? 'Falling asleep...' : elapsedSec < 5400 ? 'Deep sleep' : elapsedSec < 21600 ? 'Restful sleep' : 'Long sleep'}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Center content === */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <AnimatePresence mode="wait">
            {phase === 'sleeping' && (
              <SleepingPhase
                key="sleeping"
                sceneEmoji={scene.emoji}
                sceneLabel={scene.label}
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
                  setPhase('waking');
                  setTimeout(() => setPhase('quality'), 2400);
                }}
                onFail={() => {
                  if (haptics) vibrate(8);
                  setTimeout(() => setPhase('sleeping'), 2000);
                }}
                onBack={() => setPhase('sleeping')}
              />
            )}
            {phase === 'waking' && (
              <WakingPhase key="waking" tod={tod} scene={scene} />
            )}
            {phase === 'quality' && (
              <QualityPhase
                key="quality"
                elapsedSec={elapsedSec}
                bedTimeDate={bedTime}
                onSelect={(q) => {
                  if (haptics) vibrate([10, 30, 10, 30, 50]);
                  setPhase('celebrating');
                  setTimeout(() => wakeUp(q), 1000);
                }}
                onSkip={() => {
                  if (haptics) vibrate(10);
                  setPhase('celebrating');
                  setTimeout(() => wakeUp(), 800);
                }}
              />
            )}
            {phase === 'celebrating' && (
              <CelebratingPhase key="celebrating" />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== Sleeping Phase — celestial body + double-tap hint =====
function SleepingPhase({
  sceneEmoji,
  sceneLabel,
  onDoubleTap,
  onCancel,
}: {
  sceneEmoji: string;
  sceneLabel: string;
  onDoubleTap: () => void;
  onCancel: () => void;
}) {
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
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: EASE_OUT_QUART }}
      className="flex flex-col items-center"
      onClick={handleTap}
    >
      {/* Breathing celestial body — 4-second breathing cycle */}
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="text-8xl mb-6"
        style={{ filter: 'drop-shadow(0 0 50px rgba(165,180,252,0.7))' }}
      >
        {sceneEmoji}
      </motion.div>

      {/* Breathing guide ring */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full border-2 border-white/20"
        style={{ width: 120, height: 120, top: '35%' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0.5, 0.9, 0.5], y: 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        className="text-2xl font-light text-white/90 mb-2 tracking-wide"
      >
        {sceneLabel}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="text-sm text-white/60 font-medium mb-1"
      >
        Double-tap anywhere to wake up
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
        className="text-[10px] text-white/30 uppercase tracking-widest"
      >
        Breathe with the rhythm
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="absolute bottom-[env(safe-area-inset-bottom,0px)] bottom-8 text-[11px] text-white/40 hover:text-white/70 transition underline"
      >
        Cancel sleep
      </motion.button>
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
      setTimeout(onSolve, 700);
    } else {
      setStatus('wrong');
      onFail();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95, filter: 'blur(6px)' }}
      transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
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
      <p className="text-sm text-white/70 mb-6 text-center">Solve this to prove you're awake</p>

      <motion.div
        animate={status === 'wrong' ? { x: [0, -10, 10, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 mb-4 text-center"
      >
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
      </motion.div>

      <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-sm active:scale-[0.98] transition mb-2">Unlock</button>
      <button onClick={onBack} className="text-xs text-white/50 hover:text-white/80 transition underline">Back to sleep</button>
    </motion.div>
  );
}

// ===== Waking Phase — multi-stage cinematic sunrise =====
function WakingPhase({ tod, scene }: { tod: TimeOfDay; scene: typeof SCENES[TimeOfDay] }) {
  const isNight = tod === 'night' || tod === 'evening';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: EASE_SMOOTH }}
      className="text-center relative"
    >
      {/* Expanding light rings — radiate outward */}
      {[0, 0.4, 0.8].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-amber-200/30"
          style={{ width: 80, height: 80, top: '50%', left: '50%', marginLeft: -40, marginTop: -80 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 4], opacity: [0.6, 0] }}
          transition={{ duration: 2, ease: EASE_OUT_QUART, delay, repeat: Infinity }}
        />
      ))}

      {/* Rising sun emoji */}
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.6 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: EASE_OUT_QUART }}
        className="text-7xl mb-4 relative z-10"
        style={{ filter: 'drop-shadow(0 0 50px rgba(255,200,100,0.9))' }}
      >
        {isNight ? '☀️' : scene.emoji}
      </motion.div>

      {/* Greeting text */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.8, ease: EASE_OUT_QUART }}
        className="text-lg font-light text-amber-50"
      >
        {isNight ? 'Good morning!' : 'Time to wake up!'}
      </motion.p>

      {/* Subtle breathing glow under text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="text-[10px] text-amber-100/50 uppercase tracking-widest mt-2"
      >
        Waking up...
      </motion.div>
    </motion.div>
  );
}

// ===== Quality Phase — "How was your sleep?" with detailed calculation =====
function QualityPhase({
  elapsedSec,
  bedTimeDate,
  onSelect,
  onSkip,
}: {
  elapsedSec: number;
  bedTimeDate: Date;
  onSelect: (quality: number) => void;
  onSkip: () => void;
}) {
  const metrics = calcSleepMetrics(elapsedSec);
  const wakeTime = new Date(bedTimeDate.getTime() + elapsedSec * 1000);
  const wakeTimeStr = wakeTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const bedTimeStr = bedTimeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const options = [
    { q: 1, emoji: '😣', label: 'Terrible', color: '#ef4444' },
    { q: 2, emoji: '😕', label: 'Poor', color: '#f97316' },
    { q: 3, emoji: '😐', label: 'Okay', color: '#eab308' },
    { q: 4, emoji: '😊', label: 'Good', color: '#84cc16' },
    { q: 5, emoji: '😍', label: 'Great', color: '#22c55e' },
  ];

  let sleepContext = '';
  if (metrics.hours < 4) sleepContext = 'Short sleep — you may feel tired';
  else if (metrics.hours < 6) sleepContext = 'Below recommended — take it easy';
  else if (metrics.hours < 9) sleepContext = 'Optimal sleep duration! 💤';
  else if (metrics.hours < 12) sleepContext = 'Long sleep — stay hydrated';
  else sleepContext = 'Very long sleep — check your energy';

  const scoreColor = metrics.sleepScore >= 80 ? '#22c55e' : metrics.sleepScore >= 60 ? '#eab308' : '#f97316';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(6px)' }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="w-full max-w-sm px-6"
    >
      {/* Header */}
      <div className="text-center mb-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          className="text-5xl mb-2"
          style={{ filter: 'drop-shadow(0 0 30px rgba(255,200,100,0.6))' }}
        >
          ☀️
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT_QUART }}
          className="text-xl font-bold text-white mb-1"
        >
          You slept {formatHM(elapsedSec)}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-sm text-white/70 mb-1"
        >
          How was your sleep quality?
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="text-[10px] text-amber-200/60"
        >
          {sleepContext}
        </motion.p>
      </div>

      {/* Sleep calculation card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6, ease: EASE_OUT_QUART }}
        className="rounded-2xl bg-white/8 backdrop-blur-md border border-white/15 p-3 mb-4"
      >
        {/* Time range: bed → wake */}
        <div className="flex items-center justify-between mb-2.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40">🌙</span>
            <span className="text-white/70 font-medium tabular">{bedTimeStr}</span>
          </div>
          <div className="flex-1 mx-2 h-px bg-gradient-to-r from-white/20 via-white/40 to-white/20 relative">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.8, ease: EASE_OUT_QUART }}
              className="absolute inset-0 bg-gradient-to-r from-indigo-300/40 via-amber-200/60 to-amber-300/40 origin-left"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 font-medium tabular">{wakeTimeStr}</span>
            <span className="text-white/40">☀️</span>
          </div>
        </div>

        {/* Metrics: cycles / score / stage */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[8px] uppercase tracking-wider text-white/40 mb-0.5">Cycles</div>
            <div className="text-sm font-bold text-white tabular">{metrics.sleepCycles}</div>
          </div>
          <div className="border-x border-white/10">
            <div className="text-[8px] uppercase tracking-wider text-white/40 mb-0.5">Score</div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 20 }}
              className="text-sm font-bold tabular"
              style={{ color: scoreColor }}
            >
              {metrics.sleepScore}
            </motion.div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-wider text-white/40 mb-0.5">Stage</div>
            <div className="text-[10px] font-semibold text-white/90 leading-tight pt-0.5">{metrics.stageLabel}</div>
          </div>
        </div>
      </motion.div>

      {/* 5 emoji buttons — horizontal row */}
      <div className="flex gap-1.5 mb-3">
        {options.map((opt, i) => (
          <motion.button
            key={opt.q}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.07, type: 'spring', stiffness: 400, damping: 20 }}
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect(opt.q)}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 transition"
            style={{ borderBottom: `3px solid ${opt.color}` }}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="text-[8px] text-white/60 font-medium">{opt.label}</span>
          </motion.button>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        onClick={onSkip}
        className="w-full py-2.5 rounded-xl bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 transition"
      >
        Skip rating
      </motion.button>
    </motion.div>
  );
}

// ===== Celebrating Phase — brief confirmation before exit =====
function CelebratingPhase() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
      className="text-center"
    >
      {/* Expanding sparkle */}
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: [0, 1.2, 1], rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="text-6xl mb-3"
        style={{ filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.8))' }}
      >
        ✨
      </motion.div>

      {/* Radiating rings */}
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-white/20"
          style={{ width: 60, height: 60, top: '50%', left: '50%', marginLeft: -30, marginTop: -60 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 3], opacity: [0.5, 0] }}
          transition={{ duration: 1.2, ease: EASE_OUT_QUART, delay, repeat: Infinity }}
        />
      ))}

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-lg font-light text-white"
      >
        Have a great day!
      </motion.p>
    </motion.div>
  );
}

// ===== Time-of-day aware scenery =====
function TimeScenery({ tod }: { tod: TimeOfDay }) {
  if (tod === 'night' || tod === 'evening') {
    return <NightEveningScenery showMoon={tod === 'night'} />;
  }
  if (tod === 'dawn') {
    return <DawnScenery />;
  }
  if (tod === 'morning' || tod === 'noon') {
    return <DayScenery bright={tod === 'noon'} />;
  }
  // dusk
  return <DuskScenery />;
}

// ===== Night / Evening scenery — stars, moon, clouds, shooting stars, hills =====
function NightEveningScenery({ showMoon }: { showMoon: boolean }) {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 60,
    size: 1 + Math.random() * 2, delay: Math.random() * 4, duration: 2 + Math.random() * 3,
  })), []);

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

      {/* Floating clouds */}
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

      {/* Shooting stars */}
      <ShootingStars />

      {/* Breathing moon glow (night only) */}
      {showMoon && (
        <motion.div
          className="absolute rounded-full"
          style={{ right: '15%', top: '12%', width: 80, height: 80,
            background: 'radial-gradient(circle, rgba(255,255,230,0.9) 0%, rgba(255,255,200,0.3) 40%, transparent 70%)',
            filter: 'blur(8px)',
          }}
          animate={{ opacity: [0.5, 0.95, 0.5], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

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

// ===== Dawn scenery — fading stars + warm horizon glow =====
function DawnScenery() {
  const stars = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 40,
    size: 1 + Math.random() * 1.5, delay: Math.random() * 3, duration: 2 + Math.random() * 2,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Fading stars */}
      {stars.map((s) => (
        <motion.div key={s.id} className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Rising sun glow at bottom horizon */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: '50%', bottom: '15%', width: 140, height: 140, marginLeft: -70,
          background: 'radial-gradient(circle, rgba(255,180,120,0.7) 0%, rgba(255,140,80,0.3) 40%, transparent 70%)',
          filter: 'blur(6px)',
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Warm horizon glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '45%', background: 'radial-gradient(ellipse at 50% 100%, rgba(244,162,97,0.3) 0%, rgba(196,69,105,0.12) 40%, transparent 70%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Hills silhouette */}
      <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ height: '22%' }}>
        <path d="M0,80 Q50,60 100,75 T200,70 T300,80 T400,65 L400,120 L0,120 Z" fill="rgba(45,27,78,0.5)" />
        <path d="M0,95 Q60,80 120,90 T240,85 T360,95 T400,90 L400,120 L0,120 Z" fill="rgba(45,27,78,0.7)" />
      </svg>
    </div>
  );
}

// ===== Day scenery (morning / noon) — sun + clouds + bright sky =====
function DayScenery({ bright }: { bright: boolean }) {
  const clouds = useMemo(() => [
    { id: 1, top: '12%', duration: 50, delay: 0, scale: 1 },
    { id: 2, top: '22%', duration: 70, delay: 15, scale: 0.7 },
    { id: 3, top: '6%', duration: 60, delay: 30, scale: 0.85 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Bright sun glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ right: '15%', top: bright ? '8%' : '12%', width: 100, height: 100,
          background: 'radial-gradient(circle, rgba(255,235,100,0.9) 0%, rgba(255,200,50,0.4) 40%, transparent 70%)',
          filter: 'blur(4px)',
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating clouds (lighter, more visible than night) */}
      {clouds.map((c) => (
        <motion.div
          key={`cloud-${c.id}`}
          className="absolute"
          style={{ top: c.top, scale: c.scale }}
          initial={{ x: '-150px' }}
          animate={{ x: 'calc(100vw + 150px)' }}
          transition={{ duration: c.duration, repeat: Infinity, delay: c.delay, ease: 'linear' }}
        >
          <Cloud bright />
        </motion.div>
      ))}

      {/* Soft bottom glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '40%', background: 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Light hills */}
      <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ height: '20%' }}>
        <path d="M0,80 Q50,60 100,75 T200,70 T300,80 T400,65 L400,120 L0,120 Z" fill="rgba(74,144,217,0.3)" />
        <path d="M0,95 Q60,80 120,90 T240,85 T360,95 T400,90 L400,120 L0,120 Z" fill="rgba(74,144,217,0.5)" />
      </svg>
    </div>
  );
}

// ===== Dusk scenery — sunset + warm horizon =====
function DuskScenery() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Setting sun glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: '50%', bottom: '18%', width: 130, height: 130, marginLeft: -65,
          background: 'radial-gradient(circle, rgba(255,160,60,0.8) 0%, rgba(255,100,40,0.3) 40%, transparent 70%)',
          filter: 'blur(6px)',
        }}
        animate={{ opacity: [0.6, 0.95, 0.6], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Warm horizon */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '50%', background: 'radial-gradient(ellipse at 50% 100%, rgba(230,126,34,0.3) 0%, rgba(142,68,173,0.12) 40%, transparent 70%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Hills silhouette */}
      <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ height: '22%' }}>
        <path d="M0,80 Q50,60 100,75 T200,70 T300,80 T400,65 L400,120 L0,120 Z" fill="rgba(74,35,90,0.5)" />
        <path d="M0,95 Q60,80 120,90 T240,85 T360,95 T400,90 L400,120 L0,120 Z" fill="rgba(74,35,90,0.7)" />
      </svg>
    </div>
  );
}

// ===== Waking scenery — sunrise / brighten transition =====
function WakingScenery({ tod }: { tod: TimeOfDay }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Rising sun glow — animates upward */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: '50%', bottom: '20%', width: 140, height: 140, marginLeft: -70,
          background: 'radial-gradient(circle, rgba(255,220,150,1) 0%, rgba(255,180,80,0.5) 40%, transparent 70%)',
          filter: 'blur(4px)',
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 2, ease: EASE_OUT_QUART }}
      />
      {/* Warm horizon glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '40%', background: 'radial-gradient(ellipse at 50% 100%, rgba(255,160,60,0.4) 0%, rgba(255,100,40,0.15) 40%, transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />

      {/* Soft particle drift for daytime waking */}
      {(tod === 'morning' || tod === 'noon') && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />
      )}
    </div>
  );
}

// ===== Cloud SVG shape =====
function Cloud({ bright = false }: { bright?: boolean }) {
  const opacity = bright ? 0.25 : 0.08;
  return (
    <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
      <ellipse cx="30" cy="35" rx="25" ry="15" fill={`rgba(255,255,255,${opacity})`} />
      <ellipse cx="60" cy="28" rx="30" ry="18" fill={`rgba(255,255,255,${opacity * 0.8})`} />
      <ellipse cx="90" cy="35" rx="22" ry="14" fill={`rgba(255,255,255,${opacity})`} />
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
      setTimeout(() => setStars((prev) => prev.filter((s) => s.id !== id - 1)), 1500);
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
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-white" style={{ boxShadow: '0 0 10px 2px rgba(255,255,255,0.8)' }} />
            <div className="absolute top-1/2 right-full w-16 h-px bg-gradient-to-l from-white to-transparent" style={{ transform: 'translateY(-50%) rotate(37deg)', transformOrigin: 'right center' }} />
          </div>
        </motion.div>
      ))}
    </>
  );
}
