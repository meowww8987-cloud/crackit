'use client';

import { motion } from 'framer-motion';
import { Star, Check, Clock, Trash2, Pencil } from 'lucide-react';
import { useState, useRef } from 'react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { subjectColor } from '@/lib/colors';
import type { Lecture, Chapter, SubjectEntity } from '@/lib/types';
import { cn, isRevisionOverdue, todayKey, vibrate } from '@/lib/utils';

interface Props {
  lecture: Lecture;
  chapter: Chapter;
  subject: SubjectEntity;
  onEdit: () => void;
}

export function LectureRow({ lecture, chapter, subject, onEdit }: Props) {
  const toggleDone = useSyllabus((s) => s.toggleLectureDone);
  const setHardness = useSyllabus((s) => s.setHardness);
  const deleteLecture = useSyllabus((s) => s.deleteLecture);
  const advanceRevision = useSyllabus((s) => s.advanceRevision);
  const addTarget = useTargets((s) => s.addTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);

  const color = subjectColor(subject.name);
  const isOverdue = lecture.done && isRevisionOverdue(lecture.nextRevisionAt);
  const isAddedToday = isAlreadyAdded(
    subject.name,
    chapter.name,
    'Lecture',
    lecture.isCustom ? undefined : `L${lecture.lecNo}`
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);

  const handleAddToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAddedToday) return;
    vibrate(12);
    addTarget({
      date: todayKey(),
      subject: subject.name,
      activity: 'Lecture',
      chapter: chapter.name,
      lecture: lecture.isCustom ? `C${lecture.lecNo}` : `L${lecture.lecNo}`,
      topic: lecture.topic,
      expectedMinutes: 60,
      lectureId: lecture.id,
    });
  };

  const handleHardness = (e: React.MouseEvent, level: number) => {
    e.stopPropagation();
    vibrate(8);
    setHardness(lecture.id, level);
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

  const labelPrefix = lecture.isCustom ? 'C' : 'L';

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg bg-foreground/[0.03] relative',
        isOverdue && 'border border-amber-500/30'
      )}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onTouchCancel={handleLongPressEnd}
    >
      {/* Done checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); vibrate(10); toggleDone(lecture.id); }}
        className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
        style={{
          background: lecture.done ? '#22c55e' : 'transparent',
          borderColor: lecture.done ? '#22c55e' : 'rgba(255,255,255,0.3)',
        }}
      >
        {lecture.done && <Check size={12} className="text-black" strokeWidth={3} />}
      </button>

      {/* Label */}
      <span className="text-[10px] font-bold text-muted-foreground tabular shrink-0 w-6">
        {labelPrefix}{lecture.lecNo}
      </span>

      {/* Topic + date */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs truncate', lecture.done && 'line-through text-muted-foreground')}>
          {lecture.topic}
          {lecture.isCustom && (
            <span className="ml-1.5 text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500/30 text-purple-300">
              CUSTOM
            </span>
          )}
        </div>
        {lecture.date && (
          <div className="text-[9px] text-muted-foreground/60">
            {new Date(lecture.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Overdue clock */}
      {isOverdue && (
        <button
          onClick={(e) => { e.stopPropagation(); vibrate(10); advanceRevision(lecture.id); }}
          className="text-amber-400 shrink-0"
          title="Overdue revision — tap to mark revised"
        >
          <Clock size={14} className="pulse-slow" />
        </button>
      )}

      {/* Hardness stars */}
      <div className="flex shrink-0">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={(e) => handleHardness(e, level)}
            className="p-0.5"
          >
            <Star
              size={10}
              className={cn(
                level <= lecture.hardness ? 'text-amber-400' : 'text-muted-foreground/20'
              )}
              fill={level <= lecture.hardness ? 'currentColor' : 'none'}
            />
          </button>
        ))}
      </div>

      {/* +Today button */}
      <button
        onClick={handleAddToday}
        disabled={isAddedToday}
        className={cn(
          'shrink-0 px-2 py-1 rounded-md text-[10px] font-bold transition',
          isAddedToday
            ? 'bg-green-500/20 text-green-400'
            : 'bg-foreground/10 text-white hover:bg-foreground/15'
        )}
      >
        {isAddedToday ? (
          <span className="flex items-center gap-0.5"><Check size={10} /> ADDED</span>
        ) : (
          <span>+Today</span>
        )}
      </button>

      {/* Long-press actions */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute right-0 top-full mt-1 z-10 glass rounded-lg p-1 flex gap-1"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
            className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this lecture?')) {
                deleteLecture(lecture.id);
              }
              setShowActions(false);
            }}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
