'use client';
// === FIX: removed unused imports (useVisibility/useReducedMotion were
//     imported but never used — dead code) ===
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Maximize2, EyeOff, Pause, Play, Square, CheckCircle2 } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { cn, formatClock, vibrate } from '@/lib/utils';

export function FloatingWidget() {
  const { active, widgetHidden, setFocusOpen, setWidgetHidden, pause, resume, stop } = useSession();
  const toggleTargetDone = useTargets((s) => s.toggleDone);
  const haptics = useSettings((s) => s.haptics);

  const [, setTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Position
  const x = useMotionValue(typeof window !== 'undefined' ? window.innerWidth - 210 : 100);
  const y = useMotionValue(typeof window !== 'undefined' ? window.innerHeight - 280 : 100);

  // === FIX (widget stays off-screen after Hide in landscape → rotate to portrait) ===
  // What the user's video showed: tap "Hide" on the landscape full-screen timer
  // → widget mounts at landscape coordinates (x = landscapeWidth - 210 ≈ 630) →
  // phone rotates to portrait (width ≈ 390) → the widget is 240px PAST the right
  // edge — completely invisible — and it NEVER came back.
  //
  // Root cause: the ONLY re-clamp triggers were resize-family events. On real
  // phones the first `resize` after a rotation can fire while window.innerWidth
  // still reports the OLD (pre-rotation) value. The clamp then believes the
  // widget is "in bounds" for a viewport that no longer exists and does nothing.
  // If no further resize event follows, nothing ever re-clamps → widget lost
  // off-screen until the next rotation.
  //
  // Fix — four INDEPENDENT clamp layers, so no single browser quirk can strand
  // the widget:
  //   1. Event triggers (resize / orientationchange / screen.orientation /
  //      visibilitychange / pageshow) — each one re-checks again on the next
  //      animation frames and after short timeouts, which heals the
  //      stale-dimension case (fresh dimensions settle a frame or two after
  //      the event fires).
  //   2. visualViewport 'resize' — reliable on mobile, also covers URL-bar
  //      and keyboard viewport changes.
  //   3. ResizeObserver on <html> — fires AFTER layout settles, so the
  //      dimensions read inside it are always fresh.
  //   4. Clamp on EVERY render — the widget re-renders every second (live
  //      ticking) while visible, so even if ALL events fail the widget
  //      re-enters the screen by itself within ~1 second.
  //
  // An in-bounds widget is never moved (no surprise jumps) — only one that
  // would end up (partially) off-screen is pulled back to the nearest safe
  // edge, matching the snap margins used at drag-end (20px right / 180px
  // bottom).
  const clampToViewport = useCallback(() => {
    const WIDGET_W = 184;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxX = Math.max(0, w - WIDGET_W - 20); // same 20px margin as snap
    const maxY = Math.max(0, h - 180);          // same bottom margin as snap
    const cx = x.get();
    const cy = y.get();
    const nx = cx > maxX ? maxX : Math.max(0, cx);
    const ny = cy > maxY ? maxY : Math.max(0, cy);
    if (nx !== cx) x.set(nx);
    if (ny !== cy) y.set(ny);
  }, [x, y]);

  // Layers 1–3: event-driven clamping with stale-dimension self-healing.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    // Clamp now + again on the next frames + after short timeouts. Costs a few
    // no-ops when dimensions were already fresh; saves the widget when they weren't.
    const trigger = () => {
      clampToViewport();
      cancelAnimationFrame(raf1);
      raf1 = requestAnimationFrame(() => {
        clampToViewport();
        cancelAnimationFrame(raf2);
        raf2 = requestAnimationFrame(clampToViewport);
      });
      clearTimeout(t1); t1 = setTimeout(clampToViewport, 150);
      clearTimeout(t2); t2 = setTimeout(clampToViewport, 400);
    };

    window.addEventListener('resize', trigger);
    window.addEventListener('orientationchange', trigger);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', trigger);
    }
    // Layer 2: visualViewport (fires for rotation + URL bar + keyboard)
    window.visualViewport?.addEventListener('resize', trigger);
    // Layer 3: ResizeObserver on <html> — always fires AFTER layout settles
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => trigger());
      ro.observe(document.documentElement);
    }
    const onVis = () => { if (!document.hidden) trigger(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);

    trigger(); // also covers mount (no-op when already in bounds)

    return () => {
      window.removeEventListener('resize', trigger);
      window.removeEventListener('orientationchange', trigger);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', trigger);
      }
      window.visualViewport?.removeEventListener('resize', trigger);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [clampToViewport]);

  // Layer 4: clamp on EVERY render. The widget re-renders every second while
  // visible (live ticking), so this is the safety net that guarantees the
  // widget can never stay off-screen for more than ~1s, even if every event
  // listener above fails to fire. Skipped mid-drag so it never fights the
  // finger (the drag handler already clamps to bounds itself).
  useEffect(() => {
    if (dragging) return;
    clampToViewport();
  });

  // Live ticking — skip when widget is hidden (saves CPU on low-end devices)
  // === HEAT FIX: Also skip when tab is hidden ===
  useEffect(() => {
    if (widgetHidden) return;
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(i);
  }, [widgetHidden]);

  // Early return when not needed — prevents all computations + rendering
  if (!active || widgetHidden) return null;

  const color = subjectColor(active.subject);
  const studySec = getLiveStudySeconds(active);
  const wastedSec = getLiveWastedSeconds(active);

  const isPaused = active.paused;
  const isWasting = active.wasting;
  const borderColor = isPaused ? '#f59e0b' : isWasting ? '#ef4444' : color.hex;
  const statusColor = isPaused ? '#f59e0b' : isWasting ? '#ef4444' : '#22c55e';
  const statusText = isPaused ? 'Paused' : isWasting ? 'Wasting' : 'Studying';

  const handleStop = () => {
    if (studySec < 300) {
      if (confirm(`Only ${Math.floor(studySec / 60)}m studied. End session?`)) stop();
    } else {
      stop();
    }
  };

  // Long-press to start drag (works on whole widget body)
  const onPointerDown = (e: React.PointerEvent) => {
    // Record offset from widget top-left to pointer
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    longPressTimer.current = setTimeout(() => {
      isDraggingRef.current = true;
      setDragging(true);
      if (haptics) vibrate(30);
    }, 400);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const newX = e.clientX - dragOffsetRef.current.x;
    const newY = e.clientY - dragOffsetRef.current.y;
    // Clamp to screen bounds
    const w = window.innerWidth;
    const h = window.innerHeight;
    const widgetW = 184;
    const widgetH = 160;
    x.set(Math.max(0, Math.min(newX, w - widgetW)));
    y.set(Math.max(0, Math.min(newY, h - widgetH)));
  };

  const onPointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setDragging(false);
    // Snap to nearest edge
    const w = window.innerWidth;
    const h = window.innerHeight;
    const currX = x.get();
    const currY = y.get();
    const snapX = currX + 92 < w / 2 ? 20 : w - 204;
    // If in bottom 40%, snap to bottom
    const snapY = currY > h * 0.6 ? h - 180 : Math.max(80, Math.min(currY, h - 180));
    // Animate via motion value
    const startX = currX;
    const startY = currY;
    const dx = snapX - startX;
    const dy = snapY - startY;
    const duration = 300;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      x.set(startX + dx * eased);
      y.set(startY + dy * eased);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  if (widgetHidden) return null;

  return (
    <motion.div
      data-session-widget
      style={{
        x,
        y,
        position: 'fixed',
        zIndex: 9998,
        width: 184,
        opacity: dragging ? 0.9 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="rounded-2xl shadow-2xl overflow-hidden select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Outer container — higher opacity, solid background */}
      <div
        style={{
          border: `2px solid ${borderColor}`,
          background: 'var(--card)',
        }}
        className="rounded-2xl"
      >
        {/* Header — status + buttons */}
        <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', !isPaused && (isWasting ? 'pulse-fast' : 'pulse-slow'))}
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          <span className="text-[10px] font-bold text-white flex-1">{statusText}</span>
          {/* === FIX: Bigger hit targets (was p-0.5 + 12px icon ≈ 17px — too
              small for fingers; taps missed the button and hit the drag handle
              instead, which felt like "hide/unhide not working") === */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setFocusOpen(true)}
            className="text-foreground/85 hover:text-foreground p-1.5 -m-1"
            aria-label="Maximize"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setWidgetHidden(true)}
            className="text-foreground/85 hover:text-foreground p-1.5 -m-1"
            aria-label="Hide"
          >
            <EyeOff size={13} />
          </button>
        </div>

        {/* Body — tap to open (but drag works here too) */}
        <button
          onClick={(e) => { if (!dragging) { e.stopPropagation(); setFocusOpen(true); } }}
          className="block w-full text-left px-3 py-2"
          style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
        >
          <div className="text-xs font-bold truncate" style={{ color: color.hex }}>
            {active.subject}
          </div>
          <div className="text-[10px] text-foreground/85 truncate mb-1">{active.chapter}</div>
          <div className="text-2xl font-bold tabular text-white">
            {formatClock(isWasting ? wastedSec : studySec)}
          </div>
        </button>

        {/* Footer controls */}
        <div className="flex gap-1 px-2 pb-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (haptics) vibrate(10);
              if (isPaused) {
                // Resume in background (no fullscreen)
                resume();
              } else {
                pause();
              }
            }}
            className="flex-1 py-1.5 rounded-lg text-white text-[10px] font-bold flex items-center justify-center gap-1 active:scale-95 transition"
            style={{
              background: isPaused ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.2)',
            }}
          >
            {isPaused ? <><Play size={10} fill="currentColor" /> Resume</> : <><Pause size={10} fill="currentColor" /> Pause</>}
          </button>
          {active?.targetId && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (haptics) vibrate([10, 30, 10]);
                toggleTargetDone(active.targetId!);
                stop();
              }}
              className="flex-1 py-1.5 rounded-lg bg-green-500/30 text-green-300 text-[10px] font-bold flex items-center justify-center gap-1 active:scale-95"
            >
              <CheckCircle2 size={10} /> Done
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handleStop(); }}
            className="flex-1 py-1.5 rounded-lg bg-red-500/30 text-red-300 text-[10px] font-bold flex items-center justify-center gap-1 active:scale-95"
          >
            <Square size={10} fill="currentColor" /> Stop
          </button>
        </div>
      </div>
    </motion.div>
  );
}
