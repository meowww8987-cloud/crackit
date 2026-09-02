'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Plus, Check, Pencil, Trash2, Play, FileText, BookOpen, RotateCw, RotateCcw, X, Clock } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { useSession } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity, LectureResource, ActivityType } from '@/lib/types';
import { cn, todayKey, vibrate, formatHM, nextRevisionDate } from '@/lib/utils';
import { getLearnedExpectedMinutes } from '@/lib/store/learnedTime';
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

// Revision color cycles — each revision gets a distinct color
const REVISION_COLORS = [
  '#f59e0b', // 1st revision — amber
  '#f97316', // 2nd revision — orange
  '#ef4444', // 3rd revision — red
  '#dc2626', // 4th revision — dark red
  '#991b1b', // 5+ revisions — deep red
];

export function LectureResourceRow({ lecture, chapter, subject, index, onEdit }: Props) {
  const toggleResource = useSyllabus((s) => s.toggleLectureResource);
  const updateLecture = useSyllabus((s) => s.updateLecture);
  const deleteLecture = useSyllabus((s) => s.deleteLecture);
  const addTarget = useTargets((s) => s.addTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);
  const activeSession = useSession((s) => s.active);

  // === Total study time across ALL activities for this lecture ===
  // Includes: focus sessions linked to this lecture + practice sessions
  // matching subject+chapter+topic + lecture's accumulated timeSpentSec
  const allSessions = useHistory((s) => s.sessions);
  const totalStudyTime = useMemo(() => {
    // 1. Lecture's accumulated time (from syllabus store)
    let total = lecture.timeSpentSec || 0;
    // 2. Find ALL history sessions matching this lecture's subject+chapter+topic
    // This catches practice sessions, free study, etc. that aren't linked
    // via targetId but still relate to this lecture
    const matchingSessions = allSessions.filter(s =>
      s.subject === subject.name &&
      s.chapter === chapter.name &&
      s.topic === lecture.topic
    );
    // Add any sessions not already counted in timeSpentSec
    // (timeSpentSec is accumulated via addLectureStats, which only fires
    // for sessions with a targetId linked to this lecture. Practice sessions
    // don't have targetId, so they're not counted in timeSpentSec.)
    const sessionTotal = matchingSessions.reduce((a, s) => a + s.studySeconds, 0);
    // Use the larger of the two (avoid double-counting)
    total = Math.max(total, sessionTotal);
    return total;
  }, [lecture.timeSpentSec, allSessions, subject.name, chapter.name, lecture.topic]);

  const color = subjectColor(subject.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resourceLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showAddToday, setShowAddToday] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResourceAdd, setShowResourceAdd] = useState<{ resource: LectureResource; label: string } | null>(null);
  const [activity, setActivity] = useState<ActivityType>('Lecture');
  const [expectedMinutes, setExpectedMinutes] = useState(60);
  const [resourceExpectedMinutes, setResourceExpectedMinutes] = useState(30);

  const doneCount = [lecture.done, lecture.dppDone, lecture.notesDone, lecture.revisionDone].filter(Boolean).length;
  const progressPct = Math.round((doneCount / 4) * 100);
  const isComplete = progressPct === 100;
  const isInProgress = doneCount > 0 && !isComplete;

  const isAddedToday = isAlreadyAdded(subject.name, chapter.name, 'Lecture', `L${lecture.lecNo}`);
  const labelPrefix = lecture.isCustom ? 'C' : 'L';

  // Active session detection
  const isActive = activeSession?.targetId === lecture.id;

  // Revision count — revisionStage tracks how many times revised (0-4)
  const revisionCount = lecture.revisionStage >= 0 ? lecture.revisionStage + 1 : 0;
  const revisionColor = revisionCount > 0 ? REVISION_COLORS[Math.min(revisionCount - 1, REVISION_COLORS.length - 1)] : '#f59e0b';

  // Zebra striping
  const isEvenRow = index % 2 === 0;

  // Status-based card styling
  const cardBackground = isComplete
    ? 'rgba(34, 197, 94, 0.06)'
    : isInProgress
    ? `${color.hex}${isEvenRow ? '0d' : '08'}`
    : isEvenRow
    ? 'var(--bg-card, rgba(255,255,255,0.04))'
    : 'var(--bg-card, rgba(255,255,255,0.01))';

  const cardBorder = isComplete
    ? '1px solid rgba(34,197,94,0.25)'
    : isInProgress
    ? `1px solid ${color.hex}40`
    : '1px solid var(--border-card, rgba(255,255,255,0.06))';

  const handleResourceToggle = (resource: LectureResource, e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(10);
    if (resource === 'revision') {
      // Revision INCREMENTS — each tap counts as one more revision
      // Cycles through: not done → 1st → 2nd → 3rd → 4th → back to not done
      const currentStage = lecture.revisionStage;
      const nextStage = currentStage >= 4 ? -1 : currentStage + 1;
      updateLecture(lecture.id, {
        revisionDone: nextStage >= 0,
        revisionStage: nextStage,
        lastRevisedAt: nextStage >= 0 ? Date.now() : undefined,
        // Use the store's spaced-repetition function (consistent intervals)
        nextRevisionAt: nextStage >= 0 ? nextRevisionDate(nextStage) : undefined,
      });
    } else {
      toggleResource(lecture.id, resource);
    }
  };

  // Reset revision count back to 0 — shown in the long-press popup
  const handleResetRevision = () => {
    setShowActions(false);
    vibrate([10, 20, 10]);
    updateLecture(lecture.id, {
      revisionDone: false,
      revisionStage: -1,
      lastRevisedAt: undefined,
      nextRevisionAt: undefined,
    });
  };

  const handleResourceLongPress = (resource: LectureResource, label: string) => {
    // Map resource to activity type
    const activityMap: Record<LectureResource, ActivityType> = {
      lecture: 'Lecture',
      dpp: 'DPP',
      notes: 'Notes',
      revision: 'Revision',
    };
    setActivity(activityMap[resource]);
    // Use learned time for this subject+activity, fall back to defaults
    const defaultTime = getLearnedExpectedMinutes(subject.name, activityMap[resource]);
    setResourceExpectedMinutes(defaultTime);
    setShowResourceAdd({ resource, label });
    vibrate(20);
  };

  const handleResourcePointerDown = (resource: LectureResource, label: string, e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent card's onPointerDown from firing
    longPressFiredRef.current = false; // Reset flag
    resourceLongPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true; // Mark that long-press fired
      handleResourceLongPress(resource, label);
    }, 400);
  };

  const handleResourcePointerUp = (e?: React.PointerEvent) => {
    e?.stopPropagation();
    if (resourceLongPressTimer.current) {
      clearTimeout(resourceLongPressTimer.current);
      resourceLongPressTimer.current = null;
    }
  };

  // Track if long-press fired — prevents onClick toggle from firing after long-press
  const longPressFiredRef = useRef(false);

  const handleResourceClick = (resource: LectureResource, e: React.MouseEvent) => {
    e.stopPropagation();
    // If long-press just fired, don't toggle — just reset the flag
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    handleResourceToggle(resource, e);
  };

  const handleConfirmResourceAdd = () => {
    if (!showResourceAdd) return;
    vibrate(12);
    addTarget({
      date: todayKey(),
      subject: subject.name,
      activity,
      chapter: chapter.name,
      lecture: `${labelPrefix}${lecture.lecNo}`,
      topic: lecture.topic,
      expectedMinutes: resourceExpectedMinutes,
      lectureId: lecture.id,
      chapterId: chapter.id,
    });
    setShowResourceAdd(null);
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

  const handleLongPressStart = (e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent chapter card's long-press from firing
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
      vibrate(20);
    }, 500);
  };

  const handleLongPressEnd = (e?: React.PointerEvent) => {
    e?.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Short tap → do nothing (long-press opens detail/edit)
  // Previously: single tap opened detail sheet. Now removed per user request.
  // Long-press (500ms) → opens actions popup with Edit + Delete.
  const handleCardClick = (e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    // Short tap — do nothing. User must long-press to open detail.
    e.stopPropagation();
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
          isActive && 'glow-pulse',
          !isInProgress && !isComplete && 'opacity-90',
        )}
        style={{
          ['--glow-color' as string]: color.glow,
          background: cardBackground,
          border: cardBorder,
        }}
        onPointerDown={handleLongPressStart}
        onPointerUp={(e) => handleLongPressEnd(e)}
        onPointerLeave={() => handleLongPressEnd()}
        onPointerCancel={() => handleLongPressEnd()}
        onClick={handleCardClick}
      >
        {/* === Colored header row — subject color background ===
            The ENTIRE header row (lec# + topic name) has a subject-color
            tint background. This is the primary visual separator between
            lectures — always visible in all themes, all subjects. */}
        <div
          className="flex items-center gap-2 p-3 pt-2.5 relative"
          style={{
            background: isComplete
              ? 'linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
              : `linear-gradient(90deg, ${color.hex}25, ${color.hex}10)`,
            borderBottom: `2px solid ${isComplete ? 'rgba(34,197,94,0.2)' : `${color.hex}20`}`,
          }}
        >
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

          {/* Lecture number badge */}
          <div
            className={cn(
              'shrink-0 min-w-[28px] h-6 px-1 rounded-md text-[10px] font-bold tabular flex items-center justify-center',
              isInProgress && !isComplete && 'animate-pulse'
            )}
            style={{
              background: isComplete
                ? 'rgba(34,197,94,0.15)'
                : isInProgress
                ? `${color.hex}25`
                : `${color.hex}10`,
              color: isComplete ? '#22c55e' : isInProgress ? color.hex : 'var(--muted-foreground)',
              border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : isInProgress ? `${color.hex}50` : `${color.hex}20`}`,
            }}
          >
            {labelPrefix}{lecture.lecNo}
          </div>

          {/* Topic text */}
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

        {/* Segmented progress bar */}
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
            {[25, 50, 75].map((pos) => (
              <div
                key={pos}
                className="absolute top-0 bottom-0 w-px pointer-events-none"
                style={{ left: `${pos}%`, background: 'var(--border, rgba(255,255,255,0.12))' }}
              />
            ))}
          </div>
        </div>

        {/* Resource toggle buttons — long-press to add as target */}
        <div className="grid grid-cols-4 gap-1.5 p-3">
          {RESOURCES.map((res) => {
            const isDone = res.key === 'lecture' ? lecture.done
              : res.key === 'dpp' ? lecture.dppDone
              : res.key === 'notes' ? lecture.notesDone
              : lecture.revisionDone;
            const Icon = res.icon;
            // Revision gets special color based on count
            const btnColor = res.key === 'revision' && revisionCount > 0 ? revisionColor : res.color;
            return (
              <button
                key={res.key}
                onClick={(e) => handleResourceClick(res.key, e)}
                onPointerDown={(e) => handleResourcePointerDown(res.key, res.label, e)}
                onPointerUp={(e) => handleResourcePointerUp(e)}
                onPointerLeave={() => handleResourcePointerUp()}
                className={cn(
                  'py-2 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition border active:scale-95 relative',
                  isDone
                    ? 'text-white border-transparent'
                    : 'border-border bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.07]'
                )}
                style={isDone ? { background: btnColor, boxShadow: `0 0 8px ${btnColor}60` } : undefined}
                aria-label={`${res.label} — ${isDone ? 'done' : 'not done'}. Long-press to add as today's target.`}
                title={`${res.label} — tap to toggle, long-press to add to today`}
              >
                <Icon size={14} fill={isDone ? 'currentColor' : 'none'} />
                <span className="text-[8px] font-semibold uppercase tracking-wide">
                  {isDone ? '✓' : res.label}
                </span>
                {/* Revision count badge */}
                {res.key === 'revision' && revisionCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white border border-white/30"
                    style={{ background: revisionColor }}
                  >
                    {revisionCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* === Total study time row — shows ALL time across all activities === */}
        {totalStudyTime > 0 && (
          <div className="flex items-center gap-2 px-3 pb-2 text-[10px] tabular" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="flex items-center gap-1 pt-1.5">
              <Play size={9} className="text-green-600 dark:text-green-400" fill="currentColor" />
              <span className="text-green-600 dark:text-green-400 font-bold">{formatHM(totalStudyTime)}</span>
              <span className="text-muted-foreground">total study time</span>
            </span>
            {lecture.timeWastedSec && lecture.timeWastedSec > 0 && (
              <span className="flex items-center gap-0.5 pt-1.5">
                <span className="text-red-500">⚠</span>
                <span className="text-red-500 font-medium">{formatHM(lecture.timeWastedSec)}</span>
              </span>
            )}
            {lecture.confidence && lecture.confidence > 0 && (
              <span className="flex items-center gap-1 pt-1.5 ml-auto" title={`Confidence: ${lecture.confidence}/5`}>
                {[1, 2, 3, 4, 5].map((d) => (
                  <span
                    key={d}
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: d <= lecture.confidence!
                        ? (lecture.confidence! >= 4 ? '#22c55e' : lecture.confidence! >= 3 ? '#f59e0b' : '#ef4444')
                        : 'var(--bar-track, rgba(128,128,128,0.2))',
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* === Long-press Actions Modal — Edit + Delete + lecture details (via Portal) === */}
      {showActions && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/80"
            onClick={() => setShowActions(false)}
          />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-[320px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{
                background: 'var(--popover, rgba(20,22,30,0.96))',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* === Header with lecture identity === */}
              <div
                className="px-4 py-3 border-b border-foreground/10 sticky top-0 z-10"
                style={{
                  background: isComplete
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
                    : `linear-gradient(135deg, ${color.hex}20, ${color.hex}08)`,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color.hex}25`, color: color.hex, border: `1px solid ${color.hex}30` }}>
                    <BookOpen size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded-md"
                        style={{ background: `${color.hex}25`, color: color.hex }}
                      >
                        {labelPrefix}{lecture.lecNo}
                      </span>
                      {isComplete && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-600 dark:text-green-400">
                          ✓ COMPLETE
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${color.hex}20`, color: color.hex }}>
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground leading-snug">{lecture.topic}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{subject.name} · {chapter.name}</div>
                  </div>
                  <button
                    onClick={() => setShowActions(false)}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90 shrink-0"
                    aria-label="Close"
                  >
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* === Lecture Details — progress summary === */}
              <div className="px-4 py-3 border-b border-foreground/10">
                {/* Resource progress grid */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {RESOURCES.map((res) => {
                    const isDone = res.key === 'lecture' ? lecture.done
                      : res.key === 'dpp' ? lecture.dppDone
                      : res.key === 'notes' ? lecture.notesDone
                      : lecture.revisionDone;
                    const Icon = res.icon;
                    const btnColor = res.key === 'revision' && revisionCount > 0 ? revisionColor : res.color;
                    return (
                      <div
                        key={res.key}
                        className="rounded-lg p-1.5 flex flex-col items-center gap-0.5 border"
                        style={{
                          background: isDone ? `${btnColor}20` : 'transparent',
                          borderColor: isDone ? `${btnColor}40` : 'var(--border, rgba(255,255,255,0.08))',
                        }}
                      >
                        <Icon size={12} fill={isDone ? 'currentColor' : 'none'} style={{ color: isDone ? btnColor : 'var(--muted-foreground)' }} />
                        <span className="text-[8px] font-semibold uppercase" style={{ color: isDone ? btnColor : 'var(--muted-foreground)' }}>
                          {res.label}
                        </span>
                        {res.key === 'revision' && revisionCount > 0 && (
                          <span className="text-[8px] font-bold" style={{ color: revisionColor }}>×{revisionCount}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overall progress bar */}
                <div className="relative h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: isComplete ? 'linear-gradient(90deg, #22c55e, #16a34a)' : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>
                  <span><span className="font-bold" style={{ color: isComplete ? '#22c55e' : color.hex }}>{progressPct}%</span> complete · {doneCount}/4 resources</span>
                </div>
              </div>

              {/* === Time stats (if any) === */}
              {(lecture.timeSpentSec || lecture.timeWastedSec || lecture.doneDate) && (
                <div className="px-4 py-2.5 border-b border-foreground/10">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Study Stats</div>
                  <div className="flex items-center gap-3 text-[11px] tabular flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                    {lecture.timeSpentSec && lecture.timeSpentSec > 0 && (
                      <span className="flex items-center gap-1">
                        <Play size={10} className="text-green-600 dark:text-green-400" fill="currentColor" />
                        <span className="text-foreground font-medium">{formatHM(lecture.timeSpentSec)}</span> studied
                      </span>
                    )}
                    {lecture.timeWastedSec && lecture.timeWastedSec > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-red-500 dark:text-red-400">⚠</span>
                        <span className="text-red-500 dark:text-red-400 font-medium">{formatHM(lecture.timeWastedSec)}</span> wasted
                      </span>
                    )}
                    {lecture.confidence && lecture.confidence > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-[9px] uppercase">Confidence:</span>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <span key={d} className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.confidence! ? (lecture.confidence! >= 4 ? '#22c55e' : lecture.confidence! >= 3 ? '#f59e0b' : '#ef4444') : 'var(--bar-track)' }} />
                        ))}
                      </span>
                    )}
                    {lecture.doneDate && (
                      <span className="ml-auto">Done: {new Date(lecture.doneDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              )}

              {/* === Notes preview (if any) === */}
              {lecture.notes && lecture.notes.trim() && (
                <div className="px-4 py-2.5 border-b border-foreground/10">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--foreground)' }}>
                    {lecture.notes.length > 120 ? lecture.notes.substring(0, 120) + '...' : lecture.notes}
                  </p>
                </div>
              )}

              {/* === Actions === */}
              <div className="py-1">
                {/* View Details — opens the full detail sheet */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    <BookOpen size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">View Details</div>
                    <div className="text-[10px] text-muted-foreground">Time stats, revision schedule, session history + more</div>
                  </div>
                </button>
                {/* Edit Lecture */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Pencil size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">Edit Lecture</div>
                    <div className="text-[10px] text-muted-foreground">Change topic, hardness, notes, confidence</div>
                  </div>
                </button>
                {/* Reset revision count — only shows if revised at least once */}
                {lecture.revisionStage >= 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResetRevision(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 active:bg-amber-500/15 transition text-left"
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <RotateCcw size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-amber-600 dark:text-amber-400">Reset Revision Count</div>
                      <div className="text-[10px] text-muted-foreground">Currently revised {revisionCount}× — reset to 0</div>
                    </div>
                  </button>
                )}
                <div className="h-px bg-foreground/10 my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); setShowDeleteConfirm(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 active:bg-red-500/15 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-red-500/20 text-red-600 dark:text-red-400">
                    <Trash2 size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-red-600 dark:text-red-400">Delete Lecture</div>
                    <div className="text-[10px] text-muted-foreground">Remove from this chapter</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Add to Today Sheet (from + button) — via Portal === */}
      {showAddToday && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/80"
            onClick={() => setShowAddToday(false)}
          />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-[320px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{
                background: 'var(--popover, rgba(20,22,30,0.96))',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
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
              <div className="p-4 space-y-4">
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
                <button
                  onClick={handleConfirmAddToday}
                  className="w-full py-2.5 rounded-lg text-[12px] font-bold text-black transition active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: color.hex, boxShadow: `0 2px 8px -2px ${color.glow}` }}
                >
                  <Check size={12} /> Add to Today ({expectedMinutes}m)
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Resource Long-Press Modal — add specific resource as target (via Portal) === */}
      {showResourceAdd && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/80"
            onClick={() => setShowResourceAdd(null)}
          />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-foreground/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color.hex}20`, color: color.hex }}>
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Add {showResourceAdd.label} to Today</div>
                    <div className="text-sm font-semibold text-foreground truncate">{lecture.topic}</div>
                  </div>
                  <button
                    onClick={() => setShowResourceAdd(null)}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90 shrink-0"
                    aria-label="Close"
                  >
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Expected Time</label>
                    <span className="text-[11px] font-bold tabular" style={{ color: color.hex }}>{resourceExpectedMinutes} min</span>
                  </div>
                  <ScrollAwareSlider>
                    <input
                      type="range" min={10} max={120} step={5}
                      value={resourceExpectedMinutes}
                      onChange={(e) => setResourceExpectedMinutes(Number(e.target.value))}
                      className="w-full"
                    />
                  </ScrollAwareSlider>
                </div>
                <button
                  onClick={handleConfirmResourceAdd}
                  className="w-full py-2.5 rounded-lg text-[12px] font-bold text-black transition active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ background: color.hex, boxShadow: `0 2px 8px -2px ${color.glow}` }}
                >
                  <Check size={12} /> Add {showResourceAdd.label} ({resourceExpectedMinutes}m)
                </button>
              </div>
            </motion.div>
          </div>
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
            className="fixed inset-0 z-[10003] bg-black/80"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-[10004] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
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
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
