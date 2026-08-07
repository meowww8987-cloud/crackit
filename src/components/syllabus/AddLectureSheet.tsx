'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { subjectColor } from '@/lib/colors';
import type { Chapter, SubjectEntity, LectureResource } from '@/lib/types';
import { cn, todayKey, vibrate } from '@/lib/utils';

interface Props {
  chapter: Chapter;
  subject: SubjectEntity;
  onClose: () => void;
  showToast?: (msg: string, sub?: string) => void;
}

const RESOURCE_OPTIONS: { key: LectureResource; icon: string; label: string; color: string }[] = [
  { key: 'lecture', icon: '📺', label: 'Lecture', color: '#14b8a6' },
  { key: 'dpp', icon: '📝', label: 'DPP', color: '#22c55e' },
  { key: 'notes', icon: '📖', label: 'Notes', color: '#3b82f6' },
  { key: 'revision', icon: '🔄', label: 'Revision', color: '#f59e0b' },
];

export function AddLectureSheet({ chapter, subject, onClose, showToast }: Props) {
  const addLecture = useSyllabus((s) => s.addLecture);
  const addTarget = useTargets((s) => s.addTarget);

  const color = subjectColor(subject.name);

  const [topic, setTopic] = useState('');
  const [includedResources, setIncludedResources] = useState<Set<LectureResource>>(new Set(['lecture', 'dpp', 'notes', 'revision']));
  const [addToToday, setAddToToday] = useState(true);

  // Compute next lecture number
  const nextLecNo = useMemo(() => {
    const state = useSyllabus.getState();
    const chapterLecs = state.lectures.filter((l) => l.chapterId === chapter.id && !l.isCustom);
    return chapterLecs.length + 1;
  }, [chapter.id]);

  const toggleResource = (res: LectureResource) => {
    vibrate(6);
    setIncludedResources((prev) => {
      const next = new Set(prev);
      if (next.has(res)) next.delete(res);
      else next.add(res);
      return next;
    });
  };

  const handleAdd = () => {
    vibrate(15);
    const finalTopic = topic.trim() || `Lecture ${nextLecNo}`;
    const lecId = addLecture(chapter.id, finalTopic);

    if (addToToday) {
      addTarget({
        date: todayKey(),
        subject: subject.name,
        activity: 'Lecture',
        chapter: chapter.name,
        lecture: `L${nextLecNo}`,
        topic: finalTopic,
        expectedMinutes: 60,
        lectureId: lecId,
        chapterId: chapter.id,
      });
    }

    if (showToast) {
      showToast(
        addToToday ? '✅ Lecture added + to today' : '✅ Lecture added',
        `${chapter.name} · L${nextLecNo}`
      );
    }
    onClose();
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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl p-5 pb-8"
        style={{ borderTop: `3px solid ${color.hex}` }}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color.hex}22` }}>
              <Plus size={16} style={{ color: color.hex }} />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Add Lecture</h2>
              <div className="text-[10px] text-white/40 truncate">{chapter.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        {/* Topic input */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            LECTURE NAME (optional)
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`Leave empty for auto L${nextLecNo}`}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-400/50"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <p className="text-[10px] text-white/30 mt-1">
            Will be: <span className="font-bold tabular" style={{ color: color.hex }}>L{nextLecNo}</span>
            {topic.trim() && ` - ${topic.trim()}`}
          </p>
        </div>

        {/* Resource inclusions */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            RESOURCES TO TRACK
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RESOURCE_OPTIONS.map((res) => {
              const included = includedResources.has(res.key);
              return (
                <button
                  key={res.key}
                  onClick={() => toggleResource(res.key)}
                  className={cn(
                    'p-2.5 rounded-xl flex items-center gap-2 transition border',
                    included ? 'border-2' : 'border border-white/5 bg-white/[0.03]'
                  )}
                  style={included ? { background: `${res.color}15`, borderColor: res.color } : undefined}
                >
                  <span className="text-base">{res.icon}</span>
                  <span className={cn('text-xs font-semibold flex-1 text-left', included ? 'text-white' : 'text-white/40')}>
                    {res.label}
                  </span>
                  {included && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: res.color }}>
                      <Check size={10} className="text-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-white/30 mt-1.5">
            Uncheck resources this lecture doesn't have
          </p>
        </div>

        {/* Add to today toggle */}
        <div className="mb-4 glass rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold">Add to today's targets</div>
            <div className="text-[10px] text-white/40">Creates a 60-min target for today</div>
          </div>
          <button
            onClick={() => { setAddToToday(!addToToday); vibrate(8); }}
            className={cn('w-12 h-7 rounded-full transition relative', addToToday ? 'bg-teal-500' : 'bg-white/10')}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn('absolute top-1 w-5 h-5 rounded-full bg-white', addToToday ? 'left-6' : 'left-1')}
            />
          </button>
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-black active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: color.hex }}
        >
          <Plus size={16} /> Add Lecture
        </button>
      </motion.div>
    </motion.div>
  );
}
