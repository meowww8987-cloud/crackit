'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity, LectureResource, ActivityType } from '@/lib/types';
import { cn, todayKey, vibrate, formatHM } from '@/lib/utils';

interface Props {
  lecture: Lecture;
  chapter: Chapter;
  subject: SubjectEntity;
  index: number;
  onEdit: () => void;
}

const RESOURCES: { key: LectureResource; icon: string; label: string; color: string }[] = [
  { key: 'lecture', icon: '📺', label: 'Lecture', color: '#14b8a6' },
  { key: 'dpp', icon: '📝', label: 'DPP', color: '#22c55e' },
  { key: 'notes', icon: '📖', label: 'Notes', color: '#3b82f6' },
  { key: 'revision', icon: '🔄', label: 'Revision', color: '#f59e0b' },
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

  const isAddedToday = isAlreadyAdded(subject.name, chapter.name, 'Lecture', `L${lecture.lecNo}`);
  const labelPrefix = lecture.isCustom ? 'C' : 'L';
  const isEven = index % 2 === 0;

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
      className="rounded-xl p-2.5 transition-colors"
      style={{
        borderLeft: `3px solid ${progressPct === 100 ? '#22c55e' : color.hex}`,
        background: isEven ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
      }}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onTouchCancel={handleLongPressEnd}
    >
      {/* Row 1: +Today mini button + Label + topic + progress */}
      <div className="flex items-center gap-2 mb-2">
        {/* +Today mini button (right of lecture number) */}
        <button
          onClick={handleAddTodayClick}
          disabled={isAddedToday}
          className={cn(
            'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition',
            isAddedToday
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          )}
          title={isAddedToday ? 'Already added to today' : 'Add to today targets'}
        >
          {isAddedToday ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
        </button>

        <span className={cn('text-[10px] font-bold text-white/40 tabular shrink-0 w-6', lecture.done && 'line-through')}>
          {labelPrefix}{lecture.lecNo}
        </span>
        <span className={cn('text-xs flex-1 truncate', lecture.done && 'line-through text-white/40')}>
          {lecture.topic}
        </span>
        {lecture.isCustom && (
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500/30 text-purple-300">
            CUSTOM
          </span>
        )}
        <span className="text-[9px] tabular font-bold shrink-0" style={{ color: progressPct === 100 ? '#22c55e' : '#ffffff60' }}>
          {doneCount}/4
        </span>
      </div>

      {/* Row 2: Progress bar */}
      <div className="h-1 rounded-full bg-white/5 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: progressPct === 100 ? '#22c55e' : color.hex }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Row 3: 4 resource toggle buttons */}
      <div className="flex gap-1.5">
        {RESOURCES.map((res) => {
          const isDone =
            res.key === 'lecture' ? lecture.done :
            res.key === 'dpp' ? lecture.dppDone :
            res.key === 'notes' ? lecture.notesDone :
            lecture.revisionDone;
          return (
            <button
              key={res.key}
              onClick={(e) => handleResourceToggle(res.key, e)}
              className={cn(
                'flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition border',
                isDone ? 'text-black' : 'border-white/10 bg-white/[0.03]'
              )}
              style={isDone ? { background: res.color, borderColor: res.color } : undefined}
              title={res.label}
            >
              <span className="text-[10px]">{res.icon}</span>
              {isDone && <Check size={9} strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      {/* Stats row — time spent, wasted, confidence, done date */}
      {((lecture.timeSpentSec && lecture.timeSpentSec > 0) || lecture.doneDate) && (
        <div className="flex items-center gap-2 mt-1.5 mb-0.5 text-[9px] tabular text-white/40 flex-wrap">
          {lecture.timeSpentSec && lecture.timeSpentSec > 0 && (
            <span className="flex items-center gap-0.5">
              <span style={{ color: '#22c55e' }}>▶</span> {formatHM(lecture.timeSpentSec)}
            </span>
          )}
          {lecture.timeWastedSec && lecture.timeWastedSec > 0 && (
            <span className="flex items-center gap-0.5">
              <span style={{ color: '#ef4444' }}>⚠</span> {formatHM(lecture.timeWastedSec)}
            </span>
          )}
          {lecture.confidence && lecture.confidence > 0 && (
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <span
                  key={d}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: d <= lecture.confidence!
                      ? (lecture.confidence! >= 4 ? '#22c55e' : lecture.confidence! >= 3 ? '#f59e0b' : '#ef4444')
                      : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </span>
          )}
          {lecture.doneDate && (
            <span className="ml-auto text-white/30">
              {new Date(lecture.doneDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* Inline Add-to-Today panel (expands when +Today is tapped) */}
      <AnimatePresence>
        {showAddToday && !isAddedToday && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2"
          >
            <div className="glass rounded-xl p-2.5 space-y-2.5" style={{ borderLeft: `2px solid ${color.hex}` }}>
              {/* Activity pills */}
              <div>
                <label className="text-[9px] font-bold text-white/40 uppercase mb-1 block">Activity</label>
                <div className="flex gap-1 flex-wrap">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a}
                      onClick={(e) => { e.stopPropagation(); setActivity(a); vibrate(6); }}
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] font-medium transition',
                        activity === a ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
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
                  <label className="text-[9px] font-bold text-white/40 uppercase">Expected Time</label>
                  <span className="text-[10px] font-bold tabular text-teal-400">{expectedMinutes} min</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={180}
                  step={5}
                  value={expectedMinutes}
                  onChange={(e) => setExpectedMinutes(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full"
                />
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirmAddToday}
                className="w-full py-2 rounded-lg text-[10px] font-bold text-black transition active:scale-95"
                style={{ background: color.hex }}
              >
                <Check size={10} className="inline mr-1" /> Add to Today ({expectedMinutes}m)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Long-press actions */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-white/5">
              <button
                onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
                className="flex-1 py-1 rounded-lg bg-white/5 text-white/60 text-[10px] font-semibold flex items-center justify-center gap-1"
              >
                <Pencil size={10} /> Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this lecture?')) {
                    deleteLecture(lecture.id);
                    vibrate(15);
                  }
                  setShowActions(false);
                }}
                className="flex-1 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-semibold flex items-center justify-center gap-1"
              >
                <Trash2 size={10} /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
