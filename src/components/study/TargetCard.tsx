'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Play, Pause, Check, CheckCircle2, Clock, MoreVertical, GripVertical, BookOpen, FileText } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useTargets } from '@/lib/store/targets';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import type { Target, ActivityType } from '@/lib/types';
import { cn, formatHM, vibrate } from '@/lib/utils';
import { playSound } from '@/lib/sounds';
import { LiquidProgress } from '@/components/shared/LiquidProgress';

interface Props {
  target: Target;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  /**
   * Index of this card within its chapter group (1-based).
   * Used for the "sister card" indicator — shows "1/3", "2/3" etc. when
   * multiple cards share the same subject + chapter.
   */
  indexInChapter?: number;
  /** Total cards in this chapter group. */
  chapterTotal?: number;
  /** Whether this card has at least one sibling in the same chapter. */
  hasSiblings?: boolean;
}

// Activity-specific icon + tint — makes it easy to tell a Lecture apart from
// a DPP / Notes / Revision card at a glance, even when they share a subject.
const ACTIVITY_META: Record<ActivityType, { icon: typeof BookOpen; label: string }> = {
  Lecture:  { icon: BookOpen,  label: 'Lecture' },
  DPP:      { icon: FileText,  label: 'DPP' },
  Notes:    { icon: FileText,  label: 'Notes' },
  Revision: { icon: BookOpen,  label: 'Revision' },
  Custom:   { icon: FileText,  label: 'Task' },
};

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
  const haptics = useSettings((s) => s.haptics);
  const reduceAnimations = useSettings((s) => s.reduceAnimations);
  const animationIntensity = useSettings((s) => s.animationIntensity);
  const [celebrate, setCelebrate] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);

  // Drag controls — a dedicated drag handle (GripVertical) starts the drag.
  // This is more reliable than long-press on mobile + doesn't conflict with
  // tap-to-open-detail. The handle calls dragControls.start(e) on pointerdown;
  // Reorder.Item reads `dragListener={false}` + `dragControls={dragControls}`.
  const dragControls = useDragControls();

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

  // Today's sessions for this target
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
  const remainingSec = Math.max(0, expectedSec - liveStudied);

  const handleStartPause = (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  // Status pill content for the active session state
  const statusPill = sessionState === 'studying' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-500 text-white pulse-slow shadow flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-white" /> LIVE
    </span>
  ) : sessionState === 'paused' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow">⏸ PAUSED</span>
  ) : sessionState === 'wasting' ? (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500 text-white pulse-fast shadow">⚠ WASTING</span>
  ) : null;

  return (
    <Reorder.Item
      value={target}
      data-card
      layout
      dragListener={false}
      dragControls={dragControls}
      initial={reduceAnimations ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: celebrate && !reduceAnimations ? 1.02 : 1,
      }}
      whileDrag={
        reduceAnimations
          ? { zIndex: 50, cursor: 'grabbing' }
          : {
              scale: 1.03,
              y: -2,
              zIndex: 50,
              cursor: 'grabbing',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            }
      }
      dragTransition={
        reduceAnimations
          ? { bounceStiffness: 1000, bounceDamping: 100 }
          : { bounceStiffness: 500, bounceDamping: 35 }
      }
      transition={
        reduceAnimations
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 400 + (animationIntensity / 100) * 200,
              damping: 45 - (animationIntensity / 100) * 20,
              mass: 0.8,
            }
      }
      className={cn(
        'card-solid rounded-2xl relative overflow-hidden select-none',
        // Tap opens detail; drag handle is separate
        'cursor-pointer',
        sessionState === 'studying' && 'glow-pulse',
        sessionState === 'wasting' && 'glow-pulse',
        target.done && 'opacity-65',
        flashGreen && 'ring-2 ring-green-500',
      )}
      style={{
        transitionProperty: 'border-color, box-shadow, background-color',
        transitionDuration: '250ms',
        transitionTimingFunction: 'ease-out',
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
      }}
      onPointerDown={(e) => {
        // Tap to open detail — but only if the pointer didn't start on the
        // drag handle (the handle stops propagation in its own onPointerDown).
        // We defer the "was this a tap?" decision to onPointerUp.
        (e.currentTarget as HTMLElement).dataset.pointerStart = '1';
      }}
      onPointerUp={(e) => {
        const el = e.currentTarget as HTMLElement;
        if (el.dataset.pointerStart === '1' && !el.dataset.dragged) {
          onOpenDetail();
        }
        delete el.dataset.pointerStart;
        delete el.dataset.dragged;
      }}
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

      {/* === Sister-card indicator: left-edge "depth" bar ===
          When multiple cards share the same subject+chapter, show a colored
          vertical bar on the left edge with a small "1/3" badge so the user
          can tell at a glance which card is which within the group. */}
      {hasSiblings && (
        <div
          className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ width: 4, background: color.hex, opacity: 0.6 }}
        >
          <span
            className="absolute left-1 top-1.5 text-[8px] font-bold tabular px-1 py-0.5 rounded-sm"
            style={{ background: `${color.hex}30`, color: color.hex }}
          >
            {indexInChapter}/{chapterTotal}
          </span>
        </div>
      )}

      {/* Content wrapper */}
      <div className="relative p-3 pl-3.5">
        {/* Green flash on done celebration */}
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

        {/* === Row 1: Header — activity icon + lecture tag + activity badge + status pill === */}
        <div className="flex items-center gap-1.5 mb-1.5 min-h-[24px]">
          {/* Activity icon — color-coded by subject, shape-coded by activity */}
          <div
            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: `${color.hex}22`, color: color.hex }}
          >
            <ActivityIcon size={12} />
          </div>

          {/* Lecture tag (e.g. "Lec 12") — only for Lecture activity */}
          {target.lecture && (
            <span
              className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded tabular shrink-0',
                target.done && 'line-through opacity-60'
              )}
              style={{ background: `${color.hex}25`, color: color.hex, border: `1px solid ${color.hex}40` }}
            >
              {target.lecture}
            </span>
          )}

          {/* Activity badge — DPP / Notes / Revision / Custom */}
          <span
            className={cn(
              'text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0',
              target.done && 'line-through opacity-60'
            )}
            style={{ background: 'rgba(255,255,255,0.10)', color: 'inherit' }}
          >
            {activityMeta.label}
          </span>

          {/* Status pill (LIVE / PAUSED / WASTING) — only when active */}
          {statusPill}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Expected time — compact */}
          <span className="text-[10px] text-white/55 tabular flex items-center gap-0.5 shrink-0">
            <Clock size={10} />
            {target.expectedMinutes}m
          </span>

          {/* Drag handle — dedicated, calls dragControls.start on pointerdown */}
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              if (haptics) vibrate(15);
              dragControls.start(e);
              // Mark card as "being dragged" so onPointerUp doesn't open detail
              const card = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement;
              if (card) card.dataset.dragged = '1';
            }}
            onClick={(e) => e.stopPropagation()}
            className="ml-1 w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 active:scale-90 transition shrink-0 cursor-grab active:cursor-grabbing"
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
            target.done && 'line-through text-white/55'
          )}
        >
          {target.topic}
        </div>

        {/* === Row 3: Liquid progress bar === */}
        <LiquidProgress
          pct={progressPct}
          color={sessionState === 'wasting' ? '#ef4444' : color.hex}
          color2={sessionState === 'wasting' ? '#ef4444aa' : `${color.hex}aa`}
          className="mb-2"
          height="h-1.5"
        />

        {/* === Row 4: Stats — studied / remaining / sessions + action buttons === */}
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
            <span className="text-[10px] text-white/45 tabular">
              · {formatHM(remainingSec)} left
            </span>
          ) : null}

          {/* Wasted time (if any) */}
          {liveWasted > 0 && (
            <span className="text-[10px] text-red-400 tabular">⚠ {formatHM(liveWasted)}</span>
          )}

          {/* Session count */}
          {sessions.length > 0 && (
            <span className="text-[10px] text-white/40 tabular">
              · {sessions.length}{sessions.length === 1 ? ' session' : ' sessions'}
            </span>
          )}

          {/* Spacer */}
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
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white hover:bg-white/20'
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
              onClick={(e) => {
                e.stopPropagation();
                if (haptics) vibrate(15);
                setFlashGreen(true);
                setCelebrate(true);
                setTimeout(() => setFlashGreen(false), 400);
                setTimeout(() => setCelebrate(false), 600);
                toggleDone.toggleDone(target.id);
                playSound('done');
                if (!reduceAnimations) {
                  import('@/components/shared/Effects').then(({ triggerParticleBurst }) => {
                    triggerParticleBurst(e.clientX, e.clientY, color.hex);
                  });
                }
                import('@/components/shared/Effects').then(({ triggerEffect }) => triggerEffect('small', 'chime'));
              }}
              className="flex items-center justify-center rounded-lg transition active:scale-95 min-w-[28px] h-7 px-1.5 bg-green-500/15 text-green-400 hover:bg-green-500/25"
              aria-label="Mark as done"
              title="Mark as done"
            >
              {/* Animated checkmark — SVG path draws itself on tap */}
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
      </div>
    </Reorder.Item>
  );
}
