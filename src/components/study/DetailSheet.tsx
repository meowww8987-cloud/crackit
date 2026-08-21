'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Check, Pencil, Trash2, ExternalLink, Undo2 } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useTargets } from '@/lib/store/targets';
import { useNav } from '@/lib/store/nav';
import { subjectColor } from '@/lib/colors';
import { pushToast } from '@/components/shared/Toast';
import type { Target } from '@/lib/types';
import { cn, formatHM, formatClock, moodEmoji, vibrate } from '@/lib/utils';

interface Props {
  target: Target;
  onClose: () => void;
  onEdit: () => void;
}

export function DetailSheet({ target: initialTarget, onClose, onEdit }: Props) {
  // Read the LIVE target from store (so it updates when toggleDone is called)
  const liveTarget = useTargets((s) => {
    for (const date of Object.keys(s.byDate)) {
      const t = s.byDate[date].find((x) => x.id === initialTarget.id);
      if (t) return t;
    }
    return initialTarget;
  });
  const target = liveTarget;

  const color = subjectColor(target.subject);
  const active = useSession((s) => s.active);
  const startSession = useSession((s) => s.startSession);
  const pause = useSession((s) => s.pause);
  const resume = useSession((s) => s.resume);
  const setFocusOpen = useSession((s) => s.setFocusOpen);
  const deleteTarget = useTargets((s) => s.deleteTarget);
  const toggleDone = useTargets((s) => s.toggleDone);
  const setTab = useNav((s) => s.setTab);

  const isThisActive = active?.targetId === target.id;
  const sessionState = isThisActive
    ? active!.paused
      ? 'paused'
      : active!.wasting
      ? 'wasting'
      : 'studying'
    : target.done
    ? 'done'
    : 'idle';

  // Flash state for the Mark Done / Mark Undone button — gives clear visual
  // confirmation that the tap was registered even when state updates are subtle.
  const [toggleFlash, setToggleFlash] = useState<'done' | 'undone' | null>(null);

  const allSessions = useHistory((s) => s.sessions);
  const sessions = useMemo(
    () => allSessions.filter((s) => s.targetId === target.id && s.date === target.date),
    [allSessions, target.id, target.date]
  );
  const studiedSec = sessions.reduce((a, s) => a + s.studySeconds, 0);
  const wastedSec = sessions.reduce((a, s) => a + s.wastedSeconds, 0);

  const liveStudied = isThisActive ? getLiveStudySeconds(active) : studiedSec;
  const liveWasted = isThisActive ? getLiveWastedSeconds(active) : wastedSec;
  const expectedSec = target.expectedMinutes * 60;
  const progressPct = expectedSec > 0 ? Math.min(100, Math.round((liveStudied / expectedSec) * 100)) : 0;
  const remainingSec = Math.max(0, expectedSec - liveStudied);

  const handleToggleDone = () => {
    vibrate(15);
    const wasDone = target.done;
    toggleDone(target.id);
    // Flash animation on the button itself
    setToggleFlash(wasDone ? 'undone' : 'done');
    setTimeout(() => setToggleFlash(null), 600);
    // Toast gives explicit textual confirmation
    if (wasDone) {
      pushToast(
        'Marked Undone',
        studiedSec > 0 ? `Resumes from ${formatHM(studiedSec)} studied today` : 'Ready to study again',
        'info'
      );
    } else {
      pushToast('Marked Done', 'Nice work! Keep the streak going.', 'success');
    }
  };

  const handleStartPause = () => {
    vibrate(12);
    if (target.done) return;
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

  const handleDelete = () => {
    if (confirm('Delete this target? Today\'s sessions will remain in history.')) {
      deleteTarget(target.id);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%', scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: '100%', scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${color.hex}22`, color: color.hex }}
                >
                  {target.subject}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                  {target.activity}
                </span>
              </div>
            <button
              onClick={() => { setTab('syllabus'); onClose(); }}
              className="text-sm text-white/60 hover:text-white flex items-center gap-1"
            >
              {target.chapter}
              <ExternalLink size={12} />
            </button>
            <h2 className={cn('text-lg font-bold mt-1', target.done && 'line-through text-white/50')}>
              {target.topic}
            </h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto scroll-area px-5 py-4">

        {/* 3 stat boxes */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatBox label="Studied" value={formatHM(liveStudied)} color="#14b8a6" />
          <StatBox label="Wasted" value={formatHM(liveWasted)} color="#ef4444" />
          <StatBox label="Sessions" value={String(sessions.length)} color="#ffffff" />
        </div>

        {/* Circular progress */}
        <div className="flex flex-col items-center my-5">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ring-track)" strokeWidth="8" />
            <motion.circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={color.hex}
              strokeWidth="8"
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              initial={{ strokeDashoffset: 314.16 }}
              animate={{ strokeDashoffset: 314.16 - (314.16 * progressPct) / 100 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              strokeDasharray="314.16"
            />
            <text x="60" y="58" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: '24px' }}>
              {progressPct}%
            </text>
            <text x="60" y="76" textAnchor="middle" className="fill-white/40" style={{ fontSize: '10px' }}>
              of goal
            </text>
          </svg>
          <div className="mt-2 text-sm">
            {remainingSec > 0 ? (
              <span className="text-white/60 tabular">{formatClock(remainingSec)} remaining</span>
            ) : (
              <span className="text-green-400 font-semibold">✓ Goal reached!</span>
            )}
          </div>
        </div>

        {/* Session history today */}
        {sessions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">Today's Sessions</h3>
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <div key={s.id} className="glass rounded-xl p-2.5 flex items-center gap-3">
                  <div className="text-center min-w-[36px]">
                    <div className="text-xs text-white/40">
                      {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="text-sm text-green-400 tabular">▶ {formatHM(s.studySeconds)}</span>
                  {s.wastedSeconds > 0 && (
                    <span className="text-xs text-red-400 tabular">⚠ {formatHM(s.wastedSeconds)}</span>
                  )}
                  <span className="ml-auto text-lg">{moodEmoji(s.mood)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open in Syllabus link */}
        <button
          onClick={() => { setTab('syllabus'); onClose(); }}
          className="w-full text-center text-xs text-teal-400/70 hover:text-teal-400 py-1"
        >
          Open in Syllabus →
        </button>

        </div>

        {/* Sticky footer with action buttons — always visible */}
        <div className="sticky bottom-0 z-10 px-5 py-3 glass" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStartPause}
              disabled={target.done}
              className={cn(
                'py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition active:scale-95',
                target.done
                  ? 'bg-white/5 text-white/30'
                  : 'text-white'
              )}
              style={!target.done ? { background: color.hex, color: '#000' } : undefined}
            >
              {target.done ? (
                <><Check size={16} /> Done</>
              ) : isThisActive ? (
                active!.paused ? <><Play size={14} fill="currentColor" /> Resume</> : <><Pause size={14} fill="currentColor" /> Pause</>
              ) : (
                <><Play size={14} fill="currentColor" /> Start</>
              )}
            </button>
            <button
              onClick={handleToggleDone}
              className={cn(
                'relative overflow-hidden py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition active:scale-95',
                target.done ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
              )}
            >
              {/* Flash overlay on toggle — gives clear visual feedback */}
              {toggleFlash && (
                <motion.div
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: toggleFlash === 'done' ? '#ffffff' : '#fbbf24',
                  }}
                />
              )}
              {/* Brief scale bump on the label */}
              <motion.span
                key={target.done ? 'undone' : 'done'}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="relative flex items-center gap-1.5"
              >
                {target.done ? (
                  <><Undo2 size={15} /> Mark Undone</>
                ) : (
                  <><Check size={16} /> Mark Done</>
                )}
              </motion.span>
            </button>
            <button
              onClick={onEdit}
              className="py-3 rounded-xl font-semibold text-sm bg-white/10 text-white flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="py-3 rounded-xl font-semibold text-sm bg-red-500/20 text-red-400 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-white/40 mb-0.5">{label}</div>
      <div className="text-base font-bold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
