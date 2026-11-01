'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, ChevronDown, AlertTriangle, CheckCircle2, RotateCw, Lock, Unlock } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { cn, formatClock, formatHM, vibrate } from '@/lib/utils';
import { FlipTimer } from '@/components/timer/FlipTimer';
import { useRoutine } from '@/lib/store/routine';

export function FocusTimer() {
  const { active, pause, resume, toggleWasting, stop, setFocusOpen, bumpInteraction, setWidgetHidden, tick } = useSession();
  const toggleTargetDone = useTargets((s) => s.toggleDone);
  const settings = useSettings();
  // === FIX #23: Removed dead partner imports ===
  // usePartner was imported but syncData/code were never used — dead code
  // that triggered unnecessary re-renders when partner data changed.
  const color = active ? subjectColor(active.subject) : null;

  // Local state for live ticking + burn protection
  const [, setTick] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [timerPos, setTimerPos] = useState({ x: 0, y: 0 });
  const [wasteFlash, setWasteFlash] = useState<number | null>(null); // seconds wasted on return
  const [showPulse, setShowPulse] = useState(false);
  // === FIX #8: In-app stop confirmation modal (replaces native confirm()) ===
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  // === Modern Orientation Detection (v2.21.0) ===
  //
  // PROBLEMS with the old approach (single 45° threshold + raw sensor):
  //  - Jitter at the portrait↔landscape boundary → rapid flip-flopping
  //  - Unreliable when phone is lying flat (gravity vector is ambiguous)
  //  - Sensor noise (±3-5°) triggers spurious state changes
  //
  // MODERN SOLUTION — 3 layers of stability:
  //
  // 1. HYSTERESIS (the main fix):
  //    Two thresholds with a 20° gap instead of one hard line at 45°.
  //    - To ENTER landscape: |gamma| > 55° (was 45)
  //    - To EXIT back to portrait: |gamma| < 35° (was 45)
  //    Once in landscape, you must tilt 20° back before it flips.
  //    Industry-standard for any binary threshold (thermostats, etc.).
  //
  // 2. FLAT-IGNORE:
  //    When the phone is lying nearly flat (|beta| < 25 AND |gamma| < 25),
  //    the gravity vector is ambiguous — the sensor can't reliably tell
  //    portrait from landscape. We HOLD the current orientation instead
  //    of guessing. Prevents flips when phone is on a table/bed.
  //
  // 3. LOW-PASS SMOOTHING:
  //    Raw gamma/beta jitter by ±3-5° even when held still. We apply
  //    exponential smoothing: smoothed = 0.85 * old + 0.15 * new.
  //    This gives a ~300ms response time — fast enough to feel responsive,
  //    slow enough to ignore micro-jitter.
  //
  // orientationAngle meaning (what the user sees as "up"):
  //   0°   = portrait upright
  //   90°  = landscape (rotated 90° CW — home button on left)
  //   180° = portrait upside-down
  //   270° = landscape (rotated 90° CCW — home button on right)
  const [orientationAngle, setOrientationAngle] = useState(0);
  const orientationAngleRef = useRef(0);
  // Temporary lock (double-tap rotate button) — only for current session.
  const [tempLockAngle, setTempLockAngle] = useState<number | null>(null);
  // Lock button state
  const rotateLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRotateTapRef = useRef(0);
  const [lockToast, setLockToast] = useState<string | null>(null);
  const lastWastedRef = useRef(0);
  const lastInteractRef = useRef(Date.now());

  // Live ticking — 1000ms normally, 5s when dimmed (saves CPU on low-end devices)
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return; // Skip — will catch up on return
      setTick((t) => t + 1);
      // Drive the session store's periodic commit + waste-detection logic.
      try { tick(); } catch {}
    }, dimmed ? 5000 : 1000);
    return () => clearInterval(i);
  }, [dimmed, tick]);

  // The EFFECTIVE angle: if locked, use the lock value. Otherwise use auto-detected.
  const effectiveAngle = tempLockAngle ?? settings.lockedOrientation ?? orientationAngle;

  // === Orientation detection — viewport-based, NOT sensor-based ===
  // Replaces the old deviceorientation sensor approach which caused severe
  // landscape layout bugs (rotated portrait-sized div had only ~390px for
  // flex row → controls squeezed → buttons cut off → rotate invisible).
  //
  // Now: just detect if the viewport is landscape (innerWidth > innerHeight).
  // The browser handles the actual rotation. No manual CSS rotation needed.
  // Listen to resize + orientationchange to update on rotate.
  useEffect(() => {
    const lockAngle = tempLockAngle ?? settings.lockedOrientation;
    if (lockAngle !== null && lockAngle !== undefined) {
      const normalized = ((lockAngle % 360) + 360) % 360;
      orientationAngleRef.current = normalized;
      setOrientationAngle(normalized);
      return;
    }

    const readViewportAngle = (): number => {
      // 0 = portrait, 90 = landscape. (No 180°/270° — browser handles those
      // automatically by flipping the viewport, so we always see 0 or 90.)
      return window.innerWidth > window.innerHeight ? 90 : 0;
    };

    const applyAngle = (newAngle: number) => {
      const normalized = ((newAngle % 360) + 360) % 360;
      if (normalized !== orientationAngleRef.current) {
        orientationAngleRef.current = normalized;
        setOrientationAngle(normalized);
      }
    };

    applyAngle(readViewportAngle());

    const onResize = () => applyAngle(readViewportAngle());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', onResize);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', onResize);
      }
    };
  }, [tempLockAngle, settings.lockedOrientation]);

  // === Waste flash — shows when returning from background after > 60s away ===
  // === BUG FIX (B3 + B6): Previous effect used `wastedSeconds > lastWastedRef.current + 2`
  //     as the guard, which broke when multiple state updates landed close together
  //     (the ref got updated synchronously, so subsequent updates failed the guard,
  //     the setTimeout was cleared but never re-set, and the flash stayed forever).
  //     New approach: track the last SEEN value in a ref, fire the flash on ANY
  //     positive jump, and use a HARD 4s timeout stored in a ref that ALWAYS fires
  //     (cleared only by tap-to-dismiss or a new flash). The flash auto-dismisses
  //     reliably regardless of subsequent state changes. ===
  const wastedSeconds = active?.wastedSeconds ?? 0;
  const wasteFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active) return;
    // Only trigger on a positive jump (waste was added — auto-detect return)
    const jump = wastedSeconds - lastWastedRef.current;
    lastWastedRef.current = wastedSeconds;
    if (jump >= 5) {  // 5s minimum — filters out tiny rounding noise
      setWasteFlash(jump);
      // Clear any existing timeout, then set a fresh HARD 4s timeout.
      // This always fires unless explicitly cleared by tap-to-dismiss.
      if (wasteFlashTimeoutRef.current) clearTimeout(wasteFlashTimeoutRef.current);
      wasteFlashTimeoutRef.current = setTimeout(() => {
        setWasteFlash(null);
        wasteFlashTimeoutRef.current = null;
      }, 4000);
    }
  }, [wastedSeconds, active]);

  // Cleanup the flash timeout on unmount
  useEffect(() => {
    return () => {
      if (wasteFlashTimeoutRef.current) {
        clearTimeout(wasteFlashTimeoutRef.current);
        wasteFlashTimeoutRef.current = null;
      }
    };
  }, []);

  // Tap-to-dismiss the flash
  const dismissWasteFlash = () => {
    if (wasteFlashTimeoutRef.current) {
      clearTimeout(wasteFlashTimeoutRef.current);
      wasteFlashTimeoutRef.current = null;
    }
    setWasteFlash(null);
  };

  // Burn protection check
  // === HEAT FIX: Skip when tab hidden — dimming only matters when visible ===
  useEffect(() => {
    if (!settings.burnProtection || !active) return;
    const i = setInterval(() => {
      if (document.hidden) return; // Skip — will re-evaluate on return
      const since = Date.now() - lastInteractRef.current;
      if (since > settings.dimDelay * 1000) {
        setDimmed(true);
      }
    }, 1000);
    return () => clearInterval(i);
  }, [settings.burnProtection, settings.dimDelay, active]);

  // Fullscreen on mount + request iOS motion permission.
  //
  // === ORIENTATION LOCK REMOVED ===
  // Previously: locked screen to 'portrait' + manually rotated content via
  // deviceorientation sensor. This caused SEVERE layout bugs in landscape:
  //   - The content div was always 100vmin × 100vmax (portrait dimensions:
  //     ~390×844). When rotated 90°, the flex row only had ~390px of pre-rotation
  //     width → controls `w-full` took all 390px → timer squeezed to 0 → buttons
  //     overflowed/cut off → rotate button invisible.
  //   - Double-rotation in browser mode (browser auto-rotates + we also rotate).
  //
  // Now: NO orientation lock. The browser handles rotation naturally. When the
  // phone tilts to landscape, the viewport becomes landscape (innerWidth >
  // innerHeight), and we lay out content with flexDirection: row using the FULL
  // viewport width. No manual rotation, no squeezing, no glitches.
  useEffect(() => {
    const requestMotionPermission = async () => {
      try {
        const anyDeviceOrientation = (window as any).DeviceOrientationEvent;
        if (anyDeviceOrientation && typeof anyDeviceOrientation.requestPermission === 'function') {
          await anyDeviceOrientation.requestPermission().catch(() => {});
        }
      } catch {}
    };
    requestMotionPermission();
    // No cleanup needed — no orientation lock to undo
  }, []);

  // Wake Lock — keep screen awake during study session (no auto-lock)
  const wakeLockRef = useRef<any>(null);
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again (wake lock is released on hide)
    const onVis = () => {
      if (!document.hidden && active) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
        wakeLockRef.current = null;
      }
    };
  }, [active]);

  // Re-enter fullscreen on visibility return — REMOVED (v2.19.0)
  // Was triggering the "press Esc to exit fullscreen" toast every time the
  // user returned to the app during a focus session. The FocusTimer is
  // already CSS position:fixed inset-0 z-[9999] so it visually covers the
  // viewport without needing OS-level fullscreen.
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && active) {
        // Re-acquire wake lock only (no fullscreen)
        // Wake lock handling is done in the other effect above.
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]);

  // Auto-reposition timer when dimmed (burn protection)
  // First reposition happens immediately when dimming starts (synced with dimming)
  // Then every 10 minutes to avoid disturbing focus
  useEffect(() => {
    if (dimmed) {
      // First position change happens immediately with the dimming
      setTimerPos({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 300,
      });
      // Then reposition every 10 minutes
      const i = setInterval(() => {
        setTimerPos({
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 300,
        });
      }, 600000); // 10 minutes
      return () => clearInterval(i);
    } else {
      // Reset position when un-dimming
      setTimerPos({ x: 0, y: 0 });
    }
  }, [dimmed]);

  if (!active || !color) return null;

  // === FIX #24: minimalMode — hide non-essential UI for deep focus ===
  // === FIX #25: reduceAnimations — disable decorative animations ===
  const minimalMode = settings.minimalMode;
  const reduceAnim = settings.reduceAnimations;

  const studySec = getLiveStudySeconds(active);
  const wastedSec = getLiveWastedSeconds(active);
  const isOverTime = active.expectedMinutes ? studySec > active.expectedMinutes * 60 : false;

  // === Landscape detection ===
  // Used to switch to a compact landscape layout.
  // effectiveAngle is now 0 (portrait) or 90 (landscape) — the browser handles
  // 180°/270° by flipping the viewport, so we always see one of these two.
  const isLandscape = effectiveAngle === 90;

  // Determine state
  const isPaused = active.paused;
  const isWasting = active.wasting;
  const isStudying = !isPaused && !isWasting;

  // Timer color
  // === FIX #6: Distinct colors for paused vs overtime ===
  // Previously both used #f59e0b (amber) — visually identical.
  // Now: paused = amber, overtime = cyan, wasting = red, studying = green
  const timerColor = isWasting ? '#ef4444' : isPaused ? '#f59e0b' : isOverTime ? '#06b6d4' : '#22c55e';

  // Background — pure black with smooth color morph overlay
  // === FIX: Use subject color tint for studying state (subtle 3% alpha) ===
  const bgOverlay = isWasting
    ? 'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0) 70%)'
    : isPaused
    ? 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.06) 0%, rgba(0,0,0,0) 70%)'
    : isOverTime
    ? 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.06) 0%, rgba(0,0,0,0) 70%)'
    : `radial-gradient(circle at 50% 50%, ${color?.hex}10 0%, rgba(0,0,0,0) 70%)`;

  const handleInteraction = () => {
    lastInteractRef.current = Date.now();
    bumpInteraction();
    if (dimmed) {
      setDimmed(false);
      setTimerPos({ x: 0, y: 0 });
    }
  };

  // Auto-reposition timer when dimmed (moved above early return)

  const handleStop = () => {
    vibrate(15);
    if (studySec < 300) {
      // === FIX #8: Use in-app modal instead of native confirm() ===
      setShowStopConfirm(true);
    } else {
      triggerStopPulse();
    }
  };

  const confirmStop = () => {
    setShowStopConfirm(false);
    vibrate(15);
    triggerStopPulse();
  };

  const triggerStopPulse = () => {
    setShowPulse(true);
    setTimeout(() => {
      stop();
      setShowPulse(false);
    }, 600);
  };

  const handleDone = () => {
    vibrate([10, 30, 10]);
    // Mark the target as done (also syncs to syllabus via bi-directional sync)
    if (active?.targetId) {
      toggleTargetDone(active.targetId);
    }
    // Trigger pulse wave then stop
    triggerStopPulse();
  };

  const displayTime = isWasting ? wastedSec : studySec;

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleInteraction}
      className="fixed inset-0 z-[9999] force-dark-ui"
      style={{
        cursor: dimmed ? 'pointer' : 'default',
        // ALWAYS solid black background — never show app behind.
        backgroundColor: '#000000',
        // Color overlay on top of black (subject-colored glow).
        // When dimmed (burn protection), overlay fades out.
        backgroundImage: dimmed ? 'none' : bgOverlay,
        transition: 'background-image 800ms ease-in-out, background-color 800ms ease-in-out',
      }}
    >
      {/* === CONTENT DIV — uses ACTUAL viewport dimensions, NO rotation ===
          Previous approach: always 100vmin × 100vmax (portrait) + CSS rotation.
          That caused severe landscape bugs (controls squeezed into ~390px,
          buttons cut off, rotate invisible).

          Now: 100vw × 100vh (actual viewport). The browser handles rotation.
          flexDirection: row for landscape (wide), column for portrait (tall).
          No transform, no transformOrigin, no rotation math. */}
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isLandscape ? 'center' : 'space-between',
          gap: isLandscape ? '1.5rem' : undefined,
          padding: isLandscape ? '1.5rem 2rem' : '3rem 1.5rem',
          backgroundImage: dimmed ? 'none' : bgOverlay,
          backgroundColor: '#000000',
        }}
      >
      {/* === Waste flash — modern card overlay ===
          Shows when returning from background after > 60s away.
          Clean card design with: icon, time, total, and dismiss hint.
          Tap anywhere to dismiss. Auto-dismisses after 4s. */}
      {wasteFlash !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissWasteFlash}
          className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer p-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-3xl p-6 max-w-[300px] w-full text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(239,68,68,0.15) 0%, rgba(20,20,25,0.98) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              boxShadow: '0 20px 60px -10px rgba(239,68,68,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            {/* Label */}
            <div className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest mb-2">
              Welcome Back
            </div>
            {/* Time wasted this away */}
            <div className="text-4xl font-black tabular text-white mb-1">
              {Math.floor(wasteFlash / 60) > 0 ? `${Math.floor(wasteFlash / 60)}m ` : ''}{wasteFlash % 60}s
            </div>
            <div className="text-[11px] text-muted-foreground mb-4">
              {Math.floor(wasteFlash / 60) > 0 ? 'away while studying' : 'seconds distracted'}
            </div>
            {/* Total wasted */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span>Total wasted this session:</span>
              <span className="font-bold text-red-400/80 tabular">{formatHM(wastedSec)}</span>
            </div>
            {/* Resume hint */}
            <div className="text-[11px] text-foreground/70 mb-3">
              Study timer auto-resumed
            </div>
            {/* Dismiss button */}
            <button
              onClick={dismissWasteFlash}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-[0.98]"
              style={{ background: 'rgba(239,68,68,0.8)' }}
            >
              Continue Studying
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Pulse Wave on Stop — ripple expands from center */}
      <AnimatePresence>
        {showPulse && (
          <>
            {/* Timer scales down */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="text-7xl sm:text-8xl font-bold tabular"
                style={{ color: timerColor }}
                initial={{ scale: 1 }}
                animate={{ scale: 0.8, opacity: 0.3 }}
                transition={{ duration: 0.4, ease: 'easeIn' }}
              >
                {formatClock(displayTime)}
              </motion.div>
            </motion.div>
            {/* Ripple 1 */}
            <motion.div
              className="absolute left-1/2 top-1/2 rounded-full pointer-events-none z-20"
              style={{ border: `2px solid ${timerColor}`, x: '-50%', y: '-50%' }}
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: 600, height: 600, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            {/* Ripple 2 (delayed) */}
            <motion.div
              className="absolute left-1/2 top-1/2 rounded-full pointer-events-none z-20"
              style={{ border: `1px solid ${timerColor}`, x: '-50%', y: '-50%' }}
              initial={{ width: 0, height: 0, opacity: 0.5 }}
              animate={{ width: 800, height: 800, opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            />
            {/* Fade to black */}
            <motion.div
              className="absolute inset-0 bg-black pointer-events-none z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Top section: labels — HIDDEN when dimmed OR minimalMode.
          === LANDSCAPE: Compact single-line layout (no stacked badges). === */}
      {!minimalMode && (
      <div className={cn('text-center transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100', isLandscape && 'shrink-0')}>
        {/* Landscape: single-line compact header. Portrait: stacked badges. */}
        {isLandscape ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color.hex }} />
            <span className="font-bold" style={{ color: color.hex }}>{active.subject}</span>
            {active.chapter && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground font-medium truncate max-w-[120px]">{active.chapter}</span>
              </>
            )}
            {active.topic && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate max-w-[100px]">{active.topic}</span>
              </>
            )}
          </div>
        ) : (
        <>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-foreground/10 border border-border mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color.hex }} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
            {active.mode === 'free' ? 'Free Study' : 'Focus Session'}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 text-base">
          <span className="font-bold" style={{ color: color.hex }}>{active.subject}</span>
          {active.chapter && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground font-medium">{active.chapter}</span>
            </>
          )}
        </div>
        {active.topic && (
          <div className="text-xs text-foreground mt-0.5">{active.topic}</div>
        )}
        {/* === Smart Study Routine: block context ===
         * === FIX #2: Wrong-subject warning ===
         * === FIX #31: Next block preview ===
         * === FIX: Moved require to top-level import === */}
        {active.plannedSlotId && (() => {
          try {
            const block = useRoutine.getState().blocks.find((b) => b.id === active.plannedSlotId);
            if (!block) return null;
            const now = new Date();
            const blockEndMs = new Date().setHours(block.endHour, 0, 0, 0);
            const remainingMin = Math.round((blockEndMs - now.getTime()) / 60000);
            const formatHour = (h: number) => {
              if (h === 24) return '12:00 AM';
              const period = h >= 12 ? 'PM' : 'AM';
              const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
              return `${display}:00 ${period}`;
            };
            // === FIX #2: Wrong-subject warning ===
            const isWrongSubject = active.subject !== block.subject;
            // === FIX #31: Next block preview ===
            const nextBlock = useRoutine.getState().getNextBlock();

            return (
              <div className="mt-1 flex flex-col items-center gap-1">
                {/* Wrong-subject warning */}
                {isWrongSubject && (
                  <div className="text-[10px] px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    ⚠ Off-plan: routine says {block.subject}
                  </div>
                )}
                {/* Block ends at / overtime */}
                {remainingMin > 0 ? (
                  <div className="text-[10px] px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    style={{ background: `${color?.hex}15`, color: color?.hex }}>
                    Block ends at {formatHour(block.endHour)} · {remainingMin} min left
                  </div>
                ) : remainingMin > -120 ? (
                  <div className="text-[10px] px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>
                    ⚠ {Math.abs(remainingMin)} min overtime
                  </div>
                ) : null}
                {/* Next block preview */}
                {nextBlock && (
                  <div className="text-[9px] text-muted-foreground/60">
                    Next: {nextBlock.subject} · {formatHour(nextBlock.startHour)}
                  </div>
                )}
              </div>
            );
          } catch {}
          return null;
        })()}
        </>
        )}
      </div>
      )}

      {/* Center: massive timer.
          === LANDSCAPE: Smaller badge margin (mb-3 vs mb-6) so the timer
              doesn't get pushed down by the compact header. === */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Status badge — HIDDEN when dimmed OR minimalMode */}
        <motion.div
          key={isPaused ? 'paused' : isWasting ? 'wasting' : 'studying'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: dimmed ? 0 : 1 }}
          transition={{ duration: 1 }}
          className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg', isLandscape ? 'mb-3' : 'mb-6')}
          style={{
            background: isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e',
            color: '#000',
            pointerEvents: dimmed ? 'none' : 'auto',
            transition: 'background-color 1000ms ease-in-out',
            boxShadow: dimmed ? 'none' : `0 4px 16px -4px ${isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e'}80`,
          }}
          role="status"
          aria-label={isPaused ? 'Status: Paused' : isWasting ? 'Status: Wasting time' : 'Status: Studying'}
        >
          {isPaused ? (
            <span><span aria-hidden="true">⏸</span> PAUSED</span>
          ) : isWasting ? (
            // FIX #7: pulse-fast back but gentler (1.8s opacity-only, was 0.9s with scale)
            <span className={cn('pulse-fast', dimmed && '!animate-none')}>⚠ DISTRACTED — tap Back to Study</span>
          ) : (
            // FIX #35: pulse-slow stays alive — gentle breathing always on
            // FIX #25: Disabled when reduceAnimations is on
            <span className={cn(!reduceAnim && !dimmed && 'pulse-slow', dimmed && '!animate-none')}>
              <span aria-hidden="true">●</span> STUDYING
            </span>
          )}
        </motion.div>

        {/* Timer — dims to screenDimOpacity% but stays barely visible */}
        <motion.div
          animate={{ x: timerPos.x, y: timerPos.y }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          className="transition-opacity duration-1000"
          style={{
            opacity: dimmed ? Math.max(0.05, settings.screenDimOpacity / 100) : 1,
            filter: dimmed ? 'drop-shadow(0 0 40px rgba(255,255,255,0.1))' : 'none',
          }}
        >
          {dimmed ? (
            <div
              className={cn('font-bold tabular tracking-tight text-center', isLandscape ? 'text-6xl' : 'text-7xl sm:text-8xl')}
              style={{
                color: timerColor,
                transition: 'color 1000ms ease-in-out',
              }}
            >
              {formatClock(displayTime)}
            </div>
          ) : (
            <FlipTimer
              value={formatClock(displayTime)}
              className={cn(
                'font-bold tabular tracking-tight text-center',
                isLandscape ? 'text-6xl' : 'text-7xl sm:text-8xl',
                // === NEW: Breathing glow makes timer feel alive ===
                !reduceAnim && 'timer-breathe'
              )}
              style={{
                color: timerColor,
                textShadow: `0 0 40px ${timerColor}40`,
                transition: 'color 1000ms ease-in-out, text-shadow 1000ms ease-in-out',
                ['--timer-glow' as string]: `${timerColor}50`,
              }}
            />
          )}
          {/* Timer label — small caption so the meaning is unambiguous */}
          {!dimmed && (
            <div className="text-center mt-1 text-[10px] uppercase tracking-widest text-foreground font-semibold">
              {isPaused ? 'Paused at' : isWasting ? 'Wasting for' : 'Studied for'}
            </div>
          )}
          {/* === FIX #9: Minimal context when dimmed ===
              Shows subject · chapter at low opacity so context survives
              without burning the screen. */}
          {dimmed && (
            <div className="text-center mt-3 text-[10px] text-white/20 font-medium">
              {active.subject}{active.chapter ? ` · ${active.chapter}` : ''}
            </div>
          )}
        </motion.div>

        {/* Wasted display + Focus quality — HIDDEN when dimmed.
            === B7 FIX: Auto-hide after 30s of clean studying so the user can
               recover without a demoralizing red label staring at them all
               session. Reappears briefly if waste is added again (the wasteFlash
               overlay handles that).
            === LANDSCAPE: Hidden entirely — the wasteFlash overlay already shows
               waste on return, and the permanent label takes too much vertical
               space in the short landscape viewport. === */}
        {!isWasting && wastedSec > 0 && !isLandscape && (() => {
          // If currently studying and the last waste was > 30s ago, hide.
          // We approximate "last waste was > 30s ago" by checking if the
          // live study delta since last resume is > 30s.
          const studySinceResume = active.lastResumeAt
            ? Math.floor((Date.now() - active.lastResumeAt) / 1000)
            : 0;
          const showWasted = studySinceResume < 30;
          if (!showWasted) return null;
          return (
            <div className={cn('mt-4 text-sm text-red-400/85 tabular font-semibold transition-opacity duration-1000', dimmed ? 'opacity-0' : 'opacity-100')}>
              Wasted: {formatHM(wastedSec)} · {(() => {
                const total = studySec + wastedSec;
                const pct = total > 0 ? Math.round((studySec / total) * 100) : 100;
                return `${pct}% focus`;
              })()}
            </div>
          );
        })()}

        {/* Expected time progress — HIDDEN when dimmed.
            === LANDSCAPE: Also hidden — the progress bar takes too much vertical
                space in the short landscape viewport. The timer + status badge
                + compact header is enough context. === */}
        {active.expectedMinutes && !isLandscape && (
          <div className={cn('mt-6 w-64 transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
            <div className="flex justify-between text-[11px] text-foreground mb-1 tabular font-medium">
              <span>{formatHM(studySec)} done</span>
              <span>{active.expectedMinutes}m goal</span>
            </div>
            <div className="h-2 rounded-full bg-foreground/20 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (studySec / (active.expectedMinutes * 60)) * 100)}%`,
                  background: `linear-gradient(90deg, ${color.hex}, ${color.hex}88)`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls — HIDDEN when dimmed.
          === LANDSCAPE: Compact 2-row grid so all 5 buttons fit without overlap.
              Row 1: Pause (left) | Got Distracted (right)
              Row 2: Done/Stop (left) | Hide (center) | Rotate (right)
              Buttons are smaller (py-3 vs py-4, text-sm vs text-base) to fit
              the shorter landscape viewport. ===
          === PORTRAIT: Original stacked full-width layout. === */}
      <div className={cn(
        'w-full transition-opacity duration-1000',
        dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100',
        isLandscape ? 'max-w-md space-y-2' : 'max-w-sm space-y-3'
      )}>
        {isLandscape ? (
          /* === LANDSCAPE LAYOUT — 2-row grid === */
          <>
            {/* Row 1: Pause + Got Distracted */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction();
                  vibrate(12);
                  if (isPaused) resume();
                  else pause();
                }}
                className="py-3 rounded-xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              >
                {isPaused ? <><Play size={16} fill="currentColor" /> Resume</> : <><Pause size={16} fill="currentColor" /> Pause</>}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction();
                  toggleWasting();
                }}
                className={cn(
                  'py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5',
                  isWasting ? 'bg-green-500 text-black' : 'bg-red-500/90 text-white'
                )}
              >
                {isWasting ? (
                  <><Play size={16} fill="currentColor" /> Back to Study</>
                ) : (
                  <><AlertTriangle size={16} /> Distracted</>
                )}
              </button>
            </div>
            {/* Row 2: Done/Stop + Hide + Rotate */}
            <div className="grid grid-cols-3 gap-2">
              {active?.targetId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleInteraction(); handleDone(); }}
                  className="py-3 rounded-xl font-bold text-sm bg-green-500 text-black active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  aria-label="Done — mark target complete"
                >
                  <CheckCircle2 size={18} /> Done
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleInteraction(); handleStop(); }}
                  className="py-3 rounded-xl font-bold text-sm bg-red-500/15 text-red-400 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  aria-label="Stop — end session"
                >
                  <Square size={18} fill="currentColor" /> Stop
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction();
                  setFocusOpen(false);
                  setWidgetHidden(false);
                }}
                className="py-3 rounded-xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                aria-label="Hide timer"
              >
                <ChevronDown size={16} /> Hide
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInteraction();
                  vibrate(8);
                  // Toggle between portrait and landscape via Screen Orientation API.
                  // In browser mode this may not work (orientation lock requires fullscreen/PWA),
                  // but the user can always just rotate their phone physically.
                  try {
                    if (screen.orientation) {
                      const target = isLandscape ? 'portrait' : 'landscape';
                      (screen.orientation as any).lock?.(target).catch(() => {});
                    }
                  } catch {}
                  // Also update our local state for instant visual feedback
                  setOrientationAngle(isLandscape ? 0 : 90);
                  if (settings.lockedOrientation !== null) settings.set('lockedOrientation', null);
                  if (tempLockAngle !== null) setTempLockAngle(null);
                }}
                className="py-3 rounded-xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 relative"
                title={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
                aria-label="Toggle orientation"
              >
                <RotateCw size={18} />
              </button>
            </div>
          </>
        ) : (
          /* === PORTRAIT LAYOUT — original stacked full-width buttons === */
          <>
        {/* Pause/Resume */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInteraction();
            vibrate(12);
            if (isPaused) resume();
            else pause();
          }}
          className="w-full py-4 rounded-2xl font-bold text-base bg-foreground/20 text-white  active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          {isPaused ? <><Play size={18} fill="currentColor" /> Resume</> : <><Pause size={18} fill="currentColor" /> Pause</>}
        </button>

        {/* Wasting toggle — works even when paused (auto-resumes + starts wasting) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInteraction();
            toggleWasting();
          }}
          className={cn(
            'w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition flex items-center justify-center gap-2',
            isWasting
              ? 'bg-green-500 text-black'
              : 'bg-red-500/90 text-white'
          )}
        >
          {isWasting ? (
            <><Play size={18} fill="currentColor" /> Back to Study</>
          ) : (
            // === FIX #27: Softer wording — less accusatory ===
            <><AlertTriangle size={18} /> Got Distracted</>
          )}
        </button>

        {/* Done + Minimize row */}
        <div className="flex gap-3">
          {active?.targetId ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleInteraction(); handleDone(); }}
              className="flex-1 py-4 rounded-2xl font-bold text-base bg-green-500 text-black active:scale-[0.98] transition flex items-center justify-center gap-2"
              aria-label="Done — mark target complete"
            >
              {/* === FIX #11: Shape differentiation for colorblind users ===
                  Done = circle check (rounded-2xl + CheckCircle2) */}
              <CheckCircle2 size={20} /> Done
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleInteraction(); handleStop(); }}
              className="flex-1 py-4 rounded-2xl font-bold text-base bg-red-500/15 text-red-400 active:scale-[0.98] transition flex items-center justify-center gap-2"
              aria-label="Stop — end session"
            >
              {/* === FIX #11: Shape differentiation ===
                  Stop = square (rounded-2xl + Square filled) */}
              <Square size={20} fill="currentColor" /> Stop
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInteraction();
              setFocusOpen(false);
              // === FIX: Reset widgetHidden so the floating widget appears ===
              // Previously: if widgetHidden was true from a previous hide,
              // minimizing FocusTimer wouldn't show the widget — it stayed
              // hidden even though focusOpen was false.
              setWidgetHidden(false);
            }}
            className="px-5 py-4 rounded-2xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            aria-label="Hide timer"
          >
            {/* === FIX #4: "Min" → "Hide" (clearer label) === */}
            <ChevronDown size={16} /> Hide
          </button>
          {/* Orientation rotate + lock button (portrait). */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInteraction();
              vibrate(8);
              // Toggle between portrait and landscape via Screen Orientation API
              try {
                if (screen.orientation) {
                  const target = isLandscape ? 'portrait' : 'landscape';
                  (screen.orientation as any).lock?.(target).catch(() => {});
                }
              } catch {}
              setOrientationAngle(isLandscape ? 0 : 90);
              if (settings.lockedOrientation !== null) settings.set('lockedOrientation', null);
              if (tempLockAngle !== null) setTempLockAngle(null);
            }}
            className="px-5 py-4 min-w-[56px] rounded-2xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 relative"
            title={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
            aria-label="Toggle orientation"
          >
            <RotateCw size={20} />
          </button>
          {/* Rotate hint — removed (rotate button is now a simple toggle) */}
          <RotateHintToast />
        </div>
        </>
        )}
      </div>
      </div>

      {/* === FIX #8: Stop confirmation modal (in-app, replaces native confirm) === */}
      <AnimatePresence>
        {showStopConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowStopConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl p-4"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">End session early?</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Only {Math.floor(studySec / 60)}m studied. Are you sure you want to end this session?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowStopConfirm(false); vibrate(10); }}
                  className="flex-1 py-2 rounded-lg bg-foreground/10 text-white text-[12px] font-semibold hover:bg-foreground/20 active:scale-95 transition"
                >
                  Keep Studying
                </button>
                <button
                  onClick={confirmStop}
                  className="flex-1 py-2 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 active:scale-95 transition"
                >
                  End Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** RotateHintToast — educates the user about the rotate button gestures.
 *  Shows when the user taps the rotate button 3+ times in quick succession
 *  (struggling = tapping repeatedly trying to figure it out).
 *  - "Got it" → dismisses for this session. Reappears next session or after
 *    5 more taps.
 *  - "Don't show again" → sets localStorage flag. Never shows again.
 *  - If "Got it" was tapped and user taps rotate 5+ more times → shows again. */
function RotateHintToast() {
  const [show, setShow] = useState(false);
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const dismissedThisSession = useRef(false);
  const tapsSinceDismiss = useRef(0);

  useEffect(() => {
    // Check if user permanently dismissed
    if (typeof window !== 'undefined' && localStorage.getItem('neet-rotate-hint-dismissed')) {
      return; // Never show
    }

    const onRotateTap = () => {
      const now = Date.now();
      // Reset count if more than 5s between taps
      if (now - lastTapRef.current > 5000) {
        tapCountRef.current = 0;
        tapsSinceDismiss.current = 0;
      }
      lastTapRef.current = now;
      tapCountRef.current++;

      if (dismissedThisSession.current) {
        tapsSinceDismiss.current++;
        // Reappear after 5 more taps if user dismissed with "Got it"
        if (tapsSinceDismiss.current >= 5) {
          dismissedThisSession.current = false;
          tapsSinceDismiss.current = 0;
          setShow(true);
        }
      } else if (tapCountRef.current >= 3) {
        setShow(true);
      }
    };

    // Listen for rotate taps via a custom event
    window.addEventListener('neet-rotate-tap', onRotateTap);
    return () => window.removeEventListener('neet-rotate-tap', onRotateTap);
  }, []);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="absolute bottom-40 left-1/2 -translate-x-1/2 w-[280px] px-4 py-3 rounded-xl bg-black/90  border border-border text-white z-50"
    >
      <div className="text-xs font-bold mb-1.5 flex items-center gap-1.5">
        <RotateCw size={13} className="text-amber-400" /> Rotate Button Tips
      </div>
      <div className="text-[10px] text-foreground space-y-0.5 mb-2.5">
        <div>• <strong>Tap</strong> → rotate 90°</div>
        <div>• <strong>Double-tap</strong> → temporary lock</div>
        <div>• <strong>Long-press</strong> → permanent lock</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            vibrate(8);
            setShow(false);
            dismissedThisSession.current = true;
            tapCountRef.current = 0;
          }}
          className="flex-1 py-1.5 rounded-lg bg-foreground/15 text-white text-[10px] font-bold active:scale-95 transition"
        >
          Got it
        </button>
        <button
          onClick={() => {
            vibrate(8);
            setShow(false);
            try { localStorage.setItem('neet-rotate-hint-dismissed', '1'); } catch {}
          }}
          className="flex-1 py-1.5 rounded-lg bg-foreground/5 text-muted-foreground text-[10px] font-semibold active:scale-95 transition"
        >
          Don't show again
        </button>
      </div>
    </motion.div>
  );
}

