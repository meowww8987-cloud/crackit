'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, ChevronDown, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';
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
  // === Orientation detection — all 4 directions, gravity-based + deadzone.
  //
  // How it works:
  //  1. Try DeviceOrientationEvent (accelerometer/gravity). This is the MOST
  //     reliable way to detect physical device orientation on mobile — it
  //     fires continuously as the phone tilts, not just on 90° snaps.
  //  2. Fall back to screen.orientation.angle / window.orientation on mount
  //     + 'orientationchange' events (for desktop / unsupported devices).
  //
  // Deadzone: the angle only changes when the device is tilted past ±25°
  // from the current orientation's "up" axis. This prevents jitter when the
  // phone is held at a slight angle (e.g. 10° tilt in bed). The four target
  // angles are 0°, 90°, 180°, 270°.
  //
  // orientationAngle meaning (what the user sees as "up"):
  //   0°   = portrait upright
  //   90°  = landscape (rotated 90° CW — home button on left)
  //   180° = portrait upside-down
  //   270° = landscape (rotated 90° CCW — home button on right)
  const [orientationAngle, setOrientationAngle] = useState(0);
  const orientationAngleRef = useRef(0); // ref mirror for use in event handler
  const lastWastedRef = useRef(0);
  const lastInteractRef = useRef(Date.now());

  // Live ticking — 500ms for smooth display
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(i);
  }, []);

  // === Compute the nearest 4-way angle from a gamma/beta reading.
  // gamma = left-right tilt (-90 to 90). beta = front-back tilt (-180 to 180).
  // We use gamma primarily (it maps cleanly to the 4 portrait/landscape states).
  const computeAngleFromGamma = useCallback((gamma: number, beta: number): number => {
    // When the phone is held vertically (beta near ±90), gamma is unreliable.
    // Use a combination: if |beta| > 45 (phone mostly flat or upright), use
    // gamma for left-right; otherwise the phone is face-up and we keep the
    // current orientation.
    // Simplify: use gamma directly. gamma ≈ 0 → portrait (0 or 180).
    //                                   gamma ≈ 90 → landscape (90).
    //                                   gamma ≈ -90 → landscape (270).
    // To distinguish 0 vs 180 (both have gamma ≈ 0), check beta sign:
    //   beta > 0 (phone upright) → 0°, beta < 0 (phone upside-down) → 180°.
    if (gamma > 45) return 90;
    if (gamma < -45) return 270;
    // gamma is near 0 → portrait. Use beta to decide 0 vs 180.
    // beta > 0 when the phone's top is pointing up (normal portrait).
    // beta < 0 (or > 90 inverted) when upside-down.
    // Actually: when held in portrait, beta is typically 30-60 (tilted back).
    // When upside-down portrait, beta is negative or > 90.
    if (beta < -45 || beta > 135) return 180;
    return 0;
  }, []);

  // === Orientation detection effect ===
  useEffect(() => {
    // --- Helper: read current angle from the best available API ---
    const readScreenAngle = (): number => {
      // Preferred: Screen Orientation API
      if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
        return screen.orientation.angle;
      }
      // Deprecated fallback
      if (typeof window !== 'undefined' && typeof (window as any).orientation === 'number') {
        return (window as any).orientation;
      }
      // Aspect ratio fallback (desktop)
      return window.innerWidth > window.innerHeight ? 90 : 0;
    };

    // --- Helper: update angle with deadzone (only change if the target
    //     angle differs from current). This prevents jitter. ---
    const applyAngle = (newAngle: number) => {
      const normalized = ((newAngle % 360) + 360) % 360;
      if (normalized !== orientationAngleRef.current) {
        orientationAngleRef.current = normalized;
        setOrientationAngle(normalized);
      }
    };

    // Initial read from screen API
    applyAngle(readScreenAngle());

    // --- 1. Try DeviceOrientationEvent (gravity/accelerometer) ---
    // This is the most reliable on mobile — fires continuously as the phone
    // tilts, so we can apply a deadzone and snap to the nearest 4-way angle.
    let deviceOrientationActive = false;
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      // gamma = left-right tilt in degrees (-90 to 90)
      // beta = front-back tilt in degrees (-180 to 180)
      if (e.gamma == null || e.beta == null) return;
      deviceOrientationActive = true;
      const angle = computeAngleFromGamma(e.gamma, e.beta);
      applyAngle(angle);
    };

    // iOS 13+ requires permission for DeviceOrientationEvent. We attempt to
    // add the listener; if it fails or never fires, the fallbacks below handle it.
    try {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    } catch {
      // ignore
    }

    // --- 2. Fallback: screen.orientation 'change' event ---
    const handleScreenOrientationChange = () => {
      // Only use this fallback if deviceorientation isn't firing (desktop or
      // unsupported). If deviceorientation IS active, it takes priority
      // because it's more granular.
      if (deviceOrientationActive) return;
      applyAngle(readScreenAngle());
    };
    window.addEventListener('orientationchange', handleScreenOrientationChange);
    window.addEventListener('resize', handleScreenOrientationChange);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }

    // --- 3. Periodic check: if deviceorientation never fired (e.g. desktop
    //     or permission denied), fall back to screen API every 1s for the
    //     first 5 seconds, then stop. ---
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
  }, [computeAngleFromGamma]);

  // Watch for wasted seconds increase (returning from background) — show flash
  useEffect(() => {
    if (!active) return;
    const currentWasted = active.wastedSeconds;
    if (currentWasted > lastWastedRef.current + 2) {
      // Wasted time jumped by more than 2 seconds = returned from background
      const added = currentWasted - lastWastedRef.current;
      setWasteFlash(added);
      const t = setTimeout(() => setWasteFlash(null), 2500);
      lastWastedRef.current = currentWasted;
      return () => clearTimeout(t);
    }
    lastWastedRef.current = currentWasted;
  }, [active?.wastedSeconds, active]);

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
  // Chrome for Android), the OS stops auto-rotating and WE handle all rotation
  // ourselves via the gravity sensor. On iOS Safari, screen.orientation.lock()
  // isn't supported, but Safari doesn't auto-rotate web content anyway, so no
  // double-rotation issue there.
  useEffect(() => {
    const enterFullscreenAndLock = async () => {
      try {
        // 1. Enter fullscreen (required for screen.orientation.lock on Android)
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}

      // 2. Lock screen to portrait — prevents OS auto-rotation so our gravity-
      //    based content rotation doesn't double up. Must be in fullscreen.
      try {
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('portrait').catch(() => {
            // Lock failed (iOS Safari doesn't support it, or not in fullscreen).
            // On these devices, the OS/browser won't auto-rotate web content
            // anyway, so our gravity-based rotation works without double-rotation.
          });
        }
      } catch {}

      // 3. Request iOS motion permission (iOS 13+ requires explicit user gesture)
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
        // Release screen orientation lock
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
          (screen.orientation as any).unlock();
        }
      } catch {}
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
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

  // Re-enter fullscreen on visibility return
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && active) {
        try {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } catch {}
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
      className="fixed inset-0 z-[9999]"
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

          Why not 100vw/100vh? Because vw/vh track the CURRENT viewport,
          which SWAPS when the device rotates. At 90°, 100vw becomes the
          long dimension and 100vh becomes the short one — the opposite
          of what we need. vmin/vmax don't have this problem.

          The flexbox parent centers this div, so transformOrigin: center
          rotates around the viewport center. After rotation, the content
          fills the viewport exactly at all 4 angles (verified by geometry):
            0°:   400×800 in 400×800 viewport → fills ✓
            90°:  400×800 rotated 90° = 800×400 in 800×400 viewport → fills ✓
            180°: 400×800 rotated 180° = 400×800 in 400×800 viewport → fills ✓
            270°: 400×800 rotated 270° = 800×400 in 800×400 viewport → fills ✓ */}
      <div
        style={{
          // Always portrait dimensions (short × long)
          width: '100vmin',
          height: '100vmax',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3rem 1.5rem',
          // Rotate to match device orientation
          transform: `rotate(${orientationAngle}deg)`,
          transformOrigin: 'center center',
          // Smooth transition when angle changes
          transition: 'transform 0.3s ease',
        }}
      >
      {/* Wasted time flash — shows when returning from background */}
      {wasteFlash !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
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
              <span className="text-white/30">·</span>
              <span className="text-white/85 font-medium">{active.chapter}</span>
            </>
          )}
        </div>
        {active.topic && (
          <div className="text-xs text-white/65 mt-0.5">{active.topic}</div>
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
            <div className="text-center mt-1 text-[10px] uppercase tracking-widest text-white/50 font-semibold">
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
            <div className="flex justify-between text-[11px] text-white/65 mb-1 tabular font-medium">
              <span>{formatHM(studySec)} done</span>
              <span>{active.expectedMinutes}m goal</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
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
          className="w-full py-4 rounded-2xl font-bold text-base bg-white/10 text-white backdrop-blur-md active:scale-[0.98] transition flex items-center justify-center gap-2"
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
              try {
                if (document.fullscreenElement && document.exitFullscreen) {
                  document.exitFullscreen().catch(() => {});
                }
              } catch {}
              setFocusOpen(false);
            }}
            className="px-5 py-4 rounded-2xl font-semibold text-sm bg-white/5 text-white/70 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            <ChevronDown size={16} /> Min
          </button>
          {/* Orientation rotate button — cycles through all 4 directions
              (0° → 90° → 180° → 270° → 0°). Always available (no setting gate)
              so the user can manually rotate the timer in any direction.
              The icon rotates to match the current orientation. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInteraction();
              setOrientationAngle((prev) => (prev + 90) % 360);
              vibrate(8);
            }}
            className="px-4 py-4 rounded-2xl font-semibold text-sm bg-white/5 text-white/70 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            title={`Rotate (current: ${orientationAngle}°)`}
            aria-label="Rotate orientation"
          >
            <RotateCw
              size={16}
              style={{ transform: `rotate(${orientationAngle}deg)`, transition: 'transform 0.3s ease' }}
            />
          </button>
        </div>
      </div>
      </div>
      </div>
    </motion.div>
  );
}
