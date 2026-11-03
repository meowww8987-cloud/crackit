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
  // === Initialize from ACTUAL viewport — prevents portrait flash on mount ===
  // If the phone is already in landscape when FocusTimer opens, starting at 0
  // (portrait) causes a brief portrait layout flash before the effect runs.
  // Lazy init reads the viewport on first render so the correct layout is used
  // immediately.
  const [orientationAngle, setOrientationAngle] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerWidth > window.innerHeight ? 90 : 0;
  });
  const orientationAngleRef = useRef(orientationAngle);
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

  // === CRITICAL FIX: orientation is 100% VIEWPORT-DRIVEN — no lock overrides ===
  // The old chain `tempLockAngle ?? settings.lockedOrientation ?? orientationAngle`
  // let a STALE PERSISTED `lockedOrientation: 90` (saved by a since-removed lock
  // feature) force the LANDSCAPE layout into a PORTRAIT viewport: timer clipped
  // at the right edge, controls pushed entirely off-screen, rotate button
  // unreachable — a deadlock. Worse, when a lock was active the effect below
  // returned early WITHOUT attaching resize listeners, so physically rotating
  // the phone could never fix it.
  //
  // Now the layout ALWAYS matches the actual viewport:
  //   tall viewport (h > w)  → portrait layout
  //   wide viewport (w > h)  → landscape layout
  // No manual state forcing anywhere — resize/orientationchange events are the
  // single source of truth.
  //
  // === FIX (portrait shows "rotated landscape" layout on real phones) ===
  // The user reported: open FocusTimer in landscape, rotate to portrait — the
  // LANDSCAPE layout stayed on screen in the portrait viewport, looking like
  // "just a rotated version of landscape" with wasted vertical space and
  // buttons clustered in the middle.
  //
  // Root cause: SAME bug as the FloatingWidget off-screen issue. On real phones
  // the `resize` event after a rotation can fire while `window.innerWidth` still
  // reports the OLD (pre-rotation) value. `readViewportAngle()` then reads the
  // stale dimensions, computes the OLD angle, sees it equals the current state,
  // and does nothing. If no further event fires with fresh dimensions, the
  // layout is stranded in the wrong orientation forever.
  //
  // Fix — 4 INDEPENDENT layers, mirroring the FloatingWidget fix so no single
  // browser quirk can strand the layout:
  //   1. Event triggers (resize / orientationchange / screen.orientation /
  //      visibilitychange / pageshow) — each one re-checks again on the next
  //      animation frames and after short timeouts, healing stale-dimension
  //      cases (fresh dimensions settle a frame or two after the event fires).
  //   2. visualViewport 'resize' — reliable on mobile, also covers URL-bar
  //      and keyboard viewport changes.
  //   3. ResizeObserver on <html> — fires AFTER layout settles, so the
  //      dimensions read inside it are always fresh.
  //   4. Per-render check using LIVE viewport dimensions (not the cached state).
  //      The component re-renders every second while visible (live ticking),
  //      so even if ALL events above fail the layout self-corrects within ~1s.
  const effectiveAngle = orientationAngle;

  // Layer 4 (per-render): compute the angle from the LIVE viewport on every
  // render. If it disagrees with the cached state, sync the state immediately
  // so the CURRENT render uses the correct layout. This is the safety net that
  // guarantees the layout can never stay wrong for more than ~1s — it heals on
  // the very next render even if every event listener fails.
  // (typeof window guard for SSR; runs only in the browser.)
  if (typeof window !== 'undefined') {
    const liveAngle = window.innerWidth > window.innerHeight ? 90 : 0;
    if (liveAngle !== orientationAngleRef.current) {
      orientationAngleRef.current = liveAngle;
      // setState during render is allowed by React when the value actually
      // changes (it triggers a re-render before commit). This is the official
      // "adjust state during render" pattern from the React docs.
      setOrientationAngle(liveAngle);
    }
  }

  // === Orientation detection — viewport-based, NOT sensor-based ===
  // Detect if the viewport is landscape (innerWidth > innerHeight).
  // The browser handles the actual rotation. No manual CSS rotation needed.
  // Listen to resize + orientationchange + visibilitychange to update on rotate
  // AND on app return (minimize → reopen doesn't always fire resize).
  // Listeners are ALWAYS attached — no early return, no lock branch.
  useEffect(() => {
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

    // Layers 1–3: trigger re-reads on the next frames + short timeouts so a
    // single event with stale dimensions doesn't strand the layout.
    let raf1 = 0;
    let raf2 = 0;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      applyAngle(readViewportAngle());
      cancelAnimationFrame(raf1);
      raf1 = requestAnimationFrame(() => {
        applyAngle(readViewportAngle());
        cancelAnimationFrame(raf2);
        raf2 = requestAnimationFrame(() => applyAngle(readViewportAngle()));
      });
      clearTimeout(t1); t1 = setTimeout(() => applyAngle(readViewportAngle()), 150);
      clearTimeout(t2); t2 = setTimeout(() => applyAngle(readViewportAngle()), 400);
    };

    trigger(); // also covers mount (no-op when already correct)

    const onResize = () => trigger();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', onResize);
    }
    // Layer 2: visualViewport (fires for rotation + URL bar + keyboard)
    window.visualViewport?.addEventListener('resize', onResize);
    // Layer 3: ResizeObserver on <html> — always fires AFTER layout settles
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => trigger());
      ro.observe(document.documentElement);
    }

    // === CRITICAL: Re-read orientation when app becomes visible ===
    // When the app is minimized (backgrounded) and reopened, `resize` and
    // `orientationchange` events often DON'T fire — the viewport dimensions
    // are cached from before minimizing. But the user may have rotated their
    // phone while the app was backgrounded. On return, the orientation state
    // is stale (still showing portrait when the phone is now landscape).
    // This handler forces a re-read on every visibility return.
    const onVisibilityChange = () => {
      if (!document.hidden) {
        // Small delay — the viewport dimensions may not be updated yet when
        // visibilitychange fires. 100ms is enough for the browser to settle.
        setTimeout(() => trigger(), 100);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onVisibilityChange);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', onResize);
      }
      window.visualViewport?.removeEventListener('resize', onResize);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

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

  // === Orientation lifecycle: portrait on unmount ONLY — no unlock on mount ===
  //
  // The main app (AppShell, tabs, sheets) is PORTRAIT-ONLY — its layouts are not
  // optimized for landscape. ONLY the FocusTimer full-screen can go landscape.
  //
  // === FIX (screen flapping portrait↔landscape mid-session) ===
  // Previously this effect also called screen.orientation.unlock() ON MOUNT,
  // "to allow free rotation while studying". In an installed PWA that RELEASES
  // the portrait lock the app normally holds, so Android auto-rotate took over
  // and the display flipped to landscape whenever the phone was held at a
  // diagonal — then back to portrait when the user tilted it upright. The timer
  // layout jumped portrait→landscape→portrait within seconds and the buttons
  // appeared to vanish during each flip.
  //
  // New behavior — orientation is only ever changed EXPLICITLY:
  //   • While the timer is open: orientation stays whatever the app holds
  //     (portrait in PWA). To study in landscape the user taps the Rotate
  //     button, which locks 'landscape'. Tap again → back to 'portrait'.
  //   • Unmount (hide/stop/done): lock('portrait') → main app is portrait.
  //   • Browser tab (no PWA): lock() is a no-op — physical rotation drives the
  //     layout via resize events, exactly as before.
  //
  // NOTE: screen.orientation.lock() only works in fullscreen/PWA mode. In a
  // regular browser tab it fails silently and the browser follows the phone's
  // physical orientation — acceptable fallback.
  useEffect(() => {
    // === Unmount: lock back to PORTRAIT so the main app is never in landscape ===
    return () => {
      try {
        if (typeof screen !== 'undefined' && screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          (screen.orientation as any).lock('portrait').catch(() => {});
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
      {/* === CONTENT DIV — DISTINCT layouts for portrait vs landscape ===
          Mobile screens have very different aspect ratios in the two orientations:
            Portrait  (e.g. 390×844): tall + narrow → vertical stack
            Landscape (e.g. 844×390): short + wide  → side-by-side
          Just swapping flexDirection (the old approach) produced a "rotated
          portrait" look in landscape — the wide horizontal space was wasted and
          the controls were squeezed. Now each orientation has its own structure. */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          // Portrait: column (top → center → bottom).
          // Landscape: row (timer-left | controls-right) — uses the wide space.
          // The landscape header is absolutely positioned (see below) so only
          // the timer + controls consume flex width.
          flexDirection: isLandscape ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: isLandscape ? 'space-between' : 'flex-start',
          gap: isLandscape ? '2rem' : undefined,
          // Landscape: extra top padding so the absolutely-positioned header
          // (subject line) never collides with the vertically-centered timer.
          padding: isLandscape ? '3.5rem 2rem 1.25rem' : '1.25rem 1.25rem',
          backgroundImage: dimmed ? 'none' : bgOverlay,
          backgroundColor: '#000000',
          overflow: 'hidden',
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

      {/* Top section: labels — HIDDEN when minimalMode. When dimmed, FADES
          OUT entirely (opacity 0) so only the timer remains on screen — this
          is the intended burn-protection / distraction-reduction behavior.
          === LANDSCAPE: absolutely positioned at the top — a flex-row child
              would steal horizontal width from the timer + controls, which is
              exactly what squeezed the timer off-screen before. === */}
      {!minimalMode && (
      <div className={cn(
        'text-center transition-opacity duration-1000',
        dimmed ? 'opacity-0' : 'opacity-100',
        isLandscape
          ? 'absolute top-4 left-0 right-0 z-10 px-4'
          : 'shrink-0'
      )}>
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

      {/* === Center: timer block ===
          PORTRAIT: flex-1 min-h-0 — takes all vertical space between top and
            bottom, can shrink if needed (min-h-0 is the critical flex fix).
          LANDSCAPE: flex-1 min-w-0 — takes all horizontal space to the LEFT of
            the controls column. min-w-0 allows it to shrink so the controls
            column (shrink-0) always keeps its full width. */}
      <div className={cn('flex flex-col items-center justify-center', isLandscape ? 'flex-1 min-w-0' : 'flex-1 min-h-0')}>
        {/* Status badge — FADES OUT entirely when dimmed (opacity 0). Only the
            timer should remain visible in burn-protection mode. The badge is
            non-essential context (the timer color already signals state) so
            it disappears cleanly. */}
        <motion.div
          key={isPaused ? 'paused' : isWasting ? 'wasting' : 'studying'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: dimmed ? 0 : 1 }}
          transition={{ duration: 1 }}
          className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg mb-3')}
          style={{
            background: isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e',
            color: '#000',
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
            // === FIX: dimmed timer floor raised 0.15 → 0.35 — at 15% the digits
            // were subliminal on OLED black and users read the screen as
            // "completely gone". 35% keeps burn protection while staying
            // clearly readable, so the timer never looks like it "disappeared". ===
            opacity: dimmed ? Math.max(0.35, settings.screenDimOpacity / 100) : 1,
            filter: dimmed ? 'drop-shadow(0 0 40px rgba(255,255,255,0.1))' : 'none',
          }}
        >
          {dimmed ? (
            <div
              className={cn('font-bold tabular tracking-tight text-center', isLandscape ? 'text-6xl' : 'text-6xl sm:text-7xl')}
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
                // text-6xl sm:text-7xl (was text-7xl sm:text-8xl) — saves
                // ~32px of vertical space on phones, enough to keep the bottom
                // controls on-screen alongside the routine badges.
                isLandscape ? 'text-6xl' : 'text-6xl sm:text-7xl',
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
          {/* Timer label — small caption so the meaning is unambiguous.
              HIDDEN when dimmed (only the timer digits should be visible). */}
          {!dimmed && (
            <div className="text-center mt-1 text-[10px] uppercase tracking-widest text-foreground font-semibold">
              {isPaused ? 'Paused at' : isWasting ? 'Wasting for' : 'Studied for'}
            </div>
          )}
          {/* === FIX #9 (revised): NO context label when dimmed — the user's
              intended burn-protection behavior is "EVERYTHING disappears except
              the timer". An earlier version showed subject · chapter at 20%
              opacity "for context", but the user confirmed that even this faint
              text counts as clutter that should vanish. The timer color already
              signals state (green=studying, amber=paused, red=wasting), so no
              text caption is needed. === */}
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
            <div className={cn('mt-2 text-sm text-red-400/85 tabular font-semibold transition-opacity duration-1000', dimmed ? 'opacity-0' : 'opacity-100')}>
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
          <div className={cn('mt-3 w-64 transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
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

      {/* === Bottom / Right controls — FADE OUT entirely when dimmed (opacity 0)
          and become CLICK-THROUGH (pointer-events-none) so taps pass through to
          the overlay's onClick (handleInteraction) which un-dims. This is the
          intended burn-protection behavior: when dimmed, ONLY the timer is
          visible. The buttons vanish from view to maximize focus + save screen
          burn. The user taps anywhere → screen un-dims → buttons reappear →
          tap the actual button. This prevents accidentally triggering Stop or
          Distracted by tapping where an invisible button happens to be.
          === BUG HISTORY: an earlier version kept pointer-events auto when
              dimmed, so tapping to "un-dim" could accidentally hit an invisible
              Stop button and end the session. ===
          === HISTORY 2: an even earlier version set pointer-events-none but
              ALSO on the overlay, making the dimmed screen a dead zone. The
              overlay (parent motion.div) ALWAYS keeps pointer-events auto, so
              taps always reach handleInteraction. ===

          PORTRAIT: stacked full-width buttons at the bottom (3 rows).
          LANDSCAPE: 2-row grid in a fixed-width column on the RIGHT side of
            the timer — uses the wide horizontal space instead of cramming
            everything into a narrow strip. */}
      <div className={cn(
        'transition-opacity duration-1000 shrink-0',
        dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100',
        // Portrait: full-width stacked at bottom. Landscape: fixed-width column.
        isLandscape ? 'w-[280px] space-y-2' : 'w-full max-w-sm space-y-2'
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
                  // === Rotate via Screen Orientation API — NO local state forcing ===
                  // PWA/fullscreen: lock() succeeds → viewport actually rotates →
                  //   resize fires → our listener updates the layout. Always correct.
                  // Browser tab: lock() fails silently → the user physically rotates
                  //   their phone → resize fires → layout updates. Correct too.
                  // (Previously we also forced setOrientationAngle(90) for "instant
                  // feedback" — that painted a LANDSCAPE layout into a still-portrait
                  // viewport: timer clipped, controls off-screen. Never again force
                  // state that doesn't match the real viewport.)
                  try {
                    if (screen.orientation) {
                      const target = isLandscape ? 'portrait' : 'landscape';
                      (screen.orientation as any).lock?.(target).catch(() => {});
                    }
                  } catch {}
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
        {/* Pause/Resume — py-3 (was py-4) to save vertical space in portrait */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleInteraction();
            vibrate(12);
            if (isPaused) resume();
            else pause();
          }}
          className="w-full py-3 rounded-2xl font-bold text-base bg-foreground/20 text-white  active:scale-[0.98] transition flex items-center justify-center gap-2"
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
            'w-full py-3 rounded-2xl font-bold text-base active:scale-[0.98] transition flex items-center justify-center gap-2',
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
              className="flex-1 py-3 rounded-2xl font-bold text-base bg-green-500 text-black active:scale-[0.98] transition flex items-center justify-center gap-2"
              aria-label="Done — mark target complete"
            >
              {/* === FIX #11: Shape differentiation for colorblind users ===
                  Done = circle check (rounded-2xl + CheckCircle2) */}
              <CheckCircle2 size={20} /> Done
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleInteraction(); handleStop(); }}
              className="flex-1 py-3 rounded-2xl font-bold text-base bg-red-500/15 text-red-400 active:scale-[0.98] transition flex items-center justify-center gap-2"
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
            className="px-5 py-3 rounded-2xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            aria-label="Hide timer"
          >
            {/* === FIX #4: "Min" → "Hide" (clearer label) === */}
            <ChevronDown size={16} /> Hide
          </button>
          {/* Orientation rotate button (portrait). */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInteraction();
              vibrate(8);
              // === Rotate via Screen Orientation API — NO local state forcing ===
              // (see the landscape rotate button above for the full rationale —
              // forcing setOrientationAngle painted a landscape layout into a
              // portrait viewport in browser tabs)
              try {
                if (screen.orientation) {
                  const target = isLandscape ? 'portrait' : 'landscape';
                  (screen.orientation as any).lock?.(target).catch(() => {});
                }
              } catch {}
            }}
            className="px-5 py-3 min-w-[56px] rounded-2xl font-bold text-sm bg-foreground/20 text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 relative"
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

