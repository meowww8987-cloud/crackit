'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Plus, Check, Pencil, Trash2, Play, FileText, BookOpen, RotateCw, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { useSession } from '@/lib/store/session';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity, LectureResource, ActivityType } from '@/lib/types';
import { cn, todayKey, vibrate, formatHM } from '@/lib/utils';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';

interface Props {
  lecture: Lecture;
  chapter: Chapter;
  subject: SubjectEntity;
  index: number;
  onEdit: () => void;
}

const RESOURCES: { key: LectureResource; icon: typeof Play; label: string; color: string }[] = [
  { key: 'lecture',  icon: Play,     label: 'Lecture',  color: '#14b8a6' },
  { key: 'dpp',      icon: FileText, label: 'DPP',      color: '#22c55e' },
  { key: 'notes',    icon: BookOpen, label: 'Notes',    color: '#3b82f6' },
  { key: 'revision', icon: RotateCw, label: 'Revision', color: '#f59e0b' },
];

const ACTIVITIES: ActivityType[] = ['Lecture', 'DPP', 'Notes', 'Revision', 'Custom'];

export function LectureResourceRow({ lecture, chapter, subject, index, onEdit }: Props) {
  const toggleResource = useSyllabus((s) => s.toggleLectureResource);
  const deleteLecture = useSyllabus((s) => s.deleteLecture);
  const addTarget = useTargets((s) => s.addTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);
  const activeSession = useSession((s) => s.active);

  const color = subjectColor(subject.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showAddToday, setShowAddToday] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activity, setActivity] = useState<ActivityType>('Lecture');
  const [expectedMinutes, setExpectedMinutes] = useState(60);
  const [showLongPressHint, setShowLongPressHint] = useState(false);

  const doneCount = [lecture.done, lecture.dppDone, lecture.notesDone, lecture.revisionDone].filter(Boolean).length;
  const progressPct = Math.round((doneCount / 4) * 100);
  const isComplete = progressPct === 100;
  const isInProgress = doneCount > 0 && !isComplete;

  const isAddedToday = isAlreadyAdded(subject.name, chapter.name, 'Lecture', `L${lecture.lecNo}`);
  const labelPrefix = lecture.isCustom ? 'C' : 'L';

  // Active session detection — is this lecture being studied right now?
  const isActive = activeSession?.targetId === lecture.id;

  // Long-press hint — show once per session
  useEffect(() => {
    const seen = localStorage.getItem('syllabus-longpress-hint-seen');
    if (!seen) {
      const t = setTimeout(() => setShowLongPressHint(true), 2000);
      const hideT = setTimeout(() => {
        setShowLongPressHint(false);
        localStorage.setItem('syllabus-longpress-hint-seen', '1');
      }, 5000);
      return () => { clearTimeout(t); clearTimeout(hideT); };
    }
  }, []);

  const handleResourceToggle = (resource: LectureResource, e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(10);
    toggleResource(lecture.id, resource);
  };

  const handleAddTodayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAddedToday) return;
    vibrate(8);
    setShowAddToday(true);
  };

  const handleConfirmAddToday = () => {
    vibrate(12);
    addTarget({
      date: todayKey(),
      subject: subject.name,
      activity,
      chapter: chapter.name,
      lecture: `${labelPrefix}${lecture.lecNo}`,
      topic: lecture.topic,
      expectedMinutes,
      lectureId: lecture.id,
      chapterId: chapter.id,
    });
    setShowAddToday(false);
  };

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
      vibrate(20);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    vibrate([10, 30, 10]);
    deleteLecture(lecture.id);
    setShowDeleteConfirm(false);
    setShowActions(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={cn(
          'rounded-xl transition-all relative overflow-hidden',
          isActive && 'glow-pulse'
        )}
        style={{
          ['--glow-color' as string]: color.glow,
          background: isComplete
            ? 'rgba(34, 197, 94, 0.05)'
            : isInProgress
            ? `${color.hex}08`
            : 'var(--bg-card, rgba(255,255,255,0.02))',
          border: `1px solid ${isComplete ? 'rgba(34,197,94,0.2)' : 'var(--border-card, rgba(255,255,255,0.08))'}`,
        }}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
      >
        {/* 3px top stripe — subject color, fades when complete */}
        <div
          className="absolute top-0 left-0 right-0 z-[1] pointer-events-none"
          style={{
            height: 3,
            background: isComplete
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)`,
            opacity: isComplete ? 0.4 : 1,
          }}
        />

        {/* Header row: add button + lec# + topic + progress */}
        <div className="flex items-center gap-2 p-3 pt-3.5">
          {/* Add to today button */}
          <button
            onClick={handleAddTodayClick}
            disabled={isAddedToday}
            className={cn(
              'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition border active:scale-90',
              isAddedToday
                ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30'
                : 'bg-foreground/5 text-muted-foreground border-border hover:bg-foreground/10'
            )}
            aria-label={isAddedToday ? 'Already added to today' : 'Add to today targets'}
            title={isAddedToday ? 'Already added to today' : 'Add to today targets'}
          >
            {isAddedToday ? <Check size={13} strokeWidth={3} /> : <Plus size={13} />}
          </button>

          {/* Lecture number badge — pulses when in progress */}
          <div
            className={cn(
              'shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold tabular',
              isInProgress && !isComplete && 'animate-pulse'
            )}
            style={{
              background: isComplete ? 'rgba(34,197,94,0.15)' : `${color.hex}15`,
              color: isComplete ? '#22c55e' : color.hex,
              border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : `${color.hex}30`}`,
            }}
          >
            {labelPrefix}{lecture.lecNo}
          </div>

          {/* Topic text — strikethrough when complete */}
          <span
            className={cn(
              'text-sm flex-1 truncate font-medium',
              isComplete && 'line-through'
            )}
            style={{
              color: isComplete ? 'var(--muted-foreground)' : 'var(--foreground)',
            }}
          >
            {lecture.topic}
          </span>

          {/* Custom badge */}
          {lecture.isCustom && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              CUSTOM
            </span>
          )}

          {/* Progress count badge */}
          <span
            className="text-[10px] tabular font-bold shrink-0 px-1.5 py-0.5 rounded-md"
            style={{
              color: isComplete ? '#22c55e' : doneCount > 0 ? color.hex : 'var(--muted-foreground)',
              background: isComplete ? 'rgba(34,197,94,0.1)' : doneCount > 0 ? `${color.hex}15` : 'transparent',
            }}
          >
            {doneCount}/4
          </span>
        </div>

        {/* Segmented progress bar — 8px, matches chapter card style */}
        <div className="px-3">
          <div
            className="relative h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: isComplete
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                  boxShadow: `0 0 6px ${isComplete ? 'rgba(34,197,94,0.4)' : color.glow}`,
                }}
              />
            </motion.div>
            {/* Segment dividers at 25/50/75% */}
            {[25, 50, 75].map((pos) => (
              <div
                key={pos}
                className="absolute top-0 bottom-0 w-px pointer-events-none"
                style={{ left: `${pos}%`, background: 'var(--border, rgba(255,255,255,0.12))' }}
              />
            ))}
          </div>
        </div>

        {/* Resource toggle buttons — larger, 40px tall */}
        <div className="grid grid-cols-4 gap-1.5 p-3">
          {RESOURCES.map((res) => {
            const isDone = res.key === 'lecture' ? lecture.done
              : res.key === 'dpp' ? lecture.dppDone
              : res.key === 'notes' ? lecture.notesDone
              : lecture.revisionDone;
            const Icon = res.icon;
            return (
              <button
                key={res.key}
                onClick={(e) => handleResourceToggle(res.key, e)}
                className={cn(
                  'py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition border active:scale-95',
                  isDone
                    ? 'text-white border-transparent'
                    : 'border-border bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.07]'
                )}
                style={isDone ? { background: res.color, boxShadow: `0 0 8px ${res.color}60` } : undefined}
                aria-label={`${res.label} — ${isDone ? 'done' : 'not done'}`}
                title={`${res.label} — tap to toggle`}
              >
                <Icon size={14} fill={isDone ? 'currentColor' : 'none'} />
                <span className="text-[8px] font-semibold uppercase tracking-wide">
                  {isDone ? '✓' : res.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time/wasted/confidence/date row — larger, better spacing */}
        {((lecture.timeSpentSec && lecture.timeSpentSec > 0) || lecture.doneDate) && (
          <div className="flex items-center gap-3 px-3 pb-2.5 text-[11px] tabular flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
            {lecture.timeSpentSec && lecture.timeSpentSec > 0 && (
              <span className="flex items-center gap-1">
                <Play size={10} className="text-green-600 dark:text-green-400" fill="currentColor" />
                <span className="text-foreground font-medium">{formatHM(lecture.timeSpentSec)}</span>
              </span>
            )}
            {lecture.timeWastedSec && lecture.timeWastedSec > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-red-500 dark:text-red-400">⚠</span>
                <span className="text-red-500 dark:text-red-400 font-medium">{formatHM(lecture.timeWastedSec)}</span>
              </span>
            )}
            {lecture.confidence && lecture.confidence > 0 && (
              <span className="flex items-center gap-1" title={`Confidence: ${lecture.confidence}/5`}>
                {[1, 2, 3, 4, 5].map((d) => (
                  <span
                    key={d}
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: d <= lecture.confidence!
                        ? (lecture.confidence! >= 4 ? '#22c55e' : lecture.confidence! >= 3 ? '#f59e0b' : '#ef4444')
                        : 'var(--bar-track, rgba(128,128,128,0.2))',
                    }}
                  />
                ))}
              </span>
            )}
            {lecture.doneDate && (
              <span className="ml-auto" style={{ color: 'var(--muted-foreground)' }}>
                {new Date(lecture.doneDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {/* Long-press hint — shows once */}
        <AnimatePresence>
          {showLongPressHint && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute bottom-1 right-2 text-[8px] px-1.5 py-0.5 rounded-md bg-foreground/10 text-muted-foreground pointer-events-none"
            >
              long-press for edit
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline actions — Edit / Delete (long-press) */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 p-3 pt-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
                  className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[11px] font-semibold flex items-center justify-center gap-1 border border-border hover:bg-foreground/10 active:scale-95 transition"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-semibold flex items-center justify-center gap-1 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* === Add to Today Sheet — via Portal, themed modal === */}
      {showAddToday && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddToday(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-[10002] w-[320px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
            style={{
              background: 'var(--popover, rgba(20,22,30,0.96))',
              backdropFilter: 'blur(16px)',
              transform: 'translate(-50%, -50%)',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-foreground/10 sticky top-0" style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Add to Today</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{lecture.topic}</div>
                </div>
                <button
                  onClick={() => setShowAddToday(false)}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
                  aria-label="Close"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Activity picker */}
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1.5 block tracking-wide">Activity</label>
                <div className="flex gap-1 flex-wrap">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a}
                      onClick={() => { setActivity(a); vibrate(6); }}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-medium transition border active:scale-95',
                        activity === a
                          ? 'bg-teal-500 text-black border-teal-500'
                          : 'bg-foreground/5 text-muted-foreground border-border hover:bg-foreground/10'
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expected time slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Expected Time</label>
                  <span className="text-[11px] font-bold tabular text-teal-600 dark:text-teal-400">{expectedMinutes} min</span>
                </div>
                <ScrollAwareSlider>
                  <input
                    type="range" min={15} max={180} step={5}
                    value={expectedMinutes}
                    onChange={(e) => setExpectedMinutes(Number(e.target.value))}
                    className="w-full"
                  />
                </ScrollAwareSlider>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirmAddToday}
                className="w-full py-2.5 rounded-lg text-[12px] font-bold text-black transition active:scale-95 flex items-center justify-center gap-1.5"
                style={{ background: color.hex, boxShadow: `0 2px 8px -2px ${color.glow}` }}
              >
                <Check size={12} /> Add to Today ({expectedMinutes}m)
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Delete Confirmation Modal — via Portal === */}
      {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10003] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-[10004] w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border shadow-2xl"
            style={{
              background: 'var(--popover, rgba(20,22,30,0.96))',
              backdropFilter: 'blur(16px)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-red-500 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">Delete lecture?</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    "{lecture.topic}" will be permanently removed from {chapter.name}.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[12px] font-semibold hover:bg-foreground/10 active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 active:scale-95 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
