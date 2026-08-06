'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, Clock, AlertCircle } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { cn, vibrate, formatClock } from '@/lib/utils';
import { playSound } from '@/lib/sounds';

interface Props {
  testId: string;
  onClose: () => void;
}

/**
 * TestTimer — full-screen NEET test companion timer.
 *
 * Features:
 *  - 3h20m (200 min) countdown for Full Syllabus / AITS (configurable per test)
 *  - Subject section alerts at configurable intervals:
 *      0:00 - 0:50 → Physics (50 min)
 *      0:50 - 1:40 → Chemistry (50 min)
 *      1:40 - 2:30 → Botany (50 min)
 *      2:30 - 3:20 → Zoology (50 min)
 *    (NEET doesn't enforce subject sections, but most toppers recommend this split)
 *  - Pause / resume
 *  - Auto-complete at 0
 *  - Visual urgency: green → yellow → red as time runs out
 *  - Haptic + sound at section changes
 *  - Wake lock to prevent screen sleep
 */
export function TestTimer({ testId, onClose }: Props) {
  const test = useTests((s) => s.tests.find((t) => t.id === testId));
  const startTimer = useTests((s) => s.startTimer);
  const pauseTimer = useTests((s) => s.pauseTimer);
  const resumeTimer = useTests((s) => s.resumeTimer);
  const completeTimer = useTests((s) => s.completeTimer);
  const tickTimer = useTests((s) => s.tickTimer);
  const haptics = useSettings((s) => s.haptics);

  const [, setTick] = useState(0);
  const [showSectionAlert, setShowSectionAlert] = useState<string | null>(null);
  const lastSectionRef = useRef<number>(-1);
  const wakeLockRef = useRef<any>(null);

  // Live ticking — 500ms for smooth display
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(i);
  }, []);

  // Periodic commit (every 30s) — persists elapsed in case app crashes
  useEffect(() => {
    if (!test || test.timerState !== 'running') return;
    const i = setInterval(() => tickTimer(test.id), 30000);
    return () => clearInterval(i);
  }, [test?.id, test?.timerState, tickTimer]);

  // Wake lock — keep screen awake during test
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    const onVis = () => {
      if (!document.hidden && test?.timerState === 'running') requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
      }
    };
  }, [test?.timerState]);

  if (!test) return null;

  const totalSec = (test.duration || 200) * 60;
  const elapsedSec = (test.timerElapsedSec || 0) +
    (test.timerState === 'running' && test.timerStartedAt
      ? Math.floor((Date.now() - test.timerStartedAt) / 1000)
      : 0);
  const remainingSec = Math.max(0, totalSec - elapsedSec);

  // Subject section calculation (50 min per subject)
  // 0:00-50:00 Physics, 50:00-1:40:00 Chemistry, 1:40:00-2:30:00 Botany, 2:30:00-3:20:00 Zoology
  const sectionDuration = Math.floor(totalSec / 4); // 50 min for 200 min test
  const currentSectionIdx = Math.min(3, Math.floor(elapsedSec / sectionDuration));
  const sections = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  const currentSection = sections[currentSectionIdx];
  const sectionEnd = (currentSectionIdx + 1) * sectionDuration;
  const sectionRemaining = Math.max(0, sectionEnd - elapsedSec);

  // Section change detection → haptic + sound + alert
  useEffect(() => {
    if (test?.timerState !== 'running') return;
    if (currentSectionIdx !== lastSectionRef.current && lastSectionRef.current !== -1) {
      // Section changed!
      const newSection = sections[currentSectionIdx];
      setShowSectionAlert(newSection);
      setTimeout(() => setShowSectionAlert(null), 3000);
      if (haptics) vibrate([20, 50, 20]);
      playSound('tap');
    }
    lastSectionRef.current = currentSectionIdx;
  }, [currentSectionIdx, test?.timerState]);

  // Auto-complete when time runs out
  useEffect(() => {
    if (remainingSec === 0 && test?.timerState === 'running') {
      completeTimer(test.id);
      if (haptics) vibrate([30, 100, 30, 100, 30]);
      playSound('complete');
    }
  }, [remainingSec, test?.id, test?.timerState, completeTimer, haptics]);

  // Color based on time remaining
  const timeColor = remainingSec > 30 * 60
    ? '#22c55e'  // green — more than 30 min left
    : remainingSec > 10 * 60
    ? '#f59e0b'  // amber — 10-30 min left
    : '#ef4444'; // red — less than 10 min left

  const bgGradient = remainingSec > 30 * 60
    ? 'radial-gradient(circle at 50% 30%, rgba(34,197,94,0.15), transparent 60%)'
    : remainingSec > 10 * 60
    ? 'radial-gradient(circle at 50% 30%, rgba(245,158,11,0.15), transparent 60%)'
    : 'radial-gradient(circle at 50% 30%, rgba(239,68,68,0.18), transparent 60%)';

  const handleStart = () => {
    if (haptics) vibrate(15);
    if (test?.timerState === 'not_started' || test?.timerState === 'paused') {
      if (test?.timerState === 'paused') resumeTimer(test.id);
      else startTimer(test.id);
    }
  };

  const handlePause = () => {
    if (haptics) vibrate(10);
    pauseTimer(test.id);
  };

  const handleComplete = () => {
    if (haptics) vibrate([20, 50, 20]);
    if (confirm('End the test now? You can still enter your results afterwards.')) {
      completeTimer(test.id);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6"
      style={{
        backgroundColor: '#000000',
        backgroundImage: bgGradient,
      }}
    >
      {/* Section change alert */}
      <AnimatePresence>
        {showSectionAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-20 left-0 right-0 flex justify-center"
          >
            <div
              className="px-6 py-3 rounded-2xl text-center"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">
                Switch to
              </div>
              <div className="text-xl font-bold text-white">{showSectionAlert}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top: test name + section indicator */}
      <div className="text-center w-full max-w-sm">
        <div className="text-xs text-white/40 uppercase tracking-widest mb-1">
          {test.timerState === 'not_started' ? 'Ready to start' :
           test.timerState === 'running' ? 'Test in progress' :
           test.timerState === 'paused' ? 'Paused' : 'Test completed'}
        </div>
        <div className="text-lg font-bold mb-3">{test.name}</div>

        {/* Section progress dots */}
        {test.timerState !== 'not_started' && test.timerState !== 'completed' && (
          <div className="flex justify-center gap-2 mb-4">
            {sections.map((sec, i) => (
              <div
                key={sec}
                className={cn(
                  'px-3 py-1 rounded-full text-[10px] font-bold transition-all',
                  i === currentSectionIdx
                    ? 'bg-white text-black scale-110'
                    : i < currentSectionIdx
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/5 text-white/40'
                )}
              >
                {sec}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: massive timer */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          key={timeColor}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-7xl sm:text-8xl font-bold tabular tracking-tight text-center"
          style={{
            color: timeColor,
            textShadow: `0 0 60px ${timeColor}40`,
          }}
        >
          {formatClock(remainingSec)}
        </motion.div>

        <div className="mt-3 text-sm text-white/50 tabular">
          of {Math.floor(totalSec / 3600)}h {Math.floor((totalSec % 3600) / 60)}m
        </div>

        {test.timerState === 'running' && (
          <div className="mt-4 text-center">
            <div className="text-xs text-white/40 mb-1">Current section: {currentSection}</div>
            <div className="text-sm font-semibold tabular" style={{ color: timeColor }}>
              {Math.floor(sectionRemaining / 60)}m {sectionRemaining % 60}s left in section
            </div>
          </div>
        )}
      </div>

      {/* Bottom: controls */}
      <div className="w-full max-w-sm space-y-3">
        {test.timerState === 'not_started' && (
          <button
            onClick={handleStart}
            className="w-full py-4 rounded-2xl font-bold text-base bg-green-500 text-black active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> Start Test
          </button>
        )}

        {test.timerState === 'running' && (
          <>
            <button
              onClick={handlePause}
              className="w-full py-4 rounded-2xl font-bold text-base bg-amber-500/20 text-amber-300 backdrop-blur-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Pause size={20} fill="currentColor" /> Pause
            </button>
            <button
              onClick={handleComplete}
              className="w-full py-4 rounded-2xl font-bold text-base bg-red-500/20 text-red-400 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Square size={18} fill="currentColor" /> End Test Early
            </button>
          </>
        )}

        {test.timerState === 'paused' && (
          <>
            <button
              onClick={() => { if (haptics) vibrate(15); resumeTimer(test.id); }}
              className="w-full py-4 rounded-2xl font-bold text-base bg-green-500 text-black active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play size={20} fill="currentColor" /> Resume
            </button>
            <button
              onClick={handleComplete}
              className="w-full py-4 rounded-2xl font-bold text-base bg-red-500/20 text-red-400 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Square size={18} fill="currentColor" /> End Test
            </button>
          </>
        )}

        {test.timerState === 'completed' && (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">✓ Test Complete</div>
            <div className="text-sm text-white/60 mb-4 tabular">
              Time taken: {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s
              {test.timerPausedSec ? ` · paused ${Math.floor(test.timerPausedSec / 60)}m` : ''}
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-bold text-base bg-white/10 text-white active:scale-[0.98]"
            >
              Enter Results →
            </button>
          </div>
        )}

        {/* Close button (top-right X style) */}
        {test.timerState !== 'running' && (
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-white/40 hover:text-white/70"
          >
            Close timer
          </button>
        )}
      </div>

      {/* Footer info */}
      <div className="text-[10px] text-white/30 flex items-center gap-1 mt-4">
        <Clock size={10} /> NEET standard: 3h 20m · 180 questions · 720 marks
      </div>
    </motion.div>
  );
}
