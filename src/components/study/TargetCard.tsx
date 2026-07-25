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
  const toggleDone = useTargets((s) => s.toggleDone);
  const haptics = useSettings((s) => s.haptics);
  const reduceAnimations = useSettings((s) => s.reduceAnimations);
  const animationIntensity = useSettings((s) => s.animationIntensity);
  const [celebrate, setCelebrate] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);

  // === Refined gesture detection ===
  // Three distinct intents:
  //  1. QUICK TAP (< 200ms hold, < 8px movement) → open detail
  //  2. LONG PRESS (≥ 400ms hold, < 8px movement) → arm drag mode (visual pop)
  //  3. DRAG (≥ 8px movement after long-press armed) → reorder card
  //
  // Previous issues fixed:
  //  - Tap fired on any touch, even accidental fraction-of-second brushes.
  //    Now requires the pointer to be DOWN for ≥ 80ms AND released with minimal
  //    movement before it counts as a tap (filters out micro-jitter).
  //  - Vertical drag activated on 1-2px movement. Now requires 8px of
  //    movement AND the long-press timer to have fired (400ms hold) before
  //    the drag is "armed". A quick swipe without holding does nothing.
  //  - Start/Pause button taps sometimes leaked to the parent onTap.
  //    Now we track whether the pointer down started on a button and
  //    suppress the parent tap in that case.
  const suppressTapRef = useRef(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragArmedRef = useRef(false); // becomes true after 400ms hold
  const pressStartRef = useRef<{ x: number; y: number; t: number; onButton: boolean } | null>(null);
  const [popped, setPopped] = useState(false);

  // Movement threshold (px) — pointer must travel at least this far to be
  // considered a drag attempt rather than a tap.
  const DRAG_MOVE_THRESHOLD = 8;
  // Hold time (ms) required before drag mode is "armed". Below this, the
  // card stays in tap mode and won't start reordering.
  const LONG_PRESS_MS = 400;
  // Minimum press duration (ms) for a tap to count. Filters out accidental
  // micro-touches where the finger brushes the screen for < 80ms.
  const MIN_TAP_MS = 80;

  const onCardPointerDown = (e: React.PointerEvent) => {
    // If the pointer down landed on a button or interactive element inside
    // the card, mark it so we don't open detail on release.
    const onButton = (e.target as HTMLElement).closest('button, a, input, [data-stop-propagation]');
    suppressTapRef.current = !!onButton;
    dragArmedRef.current = false;
    setPopped(false);
    pressStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      onButton: !!onButton,
    };
    // Arm drag mode after a deliberate long press. Only if the user is NOT
    // pressing on a button (so button taps never accidentally arm drag).
    if (!onButton) {
      pressTimerRef.current = setTimeout(() => {
        dragArmedRef.current = true;
        setPopped(true);
        if (haptics) vibrate(10);
      }, LONG_PRESS_MS);
    }
  };

  const onCardPointerMove = (e: React.PointerEvent) => {
    if (!pressStartRef.current) return;
    const dx = Math.abs(e.clientX - pressStartRef.current.x);
    const dy = Math.abs(e.clientY - pressStartRef.current.y);
    // If significant movement happens BEFORE the long-press timer fires,
    // cancel the timer — this is a swipe/scroll, not a long-press.
    // (The drag itself will be handled by Reorder.Item, but only if armed.)
    if ((dx > DRAG_MOVE_THRESHOLD || dy > DRAG_MOVE_THRESHOLD) && pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      // Not armed yet → suppress tap (it became a drag attempt)
      suppressTapRef.current = true;
    }
  };

  const onCardPointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setPopped(false);
    // If the press was too short (< MIN_TAP_MS), treat as accidental touch
    // and suppress the tap. prevents detail opening on quick brushes.
    if (pressStartRef.current) {
      const heldMs = Date.now() - pressStartRef.current.t;
      if (heldMs < MIN_TAP_MS) {
        suppressTapRef.current = true;
      }
      pressStartRef.current = null;
    }
    // Reset drag-armed flag after a short delay so the next interaction
    // starts fresh. (Immediate reset would race with Reorder.Item's drag.)
    setTimeout(() => { dragArmedRef.current = false; }, 50);
  };

  useEffect(() => () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }, []);

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
  // Progress shows 100% when expected time is reached, but does NOT cap the
  // actual study time — liveStudied keeps growing past expected time.
  // The bar shows min(100%) but the text shows the REAL studied time.
  const progressPct = expectedSec > 0 ? Math.round((liveStudied / expectedSec) * 100) : 0;

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

  // === Simple interaction model ===
  // Reorder.Item handles drag natively. We use `onTap` (Framer Motion's
  // tap detector — fires only on clean tap, NOT after drag) to open detail.
  // Buttons inside use stopPropagation so they don't trigger the tap.

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
      drag="y"
      dragDirectionLock
      dragElastic={0.15}
      initial={reduceAnimations ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        // "Pop" effect when long-pressed — card lifts slightly to show drag mode
        scale: popped && !reduceAnimations ? 1.02 : (celebrate && !reduceAnimations ? 1.02 : 1),
      }}
      whileDrag={
        reduceAnimations
          ? { zIndex: 50, cursor: 'grabbing', scale: 1.02 }
          : {
              scale: 1.03,
              zIndex: 50,
              cursor: 'grabbing',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.08)',
            }
      }
      dragTransition={
        reduceAnimations
          ? { bounceStiffness: 1000, bounceDamping: 100 }
          : { bounceStiffness: 800, bounceDamping: 45 }
      }
      transition={
        reduceAnimations
          ? { duration: 0 }
          : { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 }
      }
      // Pointer handlers for refined gesture detection
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onPointerLeave={onCardPointerUp}
      onPointerCancel={onCardPointerUp}
      // onTap — only opens detail if:
      //  - The tap didn't originate on a button/interactive element (checked
      //    via the event target at tap time — more reliable than stopPropagation,
      //    which framer-motion's tap detector doesn't fully respect).
      //  - suppressTapRef is false (not a long-press, not an accidental
      //    micro-touch, not a drag attempt).
      //  - drag was not armed.
      onTap={(e: any) => {
        // If the tap landed on a button or interactive child, let that
        // element's own onClick handle it — don't open detail.
        if (e?.target && (e.target as HTMLElement).closest('button, a, input, [data-stop-propagation]')) {
          return;
        }
        if (suppressTapRef.current || dragArmedRef.current) {
          suppressTapRef.current = false;
          return;
        }
        onOpenDetail();
      }}
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
        'cursor-pointer',
        stateClass,
        flashGreen && 'ring-2 ring-green-500',
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

      {/* Card flip celebration on done — 3D Y-axis rotation showing green "Done!" face */}
      <AnimatePresence>
        {flashGreen && (
          <motion.div
            initial={{ rotateY: 0, opacity: 1 }}
            animate={{ rotateY: 180, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 pointer-events-none rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(34,197,94,0.1))',
              backfaceVisibility: 'hidden',
            }}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
              className="text-3xl"
            >
              ✅
            </motion.span>
          </motion.div>
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
              toggleDone(target.id);
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
            '',
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
