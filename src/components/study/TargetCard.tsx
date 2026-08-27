'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  Play, Pause, Check, CheckCircle2, Clock, MoreVertical, GripVertical,
  BookOpen, FileText, Pencil, Copy, RotateCcw, Trash2, ArrowRight, Sparkles,
} from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import type { Target, ActivityType } from '@/lib/types';
import { cn, formatHM, vibrate } from '@/lib/utils';
import { playSound } from '@/lib/sounds';

interface Props {
  target: Target;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  indexInChapter?: number;
  chapterTotal?: number;
  hasSiblings?: boolean;
}

// Activity-specific icon + label + accent color (left border / icon glow)
const ACTIVITY_META: Record<ActivityType, {
  icon: typeof BookOpen;
  label: string;
  accent: string; // hex, used for left border + icon halo
}> = {
  Lecture:  { icon: BookOpen,  label: 'Lecture',  accent: '#3b82f6' },
  DPP:      { icon: FileText,  label: 'DPP',      accent: '#f97316' },
  Notes:    { icon: FileText,  label: 'Notes',    accent: '#22c55e' },
  Revision: { icon: BookOpen,  label: 'Revision', accent: '#a855f7' },
  Custom:   { icon: FileText,  label: 'Task',     accent: '#64748b' },
};

// Premium easing curves
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export function TargetCard({
  target,
  onOpenDetail,
  onEdit,
  onDelete,
  onDuplicate,
  indexInChapter,
  chapterTotal,
  hasSiblings,
}: Props) {
  const color = subjectColor(target.subject);
  const activityMeta = ACTIVITY_META[target.activity] || ACTIVITY_META.Custom;
  const ActivityIcon = activityMeta.icon;

  const active = useSession((s) => s.active);
  const startSession = useSession((s) => s.startSession);
  const pause = useSession((s) => s.pause);
  const resume = useSession((s) => s.resume);
  const toggleDone = useTargets();
  const deleteTarget = useTargets((s) => s.deleteTarget);
  const deleteSession = useHistory((s) => s.deleteSession);
  const haptics = useSettings((s) => s.haptics);
  const reduceAnimations = useSettings((s) => s.reduceAnimations);
  const animationIntensity = useSettings((s) => s.animationIntensity);

  const [celebrate, setCelebrate] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [justRestored, setJustRestored] = useState(false);

  const dragControls = useDragControls();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  // WASTING — periodic shake nonce (state, not remount key)
  const [shakeNonce, setShakeNonce] = useState(0);

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

  // Detect "background-paused" — when component mounts and finds active paused
  // session for this target, treat as background-paused for 10s
  useEffect(() => {
    if (isThisActive && active?.paused) {
      setJustRestored(true);
      const t = setTimeout(() => setJustRestored(false), 10000);
      return () => clearTimeout(t);
    } else {
      setJustRestored(false);
    }
  }, [isThisActive, active?.paused]);

  // Today's sessions for this target
  const allSessions = useHistory((s) => s.sessions);
  const sessions = useMemo(
    () => allSessions.filter((s) => s.targetId === target.id && s.date === target.date),
    [allSessions, target.id, target.date]
  );
  const studiedSec = sessions.reduce((a, s) => a + s.studySeconds, 0);
  const wastedSec = sessions.reduce((a, s) => a + s.wastedSeconds, 0);

  // All-time sessions for this target (for smart expected-time hint)
  const allTimeSessions = useMemo(
    () => allSessions.filter((s) => s.targetId === target.id),
    [allSessions, target.id]
  );

  // Smart expected-time hint: if avg studied > expected * 1.3 across 3+ sessions, suggest adjust
  const showAdjustHint = useMemo(() => {
    if (allTimeSessions.length < 3) return false;
    const avgStudied = allTimeSessions.reduce((a, s) => a + s.studySeconds, 0) / allTimeSessions.length;
    return avgStudied > target.expectedMinutes * 60 * 1.3;
  }, [allTimeSessions, target.expectedMinutes]);

  // Live ticking when this card is active
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isThisActive) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isThisActive]);

  // WASTING — periodic shake every 5s
  useEffect(() => {
    if (sessionState !== 'wasting' || reduceAnimations) return;
    const i = setInterval(() => {
      setShakeNonce((n) => n + 1);
    }, 5000);
    return () => clearInterval(i);
  }, [sessionState, reduceAnimations]);

  // === Quick Actions menu — lock body scroll while open ===
  // Prevents the page behind the backdrop from scrolling on touch / wheel.
  useEffect(() => {
    if (!showQuickActions) return;
    const prev = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [showQuickActions]);

  const liveStudied = isThisActive ? getLiveStudySeconds(active) : studiedSec;
  const liveWasted = isThisActive ? getLiveWastedSeconds(active) : wastedSec;
  const expectedSec = target.expectedMinutes * 60;
  const progressPct = expectedSec > 0 ? Math.min(100, Math.round((liveStudied / expectedSec) * 100)) : 0;
  const remainingSec = Math.max(0, expectedSec - liveStudied);
  const wastedOverThreshold = liveWasted >= 300; // 5 minutes

  // Find next-up sibling (same subject + chapter, not done, not this)
  const todayTargets = useTargets((s) => s.byDate[target.date] || []);
  const nextUpTarget = useMemo(() => {
    if (!target.done) return null;
    const siblings = todayTargets
      .filter((t) =>
        t.id !== target.id &&
        t.subject === target.subject &&
        t.chapter === target.chapter &&
        !t.done
      )
      .sort((a, b) => a.order - b.order);
    return siblings[0] || null;
  }, [todayTargets, target]);

  const handleStartPause = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (haptics) vibrate(12);
    if (target.done) {
      toggleDone.toggleDone(target.id);
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
  }, [haptics, target, isThisActive, active, toggleDone, resume, pause, startSession]);

  const handleDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (haptics) vibrate(15);
    setFlashGreen(true);
    setCelebrate(true);
    setTimeout(() => setFlashGreen(false), 500);
    setTimeout(() => setCelebrate(false), 700);
    toggleDone.toggleDone(target.id);
    playSound('done');
    if (!reduceAnimations) {
      import('@/components/shared/Effects').then(({ triggerParticleBurst }) => {
        triggerParticleBurst(e.clientX, e.clientY, color.hex);
      });
    }
    import('@/components/shared/Effects').then(({ triggerEffect }) => triggerEffect('small', 'chime'));
  }, [haptics, color.hex, reduceAnimations, toggleDone]);

  // Long-press handler — opens quick actions menu
  const handlePointerDownLong = useCallback((e: React.PointerEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressFired.current = false;
    (e.currentTarget as HTMLElement).dataset.pointerStart = '1';
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (haptics) vibrate([10, 20, 10]);
      setShowQuickActions(true);
    }, 450);
  }, [haptics]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const el = e.currentTarget as HTMLElement;
    if (!longPressFired.current && el.dataset.pointerStart === '1' && !el.dataset.dragged) {
      onOpenDetail();
    }
    delete el.dataset.pointerStart;
    delete el.dataset.dragged;
  }, [onOpenDetail]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Keyboard shortcuts (desktop only — when card is focused)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showQuickActions) return;
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        handleStartPause();
        break;
      case 'd':
      case 'D':
        if (!target.done) {
          e.preventDefault();
          handleDone({ stopPropagation: () => {}, clientX: 0, clientY: 0 } as any);
        }
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        onEdit();
        break;
    }
  }, [showQuickActions, handleStartPause, handleDone, target.done, onEdit]);

  // Quick action handlers
  const handleQuickEdit = () => { setShowQuickActions(false); onEdit(); };
  const handleQuickDuplicate = () => {
    setShowQuickActions(false);
    if (onDuplicate) onDuplicate();
    else if (haptics) vibrate(8);
  };
  const handleQuickReset = () => {
    setShowQuickActions(false);
    if (haptics) vibrate([10, 30, 10]);
    sessions.forEach((s) => deleteSession(s.id));
  };
  const handleQuickDelete = () => {
    setShowQuickActions(false);
    if (haptics) vibrate([10, 30, 50]);
    if (onDelete) onDelete();
    else deleteTarget(target.id);
  };

  // Status pill content
  const statusPill = sessionState === 'studying' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-500 text-white pulse-slow shadow flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-white" /> LIVE
    </span>
  ) : sessionState === 'paused' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow">
      {justRestored ? '⏸ BG PAUSED' : '⏸ PAUSED'}
    </span>
  ) : sessionState === 'wasting' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500 text-white pulse-fast shadow">⚠ WASTING</span>
  ) : null;

  // Breathing animation when studying (subtle scale 1 → 1.015 → 1)
  // Celebrate (1.03) takes priority over breathing
  const breathingScale = celebrate && !reduceAnimations
    ? 1.03
    : sessionState === 'studying' && !reduceAnimations
    ? [1, 1.015, 1]
    : 1;

  // Wasting shake — re-triggered every 5s via shakeNonce
  // We can't put it on the Reorder.Item itself (would remount), so we
  // render a child motion.div with key={shakeNonce} for the shake.

  // Determine if card should "settle" (dim + shrink) because another card is active
  const isSettled = isAnyActive && !target.done;

  return (
    <Reorder.Item
      value={target}
      data-card
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      initial={reduceAnimations ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: isSettled ? 0.55 : 1,
        y: 0,
        scale: breathingScale,
      }}
      whileDrag={{
        scale: 1.04,
        zIndex: 100,
        cursor: 'grabbing',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border, rgba(255,255,255,0.08))',
      }}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 35,
        mass: 0.6,
        // For breathing, use smoother timing
        ...(sessionState === 'studying' && !reduceAnimations
          ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          : {}),
        }}
      className={cn(
        'card-solid rounded-2xl relative overflow-hidden select-none cursor-pointer outline-none',
        sessionState === 'studying' && 'glow-pulse',
        sessionState === 'wasting' && 'glow-pulse',
        target.done && 'grayscale-[60%]',
        flashGreen && 'ring-2 ring-green-500',
        isFocused && 'ring-2 ring-white/40',
      )}
      style={{
        transitionProperty: 'border-color, box-shadow, background-color, filter',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease-out',
        willChange: 'transform',
        borderColor: flashGreen
          ? '#22c55e'
          : isThisActive
          ? active!.wasting
            ? '#ef4444'
            : active!.paused
            ? '#f59e0b'
            : color.hex
          : `${color.hex}55`,
        ['--glow-color' as string]: isThisActive
          ? active!.wasting
            ? 'rgba(239,68,68,0.5)'
            : active!.paused
            ? 'rgba(245,158,11,0.5)'
            : color.glow
          : 'transparent',
        boxShadow: isThisActive && !active!.paused && !active!.wasting
          ? `0 0 24px -4px ${color.hex}80, 0 4px 16px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.16)`
          : undefined,
        // Activity-color left border (#6) — 2px solid strip
        borderLeft: `2px solid ${activityMeta.accent}`,
      }}
      onPointerDown={handlePointerDownLong}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${target.topic} — ${activityMeta.label}. Press Space to start/pause, D to mark done, E to edit.`}
    >
      {/* Subject color tint overlay */}
      <div
        className="card-tint"
        style={{
          background: target.done
            ? `linear-gradient(135deg, ${color.hex}10, transparent)`
            : `linear-gradient(135deg, ${color.hex}28, ${color.hex}0a)`,
        }}
      />

      {/* === Sister-card indicator: filled/hollow dots on left edge === */}
      {hasSiblings && chapterTotal && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none z-[1]">
          {Array.from({ length: chapterTotal }, (_, i) => {
            const idx = i + 1;
            const isCurrent = idx === indexInChapter;
            // Mark dots as filled if their index is < current (heuristic: previous cards done)
            // True completion status would require sibling data; this is a visual hint
            const isFilled = isCurrent ? !target.done : idx < (indexInChapter ?? 0);
            return (
              <motion.div
                key={i}
                layout
                className={cn('w-1.5 h-1.5 rounded-full transition-all duration-300')}
                style={{
                  background: isFilled ? color.hex : 'transparent',
                  border: `1px solid ${color.hex}80`,
                  transform: isCurrent ? 'scale(1.4)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Done check badge — top right corner */}
      <AnimatePresence>
        {target.done && (
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="absolute top-2 right-2 z-[2] pointer-events-none"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.5)' }}
            >
              <Check size={12} strokeWidth={3} color="#fff" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content wrapper — wrapped in motion.div for periodic wasting shake.
          Using key={shakeNonce} on this inner div re-triggers the shake animation
          every 5s without remounting the parent Reorder.Item (which would lose state). */}
      <motion.div
        key={shakeNonce}
        animate={sessionState === 'wasting' && !reduceAnimations ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 }}
        transition={sessionState === 'wasting' && !reduceAnimations ? { duration: 0.4 } : {}}
        className="relative p-3 pl-3.5"
      >
        {/* Green flash on done celebration */}
        <AnimatePresence>
          {flashGreen && (
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 bg-green-500 pointer-events-none rounded-2xl"
            />
          )}
        </AnimatePresence>

        {/* === Row 1: Header — merged chip + expected + drag handle === */}
        <div className="flex items-center gap-1.5 mb-1.5 min-h-[28px]">
          {/* Activity icon — visual anchor (28px, gradient fill) */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${activityMeta.accent}30, ${activityMeta.accent}10)`,
              color: activityMeta.accent,
              border: `1px solid ${activityMeta.accent}40`,
              boxShadow: `inset 0 1px 0 ${activityMeta.accent}30`,
            }}
          >
            <ActivityIcon size={14} />
          </motion.div>

          {/* Merged chip: "Lec 12 · Lecture" or just activity label */}
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-md tabular shrink-0 flex items-center gap-1',
              target.done && 'opacity-60'
            )}
            style={{
              background: `${color.hex}20`,
              color: color.hex,
              border: `1px solid ${color.hex}30`,
            }}
          >
            {target.lecture && <span className="tabular">{target.lecture}</span>}
            {target.lecture && <span className="opacity-40">·</span>}
            <span>{activityMeta.label}</span>
          </span>

          {/* Status pill (LIVE / PAUSED / WASTING) — only when active */}
          {statusPill}

          {/* Smart adjust hint */}
          {showAdjustHint && !target.done && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 shrink-0"
              title={`You usually study longer than ${target.expectedMinutes}m on this. Update expected time?`}
            >
              <Sparkles size={9} /> adjust?
            </motion.span>
          )}

          <div className="flex-1" />

          {/* Expected time */}
          <span className="text-[10px] text-muted-foreground tabular flex items-center gap-0.5 shrink-0">
            <Clock size={10} />
            {target.expectedMinutes}m
          </span>

          {/* Drag handle — visible on hover/focus, expand on grab */}
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              if (haptics) vibrate(15);
              dragControls.start(e);
              const card = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement;
              if (card) card.dataset.dragged = '1';
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'ml-0.5 w-6 h-6 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground/70 hover:bg-foreground/10 active:scale-90 transition shrink-0 cursor-grab active:cursor-grabbing',
              !isHovered && !isFocused && 'opacity-40'
            )}
            style={{ touchAction: 'none' }}
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
        </div>

        {/* === Row 2: Title (topic name) === */}
        <div
          className={cn(
            'text-sm font-semibold mb-2 leading-snug pr-1',
            target.done && 'text-muted-foreground'
          )}
        >
          {target.topic}
        </div>

        {/* === Row 3: Modern progress bar with live shimmer === */}
        <div className="relative mb-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
          {/* Fill — gradient + spring-animated width */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: sessionState === 'wasting'
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
              boxShadow: `0 0 8px ${sessionState === 'wasting' ? 'rgba(239,68,68,0.6)' : color.glow}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{
              type: 'spring',
              stiffness: 120,
              damping: 20,
              mass: 0.8,
            }}
          >
            {/* Shimmer overlay — only when actively studying */}
            {sessionState === 'studying' && !reduceAnimations && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                }}
                animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </motion.div>

          {/* Percentage label — floating at right end of bar */}
          {(progressPct > 0 || isThisActive) && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold tabular text-foreground/85 z-[1]">
              {progressPct}%
            </span>
          )}

          {/* Status pill overlay on bar — only when active */}
          {isThisActive && (
            <div className="absolute -top-0.5 right-0 translate-y-[-100%] z-[2]">
              {statusPill}
            </div>
          )}
        </div>

        {/* === Row 4: Stats — studied / remaining / session dots + action buttons === */}
        <div className="flex items-center gap-2">
          {/* Studied time */}
          <span className="text-[11px] text-green-400 tabular flex items-center gap-0.5 font-medium">
            <Play size={9} fill="currentColor" />
            {formatHM(liveStudied)}
          </span>

          {/* Remaining or done indicator */}
          {target.done ? (
            <span className="text-[10px] text-green-400 font-semibold flex items-center gap-0.5">
              <Check size={10} strokeWidth={3} /> Done
            </span>
          ) : remainingSec > 0 ? (
            <span className="text-[10px] text-muted-foreground tabular">
              · {formatHM(remainingSec)} left
            </span>
          ) : null}

          {/* Wasted time — pulses red when >5min */}
          {liveWasted > 0 && (
            <motion.span
              animate={wastedOverThreshold && !reduceAnimations ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className={cn(
                'text-[10px] tabular flex items-center gap-0.5',
                wastedOverThreshold ? 'text-red-400 font-bold' : 'text-red-400/80'
              )}
              title={wastedOverThreshold ? 'Tap to note what distracted you' : undefined}
            >
              ⚠ {formatHM(liveWasted)}
            </motion.span>
          )}

          {/* Session dots — replaces "3 sessions" text */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-0.5" title={`${sessions.length} session${sessions.length === 1 ? '' : 's'} today`}>
              {Array.from({ length: Math.min(sessions.length, 5) }, (_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-1 h-1 rounded-full"
                  style={{ background: color.hex, opacity: 0.6 + i * 0.08 }}
                />
              ))}
              {sessions.length > 5 && (
                <span className="text-[8px] text-muted-foreground ml-0.5">+{sessions.length - 5}</span>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Start/Pause button */}
          <button
            onClick={handleStartPause}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isAnyActive || target.done}
            className={cn(
              'flex items-center justify-center rounded-lg transition active:scale-95 min-w-[32px] h-7 px-2',
              target.done
                ? 'bg-green-500/20 text-green-400'
                : isThisActive
                ? active!.wasting
                  ? 'bg-red-500 text-white pulse-fast'
                  : active!.paused
                  ? 'bg-amber-500 text-white'
                  : 'text-white pulse-slow'
                : isAnyActive
                ? 'bg-foreground/5 text-muted-foreground/60 cursor-not-allowed'
                : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
            )}
            style={
              !target.done && isThisActive && !active!.wasting && !active!.paused
                ? { background: color.hex, color: '#000' }
                : undefined
            }
            aria-label={isThisActive ? (active!.paused ? 'Resume' : 'Pause') : 'Start session'}
          >
            {target.done ? (
              <Check size={14} strokeWidth={3} />
            ) : isThisActive ? (
              active!.paused ? (
                <Play size={12} fill="currentColor" />
              ) : (
                <Pause size={12} fill="currentColor" />
              )
            ) : (
              <Play size={12} fill="currentColor" />
            )}
          </button>

          {/* Done button — marks target complete */}
          {!target.done && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDone}
              className="flex items-center justify-center rounded-lg transition active:scale-95 min-w-[28px] h-7 px-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25"
              aria-label="Mark as done"
              title="Mark as done"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </svg>
            </button>
          )}
        </div>

        {/* === Next-up hint footer — shown after done === */}
        <AnimatePresence>
          {target.done && nextUpTarget && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT_QUART }}
              className="overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (haptics) vibrate(10);
                  startSession({
                    targetId: nextUpTarget.id,
                    subject: nextUpTarget.subject,
                    chapter: nextUpTarget.chapter,
                    lecture: nextUpTarget.lecture,
                    topic: nextUpTarget.topic,
                    mode: 'focus',
                    expectedMinutes: nextUpTarget.expectedMinutes,
                  });
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition text-left"
              >
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Next up</span>
                <span className="text-[11px] text-foreground/85 font-medium truncate flex-1">{nextUpTarget.topic}</span>
                <ArrowRight size={11} className="text-muted-foreground shrink-0" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* === Quick Actions Menu — long-press to open ===
          Rendered as a centered modal (not absolute to the card) so:
          - All options are always visible regardless of card position
          - Delete (last item) is never cut off below the viewport
          - Backdrop locks body scroll (see useEffect above) */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            {/* Backdrop — dark + blur, closes on tap, blocks scroll */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm"
              onClick={() => setShowQuickActions(false)}
              onPointerDown={(e) => { e.stopPropagation(); setShowQuickActions(false); }}
              onTouchMove={(e) => e.preventDefault()}
              style={{ touchAction: 'none' }}
            />
            {/* Menu — centered on screen, max-height ensures scrollable if needed */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="fixed left-1/2 top-1/2 z-[10002] w-[260px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
              style={{
                background: 'var(--popover, rgba(20, 22, 30, 0.96))',
                backdropFilter: 'blur(16px)',
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Header — shows which target these actions apply to */}
              <div className="px-4 py-3 border-b border-foreground/10 sticky top-0" style={{ background: 'var(--popover, rgba(20, 22, 30, 0.96))' }}>
                <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Quick Actions</div>
                <div className="text-sm font-semibold text-foreground truncate mt-0.5">{target.topic}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {target.subject} · {target.chapter}
                </div>
              </div>

              {/* Action items */}
              <div className="py-1">
                <QuickActionItem icon={Pencil} label="Edit" onClick={handleQuickEdit} />
                <QuickActionItem icon={Copy} label="Duplicate" onClick={handleQuickDuplicate} />
                <QuickActionItem
                  icon={RotateCcw}
                  label="Reset today's progress"
                  onClick={handleQuickReset}
                />
                <div className="h-px bg-foreground/10 my-1" />
                <QuickActionItem icon={Trash2} label="Delete" onClick={handleQuickDelete} destructive />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

// ===== Quick Action Item — single row in the long-press menu =====
function QuickActionItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-medium transition hover:bg-foreground/10 active:bg-foreground/15',
        destructive ? 'text-red-500 dark:text-red-400 hover:bg-red-500/10' : 'text-foreground'
      )}
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
