'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [wasteFlash, setWasteFlash] = useState<number | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [showGoalReached, setShowGoalReached] = useState(false);
  const [showBreathing, setShowBreathing] = useState(true); // show on session start
  // Landscape detection — rotates the timer layout when phone is sideways
  const [isLandscape, setIsLandscape] = useState(false);
  const lastWastedRef = useRef(0);
  const lastInteractRef = useRef(Date.now());

  // Live ticking — 500ms for smooth display
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(i);
  }, []);

  // === Landscape detection ===
  // Rotates the timer layout when phone is sideways (if allowed in settings).
  // Uses window.orientation + matchMedia for reliable detection.
  useEffect(() => {
    if (!settings.allowLandscape) return;
    const checkOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [settings.allowLandscape]);

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

  // Fullscreen on mount
  useEffect(() => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    return () => {
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

  // Pre-compute values needed by hooks (before early return)
  const studySec = active ? getLiveStudySeconds(active) : 0;
  const wastedSec = active ? getLiveWastedSeconds(active) : 0;
  const expectedSec = active?.expectedMinutes ? active.expectedMinutes * 60 : 0;
  const isOverTime = expectedSec ? studySec > expectedSec : false;

  // Track which multiple of expected time we've already shown the modal for.
  // e.g. if expected = 60 min (3600s):
  //   - At 3600s (1x) → show modal, track milestoneShown = 1
  //   - At 7200s (2x) → show modal, track milestoneShown = 2
  //   - At 10800s (3x) → show modal, track milestoneShown = 3
  // This prevents fake study time — user must actively confirm "Continue" each time.
  const lastMilestoneRef = useRef(0);

  useEffect(() => {
    if (!active || !expectedSec) return;
    if (active.paused || active.wasting) return;
    // Calculate current milestone (1, 2, 3, ...)
    const milestone = Math.floor(studySec / expectedSec);
    if (milestone > lastMilestoneRef.current && milestone >= 1) {
      lastMilestoneRef.current = milestone;
      setShowGoalReached(true);
      if (settings.haptics) vibrate([10, 30, 10, 30, 10]);
      import('@/lib/sounds').then(({ playSound }) => playSound('success'));
      import('@/components/shared/Effects').then(({ triggerConfetti }) => triggerConfetti('medium'));
    }
  }, [studySec, expectedSec, active?.paused, active?.wasting, settings.haptics, active]);

  // Reset milestone tracking when session changes (new session → can show again)
  useEffect(() => {
    lastMilestoneRef.current = 0;
    setShowGoalReached(false);
  }, [active?.targetId, active?.startedAt]);

  // === Partner sync — push live study data every 3s while in FocusTimer ===
  // CRITICAL: The global usePartnerSync hook in AppShell handles syncing on
  // all tabs. But when the FocusTimer is open in fullscreen, some mobile
  // browsers throttle background intervals. This DIRECT sync inside the
  // FocusTimer guarantees B's study data reaches the server every 3s while
  // B is actively studying in the black screen — so A sees real-time updates.
  useEffect(() => {
    if (!partnerCode) return;
    // Immediate push when FocusTimer opens
    partnerSyncData();
    const i = setInterval(() => {
      partnerSyncData();
    }, 3_000);
    return () => clearInterval(i);
  }, [partnerCode, partnerSyncData]);

  // Breathing exercise phases (4-7-8 pattern: inhale 4s, hold 7s, exhale 8s)
  // NOTE: these hooks MUST be declared BEFORE the early return below —
  // React's Rules of Hooks require hooks to be called unconditionally on
  // every render. Previously they were after the `if (!active) return null`,
  // which caused "Rendered fewer hooks than expected" crashes whenever the
  // session ended (active became null) while the breathing overlay was active.
  const breathPhases = [
    { label: 'Breathe in...', duration: 4, scale: 1.5 },
    { label: 'Hold...', duration: 7, scale: 1.5 },
    { label: 'Breathe out...', duration: 8, scale: 0.8 },
  ];
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCount, setBreathCount] = useState(0);

  useEffect(() => {
    if (!showBreathing) return;
    const phase = breathPhases[breathPhase];
    const timer = setTimeout(() => {
      if (breathPhase < 2) {
        setBreathPhase(breathPhase + 1);
      } else {
        if (breathCount >= 2) {
          setShowBreathing(false);
        } else {
          setBreathCount(breathCount + 1);
          setBreathPhase(0);
        }
      }
    }, phase.duration * 1000);
    return () => clearTimeout(timer);
  }, [showBreathing, breathPhase, breathCount]);

  if (!active || !color) return null;

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

  // Breathing overlay — shows before the focus timer starts
  if (showBreathing && active && color) {
    const phase = breathPhases[breathPhase];
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{ backgroundColor: '#000000' }}
      >
        <div className="text-xs text-white/40 uppercase tracking-widest mb-1">
          Breathing Exercise
        </div>
        <div className="text-sm text-white/60 mb-12">
          {breathCount + 1} of 3 · 4-7-8 Pattern
        </div>
        <motion.div
          animate={{ scale: phase.scale }}
          transition={{ duration: phase.duration, ease: 'easeInOut' }}
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${color.hex}40, ${color.hex}10)`,
            border: `2px solid ${color.hex}40`,
          }}
        >
          <span className="text-white font-bold text-lg">{phase.label}</span>
        </motion.div>
        <button
          onClick={() => setShowBreathing(false)}
          className="absolute bottom-12 text-xs text-white/40 hover:text-white/70"
        >
          Skip
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleInteraction}
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6",
        isLandscape && "flex-row items-center justify-center gap-8 py-6"
      )}
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

      {/* Top section: labels — HIDDEN when dimmed */}
      <div className={cn('text-center transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
        <div className="text-xs text-white/40 uppercase tracking-widest mb-1">
          {active.mode === 'free' ? 'Free Study' : 'Focus Session'}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="font-semibold" style={{ color: color.hex }}>{active.subject}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/70">{active.chapter}</span>
        </div>
        <div className="text-xs text-white/40 mt-0.5">{active.topic}</div>
        {/* Live sync indicator — shows B that their data is being pushed */}
        {partnerCode && (
          <div className="text-[9px] text-green-400/60 mt-1 flex items-center justify-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-green-400 animate-pulse" />
            Syncing live to partner
          </div>
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
          className="mb-6 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
          style={{
            background: isWasting ? '#ef4444' : isPaused ? '#f59e0b' : '#22c55e',
            color: '#000',
            pointerEvents: dimmed ? 'none' : 'auto',
            transition: 'background-color 600ms ease-in-out',
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

        {/* Timer — dims to 8% but stays barely visible */}
        <motion.div
          animate={{ x: timerPos.x, y: timerPos.y }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          className="transition-opacity duration-1000"
          style={{
            opacity: dimmed ? 0.08 : 1,
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
        </motion.div>

        {/* Wasted display — HIDDEN when dimmed */}
        {!isWasting && wastedSec > 0 && (
          <div className={cn('mt-4 text-sm text-red-400/70 tabular transition-opacity duration-1000', dimmed ? 'opacity-0' : 'opacity-100')}>
            Wasted: {formatHM(wastedSec)}
          </div>
        )}

        {/* Expected time progress — HIDDEN when dimmed */}
        {active.expectedMinutes && (
          <div className={cn('mt-6 w-64 transition-opacity duration-1000', dimmed ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
            <div className="flex justify-between text-[10px] text-white/40 mb-1 tabular">
              <span>{formatHM(studySec)}</span>
              <span>{active.expectedMinutes}m goal</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(studySec / (active.expectedMinutes * 60)) * 100}%`,
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
          {/* Landscape toggle button — manually switch between portrait/landscape layout */}
          {settings.allowLandscape && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction();
                setIsLandscape(!isLandscape);
                vibrate(8);
              }}
              className="px-4 py-4 rounded-2xl font-semibold text-sm bg-white/5 text-white/70 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              title="Toggle landscape mode"
            >
              <RotateCw size={16} className={isLandscape ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
          )}
        </div>
      </div>

      {/* === Goal Reached Modal — shows when study time hits 100% of expected === */}
      <AnimatePresence>
        {showGoalReached && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowGoalReached(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 max-w-sm w-full text-center"
            >
              {/* Celebration emoji */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
                className="text-5xl mb-3"
              >
                🎯
              </motion.div>

              {/* Title */}
              <h2 className="text-xl font-bold mb-1">
                {lastMilestoneRef.current}x Goal Reached!
              </h2>
              <p className="text-sm text-white/60 mb-1">
                You studied for <strong className="text-white">{formatHM(expectedSec * lastMilestoneRef.current)}</strong>
              </p>
              <p className="text-xs text-white/40 mb-5">
                {lastMilestoneRef.current === 1
                  ? 'Great work! Keep going or end the session.'
                  : 'Impressive dedication! Keep going or end the session.'}
              </p>

              {/* Two buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowGoalReached(false);
                    vibrate(10);
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98]"
                >
                  Continue Studying
                </button>
                <button
                  onClick={() => {
                    setShowGoalReached(false);
                    vibrate([10, 30, 10]);
                    handleDone();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-white/10 text-white font-bold text-sm active:scale-[0.98]"
                >
                  Mark Done & End
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
