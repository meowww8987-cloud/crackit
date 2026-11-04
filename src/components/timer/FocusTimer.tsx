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
import { playSound } from '@/lib/sounds';

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
  // === #10 Minute-tick sound: play a soft tick when the minute rolls over ===
  const lastMinuteRef = useRef(0);
  // === #4 Minute-rollover bounce: trigger a bounce animation on the timer ===
  const [minuteBounce, setMinuteBounce] = useState(0);
  // === #3 Ripple on state change: keyed overlay that re-mounts on state change ===
  const [stateRipple, setStateRipple] = useState(0);
  const prevstateRef = useRef('');

  // Live ticking — 1000ms normally, 5s when dimmed (saves CPU on low-end devices)
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return; // Skip — will catch up on return
      setTick((t) => t + 1);
      // Drive the session store's periodic commit + waste-detection logic.
      try { tick(); } catch {}
      // === #10 Minute-tick sound ===
      // Play a soft tick when the study minute rolls over (e.g. 4:59 → 5:00).
      // Only when sound is enabled + not paused + not wasting + tab visible.
      if (active && !active.paused && !active.wasting && settings.soundEnabled) {
        const totalSec = getLiveStudySeconds(active);
        const currentMin = Math.floor(totalSec / 60);
        if (currentMin !== lastMinuteRef.current && lastMinuteRef.current !== 0) {
          try { playSound('tick'); } catch {}
          // === #4 Minute-rollover bounce ===
          setMinuteBounce((b) => b + 1);
        }
        lastMinuteRef.current = currentMin;
      }
    }, dimmed ? 5000 : 1000);
    return () => clearInterval(i);
  }, [dimmed, tick, active, settings.soundEnabled]);

  // === #3 Ripple on state change — moved below isPaused/isWasting declarations ===

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

  // === #3 Ripple on state change — fire a ripple wave from the timer center
  // when isPaused/isWasting changes. Keyed by stateRipple so the overlay
  // re-mounts and re-animates on each state transition. ===
  useEffect(() => {
    const stateKey = isPaused ? 'paused' : isWasting ? 'wasting' : 'studying';
    if (prevstateRef.current && prevstateRef.current !== stateKey) {
      setStateRipple((r) => r + 1);
    }
    prevstateRef.current = stateKey;
  }, [isPaused, isWasting]);
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

  // === #7 Button tap ripple — Material-style ripple effect on button press.
  //     Creates a temporary ripple element at the tap position that expands
  //     and fades. Cleans up after the animation. ===
  const tapRippleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTapRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.4);width:${size}px;height:${size}px;left:${x}px;top:${y}px;pointer-events:none;`;
    // Ensure the button can position the ripple
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    if (tapRippleRef.current) clearTimeout(tapRippleRef.current);
    tapRippleRef.current = setTimeout(() => { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 600);
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
          // === FIX (top header hidden behind notch/status bar): add
          // safe-area-inset-top to the top padding so the header isn't covered
          // by the status bar on notched iPhones (≈47px) or the URL bar in
          // mobile browsers. Landscape also gets safe-area-inset-left/right
          // for the notch on the left edge when rotated. ===
          padding: isLandscape
            ? 'calc(env(safe-area-inset-top, 0px) + 1rem) calc(env(safe-area-inset-left, 0px) + 2rem) 1.25rem calc(env(safe-area-inset-right, 0px) + 2rem)'
            : 'calc(env(safe-area-inset-top, 0px) + 1.25rem) 1.25rem 1.25rem 1.25rem',
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
              exactly what squeezed the timer off-screen before. ===
          === THEME FIX: all text here uses text-white (NOT text-foreground) so
              it stays visible on the pure-black FocusTimer background in EVERY
              theme. The subject color appears ONLY in the accent bar/dot, never
              as text color — so it's always readable. ===
          === LAYOUT FIX: chapter name is stacked BELOW the subject (not
              inline beside it), so long names wrap to 2-3 lines instead of
              getting truncated with "...". No more hidden chapter names. ===
          === PREMIUM: wrapped in a frosted-glass pill (subtle blur + border)
              so the header stands out from the black background — like iOS 16+
              media controls. === */}
      {!minimalMode && (
      <div className={cn(
        'text-center transition-opacity duration-1000',
        dimmed ? 'opacity-0' : 'opacity-100',
        isLandscape
          ? 'absolute z-10'
          : 'shrink-0'
      )} style={isLandscape ? {
        top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        left: '50%',
        transform: 'translateX(-50%)',
      } : undefined}>
        {/* Frosted-glass pill wrapper — premium look, works in all themes */}
        <div
          className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            maxWidth: isLandscape ? '90vw' : '340px',
          }}
        >
          {/* Line 1: mode badge with subject color dot — small, subtle */}
          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: color.hex, boxShadow: `0 0 6px ${color.hex}80` }}
            />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
              {active.mode === 'free' ? 'Free Study' : 'Focus Session'}
            </span>
          </div>
          {/* Line 2: subject name (bold white) + chapter (dim white, wraps) */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-bold text-white text-sm leading-tight">{active.subject}</span>
            {active.chapter && (
              <span className="text-white/70 font-medium text-xs leading-tight text-center break-words"
                style={{ maxWidth: isLandscape ? '60vw' : '280px', wordBreak: 'break-word' }}>
                {active.chapter}
              </span>
            )}
            {active.topic && active.topic !== active.chapter && (
              <span className="text-white/45 text-[10px] leading-tight text-center break-words"
                style={{ maxWidth: isLandscape ? '50vw' : '240px', wordBreak: 'break-word' }}>
                {active.topic}
              </span>
            )}
          </div>
        </div>
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
      </div>
      )}

      {/* === Center: timer block ===
          PORTRAIT: flex-1 min-h-0 — takes all vertical space between top and
            bottom, can shrink if needed (min-h-0 is the critical flex fix).
          LANDSCAPE: flex-1 min-w-0 — takes all horizontal space to the LEFT of
            the controls column. min-w-0 allows it to shrink so the controls
            column (shrink-0) always keeps its full width.
          === MODERN REDESIGN: includes circular progress ring (#1), ambient
              glow (#9), state-change ripple (#3), minute-rollover bounce (#4),
              colon pulse (#4). All wrapped in a relative container so the ring
              and glow can position themselves behind the digits. === */}
      <div className={cn('flex flex-col items-center justify-center relative', isLandscape ? 'flex-1 min-w-0' : 'flex-1 min-h-0')}>
        {/* === #9 Ambient glow — soft radial gradient behind the timer that
            matches the current state color. Very subtle (8% opacity) — just
            enough to "feel" the state without being distracting. Fades out
            when dimmed. === */}
        {!dimmed && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${timerColor}15 0%, transparent 60%)`,
              opacity: dimmed ? 0 : 0.8,
            }}
          />
        )}

        {/* === #3 State-change ripple — a soft wave expands from the timer
            center when the state changes (studying → paused, etc). Keyed by
            stateRipple so it re-mounts and re-animates on each change. === */}
        {stateRipple > 0 && !dimmed && (
          <div
            key={stateRipple}
            className="state-ripple absolute left-1/2 top-1/2 pointer-events-none z-20"
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: `2px solid ${timerColor}60`,
            }}
          />
        )}

        {/* Status badge — FADES OUT entirely when dimmed (opacity 0). Only the
            timer should remain visible in burn-protection mode. The badge is
            non-essential context (the timer color already signals state) so
            it disappears cleanly. */}
        <motion.div
          key={isPaused ? 'paused' : isWasting ? 'wasting' : 'studying'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: dimmed ? 0 : 1 }}
          transition={{ duration: 1 }}
          className={cn('px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg mb-3 relative z-10')}
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
            <span className={cn('pulse-fast', dimmed && '!animate-none')}>⚠ DISTRACTED — tap Back to Study</span>
          ) : (
            <span className={cn(!reduceAnim && !dimmed && 'pulse-slow', dimmed && '!animate-none')}>
              <span aria-hidden="true">●</span> STUDYING
            </span>
          )}
        </motion.div>

        {/* === #1 Circular progress ring + timer digits ===
            The ring sits BEHIND the digits (absolute, z-0). Digits are above
            (relative, z-10). Ring fills clockwise from 12 o'clock based on:
              - If expectedMinutes is set: % of goal completed
              - Else: % of a 50-min pomodoro cycle
            Ring fades out when dimmed (only digits remain). */}
        <motion.div
          animate={{ x: timerPos.x, y: timerPos.y }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          className="transition-opacity duration-1000 relative"
          style={{
            opacity: dimmed ? Math.max(0.35, settings.screenDimOpacity / 100) : 1,
            filter: dimmed ? 'drop-shadow(0 0 40px rgba(255,255,255,0.1))' : 'none',
          }}
        >
          {/* === #1 Circular progress ring (SVG) — only when NOT dimmed ===
              Size scales with orientation: 280px portrait, 240px landscape. */}
          {!dimmed && (() => {
            const ringSize = isLandscape ? 240 : 280;
            const stroke = 3; // thin elegant ring
            const radius = (ringSize / 2) - (stroke * 2);
            const circumference = 2 * Math.PI * radius;
            // Progress: % of goal (if set) or 50-min pomodoro cycle
            const goalSec = active.expectedMinutes ? active.expectedMinutes * 60 : 50 * 60;
            const progress = Math.min(1, (isWasting ? wastedSec : studySec) / goalSec);
            const dashOffset = circumference * (1 - progress);
            return (
              <svg
                width={ringSize}
                height={ringSize}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ zIndex: 0, opacity: dimmed ? 0 : 0.9, transition: 'opacity 1000ms' }}
              >
                {/* Track (background ring) */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={stroke}
                />
                {/* Progress arc (subject/timer color) */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke={timerColor}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  style={{
                    transition: 'stroke-dashoffset 1000ms ease-out, stroke 1000ms ease-in-out',
                    filter: `drop-shadow(0 0 8px ${timerColor}60)`,
                  }}
                />
              </svg>
            );
          })()}

          {/* === #4 Minute-rollover bounce — keyed by minuteBounce so it
              re-mounts and re-animates on each minute change. === */}
          <div key={minuteBounce} className={cn(minuteBounce > 0 && !dimmed && 'minute-bounce')} style={{ position: 'relative', zIndex: 10 }}>
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
                  isLandscape ? 'text-6xl' : 'text-6xl sm:text-7xl',
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
              <div className="text-center mt-1 text-[10px] uppercase tracking-widest text-white/50 font-semibold">
                {isPaused ? 'Paused at' : isWasting ? 'Wasting for' : 'Studied for'}
              </div>
            )}
          </div>
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

        {/* === REMOVED: Horizontal progress bar (was below the timer when
            expectedMinutes was set). This was REDUNDANT with the circular
            progress ring (#1) that now sits behind the timer — both showed
            the same % of goal, causing visual clutter and overlap in portrait.
            The ring is the single source of truth for progress now.
            === The "Wasted: Xm · Y% focus" label above still shows briefly
            when waste is added, so the user still gets waste feedback. === */}
      </div>

      {/* === Bottom / Right controls — MODERN GLASSMORPHIC DESIGN (#5, #6, #7, #8)
          FADE OUT entirely when dimmed (opacity 0) + CLICK-THROUGH
          (pointer-events-none) so taps pass through to the overlay's onClick
          (handleInteraction) which un-dims.

          === #5 Glassmorphic button cards ===
              All buttons use frosted-glass: rgba(255,255,255,0.06) bg +
              1px white/10 border + 12px backdrop-blur. Matches the header pill.

          === #6 Better visual hierarchy ===
              PRIMARY (Pause/Resume): solid accent fill + glow — the main action
              ALERT (Got Distracted): red OUTLINE style (less aggressive than solid red)
              TERTIARY (Stop/Hide/Rotate): compact glass icon buttons with labels

          === #7 Ripple on tap ===
              Every button gets a Material-style ripple at the tap position.

          === #8 Contextual button states ===
              When WASTING: the Distracted button shows a live timer of how long
              you've been distracted, + becomes a calming green "Back to Study".

          PORTRAIT: stacked full-width buttons at the bottom.
          LANDSCAPE: fixed-width column on the RIGHT side of the timer. */}
      <div className={cn(
        'transition-opacity duration-1000 shrink-0',
        dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100',
        isLandscape ? 'w-[280px] space-y-2' : 'w-full max-w-sm space-y-2'
      )}>
        {isLandscape ? (
          /* === LANDSCAPE LAYOUT === */
          <>
            {/* === #6 PRIMARY: Pause / Resume — solid accent fill + glow === */}
            <button
              onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); vibrate(12); if (isPaused) resume(); else pause(); }}
              className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2"
              style={{
                background: isPaused ? '#22c55e' : 'rgba(255,255,255,0.08)',
                color: isPaused ? '#000' : '#fff',
                border: isPaused ? 'none' : '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isPaused ? '0 4px 20px -4px rgba(34,197,94,0.6)' : 'none',
              }}
            >
              {isPaused ? <><Play size={16} fill="currentColor" /> Resume</> : <><Pause size={16} fill="currentColor" /> Pause</>}
            </button>
            {/* === #6 ALERT: Got Distracted — red OUTLINE style (less aggressive) ===
                === #8 Contextual: shows live distracted timer when wasting === */}
            <button
              onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); toggleWasting(); }}
              className={cn(
                'w-full py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-2',
                isWasting && 'pulse-fast'
              )}
              style={{
                background: isWasting ? '#22c55e' : 'rgba(239,68,68,0.10)',
                color: isWasting ? '#000' : '#ef4444',
                border: isWasting ? 'none' : '1px solid rgba(239,68,68,0.30)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isWasting ? '0 4px 20px -4px rgba(34,197,94,0.6)' : 'none',
              }}
            >
              {isWasting ? (
                <><Play size={16} fill="currentColor" /> Back to Study · {formatClock(wastedSec)}</>
              ) : (
                <><AlertTriangle size={16} /> Got Distracted</>
              )}
            </button>
            {/* === #6 TERTIARY: Done/Stop + Hide + Rotate — glass icon buttons === */}
            <div className="grid grid-cols-3 gap-2">
              {active?.targetId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); handleDone(); }}
                  className="py-2.5 rounded-xl font-bold text-[11px] active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  aria-label="Done — mark target complete"
                >
                  <CheckCircle2 size={18} />
                  <span>Done</span>
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); handleStop(); }}
                  className="py-2.5 rounded-xl font-bold text-[11px] active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  aria-label="Stop — end session"
                >
                  <Square size={18} fill="currentColor" />
                  <span>Stop</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); setFocusOpen(false); setWidgetHidden(false); }}
                className="py-2.5 rounded-xl font-bold text-[11px] text-white active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                aria-label="Hide timer"
              >
                <ChevronDown size={18} />
                <span>Hide</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); vibrate(8); try { if (screen.orientation) { const target = isLandscape ? 'portrait' : 'landscape'; (screen.orientation as any).lock?.(target).catch(() => {}); } } catch {} }}
                className="py-2.5 rounded-xl font-bold text-[11px] text-white active:scale-[0.98] transition flex flex-col items-center justify-center gap-0.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                title={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
                aria-label="Toggle orientation"
              >
                <RotateCw size={18} />
                <span>Rotate</span>
              </button>
            </div>
          </>
        ) : (
          /* === PORTRAIT LAYOUT === */
          <>
            {/* === #6 PRIMARY: Pause / Resume — solid accent fill + glow === */}
            <button
              onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); vibrate(12); if (isPaused) resume(); else pause(); }}
              className="w-full py-3.5 rounded-2xl font-bold text-base active:scale-[0.98] transition flex items-center justify-center gap-2"
              style={{
                background: isPaused ? '#22c55e' : 'rgba(255,255,255,0.08)',
                color: isPaused ? '#000' : '#fff',
                border: isPaused ? 'none' : '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isPaused ? '0 4px 20px -4px rgba(34,197,94,0.6)' : 'none',
              }}
            >
              {isPaused ? <><Play size={18} fill="currentColor" /> Resume</> : <><Pause size={18} fill="currentColor" /> Pause</>}
            </button>
            {/* === #6 ALERT: Got Distracted — red OUTLINE + #8 contextual timer === */}
            <button
              onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); toggleWasting(); }}
              className={cn('w-full py-3.5 rounded-2xl font-bold text-base active:scale-[0.98] transition flex items-center justify-center gap-2', isWasting && 'pulse-fast')}
              style={{
                background: isWasting ? '#22c55e' : 'rgba(239,68,68,0.10)',
                color: isWasting ? '#000' : '#ef4444',
                border: isWasting ? 'none' : '1px solid rgba(239,68,68,0.30)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isWasting ? '0 4px 20px -4px rgba(34,197,94,0.6)' : 'none',
              }}
            >
              {isWasting ? (
                <><Play size={18} fill="currentColor" /> Back to Study · {formatClock(wastedSec)}</>
              ) : (
                <><AlertTriangle size={18} /> Got Distracted</>
              )}
            </button>
            {/* === #6 TERTIARY: Done/Stop + Hide + Rotate row === */}
            <div className="flex gap-2.5">
              {active?.targetId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); handleDone(); }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  aria-label="Done — mark target complete"
                >
                  <CheckCircle2 size={18} /> Done
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); handleStop(); }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  aria-label="Stop — end session"
                >
                  <Square size={18} fill="currentColor" /> Stop
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); setFocusOpen(false); setWidgetHidden(false); }}
                className="px-4 py-3 rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                aria-label="Hide timer"
              >
                <ChevronDown size={16} /> Hide
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleTapRipple(e); handleInteraction(); vibrate(8); try { if (screen.orientation) { const target = isLandscape ? 'portrait' : 'landscape'; (screen.orientation as any).lock?.(target).catch(() => {}); } } catch {} }}
                className="px-4 py-3 min-w-[52px] rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                title={isLandscape ? 'Switch to portrait' : 'Switch to landscape'}
                aria-label="Toggle orientation"
              >
                <RotateCw size={18} />
              </button>
            </div>
            <RotateHintToast />
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

