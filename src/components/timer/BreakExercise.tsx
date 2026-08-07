'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wind, Eye, Activity, SkipForward } from 'lucide-react';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  /** Break duration in seconds. The exercise auto-dismisses when the timer ends. */
  durationSec: number;
  onClose: () => void;
}

type ExerciseType = 'breathing' | 'eyes' | 'stretch';

const EXERCISES: { type: ExerciseType; title: string; icon: typeof Wind; color: string; desc: string }[] = [
  { type: 'breathing', title: 'Box Breathing', icon: Wind, color: '#14b8a6', desc: 'Calm your nervous system — 4s in, 4s hold, 4s out, 4s hold.' },
  { type: 'eyes', title: '20-20-20 Eye Rule', icon: Eye, color: '#3b82f6', desc: 'Look at something 20ft away for 20 seconds. Reduces eye strain.' },
  { type: 'stretch', title: 'Quick Stretch', icon: Activity, color: '#f59e0b', desc: 'Stand up and follow these 3 stretches to refresh your body.' },
];

const STRETCH_STEPS = [
  { sec: 20, text: '🧍 Stand up tall, reach for the ceiling', emoji: '🙌' },
  { sec: 20, text: '🤷 Roll your shoulders back — 5 times', emoji: '💆' },
  { sec: 20, text: '🦵 Touch your toes — hold for 20s', emoji: '🧎' },
];

/**
 * BreakExercise — a modal shown during Pomodoro breaks that suggests a
 * 3-minute recovery activity. Three options cycle randomly:
 *
 * 1. Box Breathing — animated circle that expands/contracts on a 4-4-4-4
 *    cycle (inhale 4s, hold 4s, exhale 4s, hold 4s). Proven to reduce
 *    stress and improve focus (Navy SEAL technique).
 *
 * 2. 20-20-20 Eye Rule — looks at something 20ft away for 20 seconds.
 *    Reduces digital eye strain (American Optometric Association).
 *
 * 3. Quick Stretch — 3 simple standing stretches (reach, shoulder rolls,
 *    toe touch) — 20s each = 60s total. Combats sedentary stiffness.
 *
 * The modal auto-dismisses when the break timer ends. User can also tap
 * "Skip" to dismiss early.
 */
export function BreakExercise({ durationSec, onClose }: Props) {
  // Pick a random exercise on mount
  const [exercise] = useState(() => EXERCISES[Math.floor(Math.random() * EXERCISES.length)]);
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    const i = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(i);
          vibrate([10, 30, 10]);
          setTimeout(onClose, 200);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-sm glass-strong rounded-3xl p-6 overflow-hidden"
        style={{ borderColor: `${exercise.color}40` }}
      >
        {/* Close + timer */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <exercise.icon size={16} style={{ color: exercise.color }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: exercise.color }}>
              Break · {Math.ceil(remaining / 60)}m left
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        {/* Title + description */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold mb-1">{exercise.title}</div>
          <p className="text-xs text-white/55 leading-snug px-2">{exercise.desc}</p>
        </div>

        {/* Exercise content */}
        {exercise.type === 'breathing' && <BoxBreathing />}
        {exercise.type === 'eyes' && <EyeRest durationSec={Math.min(20, durationSec)} />}
        {exercise.type === 'stretch' && <StretchSequence />}

        {/* Skip button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10 transition flex items-center justify-center gap-2"
        >
          <SkipForward size={14} /> Skip exercise
        </button>
      </motion.div>
    </motion.div>
  );
}

// === Box Breathing — animated circle, 4-4-4-4 cycle ===
function BoxBreathing() {
  const [phase, setPhase] = useState<'in' | 'hold1' | 'out' | 'hold2'>('in');
  const [phaseSec, setPhaseSec] = useState(4);

  useEffect(() => {
    const i = setInterval(() => {
      setPhaseSec((s) => {
        if (s <= 1) {
          // Move to next phase
          setPhase((p) => {
            const next = p === 'in' ? 'hold1' : p === 'hold1' ? 'out' : p === 'out' ? 'hold2' : 'in';
            vibrate(8);
            return next;
          });
          return 4;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const scale = phase === 'in' ? 1.4 : phase === 'hold1' ? 1.4 : phase === 'out' ? 0.7 : 0.7;
  const label = phase === 'in' ? 'Breathe In' : phase === 'hold1' ? 'Hold' : phase === 'out' ? 'Breathe Out' : 'Hold';

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <motion.div
          animate={{ scale }}
          transition={{ duration: 4, ease: 'easeInOut' }}
          className="w-24 h-24 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(20,184,166,0.4), rgba(20,184,166,0.1))',
            border: '2px solid rgba(20,184,166,0.5)',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-bold text-teal-300">{label}</div>
          <div className="text-3xl font-bold tabular text-white">{phaseSec}</div>
        </div>
      </div>
      <p className="text-[10px] text-white/45">4-4-4-4 cycle · calms the nervous system</p>
    </div>
  );
}

// === 20-20-20 Eye Rest — countdown timer ===
function EyeRest({ durationSec }: { durationSec: number }) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    const i = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-6xl"
      >
        👀
      </motion.div>
      <div className="text-center">
        <div className="text-2xl font-bold tabular text-blue-300">{remaining}s</div>
        <p className="text-xs text-white/55 mt-1 max-w-[200px]">
          Look at something <strong className="text-blue-300">20 feet away</strong> — out a window, down the hallway, or across the room.
        </p>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
          style={{ width: `${((durationSec - remaining) / durationSec) * 100}%` }}
        />
      </div>
    </div>
  );
}

// === Stretch Sequence — 3 stretches, 20s each ===
function StretchSequence() {
  const [stepIdx, setStepIdx] = useState(0);
  const [stepSec, setStepSec] = useState(STRETCH_STEPS[0].sec);
  const step = STRETCH_STEPS[stepIdx];

  useEffect(() => {
    const i = setInterval(() => {
      setStepSec((s) => {
        if (s <= 1) {
          setStepIdx((idx) => (idx + 1) % STRETCH_STEPS.length);
          vibrate(10);
          return STRETCH_STEPS[(stepIdx + 1) % STRETCH_STEPS.length].sec;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [stepIdx]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        key={stepIdx}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-6xl"
      >
        {step.emoji}
      </motion.div>
      <div className="text-center">
        <div className="text-3xl font-bold tabular text-amber-300">{stepSec}s</div>
        <p className="text-sm text-white/80 mt-1 font-medium">{step.text}</p>
      </div>
      <div className="flex gap-1.5">
        {STRETCH_STEPS.map((_, i) => (
          <div
            key={i}
            className={cn('h-1.5 rounded-full transition-all', i === stepIdx ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/15')}
          />
        ))}
      </div>
      <p className="text-[10px] text-white/45">Step {stepIdx + 1} of {STRETCH_STEPS.length}</p>
    </div>
  );
}
