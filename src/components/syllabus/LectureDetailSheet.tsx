'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  X, Clock, AlertTriangle, Flame, Calendar, RotateCw, BookOpen, FileText, Play,
  TrendingUp, Award, Zap, Check, ChevronRight, Sparkles, Target, BarChart3,
} from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useHistory } from '@/lib/store/history';
import { useSession } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity } from '@/lib/types';
import { cn, formatHM, vibrate, isRevisionOverdue, todayKey } from '@/lib/utils';

interface Props {
  lecture: Lecture;
  chapter: Chapter;
  subject: SubjectEntity;
  onClose: () => void;
  onEdit: () => void;
}

const REVISION_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#dc2626', '#991b1b'];
const REVISION_INTERVALS = ['1d', '2d', '4d', '8d', '16d'];

type Tab = 'overview' | 'timeline' | 'details';

export function LectureDetailSheet({ lecture, chapter, subject, onClose, onEdit }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const allSessions = useHistory((s) => s.sessions);
  const startSession = useSession((s) => s.startSession);
  const addTarget = useTargets((s) => s.addTarget);
  const color = subjectColor(subject.name);

  // === All sessions matching this lecture (by subject + chapter + topic) ===
  const lectureSessions = useMemo(() => {
    return allSessions
      .filter(s => s.subject === subject.name && s.chapter === chapter.name && s.topic === lecture.topic)
      .sort((a, b) => a.endedAt - b.endedAt);
  }, [allSessions, subject.name, chapter.name, lecture.topic]);

  // === Total time (ALL activities) ===
  const totalStudied = Math.max(lecture.timeSpentSec || 0, lectureSessions.reduce((a, s) => a + s.studySeconds, 0));
  const totalWasted = Math.max(lecture.timeWastedSec || 0, lectureSessions.reduce((a, s) => a + s.wastedSeconds, 0));
  const efficiency = (totalStudied + totalWasted) > 0 ? Math.round((totalStudied / (totalStudied + totalWasted)) * 100) : 0;
  const sessionCount = lectureSessions.length;

  // === Revision info ===
  const revisionCount = lecture.revisionStage >= 0 ? lecture.revisionStage + 1 : 0;
  const revisionColor = revisionCount > 0 ? REVISION_COLORS[Math.min(revisionCount - 1, 4)] : '#f59e0b';
  const isOverdue = lecture.done && isRevisionOverdue(lecture.nextRevisionAt);
  const nextRevisionDate = lecture.nextRevisionAt ? new Date(lecture.nextRevisionAt) : null;
  const lastRevisedDate = lecture.lastRevisedAt ? new Date(lecture.lastRevisedAt) : null;
  const doneDate = lecture.doneDate ? new Date(lecture.doneDate) : null;
  const firstSessionDate = lectureSessions.length > 0 ? new Date(lectureSessions[0].startedAt) : null;

  // === Progress ===
  const resources = [
    { key: 'lecture', label: 'Lecture', icon: Play, done: lecture.done, color: '#14b8a6' },
    { key: 'dpp', label: 'DPP', icon: FileText, done: lecture.dppDone, color: '#22c55e' },
    { key: 'notes', label: 'Notes', icon: BookOpen, done: lecture.notesDone, color: '#3b82f6' },
    { key: 'revision', label: 'Revision', icon: RotateCw, done: lecture.revisionDone, color: revisionColor, count: revisionCount },
  ];
  const doneCount = resources.filter(r => r.done).length;
  const progressPct = Math.round((doneCount / 4) * 100);
  const isComplete = progressPct === 100;

  // === Properties ===
  const hardnessLabel = lecture.hardness <= 1 ? 'Easy' : lecture.hardness <= 2 ? 'Medium' : lecture.hardness <= 3 ? 'Hard' : lecture.hardness <= 4 ? 'Very Hard' : 'Brutal';
  const hardnessColor = lecture.hardness <= 1 ? '#22c55e' : lecture.hardness <= 2 ? '#f59e0b' : lecture.hardness <= 3 ? '#f97316' : '#ef4444';
  const confidenceLabel = !lecture.confidence ? 'Not rated' : lecture.confidence >= 4 ? 'High' : lecture.confidence >= 3 ? 'Medium' : 'Low';
  const confidenceColor = !lecture.confidence ? '#6b7280' : lecture.confidence >= 4 ? '#22c55e' : lecture.confidence >= 3 ? '#f59e0b' : '#ef4444';

  // === Days to complete ===
  const daysToComplete = firstSessionDate && doneDate
    ? Math.max(1, Math.ceil((doneDate.getTime() - firstSessionDate.getTime()) / 86400000))
    : null;

  // === Comparison with other lectures in same chapter ===
  // Select the raw lectures array (stable reference unless lectures change)
  // and filter with useMemo to avoid infinite re-render from new array refs.
  const allLectures = useSyllabus((s) => s.lectures);
  const allChapterLectures = useMemo(
    () => allLectures.filter(l => l.chapterId === chapter.id),
    [allLectures, chapter.id]
  );
  const avgStudyTime = allChapterLectures.length > 0
    ? allChapterLectures.reduce((a, l) => a + (l.timeSpentSec || 0), 0) / allChapterLectures.length
    : 0;
  const isAboveAvgTime = totalStudied > avgStudyTime * 1.2;
  const isBelowAvgTime = totalStudied < avgStudyTime * 0.8 && totalStudied > 0;

  // === Quick Actions ===
  const handleStartStudy = () => {
    vibrate(12);
    addTarget({
      date: todayKey(),
      subject: subject.name,
      activity: 'Lecture',
      chapter: chapter.name,
      lecture: `L${lecture.lecNo}`,
      topic: lecture.topic,
      expectedMinutes: 45,
      lectureId: lecture.id,
      chapterId: chapter.id,
    });
    startSession({
      targetId: lecture.id,
      subject: subject.name,
      chapter: chapter.name,
      lecture: `L${lecture.lecNo}`,
      topic: lecture.topic,
      mode: 'focus',
      expectedMinutes: 45,
    });
    onClose();
  };

  const handleAddRevision = () => {
    vibrate(12);
    addTarget({
      date: todayKey(),
      subject: subject.name,
      activity: 'Revision',
      chapter: chapter.name,
      lecture: `L${lecture.lecNo}`,
      topic: lecture.topic,
      expectedMinutes: 20,
      lectureId: lecture.id,
      chapterId: chapter.id,
    });
    startSession({
      targetId: lecture.id,
      subject: subject.name,
      chapter: chapter.name,
      lecture: `L${lecture.lecNo}`,
      topic: lecture.topic,
      mode: 'focus',
      expectedMinutes: 20,
    });
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10001] bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl pointer-events-auto"
          style={{ background: 'var(--popover, rgba(20,22,30,0.96))', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* === Header === */}
          <div className="sticky top-0 z-10" style={{
            background: isComplete ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))' : `linear-gradient(135deg, ${color.hex}20, ${color.hex}08)`,
            borderBottom: `1px solid ${isComplete ? 'rgba(34,197,94,0.15)' : `${color.hex}15`}`,
          }}>
            <div className="flex items-start justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold tabular"
                  style={{ background: `${color.hex}25`, color: color.hex, border: `1px solid ${color.hex}30` }}>
                  {lecture.isCustom ? 'C' : 'L'}{lecture.lecNo}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{subject.name} · {chapter.name}</span>
                    {isComplete && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-600 dark:text-green-400">✓ DONE</span>}
                  </div>
                  <h2 className="text-[15px] font-bold leading-snug" style={{ color: 'var(--foreground)' }}>{lecture.topic}</h2>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition active:scale-90 shrink-0 ml-2" aria-label="Close">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex px-5 pb-2 gap-1">
              {(['overview', 'timeline', 'details'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); vibrate(5); }}
                  className={cn('flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition capitalize',
                    tab === t ? 'text-white' : 'text-muted-foreground hover:text-foreground')}
                  style={tab === t ? { background: color.hex } : undefined}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* === Tab Content === */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {tab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">

                  {/* === Summary Card === */}
                  <div className="rounded-2xl p-4" style={{ background: `${color.hex}08`, border: `1px solid ${color.hex}15` }}>
                    <div className="flex items-center gap-3 mb-3">
                      {/* Progress ring */}
                      <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
                        <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
                          <circle cx="26" cy="26" r="21" fill="none" stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="4" />
                          <motion.circle cx="26" cy="26" r="21" fill="none" stroke={isComplete ? '#22c55e' : color.hex} strokeWidth="4" strokeLinecap="round"
                            initial={{ strokeDashoffset: 131.95 }} animate={{ strokeDashoffset: 131.95 - (131.95 * progressPct) / 100 }}
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }} style={{ strokeDasharray: 131.95, filter: `drop-shadow(0 0 4px ${isComplete ? 'rgba(34,197,94,0.4)' : color.glow})` }} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isComplete ? <Check size={18} strokeWidth={3} color="#22c55e" /> : <span className="text-[12px] font-bold tabular" style={{ color: color.hex }}>{progressPct}%</span>}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {resources.map(r => (
                            <div key={r.key} className="flex items-center gap-1">
                              <r.icon size={10} fill={r.done ? 'currentColor' : 'none'} style={{ color: r.done ? r.color : 'var(--muted-foreground)' }} />
                              <span style={{ color: r.done ? r.color : 'var(--muted-foreground)' }} className="font-semibold">{r.done ? '✓' : r.label}</span>
                              {r.key === 'revision' && r.count && r.count > 0 && <span className="font-bold" style={{ color: revisionColor }}>×{r.count}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] tabular pt-2" style={{ borderTop: `1px solid ${color.hex}10` }}>
                      {totalStudied > 0 && <span className="flex items-center gap-1"><Play size={10} className="text-green-500" fill="currentColor" /><span className="text-green-600 dark:text-green-400 font-bold">{formatHM(totalStudied)}</span><span className="text-muted-foreground">studied</span></span>}
                      {sessionCount > 0 && <span className="text-muted-foreground">{sessionCount} session{sessionCount === 1 ? '' : 's'}</span>}
                      {totalWasted > 0 && <span className="flex items-center gap-0.5"><span className="text-red-500">⚠</span><span className="text-red-500 font-medium">{formatHM(totalWasted)}</span></span>}
                      {efficiency > 0 && <span className="ml-auto text-muted-foreground">{efficiency}% eff.</span>}
                    </div>
                  </div>

                  {/* === Key Dates === */}
                  <div className="grid grid-cols-3 gap-2">
                    {firstSessionDate && (
                      <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--foreground/5)' }}>
                        <Calendar size={12} className="mx-auto mb-1 text-muted-foreground" />
                        <div className="text-[8px] uppercase font-bold text-muted-foreground">Started</div>
                        <div className="text-[10px] font-bold tabular" style={{ color: 'var(--foreground)' }}>{firstSessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}
                    {doneDate && (
                      <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
                        <Check size={12} className="mx-auto mb-1 text-green-500" />
                        <div className="text-[8px] uppercase font-bold text-green-600 dark:text-green-400">Completed</div>
                        <div className="text-[10px] font-bold tabular" style={{ color: 'var(--foreground)' }}>{doneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}
                    {lastRevisedDate && (
                      <div className="rounded-xl p-2.5 text-center" style={{ background: `${revisionColor}10` }}>
                        <RotateCw size={12} className="mx-auto mb-1" style={{ color: revisionColor }} />
                        <div className="text-[8px] uppercase font-bold" style={{ color: revisionColor }}>Last Rev.</div>
                        <div className="text-[10px] font-bold tabular" style={{ color: 'var(--foreground)' }}>{lastRevisedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}
                  </div>
                  {daysToComplete && (
                    <div className="text-center text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      Completed in <span className="font-bold" style={{ color: 'var(--foreground)' }}>{daysToComplete} day{daysToComplete === 1 ? '' : 's'}</span>
                    </div>
                  )}

                  {/* === Smart Insights === */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                      <Sparkles size={11} /> Insights
                    </div>
                    <div className="space-y-1.5">
                      {isComplete && daysToComplete && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)' }}>
                          <span className="text-green-500">✅</span>
                          <span style={{ color: 'var(--foreground)' }}>Completed in {daysToComplete} day{daysToComplete === 1 ? '' : 's'}</span>
                        </div>
                      )}
                      {totalWasted > 0 && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>
                          <span className="text-red-500">⚠</span>
                          <span style={{ color: 'var(--foreground)' }}>{formatHM(totalWasted)} wasted — {100 - efficiency}% of total time</span>
                        </div>
                      )}
                      {revisionCount > 0 && !isOverdue && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: `${revisionColor}08` }}>
                          <span style={{ color: revisionColor }}>🔥</span>
                          <span style={{ color: 'var(--foreground)' }}>{revisionCount} revision{revisionCount === 1 ? '' : 's'} done — on track</span>
                        </div>
                      )}
                      {isOverdue && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
                          <span className="text-red-500">⏰</span>
                          <span style={{ color: 'var(--foreground)' }}>Revision overdue — review today!</span>
                        </div>
                      )}
                      {isAboveAvgTime && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)' }}>
                          <span className="text-blue-500">📊</span>
                          <span style={{ color: 'var(--foreground)' }}>Above average study time for this chapter</span>
                        </div>
                      )}
                      {isBelowAvgTime && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)' }}>
                          <span className="text-amber-500">📊</span>
                          <span style={{ color: 'var(--foreground)' }}>Below average — may need more time</span>
                        </div>
                      )}
                      {!isComplete && !isAboveAvgTime && !isBelowAvgTime && totalStudied === 0 && (
                        <div className="flex items-center gap-2 text-[11px] py-1.5 px-2.5 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                          <span>📌</span>
                          <span style={{ color: 'var(--foreground)' }}>Not started yet — ready to begin!</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* === Next Steps === */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                      <Target size={11} /> Next Steps
                    </div>
                    <div className="space-y-1">
                      {resources.map(r => (
                        <div key={r.key} className="flex items-center gap-2 text-[11px] py-1">
                          {r.done ? <Check size={12} className="text-green-500 shrink-0" /> : <div className="w-3 h-3 rounded-full border shrink-0" style={{ borderColor: r.color }} />}
                          <span style={{ color: r.done ? 'var(--muted-foreground)' : 'var(--foreground)', textDecoration: r.done ? 'line-through' : 'none' }}>
                            {r.label}{r.key === 'revision' && r.count && r.count > 0 ? ` (${r.count}× done)` : ''}
                          </span>
                        </div>
                      ))}
                      {nextRevisionDate && (
                        <div className="flex items-center gap-2 text-[11px] py-1" style={{ color: isOverdue ? '#ef4444' : 'var(--muted-foreground)' }}>
                          <Clock size={12} className="shrink-0" style={{ color: isOverdue ? '#ef4444' : 'var(--muted-foreground)' }} />
                          <span>{isOverdue ? '⚠ Overdue — review now!' : `Next revision: ${nextRevisionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* === Quick Actions === */}
                  <div className="flex gap-2 pt-2">
                    {!isComplete && (
                      <button onClick={handleStartStudy} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5"
                        style={{ background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`, boxShadow: `0 2px 8px -2px ${color.glow}` }}>
                        <Play size={13} fill="currentColor" /> Start Study
                      </button>
                    )}
                    {lecture.done && (
                      <button onClick={handleAddRevision} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                        style={{ background: `${revisionColor}20`, color: revisionColor, border: `1px solid ${revisionColor}30` }}>
                        <RotateCw size={13} /> Add Revision
                      </button>
                    )}
                    <button onClick={() => { vibrate(8); onEdit(); }} className="px-3 py-2.5 rounded-xl text-[12px] font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--foreground/5)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                      <BookOpen size={13} /> Edit
                    </button>
                  </div>
                </motion.div>
              )}

              {tab === 'timeline' && (
                <motion.div key="timeline" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                  {/* === Visual Timeline === */}
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>Timeline</div>
                  <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-0 bottom-0 w-0.5" style={{ background: 'var(--border)' }} />

                    {lectureSessions.length === 0 && !firstSessionDate && (
                      <div className="py-8 text-center text-[12px]" style={{ color: 'var(--muted-foreground)' }}>No sessions yet. Start studying to build your timeline!</div>
                    )}

                    {firstSessionDate && (
                      <div className="relative mb-3">
                        <div className="absolute -left-[18px] w-3 h-3 rounded-full" style={{ background: color.hex, border: '2px solid var(--popover)' }} />
                        <div className="text-[11px] font-bold" style={{ color: 'var(--foreground)' }}>Started</div>
                        <div className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>{firstSessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}

                    {lectureSessions.map((s, i) => {
                      const date = new Date(s.endedAt);
                      const isRevision = s.topic.toLowerCase().includes('revision') || s.topic.toLowerCase().includes('rev');
                      const dotColor = isRevision ? revisionColor : '#22c55e';
                      return (
                        <div key={s.id || i} className="relative mb-3">
                          <div className="absolute -left-[18px] w-3 h-3 rounded-full" style={{ background: dotColor, border: '2px solid var(--popover)' }} />
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[11px] font-bold" style={{ color: 'var(--foreground)' }}>
                                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                                {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {s.mood && ` · ${s.mood === 'confident' ? '😊' : s.mood === 'okay' ? '🙂' : s.mood === 'struggling' ? '😰' : '😴'}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] font-bold tabular text-green-600 dark:text-green-400">{formatHM(s.studySeconds)}</div>
                              {s.wastedSeconds > 0 && <div className="text-[9px] tabular text-red-500">⚠ {formatHM(s.wastedSeconds)}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {doneDate && (
                      <div className="relative mb-3">
                        <div className="absolute -left-[18px] w-3 h-3 rounded-full" style={{ background: '#22c55e', border: '2px solid var(--popover)' }} />
                        <div className="text-[11px] font-bold text-green-600 dark:text-green-400">✓ Completed!</div>
                        <div className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>{doneDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        {daysToComplete && <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Took {daysToComplete} day{daysToComplete === 1 ? '' : 's'}</div>}
                      </div>
                    )}

                    {lastRevisedDate && (
                      <div className="relative mb-3">
                        <div className="absolute -left-[18px] w-3 h-3 rounded-full" style={{ background: revisionColor, border: '2px solid var(--popover)' }} />
                        <div className="text-[11px] font-bold" style={{ color: revisionColor }}>🔄 Last revision ({revisionCount}×)</div>
                        <div className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>{lastRevisedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}

                    {nextRevisionDate && (
                      <div className="relative mb-3">
                        <div className="absolute -left-[18px] w-3 h-3 rounded-full border-2" style={{ borderColor: isOverdue ? '#ef4444' : revisionColor, background: 'var(--popover)' }} />
                        <div className="text-[11px] font-bold" style={{ color: isOverdue ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {isOverdue ? '⚠ Overdue!' : '⏰ Next revision'}
                        </div>
                        <div className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>{nextRevisionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      </div>
                    )}

                    {/* Spaced repetition schedule */}
                    {revisionCount > 0 && (
                      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="text-[9px] uppercase font-bold tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>Spaced Repetition Schedule</div>
                        <div className="flex items-center gap-1">
                          {REVISION_INTERVALS.map((interval, i) => (
                            <div key={i} className="flex-1 text-center py-1.5 rounded-md text-[9px] font-bold"
                              style={{ background: i < revisionCount ? `${REVISION_COLORS[Math.min(i,4)]}20` : 'var(--foreground/5)', color: i < revisionCount ? REVISION_COLORS[Math.min(i,4)] : 'var(--muted-foreground)', border: i === revisionCount - 1 ? `1px solid ${REVISION_COLORS[Math.min(i,4)]}40` : 'none' }}>
                              {interval}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {tab === 'details' && (
                <motion.div key="details" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">

                  {/* === Properties === */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>Properties</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                        <div className="flex items-center gap-2"><Flame size={13} style={{ color: hardnessColor }} /><span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Difficulty</span></div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-0.5">{[1,2,3,4,5].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.hardness ? hardnessColor : 'var(--foreground/15)' }} />)}</div>
                          <span className="text-[11px] font-bold" style={{ color: hardnessColor }}>{hardnessLabel}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                        <div className="flex items-center gap-2"><TrendingUp size={13} style={{ color: confidenceColor }} /><span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Confidence</span></div>
                        <div className="flex items-center gap-1.5">
                          {lecture.confidence ? <div className="flex gap-0.5">{[1,2,3,4,5].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.confidence! ? confidenceColor : 'var(--foreground/15)' }} />)}</div> : null}
                          <span className="text-[11px] font-bold" style={{ color: confidenceColor }}>{confidenceLabel}</span>
                        </div>
                      </div>
                      {lecture.pyqCount > 0 && (
                        <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                          <div className="flex items-center gap-2"><Award size={13} className="text-amber-500" /><span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>PYQ Questions</span></div>
                          <span className="text-[12px] font-bold tabular text-amber-600 dark:text-amber-400">{lecture.pyqCount}</span>
                        </div>
                      )}
                      {lecture.weightage && (
                        <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--foreground/5)' }}>
                          <div className="flex items-center gap-2"><Zap size={13} className="text-purple-500" /><span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>NEET Weightage</span></div>
                          <span className="text-[12px] font-bold tabular text-purple-600 dark:text-purple-400">{lecture.weightage}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* === Comparison === */}
                  {allChapterLectures.length > 1 && totalStudied > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}><BarChart3 size={11} /> vs Other Lectures in {chapter.name}</div>
                      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--foreground/5)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span style={{ color: 'var(--muted-foreground)' }}>Your time</span>
                          <span className="font-bold tabular" style={{ color: isAboveAvgTime ? '#22c55e' : isBelowAvgTime ? '#f59e0b' : 'var(--foreground)' }}>{formatHM(totalStudied)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span style={{ color: 'var(--muted-foreground)' }}>Chapter average</span>
                          <span className="font-bold tabular" style={{ color: 'var(--muted-foreground)' }}>{formatHM(Math.round(avgStudyTime))}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totalStudied / Math.max(avgStudyTime * 1.5, 1)) * 100)}%`, background: isAboveAvgTime ? '#22c55e' : isBelowAvgTime ? '#f59e0b' : color.hex }} />
                        </div>
                        {isAboveAvgTime && <div className="text-[10px] text-green-600 dark:text-green-400">↑ Above average — great effort!</div>}
                        {isBelowAvgTime && <div className="text-[10px] text-amber-600 dark:text-amber-400">↓ Below average — may need more time</div>}
                      </div>
                    </div>
                  )}

                  {/* === Notes === */}
                  {lecture.notes && lecture.notes.trim() && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>Notes</div>
                      <div className="rounded-xl p-3" style={{ background: 'var(--foreground/5)', border: '1px solid var(--border)' }}>
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{lecture.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* === Edit button === */}
                  <button onClick={() => { vibrate(8); onEdit(); }} className="w-full py-3 rounded-xl text-[13px] font-bold transition active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: `${color.hex}15`, color: color.hex, border: `1px solid ${color.hex}30` }}>
                    <BookOpen size={14} /> Edit Lecture Details
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
