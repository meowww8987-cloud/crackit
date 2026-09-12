'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, ChevronRight, Edit3, AlertTriangle, Coffee } from 'lucide-react';
import { useRoutine } from '@/lib/store/routine';
import { useSession } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { cn, vibrate, formatHM } from '@/lib/utils';

interface Props {
  onEditRoutine?: () => void;
}

/**
 * CurrentBlockCard — shows the current routine block + "Start Planned Session" button.
 *
 * Placed on the Study tab (after daily target cards).
 *
 * Logic:
 * - Checks the routine store for the current block (based on day + hour)
 * - Shows progress through the block (elapsed / total)
 * - "Start Planned Session" pre-fills the timer with the block's subject/activity
 * - If studying a DIFFERENT subject than the current block → shows warning
 * - If no block active → shows "Free time" + next block preview
 * - ✏️ edit icon opens the Routine Builder
 */
export function CurrentBlockCard({ onEditRoutine }: Props) {
  const blocks = useRoutine((s) => s.blocks);
  const activeSession = useSession((s) => s.active);
  const startSession = useSession((s) => s.startSession);
  const gracePeriod = useSettings((s) => s.routineGracePeriod);

  // Tick every 30s to update progress + current block
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const currentBlock = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const today = now.getDay();
    return (
      blocks.find(
        (b) => b.day === today && hour >= b.startHour && hour < b.endHour
      ) || null
    );
  }, [blocks]);

  const nextBlock = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const today = now.getDay();
    const todayBlocks = blocks
      .filter((b) => b.day === today)
      .sort((a, b) => a.startHour - b.startHour);
    const next = todayBlocks.find((b) => b.startHour > hour);
    if (next) return next;
    // Tomorrow's first block
    const tomorrow = (today + 1) % 7;
    return (
      blocks
        .filter((b) => b.day === tomorrow)
        .sort((a, b) => a.startHour - b.startHour)[0] || null
    );
  }, [blocks]);

  // Wrong-subject warning: active session subject ≠ current block subject
  const isWrongSubject =
    !!(activeSession && currentBlock && currentBlock.type !== 'break' &&
    activeSession.subject !== currentBlock.subject);

  const handleStartPlanned = () => {
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
  };

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
  };

  if (!currentBlock) {
    // No active block — show free time + next up
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 relative overflow-hidden"
        style={{ borderColor: 'var(--border-card)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coffee size={18} className="text-muted-foreground" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Free time
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                No scheduled block
              </div>
            </div>
          </div>
          {onEditRoutine && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(8); onEditRoutine(); }}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
              aria-label="Edit routine"
            >
              <Edit3 size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
        {nextBlock ? (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            <Clock size={11} />
            <span>Next: <span className="font-semibold" style={{ color: subjectColor(nextBlock.subject).hex }}>
              {nextBlock.subject}
            </span> {nextBlock.type === 'lecture' ? 'Lecture' : nextBlock.type === 'break' ? 'Break' : 'Self Study'} at {formatHour(nextBlock.startHour)}</span>
          </div>
        ) : (
          <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            No blocks scheduled. Tap ✏️ to create your routine.
          </div>
        )}
      </motion.div>
    );
  }

  // Break block
  if (currentBlock.type === 'break') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 relative overflow-hidden"
        style={{ borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coffee size={18} className="text-green-500" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-green-600 dark:text-green-400">
                Break time
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {formatHour(currentBlock.startHour)} → {formatHour(currentBlock.endHour)}
              </div>
            </div>
          </div>
          {onEditRoutine && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(8); onEditRoutine(); }}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
              aria-label="Edit routine"
            >
              <Edit3 size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          Take a break. Breaks are excluded from your schedule adherence.
        </div>
      </motion.div>
    );
  }

  // Study block (lecture or self-study)
  const color = subjectColor(currentBlock.subject);
  const now = new Date();
  const elapsedMin = (now.getHours() - currentBlock.startHour) * 60 + now.getMinutes();
  const totalMin = (currentBlock.endHour - currentBlock.startHour) * 60;
  const remainingMin = totalMin - elapsedMin;
  const progressPct = Math.min(100, Math.round((elapsedMin / totalMin) * 100));

  // Grace-period lateness check
  const blockStartMs = new Date().setHours(currentBlock.startHour, 0, 0, 0);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 relative overflow-hidden"
      style={{
        borderColor: `${color.hex}40`,
        background: `linear-gradient(135deg, ${color.hex}0a, transparent)`,
      }}
    >
      {/* Subject color stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${color.hex}, ${color.hex}80)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: `${color.hex}20`, color: color.hex, border: `1px solid ${color.hex}30` }}
          >
            {currentBlock.subject[0]}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: color.hex }}>
                {currentBlock.subject.toUpperCase()}
              </span>
              {isLive && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {blockLabel}
            </div>
          </div>
        </div>
        {onEditRoutine && (
          <button
            onClick={(e) => { e.stopPropagation(); vibrate(8); onEditRoutine(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90 shrink-0"
            aria-label="Edit routine"
          >
            <Edit3 size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Time + progress */}
      <div className="flex items-center gap-2 text-[11px] mb-2" style={{ color: 'var(--muted-foreground)' }}>
        <Clock size={11} />
        <span className="font-medium">
          {formatHour(currentBlock.startHour)} → {formatHour(currentBlock.endHour)}
        </span>
        <span className="ml-auto tabular font-semibold" style={{ color: color.hex }}>
          {formatHM(elapsedMin * 60)} / {formatHM(totalMin * 60)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 rounded-full overflow-hidden mb-3"
        style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5 }}
          style={{ background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)` }}
        />
      </div>

      {/* Lateness indicator (only if studying this block) */}
      {isLive && latenessMin !== null && latenessMin > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] mb-2">
          {onTime ? (
            <span className="text-green-500 font-semibold">🟢 On time</span>
          ) : isLate ? (
            <span className="text-amber-500 font-semibold">🟡 {latenessMin} min late</span>
          ) : isVeryLate ? (
            <span className="text-red-500 font-semibold">🔴 {latenessMin} min late</span>
          ) : null}
        </div>
      )}

      {/* Wrong-subject warning */}
      {isWrongSubject && (
        <div
          className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg mb-2"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}
        >
          <AlertTriangle size={11} />
          <span>
            Planned: <strong>{currentBlock.subject} {blockLabel}</strong>.
            You're doing <strong>{activeSession!.subject}</strong>.
          </span>
        </div>
      )}

      {/* Action button or live status */}
      {!isLive ? (
        <button
          onClick={handleStartPlanned}
          className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5"
          style={{ background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`, boxShadow: `0 2px 8px -2px ${color.glow}` }}
        >
          <Play size={13} fill="currentColor" /> Start {currentBlock.subject} {currentBlock.type === 'lecture' ? 'Lecture' : 'Session'}
        </button>
      ) : (
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: 'var(--muted-foreground)' }}>
            Focus: <span className="font-bold" style={{ color: 'var(--foreground)' }}>
              {formatHM(activeSession!.studySeconds)}
            </span>
          </span>
          {activeSession!.wastedSeconds > 0 && (
            <span className="text-red-500">
              ⚠ {formatHM(activeSession!.wastedSeconds)}
            </span>
          )}
          <span style={{ color: 'var(--muted-foreground)' }}>
            {remainingMin > 0 ? `${remainingMin} min left in block` : 'Block ended — overtime'}
          </span>
        </div>
      )}

      {/* Next up */}
      {nextBlock && (
        <div className="flex items-center gap-1 text-[10px] mt-2 pt-2 border-t border-foreground/5" style={{ color: 'var(--muted-foreground)' }}>
          <ChevronRight size={10} />
          <span>
            Next: <span className="font-semibold" style={{ color: subjectColor(nextBlock.subject).hex }}>
              {nextBlock.subject}
            </span> {nextBlock.type === 'lecture' ? 'Lecture' : nextBlock.type === 'break' ? 'Break' : 'Self Study'} · {formatHour(nextBlock.startHour)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
