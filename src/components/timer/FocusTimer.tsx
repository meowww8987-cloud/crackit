'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, ChevronDown, AlertTriangle, CheckCircle2, RotateCw, Lock, Unlock } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { usePartner } from '@/lib/store/partner';
import { subjectColor } from '@/lib/colors';
import { cn, formatClock, formatHM, vibrate } from '@/lib/utils';
import { FlipTimer } from '@/components/timer/FlipTimer';

export function FocusTimer() {
  const { active, pause, resume, toggleWasting, stop, setFocusOpen, bumpInteraction } = useSession();
  const toggleTargetDone = useTargets((s) => s.toggleDone);
  const settings = useSettings();
  const partnerSyncData = usePartner((s) => s.syncData);
  const partnerCode = usePartner((s) => s.code);
  const color = active ? subjectColor(active.subject) : null;

  // Local state for live ticking + burn protection
  const [, setTick] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [timerPos, setTimerPos] = useState({ x: 0, y: 0 });
  const [wasteFlash, setWasteFlash] = useState<number | null>(null); // seconds wasted on return
  const [showPulse, setShowPulse] = useState(false);
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
  // Smoothed sensor values (low-pass filter state)
  const smoothedGammaRef = useRef(0);
  const smoothedBetaRef = useRef(0);
  const sensorInitializedRef = useRef(false);
  // Temporary lock (double-tap rotate button) — only for current session.
  const [tempLockAngle, setTempLockAngle] = useState<number | null>(null);
  // Lock button state
  const rotateLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRotateTapRef = useRef(0);
  const [lockToast, setLockToast] = useState<string | null>(null);
  const lastWastedRef = useRef(0);
  const lastInteractRef = useRef(Date.now());

  // Live ticking — 500ms for smooth display
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(i);
  }, []);

  // === Hysteresis-based angle computation ===
  // Uses the CURRENT orientation state to decide which threshold to apply.
  //
  // AGGRESSIVE HYSTERESIS (user-requested v2.21.1):
  //   - To ENTER landscape: tilt past 75° (nearly horizontal)
  //   - To EXIT back to portrait: tilt back past 15° (nearly vertical)
  //   - Gap = 60° — once in landscape, it's effectively LOCKED until the user
  //     deliberately rotates the phone almost fully back to vertical.
  //   - This eliminates ALL accidental flips from wrist movement, bed reading,
  //     or slight tilts. The user must make a deliberate 75° rotation to change.
  const computeAngleHysteresis = useCallback((gamma: number, beta: number, currentAngle: number): number => {
    const isCurrentlyPortrait = currentAngle === 0 || currentAngle === 180;
    const LANDSCAPE_ENTER = 75;   // must tilt past 75° to enter landscape (nearly horizontal)
    const LANDSCAPE_EXIT = 15;    // must tilt back below 15° to return to portrait (nearly vertical)

    if (isCurrentlyPortrait) {
      // Currently portrait — need MAJOR tilt (75°+) to switch to landscape
      if (gamma > LANDSCAPE_ENTER) return 270;  // tilt right → 270
      if (gamma < -LANDSCAPE_ENTER) return 90;   // tilt left → 90
      // Still portrait — use beta for 0 vs 180
      if (beta < -45 || beta > 135) return 180;
      return 0;
    } else {
      // Currently landscape — LOCKED until user tilts almost fully back to vertical (< 15°)
      if (Math.abs(gamma) < LANDSCAPE_EXIT) {
        // Returned to near-vertical → portrait
        if (beta < -45 || beta > 135) return 180;
        return 0;
      }
      // Still in landscape — stay locked in current landscape orientation
      if (gamma > 0) return 270;
      return 90;
    }
  }, []);

  // The EFFECTIVE angle: if locked, use the lock value. Otherwise use auto-detected.
  const effectiveAngle = tempLockAngle ?? settings.lockedOrientation ?? orientationAngle;

  // === Orientation detection effect ===
  useEffect(() => {
    const lockAngle = tempLockAngle ?? settings.lockedOrientation;
    if (lockAngle !== null && lockAngle !== undefined) {
      const normalized = ((lockAngle % 360) + 360) % 360;
      orientationAngleRef.current = normalized;
      setOrientationAngle(normalized);
      return;
    }

    // --- Helper: read current angle from Screen Orientation API (fallback) ---
    const readScreenAngle = (): number => {
      if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
        return screen.orientation.angle;
      }
      if (typeof window !== 'undefined' && typeof (window as any).orientation === 'number') {
        return (window as any).orientation;
      }
      return window.innerWidth > window.innerHeight ? 90 : 0;
    };

    const applyAngle = (newAngle: number) => {
      const normalized = ((newAngle % 360) + 360) % 360;
      if (normalized !== orientationAngleRef.current) {
        orientationAngleRef.current = normalized;
        setOrientationAngle(normalized);
      }
    };

    applyAngle(readScreenAngle());

    // --- 1. DeviceOrientationEvent with smoothing + hysteresis ---
    let deviceOrientationActive = false;
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      deviceOrientationActive = true;

      // === Layer 3: LOW-PASS SMOOTHING ===
      // Exponential smoothing: removes ±3-5° sensor jitter.
      // alpha = 0.15 means 15% of the new reading + 85% of the old.
      // Result: ~300ms response time, jitter-free.
      if (!sensorInitializedRef.current) {
        // First reading — initialize without smoothing
        smoothedGammaRef.current = e.gamma;
        smoothedBetaRef.current = e.beta;
        sensorInitializedRef.current = true;
      } else {
        smoothedGammaRef.current = 0.85 * smoothedGammaRef.current + 0.15 * e.gamma;
        smoothedBetaRef.current = 0.85 * smoothedBetaRef.current + 0.15 * e.beta;
      }

      const angle = computeAngleHysteresis(
        smoothedGammaRef.current,
        smoothedBetaRef.current,
        orientationAngleRef.current,  // pass current state for hysteresis
      );
      applyAngle(angle);
    };

    try {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    } catch {
      // ignore
    }

    // --- 2. Fallback: screen.orientation 'change' event ---
    const handleScreenOrientationChange = () => {
      if (deviceOrientationActive) return;
      applyAngle(readScreenAngle());
    };
    window.addEventListener('orientationchange', handleScreenOrientationChange);
    window.addEventListener('resize', handleScreenOrientationChange);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }

    // --- 3. Periodic fallback for first 5s ---
    let fallbackChecks = 0;
    const fallbackInterval = setInterval(() => {
      if (deviceOrientationActive) {
        clearInterval(fallbackInterval);
        return;
      }
      applyAngle(readScreenAngle());
      fallbackChecks++;
      if (fallbackChecks > 5) clearInterval(fallbackInterval);
    }, 1000);

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      window.removeEventListener('orientationchange', handleScreenOrientationChange);
      window.removeEventListener('resize', handleScreenOrientationChange);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', handleScreenOrientationChange);
      }
      clearInterval(fallbackInterval);
    };
  }, [computeAngleHysteresis, tempLockAngle, settings.lockedOrientation]);

  // Watch for wasted seconds increase (returning from background) — show flash
  // that auto-dismisses after 2.5s. Only depends on wastedSeconds (not the
  // full active object, which changes every tick and would re-run this effect
  // constantly, clearing the timeout before it fires).
  const wastedSeconds = active?.wastedSeconds ?? 0;
  useEffect(() => {
    if (!active) return;
    if (wastedSeconds > lastWastedRef.current + 2) {
      const added = wastedSeconds - lastWastedRef.current;
      setWasteFlash(added);
      // Auto-hide after 2.5s
      const t = setTimeout(() => setWasteFlash(null), 2500);
      lastWastedRef.current = wastedSeconds;
      return () => clearTimeout(t);
    }
    lastWastedRef.current = wastedSeconds;
  }, [wastedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Burn protection check
  useEffect(() => {
    if (!settings.burnProtection || !active) return;
    const i = setInterval(() => {
      const since = Date.now() - lastInteractRef.current;
      if (since > settings.dimDelay * 1000) {
        setDimmed(true);
      }
    }, 1000);
    return () => clearInterval(i);
  }, [settings.burnProtection, settings.dimDelay, active]);

  // Fullscreen on mount + lock screen orientation + request iOS motion permission.
  //
  // Why lock screen orientation? On Android with auto-rotate ON, the OS rotates
  // the display when the phone turns. If we ALSO rotate our content (via
  // deviceorientation), we get a DOUBLE rotation — content appears upside down
  // or sideways. By locking the screen to 'portrait' (supported in fullscreen on
  // Fullscreen REMOVED (v2.19.0) — was triggering "press Esc to exit fullscreen"
  // toast on every focus session start + app return. The FocusTimer is already
  // CSS position:fixed inset-0 z-[9999] so it visually covers the viewport.
  // On installed Android PWA, manifest display:fullscreen handles OS-level
  // fullscreen. screen.orientation.lock still works on Android (no toast).
  useEffect(() => {
    const enterFullscreenAndLock = async () => {
      // Orientation lock — needed so Android stops auto-rotating and we can
      // handle rotation via gravity sensor. Does NOT trigger a toast.
      try {
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('portrait').catch(() => {});
        }
      } catch {}
      try {
        const anyDeviceOrientation = (window as any).DeviceOrientationEvent;
        if (anyDeviceOrientation && typeof anyDeviceOrientation.requestPermission === 'function') {
          await anyDeviceOrientation.requestPermission().catch(() => {});
        }
      } catch {}
    };

    enterFullscreenAndLock();

    return () => {
      try {
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
          (screen.orientation as any).unlock();
        }
      } catch {}
    };
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

  const studySec = getLiveStudySeconds(active);
  const wastedSec = getLiveWastedSeconds(active);
  const isOverTime = active.expectedMinutes ? studySec > active.expectedMinutes * 60 : false;

  // Determine state
  const isPaused = active.paused;
  const isWasting = active.wasting;
  const isStudying = !isPaused && !isWasting;

  // Timer color
  const timerColor = isWasting ? '#ef4444' : isPaused ? '#f59e0b' : isOverTime ? '#f59e0b' : '#22c55e';

  // Background — pure black with smooth color morph overlay
  const bgOverlay = isWasting
    ? 'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0) 70%)'
    : isPaused
    ? 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.06) 0%, rgba(0,0,0,0) 70%)'
    : 'radial-gradient(circle at 50% 50%, rgba(34,197,94,0.04) 0%, rgba(0,0,0,0) 70%)';

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
      // 5 min confirmation
      if (confirm(`Only ${Math.floor(studySec / 60)}m studied. End session?`)) {
        triggerStopPulse();
      }
    } else {
      triggerStopPulse();
    }
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
      {/* === FLEX CENTERING WRAPPER ===
          This div fills the viewport (fixed inset-0) and uses flexbox to
          CENTER the rotated content div below. The content div is always
          portrait-shaped (100vmin × 100vmax); flexbox centering ensures
          its center = viewport center, so the CSS rotation pivots around
          the viewport center — content stays perfectly framed at all 4 angles. */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* === ROTATED CONTENT DIV ===
          ALWAYS portrait dimensions: 100vmin (short) × 100vmax (long).
          vmin/vmax are ORIENTATION-INDEPENDENT — 100vmin is always the
          shorter screen dimension, 100vmax is always the longer one,
          regardless of whether the phone is in portrait or landscape.

          The flexbox parent centers this div, so transformOrigin: center
          rotates around the viewport center. After rotation, the content
          fills the viewport exactly at all 4 angles.

          LAYOUT ADAPTATION: When the effective angle is 90° or 270°
          (landscape), the content switches to a ROW layout (timer on
          left, controls on right) so everything is visible and reachable
          on a wide landscape screen. In portrait (0°/180°) it stays
          COLUMN (timer on top, controls on bottom). */}
      <div
        style={{
          // Always portrait dimensions (short × long)
          width: '100vmin',
          height: '100vmax',
          display: 'flex',
          // Landscape (90°/270°) → row layout; Portrait (0°/180°) → column
          flexDirection: (effectiveAngle === 90 || effectiveAngle === 270) ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: (effectiveAngle === 90 || effectiveAngle === 270) ? 'center' : 'space-between',
          gap: (effectiveAngle === 90 || effectiveAngle === 270) ? '2rem' : undefined,
          // Landscape: more horizontal padding; Portrait: more vertical padding
          padding: (effectiveAngle === 90 || effectiveAngle === 270) ? '1.5rem 3rem' : '3rem 1.5rem',
          // Rotate to match device orientation (or locked angle)
          transform: `rotate(${effectiveAngle}deg)`,
          transformOrigin: 'center center',
          // Smooth transition when angle changes
          transition: 'transform 0.3s ease',
          // Background overlay on the ROTATED content div (not the outer div)
          // so the radial gradient stays circular in all orientations.
          // The outer div has solid black; this div has the colored overlay.
          backgroundImage: dimmed ? 'none' : bgOverlay,
          backgroundColor: '#000000',
        }}
      >
      {/* Wasted time flash — shows when returning from background.
          Uses FIXED positioning (not absolute) so it fills the ACTUAL viewport
          regardless of the content div's rotation. The radial-gradient stays
          a perfect circle in all orientations. */}
      {wasteFlash !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(0,0,0,0.95) 70%)',
          }}
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <div className="text-5xl mb-3">⚠️</div>
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">
              Wasted Time Detected
            </div>
            <div className="text-4xl font-bold tabular text-red-400 mb-1">
              +{Math.floor(wasteFlash / 60) > 0 ? `${Math.floor(wasteFlash / 60)}m ` : ''}{wasteFlash % 60}s
            </div>
            <div className="text-xs text-white/50">
              Total wasted: {formatHM(wastedSec)}
            </div>
            <div className="text-[10px] text-white/30 mt-3">
              Auto-resumed studying
            </div>
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

      {/* Top section: labels — HIDDEN when dimmed.
          Improved contrast: bumped label opacity from /40 → /70, sizes up. */}
      <div className={cn('text-center transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color.hex }} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            {active.mode === 'free' ? 'Free Study' : 'Focus Session'}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 text-base">
          <span className="font-bold" style={{ color: color.hex }}>{active.subject}</span>
          {active.chapter && (
            <>
              <span className="text-white/70">·</span>
              <span className="text-white/85 font-medium">{active.chapter}</span>
            </>
          )}
        </div>
        {active.topic && (
          <div className="text-xs text-white/90 mt-0.5">{active.topic}</div>
        )}
      </div>

      {/* Center: massive timer */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Status badge — HIDDEN when dimmed */}
        <motion.div
          key={isPaused ? 'paused' : isWasting ? 'wasting' : 'studying'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: dimmed ? 0 : 1 }}
          transition={{ duration: 1 }}
          className="mb-6 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg"
          style={{
            background: isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e',
            color: '#000',
            pointerEvents: dimmed ? 'none' : 'auto',
            transition: 'background-color 600ms ease-in-out',
            boxShadow: dimmed ? 'none' : `0 4px 16px -4px ${isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e'}80`,
          }}
        >
          {isPaused ? (
            <span>⏸ PAUSED</span>
          ) : isWasting ? (
            <span className="pulse-fast">⚠ WASTING TIME — tap to resume</span>
          ) : (
            <span className="pulse-slow">● STUDYING</span>
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
          <FlipTimer
            value={formatClock(displayTime)}
            className="text-7xl sm:text-8xl font-bold tabular tracking-tight text-center"
            style={{
              color: timerColor,
              textShadow: dimmed ? 'none' : `0 0 40px ${timerColor}40`,
              transition: 'color 600ms ease-in-out, text-shadow 600ms ease-in-out',
            }}
          />
          {/* Timer label — small caption so the meaning is unambiguous */}
          {!dimmed && (
            <div className="text-center mt-1 text-[10px] uppercase tracking-widest text-white/80 font-semibold">
              {isPaused ? 'Paused at' : isWasting ? 'Wasting for' : 'Studied for'}
            </div>
          )}
        </motion.div>

        {/* Wasted display — HIDDEN when dimmed */}
        {!isWasting && wastedSec > 0 && (
          <div className={cn('mt-4 text-sm text-red-400/85 tabular font-semibold transition-opacity duration-1000', dimmed ? 'opacity-0' : 'opacity-100')}>
            Wasted: {formatHM(wastedSec)}
          </div>
        )}

        {/* Expected time progress — HIDDEN when dimmed */}
        {active.expectedMinutes && (
          <div className={cn('mt-6 w-64 transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
            <div className="flex justify-between text-[11px] text-white/90 mb-1 tabular font-medium">
              <span>{formatHM(studySec)} done</span>
              <span>{active.expectedMinutes}m goal</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
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

      {/* Bottom controls — HIDDEN when dimmed */}
      <div className={cn('w-full max-w-sm space-y-3 transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
        {/* Pause/Resume */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInteraction();
            vibrate(12);
            if (isPaused) resume();
            else pause();
          }}
          className="w-full py-4 rounded-2xl font-bold text-base bg-white/20 text-white backdrop-blur-md active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          {isPaused ? <><Play size={18} fill="currentColor" /> Resume</> : <><Pause size={18} fill="currentColor" /> Pause</>}
        </button>

        {/* Wasting toggle */}
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
            <><Play size={18} fill="currentColor" /> Resume Study</>
          ) : (
            <><AlertTriangle size={18} /> I'm Wasting Time</>
          )}
        </button>

        {/* Done + Minimize row */}
        <div className="flex gap-3">
          {active?.targetId ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleInteraction(); handleDone(); }}
              className="flex-1 py-4 rounded-2xl font-bold text-base bg-green-500 text-black active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} /> Done
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleInteraction(); handleStop(); }}
              className="flex-1 py-4 rounded-2xl font-bold text-base bg-red-500/15 text-red-400 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Square size={18} fill="currentColor" /> Stop
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInteraction();
              setFocusOpen(false);
            }}
            className="px-5 py-4 rounded-2xl font-bold text-sm bg-white/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <ChevronDown size={16} /> Min
          </button>
          {/* Orientation rotate + lock button.
              - Single tap: cycle through 4 angles (0°→90°→180°→270°→0°).
              - Double-tap: temporary lock at current angle (current session only).
              - Long-press (500ms): persistent lock (saved to settings, survives
                app restart). Long-press again to unlock.
              When locked, shows a Lock icon; when unlocked, shows RotateCw.
              The icon rotates to match the current orientation. */}
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              handleInteraction();
              // Start long-press timer
              rotateLongPressRef.current = setTimeout(() => {
                // Long-press fired → toggle persistent lock
                const isCurrentlyLocked = settings.lockedOrientation !== null;
                if (isCurrentlyLocked) {
                  // Unlock
                  settings.set('lockedOrientation', null);
                  setTempLockAngle(null);
                  setLockToast('🔓 Orientation unlocked — auto-rotate on');
                  vibrate([10, 30, 10]);
                } else {
                  // Lock at current effective angle
                  settings.set('lockedOrientation', effectiveAngle);
                  setLockToast(`🔒 Orientation locked at ${effectiveAngle}° — stays even after restart`);
                  vibrate([10, 30, 10, 30, 50]);
                }
                setTimeout(() => setLockToast(null), 2500);
                rotateLongPressRef.current = null;
              }, 500);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              // If long-press already fired, do nothing
              if (rotateLongPressRef.current === null) return;
              // Cancel long-press
              clearTimeout(rotateLongPressRef.current);
              rotateLongPressRef.current = null;
              // Detect double-tap
              const now = Date.now();
              const isDoubleTap = now - lastRotateTapRef.current < 300;
              lastRotateTapRef.current = now;
              if (isDoubleTap) {
                // Double-tap → toggle temporary lock
                if (tempLockAngle !== null) {
                  setTempLockAngle(null);
                  setLockToast('🔓 Temporary lock released');
                  vibrate([10, 30]);
                } else if (settings.lockedOrientation === null) {
                  // Only set temp lock if not already persistently locked
                  setTempLockAngle(effectiveAngle);
                  setLockToast(`⏸ Temporarily locked at ${effectiveAngle}° (double-tap to release)`);
                  vibrate([10, 30]);
                }
                setTimeout(() => setLockToast(null), 2000);
              } else {
                // Single tap → cycle angle by 90°
                // If currently locked (persistent or temp), unlock first then cycle
                if (settings.lockedOrientation !== null) {
                  settings.set('lockedOrientation', null);
                }
                if (tempLockAngle !== null) {
                  setTempLockAngle(null);
                }
                setOrientationAngle((prev) => (prev + 90) % 360);
                vibrate(8);
              }
            }}
            onPointerLeave={() => {
              if (rotateLongPressRef.current) {
                clearTimeout(rotateLongPressRef.current);
                rotateLongPressRef.current = null;
              }
            }}
            className="px-4 py-4 rounded-2xl font-bold text-sm bg-white/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 relative"
            title={`Rotate (current: ${effectiveAngle}°${settings.lockedOrientation !== null ? ' · locked' : ''}${tempLockAngle !== null ? ' · temp-locked' : ''})\n• Tap: rotate 90°\n• Double-tap: temp lock\n• Long-press: persistent lock`}
            aria-label="Rotate or lock orientation"
          >
            {/* Show Lock icon when locked, RotateCw when unlocked */}
            {(settings.lockedOrientation !== null || tempLockAngle !== null) ? (
              <Lock
                size={16}
                className="text-amber-400"
                style={{ transform: `rotate(${effectiveAngle}deg)`, transition: 'transform 0.3s ease' }}
              />
            ) : (
              <RotateCw
                size={16}
                style={{ transform: `rotate(${effectiveAngle}deg)`, transition: 'transform 0.3s ease' }}
              />
            )}
          </button>

          {/* Lock toast — shows briefly when lock state changes */}
          <AnimatePresence>
            {lockToast && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/15 text-white text-xs font-semibold whitespace-nowrap z-50 pointer-events-none"
              >
                {lockToast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
      </div>
    </motion.div>
  );
}
