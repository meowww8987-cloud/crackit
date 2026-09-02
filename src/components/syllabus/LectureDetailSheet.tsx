'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Clock, AlertTriangle, Flame, Calendar, RotateCw, BookOpen, FileText, Play, TrendingUp, Award, Zap } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useHistory } from '@/lib/store/history';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity, Subject } from '@/lib/types';
import { cn, formatHM, vibrate, isRevisionOverdue, todayKey } from '@/lib/utils';

interface Props {
  lecture: Lecture;
  chapter: Chapter;
  subject: SubjectEntity;
  onClose: () => void;
  onEdit: () => void;
}

const REVISION_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#dc2626', '#991b1b'];
const REVISION_INTERVALS = ['1 day', '2 days', '4 days', '8 days', '16 days'];

export function LectureDetailSheet({ lecture, chapter, subject, onClose, onEdit }: Props) {
  const allSessions = useHistory((s) => s.sessions);
  const color = subjectColor(subject.name);

  // Find all sessions linked to this lecture (via targetId → target.lectureId)
  // Since sessions store targetId, and targets store lectureId, we need to
  // find targets that link to this lecture, then find sessions for those targets.
  // Simpler: use the lecture's accumulated stats (timeSpentSec, timeWastedSec)
  // + find sessions by matching chapter + topic.
  const lectureSessions = useMemo(() => {
    return allSessions.filter(s =>
      s.subject === subject.name &&
      s.chapter === chapter.name &&
      s.topic === lecture.topic
    ).sort((a, b) => b.endedAt - a.endedAt);
  }, [allSessions, subject.name, chapter.name, lecture.topic]);

  const totalStudied = lecture.timeSpentSec || 0;
  const totalWasted = lecture.timeWastedSec || 0;
  const efficiency = (totalStudied + totalWasted) > 0
    ? Math.round((totalStudied / (totalStudied + totalWasted)) * 100)
    : 0;
  const sessionCount = lectureSessions.length;
  const avgSessionTime = sessionCount > 0 ? Math.round(totalStudied / sessionCount) : 0;

  const revisionCount = lecture.revisionStage >= 0 ? lecture.revisionStage + 1 : 0;
  const revisionColor = revisionCount > 0 ? REVISION_COLORS[Math.min(revisionCount - 1, 4)] : '#f59e0b';
  const isOverdue = lecture.done && isRevisionOverdue(lecture.nextRevisionAt);
  const nextRevisionDate = lecture.nextRevisionAt ? new Date(lecture.nextRevisionAt) : null;
  const lastRevisedDate = lecture.lastRevisedAt ? new Date(lecture.lastRevisedAt) : null;
  const doneDate = lecture.doneDate ? new Date(lecture.doneDate) : null;

  const resources = [
    { key: 'lecture', label: 'Lecture', icon: Play, done: lecture.done, color: '#14b8a6' },
    { key: 'dpp', label: 'DPP', icon: FileText, done: lecture.dppDone, color: '#22c55e' },
    { key: 'notes', label: 'Notes', icon: BookOpen, done: lecture.notesDone, color: '#3b82f6' },
    { key: 'revision', label: 'Revision', icon: RotateCw, done: lecture.revisionDone, color: revisionColor, count: revisionCount },
  ];

  const doneCount = resources.filter(r => r.done).length;
  const progressPct = Math.round((doneCount / 4) * 100);
  const isComplete = progressPct === 100;

  const hardnessLabel = lecture.hardness <= 1 ? 'Easy' : lecture.hardness <= 2 ? 'Medium' : lecture.hardness <= 3 ? 'Hard' : lecture.hardness <= 4 ? 'Very Hard' : 'Brutal';
  const hardnessColor = lecture.hardness <= 1 ? '#22c55e' : lecture.hardness <= 2 ? '#f59e0b' : lecture.hardness <= 3 ? '#f97316' : '#ef4444';

  const confidenceLabel = !lecture.confidence ? 'Not rated' : lecture.confidence >= 4 ? 'High' : lecture.confidence >= 3 ? 'Medium' : 'Low';
  const confidenceColor = !lecture.confidence ? '#6b7280' : lecture.confidence >= 4 ? '#22c55e' : lecture.confidence >= 3 ? '#f59e0b' : '#ef4444';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10001] bg-black/80"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl pointer-events-auto"
          style={{
            background: 'var(--popover, rgba(20,22,30,0.96))',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* === Header with subject-color gradient === */}
          <div
            className="px-5 pt-5 pb-4 sticky top-0 z-10"
            style={{
              background: isComplete
                ? `linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))`
                : `linear-gradient(135deg, ${color.hex}22, ${color.hex}08)`,
              borderBottom: `1px solid ${isComplete ? 'rgba(34,197,94,0.2)' : `${color.hex}20`}`,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold tabular"
                  style={{ background: `${color.hex}25`, color: color.hex, border: `1px solid ${color.hex}30` }}
                >
                  {lecture.isCustom ? 'C' : 'L'}{lecture.lecNo}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                      {subject.name} · {chapter.name}
                    </span>
                    {isComplete && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-600 dark:text-green-400">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--foreground)' }}>
                    {lecture.topic}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition active:scale-90 shrink-0 ml-2"
                aria-label="Close"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {/* Grab handle */}
            <div className="w-10 h-1 rounded-full mx-auto mt-3" style={{ background: 'var(--foreground/20, rgba(255,255,255,0.2))' }} />
          </div>

          {/* === Body === */}
          <div className="p-5 space-y-4">
            {/* === Progress Overview === */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Progress
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {resources.map((res) => (
                  <div
                    key={res.key}
                    className="rounded-xl p-2 flex flex-col items-center gap-1 border"
                    style={{
                      background: res.done ? `${res.color}15` : 'transparent',
                      borderColor: res.done ? `${res.color}30` : 'var(--border)',
                    }}
                  >
                    <res.icon size={16} fill={res.done ? 'currentColor' : 'none'} style={{ color: res.done ? res.color : 'var(--muted-foreground)' }} />
                    <span className="text-[8px] font-semibold uppercase" style={{ color: res.done ? res.color : 'var(--muted-foreground)' }}>
                      {res.label}
                    </span>
                    {res.key === 'revision' && res.count && res.count > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: revisionColor }}>×{res.count}</span>
                    )}
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  style={{
                    background: isComplete ? 'linear-gradient(90deg, #22c55e, #16a34a)' : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                    boxShadow: `0 0 6px ${isComplete ? 'rgba(34,197,94,0.4)' : color.glow}`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] tabular mt-1" style={{ color: 'var(--muted-foreground)' }}>
                <span><span className="font-bold" style={{ color: isComplete ? '#22c55e' : color.hex }}>{progressPct}%</span> complete · {doneCount}/4 resources</span>
              </div>
            </div>

            {/* === Time Stats === */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Time Statistics
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Total studied */}
                <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Play size={11} className="text-green-500" fill="currentColor" />
                    <span className="text-[9px] uppercase font-bold text-green-600 dark:text-green-400">Studied</span>
                  </div>
                  <div className="text-lg font-bold tabular text-green-600 dark:text-green-400">
                    {totalStudied > 0 ? formatHM(totalStudied) : '—'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {sessionCount} session{sessionCount === 1 ? '' : 's'}
                    {avgSessionTime > 0 && ` · avg ${formatHM(avgSessionTime)}`}
                  </div>
                </div>
                {/* Total wasted */}
                <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={11} className="text-red-500" />
                    <span className="text-[9px] uppercase font-bold text-red-600 dark:text-red-400">Wasted</span>
                  </div>
                  <div className="text-lg font-bold tabular text-red-600 dark:text-red-400">
                    {totalWasted > 0 ? formatHM(totalWasted) : '—'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {efficiency > 0 && `${efficiency}% efficiency`}
                  </div>
                </div>
              </div>
            </div>

            {/* === Lecture Properties === */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Properties
              </div>
              <div className="space-y-1.5">
                {/* Hardness */}
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                  <div className="flex items-center gap-2">
                    <Flame size={13} style={{ color: hardnessColor }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Difficulty</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.hardness ? hardnessColor : 'var(--foreground/15)' }} />
                      ))}
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: hardnessColor }}>{hardnessLabel}</span>
                  </div>
                </div>
                {/* Confidence */}
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={13} style={{ color: confidenceColor }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Confidence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {lecture.confidence ? (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(d => (
                          <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.confidence! ? confidenceColor : 'var(--foreground/15)' }} />
                        ))}
                      </div>
                    ) : null}
                    <span className="text-[11px] font-bold" style={{ color: confidenceColor }}>{confidenceLabel}</span>
                  </div>
                </div>
                {/* PYQ count */}
                {lecture.pyqCount > 0 && (
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                    <div className="flex items-center gap-2">
                      <Award size={13} className="text-amber-500" />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>PYQ Questions</span>
                    </div>
                    <span className="text-[12px] font-bold tabular text-amber-600 dark:text-amber-400">{lecture.pyqCount}</span>
                  </div>
                )}
                {/* Weightage */}
                {lecture.weightage && (
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                    <div className="flex items-center gap-2">
                      <Zap size={13} className="text-purple-500" />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>NEET Weightage</span>
                    </div>
                    <span className="text-[12px] font-bold tabular text-purple-600 dark:text-purple-400">{lecture.weightage}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* === Revision Schedule === */}
            {lecture.done && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Revision Schedule
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{
                  background: isOverdue ? 'rgba(239,68,68,0.08)' : revisionCount > 0 ? `${revisionColor}10` : 'var(--foreground/5)',
                  border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : revisionCount > 0 ? `${revisionColor}25` : 'var(--border)'}`,
                }}>
                  {/* Revision count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCw size={13} style={{ color: revisionCount > 0 ? revisionColor : 'var(--muted-foreground)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Revisions done</span>
                    </div>
                    <span className="text-sm font-bold tabular" style={{ color: revisionCount > 0 ? revisionColor : 'var(--muted-foreground)' }}>
                      {revisionCount}
                    </span>
                  </div>
                  {/* Last revised */}
                  {lastRevisedDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} style={{ color: 'var(--muted-foreground)' }} />
                        <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Last revised</span>
                      </div>
                      <span className="text-[11px] tabular" style={{ color: 'var(--foreground)' }}>
                        {lastRevisedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {/* Next revision */}
                  {nextRevisionDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={12} style={{ color: isOverdue ? '#ef4444' : 'var(--muted-foreground)' }} />
                        <span className="text-[11px]" style={{ color: isOverdue ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {isOverdue ? '⚠ Overdue since' : 'Next revision'}
                        </span>
                      </div>
                      <span className="text-[11px] tabular" style={{ color: isOverdue ? '#ef4444' : 'var(--foreground)' }}>
                        {nextRevisionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {/* Spaced repetition schedule */}
                  {revisionCount > 0 && revisionCount <= 5 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Spaced repetition</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {REVISION_INTERVALS.map((interval, i) => (
                          <div
                            key={i}
                            className="flex-1 text-center py-1 rounded-md text-[8px] font-bold"
                            style={{
                              background: i < revisionCount ? `${REVISION_COLORS[Math.min(i,4)]}20` : 'var(--foreground/5)',
                              color: i < revisionCount ? REVISION_COLORS[Math.min(i,4)] : 'var(--muted-foreground)',
                              border: i === revisionCount - 1 ? `1px solid ${REVISION_COLORS[Math.min(i,4)]}40` : 'none',
                            }}
                          >
                            {interval}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === Session History === */}
            {lectureSessions.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Session History ({lectureSessions.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {lectureSessions.slice(0, 10).map((s, i) => {
                    const date = new Date(s.endedAt);
                    return (
                      <div key={s.id || i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                        <div className="w-1 h-6 rounded-full" style={{ background: color.hex }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium truncate" style={{ color: 'var(--foreground)' }}>
                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-bold tabular text-green-600 dark:text-green-400">
                            {formatHM(s.studySeconds)}
                          </div>
                          {s.wastedSeconds > 0 && (
                            <div className="text-[9px] tabular text-red-500">⚠ {formatHM(s.wastedSeconds)}</div>
                          )}
                        </div>
                        {s.mood && (
                          <span className="text-sm">
                            {s.mood === 'confident' ? '😊' : s.mood === 'okay' ? '🙂' : s.mood === 'struggling' ? '😰' : '😴'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {lectureSessions.length > 10 && (
                    <div className="text-[10px] text-center py-1" style={{ color: 'var(--muted-foreground)' }}>
                      + {lectureSessions.length - 10} more sessions
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === Notes Preview === */}
            {lecture.notes && lecture.notes.trim() && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Notes
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--foreground/5)', border: '1px solid var(--border)' }}>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--foreground)' }}>
                    {lecture.notes}
                  </p>
                </div>
              </div>
            )}

            {/* === Done date === */}
            {doneDate && (
              <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)' }}>
                <Calendar size={13} className="text-green-500" />
                <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Completed on</span>
                <span className="text-[11px] font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {doneDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}

            {/* === Action button === */}
            <button
              onClick={() => { vibrate(10); onEdit(); }}
              className="w-full py-3 rounded-xl text-[13px] font-bold transition active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: `${color.hex}15`,
                color: color.hex,
                border: `1px solid ${color.hex}30`,
              }}
            >
              <BookOpen size={14} />
              Edit Lecture Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
