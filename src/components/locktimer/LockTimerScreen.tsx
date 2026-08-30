'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLockTimer, useLockTimerTick } from '@/lib/store/lockTimer';
import { subjectColor } from '@/lib/colors';
import { formatHM, vibrate } from '@/lib/utils';
import { playSound } from '@/lib/sounds';

// Premium easing curves for soothing motion
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export function LockTimerScreen() {
  useLockTimerTick(); // re-renders every second
  const isActive = useLockTimer((s) => s.isActive);
  const isCompleted = useLockTimer((s) => s.isCompleted);
  const subject = useLockTimer((s) => s.subject);
  const chapter = useLockTimer((s) => s.chapter);
  const targetMinutes = useLockTimer((s) => s.targetMinutes);
  const cancel = useLockTimer((s) => s.cancel);
  const complete = useLockTimer((s) => s.complete);
  const clear = useLockTimer((s) => s.clear);
  const getRemainingSec = useLockTimer((s) => s.getRemainingSec);
  const getElapsedSec = useLockTimer((s) => s.getElapsedSec);
  const getProgressPct = useLockTimer((s) => s.getProgressPct);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const lastTapRef = useRef(0);
  const warned30Ref = useRef(false);

  // Auto-complete when timer reaches 0
  useEffect(() => {
    if (isActive && getRemainingSec() <= 0) {
      complete();
    }
  }, [isActive, getRemainingSec, complete]);

  // === 30-second warning sound + vibration ===
  useEffect(() => {
    if (!isActive) {
      warned30Ref.current = false;
      return;
    }
    const remaining = getRemainingSec();
    if (remaining > 0 && remaining <= 30 && !warned30Ref.current) {
      warned30Ref.current = true;
      try { playSound('test1min'); } catch {}
      vibrate([200, 100, 200, 100, 200]);
    }
  }, [isActive, getRemainingSec]);

  const color = subjectColor(subject || 'General');
  const remainingSec = isActive ? getRemainingSec() : 0;
  const elapsedSec = getElapsedSec();
  const progressPct = isActive ? getProgressPct() : 100;
  const remainingStr = formatHM(remainingSec);
  const totalSec = targetMinutes * 60;
  const elapsedStr = formatHM(elapsedSec);
  const isUrgent = isActive && remainingSec <= 30 && remainingSec > 0;

  // Double-tap to cancel
  const handleTap = () => {
    if (!isActive) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      vibrate([10, 30, 10]);
      setShowCancelConfirm(true);
    }
    lastTapRef.current = now;
  };

  const handleCancelConfirm = () => {
    setShowCancelConfirm(false);
    cancel();
  };

  const handleDismissComplete = () => {
    clear();
  };

  return (
    <motion.div
      key="lock-timer-root"
      // === ENTRY A — "Sunrise": radial circle expands from center ===
      // The screen is clipped to a small circle at center, then grows to fill.
      // Combined with opacity fade for smoothness.
      initial={{
        opacity: 0,
        clipPath: 'circle(0% at 50% 50%)',
      }}
      animate={{
        opacity: 1,
        clipPath: 'circle(150% at 50% 50%)',
      }}
      // === EXIT 2 — "Shrink to center": scale down + fade ===
      // The whole screen shrinks back into a dot at center.
      exit={{
        opacity: 0,
        scale: 0.85,
        clipPath: 'circle(0% at 50% 50%)',
      }}
      transition={{
        duration: 0.7,
        ease: EASE_SMOOTH,
      }}
      className="fixed inset-0 z-[9998] overflow-hidden flex flex-col items-center justify-center"
      style={{
        // === Theme-aware opaque background ===
        // var(--background) is opaque in all themes (dark=#000, light=#fff, etc.)
        // No app shows through — fully solid base.
        background: 'var(--background, #0a0b15)',
        willChange: 'transform, opacity, clip-path',
      }}
      onClick={isActive ? handleTap : undefined}
    >
      {/* === Subject-colored gradient overlay (tints the theme bg) === */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${color.hex}30 0%, ${color.hex}12 50%, ${color.hex}05 100%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.2 }}
      />

      {/* === Radial ambient glow (breathing) === */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 35%, ${color.hex}30 0%, transparent 65%)`,
        }}
        animate={{
          opacity: isUrgent ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          scale: isUrgent ? [1, 1.05, 1] : [1, 1.02, 1],
        }}
        transition={{
          duration: isUrgent ? 1 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* === Urgent pulse overlay (last 30s) === */}
      {isUrgent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.12, 0] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
          style={{ background: color.hex }}
        />
      )}

      {/* === Subject label — staggers in from top === */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT_QUART }}
        className="text-center mb-4 z-10 relative"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color.hex }} />
          <span className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: color.hex }}>
            {subject}
          </span>
        </div>
        {chapter && (
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{chapter}</p>
        )}
      </motion.div>

      {/* === Circular progress ring with countdown — scales in from center === */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.7, ease: EASE_OUT_QUART }}
        className="relative z-10"
        style={{ width: 260, height: 260 }}
      >
        <svg width="260" height="260" viewBox="0 0 260 260" className="-rotate-90">
          {/* Track */}
          <circle cx="130" cy="130" r="115" fill="none" stroke="var(--bar-track, rgba(255,255,255,0.06))" strokeWidth="8" />
          {/* Progress — depletes as time runs out */}
          <motion.circle
            cx="130" cy="130" r="115" fill="none"
            stroke={isUrgent ? '#ef4444' : color.hex}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ strokeDashoffset: 722.6 }}
            animate={{ strokeDashoffset: 722.6 - (722.6 * progressPct) / 100 }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            style={{
              strokeDasharray: 722.6,
              filter: `drop-shadow(0 0 12px ${isUrgent ? 'rgba(239,68,68,0.6)' : color.glow})`,
            }}
          />
        </svg>

        {/* Center content — countdown number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isActive ? (
            <>
              <motion.div
                animate={isUrgent ? { scale: [1, 1.08, 1] } : { scale: [1, 1.02, 1] }}
                transition={{
                  duration: isUrgent ? 1 : 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="text-6xl font-bold tabular"
                style={{
                  color: isUrgent ? '#ef4444' : 'var(--foreground)',
                  textShadow: `0 0 30px ${isUrgent ? 'rgba(239,68,68,0.5)' : color.glow}`,
                }}
              >
                {remainingStr}
              </motion.div>
              <span className="text-[10px] uppercase tracking-widest mt-2" style={{ color: 'var(--muted-foreground)' }}>
                {isUrgent ? '⚠ time ending' : 'remaining'}
              </span>
            </>
          ) : (
            // Completed state
            <>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.2 }}
                className="text-5xl mb-2"
                style={{ filter: `drop-shadow(0 0 20px ${color.glow})` }}
              >
                ✓
              </motion.div>
              <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Complete!</span>
              <span className="text-[11px] tabular mt-1" style={{ color: 'var(--muted-foreground)' }}>{elapsedStr} studied</span>
            </>
          )}
        </div>
      </motion.div>

      {/* === Stats below ring — staggers in from bottom === */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.6, ease: EASE_OUT_QUART }}
        className="flex items-center gap-4 mt-6 z-10 relative"
      >
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Elapsed</div>
          <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>{elapsedStr}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border, rgba(255,255,255,0.1))' }} />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Total</div>
          <div className="text-sm font-bold tabular" style={{ color: color.hex }}>{formatHM(totalSec)}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--border, rgba(255,255,255,0.1))' }} />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Progress</div>
          <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>{progressPct}%</div>
        </div>
      </motion.div>

      {/* === Bottom hint / button — fades in last === */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="absolute bottom-12 z-10"
      >
        {isActive ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Lock size={11} style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                Locked In — double-tap to cancel
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); vibrate([10, 30, 10]); setShowCancelConfirm(true); }}
              className="px-5 py-2 rounded-xl text-[12px] font-bold border transition active:scale-95"
              style={{
                borderColor: 'var(--border, rgba(255,255,255,0.1))',
                color: 'var(--muted-foreground)',
                background: 'var(--foreground/5, rgba(255,255,255,0.03))',
              }}
            >
              Cancel Early
            </button>
          </div>
        ) : (
          <motion.button
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
            onClick={handleDismissComplete}
            className="px-8 py-3 rounded-xl text-[14px] font-bold text-white transition active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`,
              boxShadow: `0 4px 16px -4px ${color.glow}`,
            }}
          >
            Done
          </motion.button>
        )}
      </motion.div>

      {/* === Cancel confirmation modal === */}
      {showCancelConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCancelConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl p-5"
            style={{ background: 'var(--popover, rgba(20,22,30,0.96))', borderColor: 'var(--border, rgba(255,255,255,0.1))' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <Lock size={18} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Cancel Lock-In?</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  <span className="font-bold tabular" style={{ color: color.hex }}>{elapsedStr}</span> will be counted as study time.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition active:scale-95"
                style={{ background: 'var(--foreground/5, rgba(255,255,255,0.05))', color: 'var(--foreground)' }}
              >
                Keep Studying
              </button>
              <button
                onClick={handleCancelConfirm}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-bold bg-red-500 text-white hover:bg-red-600 transition active:scale-95"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
