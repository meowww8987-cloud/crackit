'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Play, Pause, Check, GripVertical, CheckCircle2 } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import type { Target } from '@/lib/types';
import { cn, formatHM, vibrate } from '@/lib/utils';
import { playSound } from '@/lib/sounds';
import { LiquidProgress } from '@/components/shared/LiquidProgress';
import { SwipeableCardWrapper } from '@/components/study/SwipeableCardWrapper';

interface Props {
  target: Target;
  onOpenDetail: () => void;
  onEdit: () => void;
  /** When provided, enables swipe gestures (right=done, left=quick actions). */
  onDelete?: () => void;
  onDuplicate?: () => void;
  /**
   * Enable swipe gestures. Default false to avoid conflict with Reorder.Item
   * (which uses vertical drag). When true, the card is NOT reorderable but
   * IS swipeable. Pick one mode per usage context.
   */
  swipeEnabled?: boolean;
}

export function TargetCard({
  target,
  onOpenDetail,
  onEdit,
  onDelete,
  onDuplicate,
  swipeEnabled = false,
}: Props) {
  const color = subjectColor(target.subject);
  const active = useSession((s) => s.active);
  const startSession = useSession((s) => s.startSession);
  const pause = useSession((s) => s.pause);
  const resume = useSession((s) => s.resume);
  const toggleDone = useTargets();
  const haptics = useSettings((s) => s.haptics);
  const reduceAnimations = useSettings((s) => s.reduceAnimations);
  const animationIntensity = useSettings((s) => s.animationIntensity);
  const [celebrate, setCelebrate] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);

  // Long-press-to-drag state.
  // Reorder.Item's drag is gated behind `dragEnabled` — false by default so
  // taps open the detail sheet, but after holding 350ms it flips to true and
  // the user can move their finger to reorder.
  // `dragArmed` is the visual cue state (card lifts slightly + haptic).
  const [dragEnabled, setDragEnabled] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);

  const isThisActive = active?.targetId === target.id;
  const isAnyActive = active !== null && !isThisActive;
  const sessionState = isThisActive
    ? active!.paused
      ? 'paused'
      : active!.wasting
      ? 'wasting'
      : 'studying'
    : target.done
    ? 'done'
    : 'idle';

  // Today's sessions for this target (use stable selector + memoized filter)
  const allSessions = useHistory((s) => s.sessions);
  const sessions = useMemo(
    () => allSessions.filter((s) => s.targetId === target.id && s.date === target.date),
    [allSessions, target.id, target.date]
  );
  const studiedSec = sessions.reduce((a, s) => a + s.studySeconds, 0);
  const wastedSec = sessions.reduce((a, s) => a + s.wastedSeconds, 0);

  // Live ticking when this card is active
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isThisActive) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isThisActive]);

  const liveStudied = isThisActive ? getLiveStudySeconds(active) : studiedSec;
  const liveWasted = isThisActive ? getLiveWastedSeconds(active) : wastedSec;
  const expectedSec = target.expectedMinutes * 60;
  const progressPct = expectedSec > 0 ? Math.min(100, Math.round((liveStudied / expectedSec) * 100)) : 0;

  const handleStartPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (haptics) vibrate(12);
    if (target.done) {
      toggleDone(target.id);
      return;
    }
    if (isThisActive) {
      if (active!.paused) resume();
      else pause();
    } else {
      startSession({
        targetId: target.id,
        subject: target.subject,
        chapter: target.chapter,
        lecture: target.lecture,
        topic: target.topic,
        mode: 'focus',
        expectedMinutes: target.expectedMinutes,
      });
    }
  };

  // === Long-press-to-drag handlers ===
  // The card is NOT draggable by default — taps open the detail sheet.
  // After holding 350ms without moving, drag is "armed" (haptic + visual cue),
  // and the user can move their finger to reorder. Release to drop.
  const DRAG_ARM_DELAY = 350;
  const TAP_MOVE_THRESHOLD = 10; // px — if finger moves more than this, cancel tap

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onCardPointerDown = (e: React.PointerEvent) => {
    // Only respond to primary button / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    pointerMovedRef.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      // Long-press fired → arm drag
      setDragEnabled(true);
      setDragArmed(true);
      if (haptics) vibrate(25);
    }, DRAG_ARM_DELAY);
  };

  const onCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerStartPos.current) return;
    const dx = e.clientX - pointerStartPos.current.x;
    const dy = e.clientY - pointerStartPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD) {
      pointerMovedRef.current = true;
      // If user moved before drag was armed, cancel the long-press timer
      // (they're scrolling, not trying to drag)
      if (!dragArmed) clearLongPress();
    }
  };

  const onCardPointerUp = (e: React.PointerEvent) => {
    clearLongPress();
    if (dragArmed) {
      // Was dragging — drop and reset
      setDragEnabled(false);
      setDragArmed(false);
      return;
    }
    // Wasn't dragging — if no significant movement, treat as tap → open detail
    if (!pointerMovedRef.current) {
      onOpenDetail();
    }
    pointerStartPos.current = null;
    pointerMovedRef.current = false;
  };

  const onCardPointerCancel = () => {
    clearLongPress();
    setDragEnabled(false);
    setDragArmed(false);
    pointerStartPos.current = null;
    pointerMovedRef.current = false;
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearLongPress(), []);

  const stateClass = {
    idle: '',
    studying: 'border-2 glow-pulse',
    paused: 'border-2 border-amber-400',
    wasting: 'border-2 glow-pulse',
    done: 'opacity-60',
  }[sessionState];

  const stateGlow = isThisActive
    ? active!.wasting
      ? 'rgba(239,68,68,0.5)'
      : active!.paused
      ? 'rgba(245,158,11,0.5)'
      : color.glow
    : 'transparent';

  return (
    <Reorder.Item
      value={target}
      data-card
      layout
      // Drag is gated behind `dragEnabled` — only true after a 350ms long-press.
      // This lets taps open the detail sheet and buttons stay clickable.
      drag={dragEnabled}
      initial={reduceAnimations ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: dragArmed && !reduceAnimations ? 1.02 : (celebrate && !reduceAnimations ? 1.02 : 1),
      }}
      whileDrag={
        reduceAnimations
          ? { zIndex: 50, cursor: 'grabbing' }
          : {
              scale: 1.04,
              y: -4,
              zIndex: 50,
              cursor: 'grabbing',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            }
      }
      dragTransition={
        reduceAnimations
          ? { bounceStiffness: 1000, bounceDamping: 100 } // no bounce
          : { bounceStiffness: 500, bounceDamping: 35 }
      }
      transition={
        reduceAnimations
          ? { duration: 0 }
          : {
              type: 'spring',
              // Intensity scales the spring: higher intensity = bouncier (lower damping)
              stiffness: 400 + (animationIntensity / 100) * 200, // 400-600
              damping: 45 - (animationIntensity / 100) * 20,     // 45→25 (higher intensity = less damping = bouncier)
              mass: 0.8,
            }
      }
      // Long-press-to-drag handlers. Taps (no movement + < 350ms hold) open detail.
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onPointerCancel={onCardPointerCancel}
      className={cn(
        // NOTE: do NOT use `transition-all duration-500` — it conflicts with
        // Framer Motion's JS-driven transform animations and causes stutter.
        // Instead, use targeted transitions only for non-transform props
        // (border-color, box-shadow) so the drag stays smooth.
        'card-solid rounded-2xl p-3.5 relative overflow-hidden select-none',
        // Cursor changes based on drag state:
        //   idle: pointer (tap to open)
        //   armed: grab (long-press active, ready to drag)
        //   dragging: grabbing (Framer Motion sets this via whileDrag)
        dragArmed ? 'cursor-grab' : 'cursor-pointer',
        stateClass,
        flashGreen && 'ring-2 ring-green-500',
        dragArmed && 'ring-2 ring-white/30',
      )}
      style={{
        // Targeted CSS transitions for visual props only (NOT transform)
        transitionProperty: 'border-color, box-shadow, background-color',
        transitionDuration: '250ms',
        transitionTimingFunction: 'ease-out',
        // via a child `.card-tint` overlay div so it sits ON TOP of the dark
        // base — color identity without muddying the text underneath.
        borderColor: flashGreen
          ? '#22c55e'
          : isThisActive
          ? active!.wasting
            ? '#ef4444'
            : active!.paused
            ? '#f59e0b'
            : color.hex
          : `${color.hex}80`,
        ['--glow-color' as string]: stateGlow,
      }}
      // onClick removed — tap-to-open-detail is now handled in onCardPointerUp
      // (after long-press logic decides if it was a tap or a drag attempt)
    >
      {/* Subject color tint overlay — sits on top of the solid dark base
          so the card visibly belongs to its subject without reducing
          text contrast. `mix-blend-mode: overlay` in CSS handles the math. */}
      <div
        className="card-tint"
        style={{
          background: sessionState === 'done'
            ? `linear-gradient(135deg, ${color.hex}14, transparent)`
            : `linear-gradient(135deg, ${color.hex}33, ${color.hex}14)`,
        }}
      />
      {/* Content wrapper — sits above the .card-tint overlay */}
      <div className="relative">
      {/* Left accent border for idle state */}
      {sessionState === 'idle' && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: color.hex, opacity: 0.4 }}
        />
      )}

      {/* Green flash overlay on done celebration */}
      <AnimatePresence>
        {flashGreen && (
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-green-500 pointer-events-none rounded-2xl"
          />
        )}
      </AnimatePresence>

      {/* Row 1: badges + button + drag handle */}
      <div className="flex items-center gap-2 mb-1.5">
        {target.lecture && (
          <span
            className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded tabular',
              target.done && 'line-through opacity-60'
            )}
            style={{ background: `${color.hex}30`, color: color.hex, border: `1px solid ${color.hex}40` }}
          >
            {target.lecture}
          </span>
        )}
        <span className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/15 text-white/90',
          target.done && 'line-through opacity-60'
        )}>
          {target.activity}
        </span>
        {sessionState === 'studying' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white pulse-slow shadow-lg">
            ● STUDYING
          </span>
        )}
        {sessionState === 'paused' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-lg">
            ⏸ PAUSED
          </span>
        )}
        {sessionState === 'wasting' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white pulse-fast shadow-lg">
            ⚠ WASTING
          </span>
        )}
        <span className="text-[11px] text-white/70 ml-auto tabular">{target.expectedMinutes}m</span>

        {/* Start/Pause button */}
        <button
          onClick={handleStartPause}
          // Stop pointer down so the card's long-press timer doesn't fire
          // when the user is just tapping this button.
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isAnyActive || target.done}
          className={cn(
            'flex items-center justify-center rounded-lg transition active:scale-95 min-w-[36px] h-8 px-2',
            target.done
              ? 'bg-green-500/20 text-green-400'
              : isThisActive
              ? active!.wasting
                ? 'bg-red-500 text-white pulse-fast'
                : active!.paused
                ? 'bg-amber-500 text-white'
                : 'text-white pulse-slow'
              : isAnyActive
              ? 'bg-white/5 text-white/30 cursor-not-allowed'
              : 'bg-white/10 text-white hover:bg-white/15'
          )}
          style={
            !target.done && isThisActive && !active!.wasting && !active!.paused
              ? { background: color.hex, color: '#000' }
              : undefined
          }
        >
          {target.done ? (
            <Check size={16} strokeWidth={3} />
          ) : isThisActive ? (
            active!.paused ? (
              <Play size={14} fill="currentColor" />
            ) : (
              <Pause size={14} fill="currentColor" />
            )
          ) : (
            <Play size={14} fill="currentColor" />
          )}
        </button>

        {/* Done button — marks target complete (also syncs to syllabus) */}
        {!target.done && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (haptics) vibrate(15);
              // Trigger celebration animation
              setFlashGreen(true);
              setCelebrate(true);
              setTimeout(() => setFlashGreen(false), 400);
              setTimeout(() => setCelebrate(false), 600);
              toggleDone.toggleDone(target.id);
              playSound('done');
              // Particle burst from the tap point in the subject's color
              // (skipped when reduceAnimations is on)
              if (!reduceAnimations) {
                import('@/components/shared/Effects').then(({ triggerParticleBurst }) => {
                  triggerParticleBurst(e.clientX, e.clientY, color.hex);
                });
              }
              import('@/components/shared/Effects').then(({ triggerEffect }) => triggerEffect('small', 'chime'));
            }}
            className="flex items-center justify-center rounded-lg transition active:scale-95 min-w-[32px] h-8 px-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25"
            title="Mark as done"
          >
            <CheckCircle2 size={16} />
          </button>
        )}

        {/* Drag handle hint — visual indicator that the card can be reordered.
            Hold anywhere on the card for 350ms to start dragging. */}
        <div
          className={cn(
            'text-white/30 flex items-center transition-colors',
            dragArmed && 'text-white/80',
          )}
          aria-label="Hold card to drag and reorder"
        >
          <GripVertical size={16} />
        </div>
      </div>

      {/* Row 2: Title */}
      <div
        className={cn(
          'text-base font-semibold mb-2 leading-tight text-white',
          target.done && 'line-through text-white/60'
        )}
      >
        {target.topic}
      </div>

      {/* Row 3: Liquid progress bar */}
      <LiquidProgress
        pct={progressPct}
        color={sessionState === 'wasting' ? '#ef4444' : color.hex}
        color2={sessionState === 'wasting' ? '#ef4444aa' : `${color.hex}aa`}
        className="mb-2"
      />

      {/* Row 4: stats */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-green-400 tabular flex items-center gap-1">
          ▶ {formatHM(liveStudied)} / {target.expectedMinutes}m
        </span>
        {liveWasted > 0 && (
          <span className="text-red-400 tabular">⚠ {formatHM(liveWasted)}</span>
        )}
        <span className="text-white/70 ml-auto tabular">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} today
        </span>
      </div>
      </div>
    </Reorder.Item>
  );
}
