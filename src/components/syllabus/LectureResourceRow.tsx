'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Pencil, Trash2, Play, FileText, BookOpen, RotateCw } from 'lucide-react';
import { useState, useRef } from 'react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
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

const RESOURCES: { key: LectureResource; icon: typeof Play; label: string; color: string; doneColor: string }[] = [
  { key: 'lecture', icon: Play, label: 'Lecture', color: '#14b8a6', doneColor: '#14b8a6' },
  { key: 'dpp', icon: FileText, label: 'DPP', color: '#22c55e', doneColor: '#22c55e' },
  { key: 'notes', icon: BookOpen, label: 'Notes', color: '#3b82f6', doneColor: '#3b82f6' },
  { key: 'revision', icon: RotateCw, label: 'Revision', color: '#f59e0b', doneColor: '#f59e0b' },
];

const ACTIVITIES: ActivityType[] = ['Lecture', 'DPP', 'Notes', 'Revision', 'Custom'];

export function LectureResourceRow({ lecture, chapter, subject, index, onEdit }: Props) {
  const toggleResource = useSyllabus((s) => s.toggleLectureResource);
  const deleteLecture = useSyllabus((s) => s.deleteLecture);
  const addTarget = useTargets((s) => s.addTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);

  const color = subjectColor(subject.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showAddToday, setShowAddToday] = useState(false);
  const [activity, setActivity] = useState<ActivityType>('Lecture');
  const [expectedMinutes, setExpectedMinutes] = useState(60);

  const doneCount = [lecture.done, lecture.dppDone, lecture.notesDone, lecture.revisionDone].filter(Boolean).length;
  const progressPct = Math.round((doneCount / 4) * 100);
  const isComplete = progressPct === 100;

  const isAddedToday = isAlreadyAdded(subject.name, chapter.name, 'Lecture', `L${lecture.lecNo}`);
  const labelPrefix = lecture.isCustom ? 'C' : 'L';

  const handleResourceToggle = (resource: LectureResource, e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(10);
    toggleResource(lecture.id, resource);
  };

  const handleAddTodayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAddedToday) return;
    vibrate(8);
    setShowAddToday(!showAddToday);
  };

  const handleConfirmAddToday = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-xl p-3 transition-all border"
      style={{
        borderLeft: `3px solid ${isComplete ? '#22c55e' : color.hex}`,
        borderColor: 'var(--border-card)',
        background: isComplete ? 'rgba(34, 197, 94, 0.04)' : 'var(--bg-card)',
      }}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onTouchCancel={handleLongPressEnd}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <button
          onClick={handleAddTodayClick}
          disabled={isAddedToday}
          className={cn(
            'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition border',
            isAddedToday
              ? 'bg-green-500/15 text-green-500 dark:text-green-400 border-green-500/30'
              : 'bg-white/5 text-t-secondary border-white/10 hover:bg-white/10 hover:border-white/20'
          )}
          title={isAddedToday ? 'Already added to today' : 'Add to today targets'}
        >
          {isAddedToday ? <Check size={13} strokeWidth={3} /> : <Plus size={13} />}
        </button>
        <div
          className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold tabular"
          style={{
            background: isComplete ? 'rgba(34,197,94,0.15)' : `${color.hex}15`,
            color: isComplete ? '#22c55e' : color.hex,
          }}
        >
          {labelPrefix}{lecture.lecNo}
        </div>
        <span className={cn('text-sm flex-1 truncate font-medium', isComplete ? 'text-t-muted line-through' : 'text-t-primary')}>{lecture.topic}</span>
        {lecture.isCustom && (<span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500 dark:text-purple-400 border border-purple-500/20">CUSTOM</span>)}
        <span className="text-[10px] tabular font-bold shrink-0 px-1.5 py-0.5 rounded-md" style={{ color: isComplete ? '#22c55e' : doneCount > 0 ? color.hex : 'var(--text-muted)', background: isComplete ? 'rgba(34,197,94,0.1)' : doneCount > 0 ? `${color.hex}15` : 'transparent' }}>{doneCount}/4</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2.5">
        <motion.div className="h-full rounded-full" style={{ background: isComplete ? 'linear-gradient(90deg, #22c55e, #16a34a)' : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)` }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {RESOURCES.map((res) => {
          const isDone = res.key === 'lecture' ? lecture.done : res.key === 'dpp' ? lecture.dppDone : res.key === 'notes' ? lecture.notesDone : lecture.revisionDone;
          const Icon = res.icon;
          return (
            <button key={res.key} onClick={(e) => handleResourceToggle(res.key, e)} className={cn('py-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition border', isDone ? 'text-black border-transparent' : 'border-white/10 bg-white/[0.03] text-t-muted hover:bg-white/[0.07] hover:border-white/20')} style={isDone ? { background: res.doneColor } : undefined} title={res.label}>
              <Icon size={13} fill={isDone ? 'currentColor' : 'none'} />
              <span className="text-[8px] font-semibold uppercase tracking-wide">{res.label}</span>
            </button>
          );
        })}
      </div>
      {((lecture.timeSpentSec && lecture.timeSpentSec > 0) || lecture.doneDate) && (
        <div className="flex items-center gap-3 mt-2.5 text-[10px] tabular text-t-muted flex-wrap">
          {lecture.timeSpentSec && lecture.timeSpentSec > 0 && (<span className="flex items-center gap-1"><Play size={9} className="text-green-500 dark:text-green-400" fill="currentColor" /><span className="text-t-secondary font-medium">{formatHM(lecture.timeSpentSec)}</span></span>)}
          {lecture.timeWastedSec && lecture.timeWastedSec > 0 && (<span className="flex items-center gap-1"><span className="text-red-500 dark:text-red-400">⚠</span><span className="text-red-500 dark:text-red-400 font-medium">{formatHM(lecture.timeWastedSec)}</span></span>)}
          {lecture.confidence && lecture.confidence > 0 && (<span className="flex items-center gap-1">{[1, 2, 3, 4, 5].map((d) => (<span key={d} className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: d <= lecture.confidence! ? (lecture.confidence! >= 4 ? '#22c55e' : lecture.confidence! >= 3 ? '#f59e0b' : '#ef4444') : 'rgba(128,128,128,0.2)' }} />))}</span>)}
          {lecture.doneDate && (<span className="ml-auto text-t-muted">{new Date(lecture.doneDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>)}
        </div>
      )}
      <AnimatePresence>
        {showAddToday && !isAddedToday && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2.5">
            <div className="rounded-xl p-3 space-y-3 border" style={{ borderLeft: `2px solid ${color.hex}`, background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
              <div>
                <label className="text-[9px] font-bold text-t-muted uppercase mb-1.5 block tracking-wide">Activity</label>
                <div className="flex gap-1 flex-wrap">
                  {ACTIVITIES.map((a) => (<button key={a} onClick={(e) => { e.stopPropagation(); setActivity(a); vibrate(6); }} className={cn('px-2.5 py-1 rounded-full text-[10px] font-medium transition border', activity === a ? 'bg-teal-500 text-black border-teal-500' : 'bg-white/5 text-t-secondary border-white/10 hover:bg-white/10')}>{a}</button>))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[9px] font-bold text-t-muted uppercase tracking-wide">Expected Time</label><span className="text-[11px] font-bold tabular text-teal-500 dark:text-teal-400">{expectedMinutes} min</span></div>
                <ScrollAwareSlider>
                  <input type="range" min={15} max={180} step={5} value={expectedMinutes} onChange={(e) => setExpectedMinutes(Number(e.target.value))} onClick={(e) => e.stopPropagation()} className="w-full" />
                </ScrollAwareSlider>
              </div>
              <button onClick={handleConfirmAddToday} className="w-full py-2.5 rounded-lg text-[11px] font-bold text-black transition active:scale-95 flex items-center justify-center gap-1.5" style={{ background: color.hex }}><Check size={11} /> Add to Today ({expectedMinutes}m)</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showActions && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-white/10">
              <button onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }} className="flex-1 py-1.5 rounded-lg bg-white/5 text-t-secondary text-[10px] font-semibold flex items-center justify-center gap-1 border border-white/10 hover:bg-white/10"><Pencil size={10} /> Edit</button>
              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this lecture?')) { deleteLecture(lecture.id); vibrate(15); } setShowActions(false); }} className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-semibold flex items-center justify-center gap-1 border border-red-500/20 hover:bg-red-500/20"><Trash2 size={10} /> Delete</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
