'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Square, Clock, ChevronRight, AlertTriangle, Coffee,
  SkipForward, RotateCw, Pencil,
} from 'lucide-react';
import { useRoutine } from '@/lib/store/routine';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { useNav } from '@/lib/store/nav';
import { subjectColor } from '@/lib/colors';
import { cn, vibrate, formatHM, formatShort } from '@/lib/utils';
import type { RoutineBlock } from '@/lib/store/routine';
import type { Subject } from '@/lib/types';

interface Props {
  onEditRoutine?: () => void;
}

/**
 * CurrentBlockCard (REDESIGNED) — Smart Study Routine current block card.
 *
 * === Modernization plan implemented ===
 * 1. Day Timeline Strip — horizontal bar showing today's blocks + pulsing "now" line
 * 2. Big circular timer ring (64px) — replaces the thin linear bar
 * 3. Hero card with live glow when session is active
 * 4. "Live" chip with breathing dot (calm blue, not aggressive red)
 * 5. Status badges row — combines lateness + wasted + remaining
 * 6. Smart CTA — adapts to state (idle / live / wrong-subject)
 * 7. Next block preview card — recessed card at bottom
 * 8. Quick actions row — Skip / Snooze 15m / Edit
 *
 * Logic:
 * - Checks routine store for current block (based on day + hour)
 * - Shows progress through the block (elapsed / total)
 * - "Start Planned Session" pre-fills the timer with the block's subject/activity
 * - If studying a DIFFERENT subject than the current block → shows warning
 * - If no block active → shows "Free time" + next block preview + today's stats
 * - Skip marks block as skipped (visual only — adherence handles its own logic)
 * - Snooze 15m pushes the displayed start forward by 15 min (UI-only)
 */
export function CurrentBlockCard({ onEditRoutine }: Props) {
  const blocks = useRoutine((s) => s.blocks);
  const activeSession = useSession((s) => s.active);
  const startSession = useSession((s) => s.startSession);
  const pause = useSession((s) => s.pause);
  const stop = useSession((s) => s.stop);
  const gracePeriod = useSettings((s) => s.routineGracePeriod);
  const setTab = useNav((s) => s.setTab);

  // Tick every 30s to update progress + current block
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(i);
  }, []);

  // Local UI state: skipped-block ids + snooze minutes (per block id)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [snoozeMap, setSnoozeMap] = useState<Record<string, number>>({});

  const today = new Date().getDay();
  const todayBlocks = useMemo(
    () => blocks.filter((b) => b.day === today).sort((a, b) => a.startHour - b.startHour),
    [blocks, today]
  );

  const currentBlock = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    return (
      blocks.find(
        (b) => b.day === today && hour >= b.startHour && hour < b.endHour
      ) || null
    );
  }, [blocks, today]);

  const nextBlock = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const next = todayBlocks.find((b) => b.startHour > hour);
    if (next) return next;
    // Tomorrow's first block
    const tomorrow = (today + 1) % 7;
    return (
      blocks
        .filter((b) => b.day === tomorrow)
        .sort((a, b) => a.startHour - b.startHour)[0] || null
    );
  }, [blocks, todayBlocks, today]);

  // === Handlers ===
  const handleEditRoutine = useCallback(() => {
    vibrate(8);
    if (onEditRoutine) onEditRoutine();
    else setTab('settings');
  }, [onEditRoutine, setTab]);

  const handleStartPlanned = useCallback(() => {
    if (!currentBlock || currentBlock.type === 'break') return;
    vibrate(12);
    const activity =
      currentBlock.type === 'lecture' ? 'Lecture' :
      (currentBlock.allowedActivities && currentBlock.allowedActivities[0]) || 'Custom';
    startSession({
      targetId: null,
      subject: currentBlock.subject,
      chapter: 'Routine',
      topic: `${currentBlock.subject} ${activity}`,
      mode: 'focus',
      expectedMinutes: (currentBlock.endHour - currentBlock.startHour) * 60,
      plannedSlotId: currentBlock.id,
    });
  }, [currentBlock, startSession]);

  const handleSkip = useCallback(() => {
    if (!currentBlock) return;
    vibrate(15);
    setSkippedIds((s) => new Set(s).add(currentBlock.id));
  }, [currentBlock]);

  const handleSnooze = useCallback(() => {
    if (!currentBlock) return;
    vibrate(10);
    setSnoozeMap((m) => ({ ...m, [currentBlock.id]: (m[currentBlock.id] || 0) + 15 }));
  }, [currentBlock]);

  // === RENDER ===
  // Free time state
  if (!currentBlock) {
    return (
      <FreeTimeCard
        todayBlocks={todayBlocks}
        nextBlock={nextBlock}
        onEditRoutine={handleEditRoutine}
      />
    );
  }

  // Skipped state
  if (skippedIds.has(currentBlock.id)) {
    return (
      <SkippedCard
        block={currentBlock}
        nextBlock={nextBlock}
        onEditRoutine={handleEditRoutine}
        onUnskip={() => {
          vibrate(8);
          setSkippedIds((s) => {
            const n = new Set(s);
            n.delete(currentBlock.id);
            return n;
          });
        }}
      />
    );
  }

  // Break block
  if (currentBlock.type === 'break') {
    return (
      <BreakCard
        block={currentBlock}
        nextBlock={nextBlock}
        onEditRoutine={handleEditRoutine}
      />
    );
  }

  // Study block (lecture or self-study)
  const color = subjectColor(currentBlock.subject);
  const now = new Date();
  const snoozeMin = snoozeMap[currentBlock.id] || 0;
  const effectiveStart = currentBlock.startHour + snoozeMin / 60;
  const elapsedMin = Math.max(0, (now.getHours() - effectiveStart) * 60 + now.getMinutes());
  const totalMin = (currentBlock.endHour - currentBlock.startHour) * 60;
  const remainingMin = Math.max(0, totalMin - elapsedMin);
  const progressPct = Math.min(100, Math.round((elapsedMin / totalMin) * 100));

  // Lateness
  const blockStartMs = new Date().setHours(currentBlock.startHour + snoozeMin / 60, 0, 0, 0);
  const sessionStartMin = activeSession
    ? Math.floor((activeSession.startedAt - blockStartMs) / 60000)
    : null;
  const latenessMin = sessionStartMin !== null ? Math.max(0, sessionStartMin) : null;
  const onTime = latenessMin !== null && latenessMin <= gracePeriod;
  const isLate = latenessMin !== null && latenessMin > gracePeriod && latenessMin <= 30;
  const isVeryLate = latenessMin !== null && latenessMin > 30;

  const blockLabel = currentBlock.type === 'lecture'
    ? 'Lecture'
    : currentBlock.allowedActivities && currentBlock.allowedActivities.length > 0
    ? currentBlock.allowedActivities.join(' / ')
    : 'Self Study';

  const isLive = !!(activeSession && activeSession.plannedSlotId === currentBlock.id);
  // At this point currentBlock is a study block (break was returned earlier),
  // so any active session with a different subject is "wrong subject".
  const isWrongSubject = !!(activeSession && !isLive &&
    activeSession.subject !== currentBlock.subject);

  // Live study/wasted seconds
  const liveStudySec = isLive ? getLiveStudySeconds(activeSession) : 0;
  const liveWastedSec = isLive ? getLiveWastedSeconds(activeSession) : 0;

  // Ring math
  const ringRadius = 27;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDash = ringCirc - (ringCirc * progressPct) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-3.5 relative overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${color.hex}14 0%, ${color.hex}05 60%, transparent 100%)`,
        border: `1px solid ${isLive ? color.hex : `${color.hex}50`}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: isLive
          ? `0 0 0 1px ${color.hex}55, 0 12px 32px -8px ${color.glow}`
          : `0 4px 12px -4px ${color.hex}20`,
      }}
    >
      {/* Active radial glow */}
      {isLive && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-40%', right: '-10%',
            width: '60%', height: '80%',
            background: `radial-gradient(ellipse, ${color.hex}30 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative space-y-3">
        {/* === DAY TIMELINE STRIP === */}
        <DayTimeline
          todayBlocks={todayBlocks}
          currentBlockId={currentBlock.id}
          skippedIds={skippedIds}
          color={color.hex}
        />

        {/* === HEADER ROW: ring + block info === */}
        <div className="flex items-center gap-3">
          {/* Big circular timer ring */}
          <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r={ringRadius} fill="none"
                      stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="5" />
              <motion.circle
                cx="32" cy="32" r={ringRadius} fill="none"
                stroke={color.hex} strokeWidth="5" strokeLinecap="round"
                initial={false}
                animate={{ strokeDashoffset: ringDash }}
                transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                style={{
                  strokeDasharray: ringCirc,
                  filter: `drop-shadow(0 0 ${isLive ? 6 : 4}px ${color.hex}90)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <motion.span
                key={remainingMin}
                initial={{ scale: 0.85, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="text-[17px] font-black tabular-nums"
                style={{ color: 'var(--foreground)' }}
                suppressHydrationWarning
              >
                {remainingMin}m
              </motion.span>
              <span className="text-[8px] font-bold uppercase tracking-[0.6px] mt-0.5"
                    style={{ color: 'var(--muted-foreground)' }}>
                left
              </span>
            </div>
          </div>

          {/* Block info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[9px] font-extrabold uppercase tracking-[1.4px] leading-none"
                style={{ color: color.hex }}
              >
                {currentBlock.subject} · {blockLabel}
              </span>
              {isLive && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[8.5px] font-bold uppercase tracking-[0.6px]"
                  style={{
                    background: `${color.hex}26`,
                    border: `1px solid ${color.hex}66`,
                    color: color.hex,
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: color.hex,
                      boxShadow: `0 0 5px ${color.hex}`,
                      animation: 'pulse-soft 1.6s ease-in-out infinite',
                    }}
                  />
                  Live
                </span>
              )}
            </div>
            <div className="text-[13px] font-bold mt-1.5 truncate" style={{ color: 'var(--foreground)' }}>
              {currentBlock.subject} {blockLabel}
            </div>
            <div
              className="text-[10px] mt-1 flex items-center gap-1 tabular-nums"
              style={{ color: 'var(--muted-foreground)' }}
              suppressHydrationWarning
            >
              <Clock size={10} style={{ color: 'var(--muted-foreground)' }} />
              <span>
                {formatHour(currentBlock.startHour)} → {formatHour(currentBlock.endHour)}
                {snoozeMin > 0 && <span style={{ color: '#f59e0b' }}> · snoozed +{snoozeMin}m</span>}
              </span>
            </div>
          </div>
        </div>

        {/* === STATUS BADGES ROW === */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Lateness badge (only if live) */}
          {isLive && latenessMin !== null && latenessMin > 0 && (
            <StatusBadge
              tone={onTime ? 'green' : isLate ? 'amber' : 'red'}
              dot
              label={onTime ? 'On time' : `${latenessMin} min late`}
            />
          )}
          {isLive && latenessMin !== null && latenessMin === 0 && (
            <StatusBadge tone="green" dot label="Started on time" />
          )}
          {/* Wasted badge */}
          {isLive && liveWastedSec > 0 && (
            <StatusBadge
              tone="red"
              label={`⚠ ${formatShort(liveWastedSec)} wasted`}
            />
          )}
          {/* Remaining/studied badge */}
          <StatusBadge
            tone="muted"
            label={isLive
              ? `${formatShort(liveStudySec)} studied · ${remainingMin}m left`
              : `${formatShort(elapsedMin * 60)} elapsed · ${remainingMin}m left`
            }
          />
        </div>

        {/* === WRONG-SUBJECT WARNING + CTA === */}
        <AnimatePresence mode="wait">
          {isWrongSubject ? (
            <motion.div
              key="wrong-subj"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="space-y-1.5"
            >
              <div
                className="flex items-center gap-1.5 text-[10px] py-1.5 px-2 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}
              >
                <AlertTriangle size={11} className="shrink-0" />
                <span className="leading-tight">
                  Planned: <strong>{currentBlock.subject}</strong>. You're doing <strong>{activeSession!.subject}</strong>.
                </span>
              </div>
              <button
                onClick={handleStartPlanned}
                className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`,
                  boxShadow: `0 4px 12px -2px ${color.glow}`,
                }}
              >
                <Play size={12} fill="#fff" strokeWidth={0} />
                Switch to planned: {currentBlock.subject}
              </button>
            </motion.div>
          ) : !isLive ? (
            <motion.button
              key="start"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={handleStartPlanned}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5"
              style={{
                background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`,
                boxShadow: `0 4px 12px -2px ${color.glow}`,
              }}
            >
              <Play size={12} fill="#fff" strokeWidth={0} />
              Start {currentBlock.subject} {currentBlock.type === 'lecture' ? 'Lecture' : 'Session'}
            </motion.button>
          ) : (
            <motion.div
              key="live-cta"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex gap-2"
            >
              <button
                onClick={() => { vibrate(12); pause(); }}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  boxShadow: '0 4px 12px -2px rgba(245,158,11,0.45)',
                }}
              >
                <Pause size={12} fill="#fff" strokeWidth={0} />
                Pause
              </button>
              <button
                onClick={() => { vibrate(15); stop(); }}
                className="px-4 py-2.5 rounded-xl text-[12px] font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.40)',
                }}
              >
                <Square size={11} fill="currentColor" />
                Stop
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === NEXT BLOCK PREVIEW === */}
        {nextBlock && (
          <NextBlockPreview block={nextBlock} />
        )}

        {/* === QUICK ACTIONS ROW === */}
        <div
          className="flex items-center gap-1.5 pt-2.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <QuickActionButton
            icon={<SkipForward size={11} />}
            label="Skip"
            onClick={handleSkip}
          />
          <QuickActionButton
            icon={<RotateCw size={11} />}
            label="Snooze 15m"
            onClick={handleSnooze}
            disabled={isLive}
          />
          <QuickActionButton
            icon={<Pencil size={11} />}
            label="Edit"
            onClick={handleEditRoutine}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   Day Timeline Strip — horizontal bar showing today's blocks + "now" line
   ========================================================================= */
function DayTimeline({
  todayBlocks, currentBlockId, skippedIds, color,
}: {
  todayBlocks: RoutineBlock[];
  currentBlockId: string;
  skippedIds: Set<string>;
  color: string;
}) {
  // Window: 6 AM to 12 AM (18 hours). Blocks outside this window are clipped.
  const windowStart = 6;
  const windowEnd = 24;
  const windowHours = windowEnd - windowStart;

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowPct = ((nowHour - windowStart) / windowHours) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.8px]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Today's plan
        </span>
        <span
          className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
          style={{
            background: 'var(--muted)',
            color: 'var(--foreground)',
          }}
          suppressHydrationWarning
        >
          {formatHour(now.getHours())} now
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full overflow-hidden"
        style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}
      >
        {todayBlocks.map((b) => {
          const startPct = ((b.startHour - windowStart) / windowHours) * 100;
          const widthPct = ((b.endHour - b.startHour) / windowHours) * 100;
          if (startPct >= 100 || startPct + widthPct <= 0) return null;
          const subjColor = b.type === 'break' ? null : subjectColor(b.subject);
          const isCurrent = b.id === currentBlockId;
          const isSkipped = skippedIds.has(b.id);
          return (
            <div
              key={b.id}
              className="absolute top-0 bottom-0 rounded-sm transition-all"
              style={{
                left: `${Math.max(0, startPct)}%`,
                width: `${Math.min(100 - Math.max(0, startPct), widthPct)}%`,
                background: b.type === 'break'
                  ? 'repeating-linear-gradient(45deg, rgba(148,163,184,0.30) 0 3px, transparent 3px 6px)'
                  : isSkipped
                  ? 'repeating-linear-gradient(45deg, rgba(239,68,68,0.30) 0 3px, transparent 3px 6px)'
                  : `linear-gradient(90deg, ${subjColor!.hex}, ${subjColor!.hex}aa)`,
                boxShadow: isCurrent ? `0 0 0 1.5px var(--background), 0 0 0 2.5px ${subjColor?.hex || '#94a3b8'}, 0 0 8px ${subjColor?.hex || '#94a3b8'}80` : 'none',
                opacity: isSkipped ? 0.5 : 1,
              }}
              title={`${b.subject} ${b.type} · ${formatHour(b.startHour)}–${formatHour(b.endHour)}${isSkipped ? ' (skipped)' : ''}`}
            />
          );
        })}
        {/* Now line */}
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="absolute top-[-3px] bottom-[-3px] z-10"
            style={{
              left: `${nowPct}%`,
              width: 2,
              background: 'var(--foreground)',
              boxShadow: '0 0 6px var(--foreground), 0 0 12px rgba(255,255,255,0.4)',
              borderRadius: 1,
            }}
          >
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{
                background: 'var(--foreground)',
                boxShadow: '0 0 8px var(--foreground)',
                animation: 'pulse-soft 1.6s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </div>
      <div className="flex justify-between text-[8px] mt-1 tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  );
}

/* =========================================================================
   Status Badge — colored pill with optional dot
   ========================================================================= */
function StatusBadge({
  tone, label, dot,
}: {
  tone: 'green' | 'amber' | 'red' | 'muted';
  label: string;
  dot?: boolean;
}) {
  const styles = {
    green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: '#4ade80', dot: '#4ade80' },
    amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: '#fbbf24', dot: '#fbbf24' },
    red:   { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', color: '#f87171', dot: '#f87171' },
    muted: { bg: 'var(--muted)', border: 'var(--border)', color: 'var(--muted-foreground)', dot: 'var(--muted-foreground)' },
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
      }}
    >
      {dot && (
        <span
          className="w-1 h-1 rounded-full shrink-0"
          style={{ background: styles.dot, boxShadow: tone !== 'muted' ? `0 0 4px ${styles.dot}` : 'none' }}
        />
      )}
      {label}
    </span>
  );
}

/* =========================================================================
   Next Block Preview — recessed card at the bottom
   ========================================================================= */
function NextBlockPreview({ block }: { block: RoutineBlock }) {
  const color = block.type === 'break' ? null : subjectColor(block.subject);
  const label = block.type === 'lecture'
    ? 'Lecture'
    : block.type === 'break'
    ? 'Break'
    : block.allowedActivities && block.allowedActivities.length > 0
    ? block.allowedActivities.join(' / ')
    : 'Self Study';

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{
        background: 'color-mix(in oklch, var(--background) 50%, transparent)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="w-1 h-7 rounded-full shrink-0"
        style={{ background: color?.hex || '#94a3b8' }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-[8.5px] font-bold uppercase tracking-[0.6px]"
          style={{ color: 'var(--muted-foreground)' }}
          suppressHydrationWarning
        >
          Next at {formatHour(block.startHour)}
        </div>
        <div className="text-[11px] font-bold truncate" style={{ color: color?.hex || 'var(--foreground)' }}>
          {block.type === 'break' ? 'Break' : block.subject} · {label}
        </div>
        <div className="text-[9px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
          {(block.endHour - block.startHour)}h {block.type === 'break' ? '· take a rest' : '· planned'}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
    </div>
  );
}

/* =========================================================================
   Quick Action Button
   ========================================================================= */
function QuickActionButton({
  icon, label, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition active:scale-95',
        disabled && 'opacity-40'
      )}
      style={{
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        color: 'var(--muted-foreground)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* =========================================================================
   Free Time Card — coffee emoji + today's stats + next preview
   ========================================================================= */
function FreeTimeCard({
  todayBlocks, nextBlock, onEditRoutine,
}: {
  todayBlocks: RoutineBlock[];
  nextBlock: RoutineBlock | null;
  onEditRoutine: () => void;
}) {
  // Today's stats
  const now = new Date();
  const hour = now.getHours();
  const today = now.getDay();
  const pastBlocks = todayBlocks.filter((b) => b.endHour <= hour);
  const upcomingBlocks = todayBlocks.filter((b) => b.startHour > hour);
  const plannedHours = todayBlocks
    .filter((b) => b.type !== 'break')
    .reduce((a, b) => a + (b.endHour - b.startHour), 0);
  const doneHours = pastBlocks
    .filter((b) => b.type !== 'break')
    .reduce((a, b) => a + (b.endHour - b.startHour), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(148,163,184,0.08) 0%, transparent 60%)',
        border: '1px solid rgba(148,163,184,0.20)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="relative space-y-3">
        {/* Day timeline */}
        <DayTimeline
          todayBlocks={todayBlocks}
          currentBlockId=""
          skippedIds={new Set()}
          color="#94a3b8"
        />

        {/* Free hero */}
        <div className="text-center py-1">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-3xl mb-1.5 inline-block"
          >
            ☕
          </motion.div>
          <div className="text-[14px] font-bold" style={{ color: 'var(--foreground)' }}>
            Free time
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            No scheduled block right now
          </div>
        </div>

        {/* Stats */}
        <div
          className="flex justify-around py-2"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="text-center">
            <div className="text-[17px] font-black tabular-nums" style={{ color: 'var(--foreground)' }}>
              {doneHours}h
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Done today
            </div>
          </div>
          <div className="text-center">
            <div className="text-[17px] font-black tabular-nums" style={{ color: 'var(--foreground)' }}>
              {plannedHours - doneHours}h
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Planned left
            </div>
          </div>
          <div className="text-center">
            <div className="text-[17px] font-black tabular-nums" style={{ color: 'var(--foreground)' }}>
              {upcomingBlocks.length}
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Blocks left
            </div>
          </div>
        </div>

        {/* Next preview */}
        {nextBlock && <NextBlockPreview block={nextBlock} />}

        {/* Quick actions */}
        <div
          className="flex items-center gap-1.5 pt-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <QuickActionButton
            icon={<Play size={11} />}
            label="Free study"
            onClick={() => { vibrate(12); /* Navigate to FAB or start free */ }}
          />
          <QuickActionButton
            icon={<Clock size={11} />}
            label="Browse"
            onClick={onEditRoutine}
          />
          <QuickActionButton
            icon={<Pencil size={11} />}
            label="Edit"
            onClick={onEditRoutine}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   Break Card — break time design
   ========================================================================= */
function BreakCard({
  block, nextBlock, onEditRoutine,
}: {
  block: RoutineBlock;
  nextBlock: RoutineBlock | null;
  onEditRoutine: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.03) 60%, transparent 100%)',
        border: '1px solid rgba(34,197,94,0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(34,197,94,0.18)', boxShadow: '0 0 0 1px rgba(34,197,94,0.30)' }}
            >
              <Coffee size={16} className="text-green-500" />
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-green-600 dark:text-green-400 leading-none">
                Break time
              </div>
              <div className="text-[13px] font-bold mt-1" style={{ color: 'var(--foreground)' }}>
                {formatHour(block.startHour)} → {formatHour(block.endHour)}
              </div>
              <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
                {block.endHour - block.startHour} hour{(block.endHour - block.startHour) > 1 ? 's' : ''} · excluded from adherence
              </div>
            </div>
          </div>
          <button
            onClick={onEditRoutine}
            className="w-7 h-7 rounded-md flex items-center justify-center transition active:scale-90"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
            aria-label="Edit routine"
          >
            <Pencil size={12} />
          </button>
        </div>

        <div className="text-[11px] py-2 px-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', color: 'var(--muted-foreground)' }}>
          Take a break. Stretch, hydrate, rest your eyes. Breaks don't count against your schedule adherence.
        </div>

        {nextBlock && <NextBlockPreview block={nextBlock} />}
      </div>
    </motion.div>
  );
}

/* =========================================================================
   Skipped Card — shown when user skips the current block
   ========================================================================= */
function SkippedCard({
  block, nextBlock, onEditRoutine, onUnskip,
}: {
  block: RoutineBlock;
  nextBlock: RoutineBlock | null;
  onEditRoutine: () => void;
  onUnskip: () => void;
}) {
  const color = block.type === 'break' ? null : subjectColor(block.subject);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.04) 0 8px, transparent 8px 16px), linear-gradient(135deg, rgba(239,68,68,0.06) 0%, transparent 60%)',
        border: '1px solid rgba(239,68,68,0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', boxShadow: '0 0 0 1px rgba(239,68,68,0.30)' }}
          >
            <SkipForward size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-red-500 leading-none">
              Skipped
            </div>
            <div className="text-[13px] font-bold mt-1" style={{ color: 'var(--foreground)' }}>
              {block.subject} {block.type === 'lecture' ? 'Lecture' : 'Self Study'}
            </div>
            <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
              {formatHour(block.startHour)} → {formatHour(block.endHour)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onUnskip}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95"
            style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            Undo skip
          </button>
          <button
            onClick={onEditRoutine}
            className="px-4 py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95"
            style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
            }}
          >
            <Pencil size={12} />
          </button>
        </div>

        {nextBlock && <NextBlockPreview block={nextBlock} />}
      </div>
    </motion.div>
  );
}

/* === Helpers === */
function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}
