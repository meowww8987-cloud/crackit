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
  const [selectedLecNums, setSelectedLecNums] = useState<Set<number>>(new Set());
  const [includedResources, setIncludedResources] = useState<Set<LectureResource>>(new Set(['lecture', 'dpp', 'notes', 'revision']));
  const [addToToday, setAddToToday] = useState(true);

  // Compute next lecture number
  const nextLecNo = useMemo(() => {
    const state = useSyllabus.getState();
    const chapterLecs = state.lectures.filter((l) => l.chapterId === chapter.id && !l.isCustom);
    return chapterLecs.length + 1;
  }, [chapter.id]);

  // Generate selectable lecture numbers: next 5 starting from nextLecNo
  const selectableLecNums = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => nextLecNo + i);
  }, [nextLecNo]);

  const toggleLecNum = (num: number) => {
    vibrate(6);
    setSelectedLecNums((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const selectAllLecNums = () => {
    vibrate(8);
    if (selectedLecNums.size === selectableLecNums.length) {
      setSelectedLecNums(new Set());
    } else {
      setSelectedLecNums(new Set(selectableLecNums));
    }
  };

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
    const nums = Array.from(selectedLecNums).sort((a, b) => a - b);
    if (nums.length === 0) {
      // If nothing selected, add just the next one
      nums.push(nextLecNo);
    }
    let added = 0;
    for (const lecNo of nums) {
      const topicName = topic.trim() || `Lecture ${lecNo}`;
      const lecId = addLecture(chapter.id, topicName);
      if (addToToday) {
        addTarget({
          date: todayKey(), subject: subject.name, activity: 'Lecture',
          chapter: chapter.name, lecture: `L${lecNo}`, topic: topicName,
          expectedMinutes: 60, lectureId: lecId, chapterId: chapter.id,
        });
      }
      added++;
    }
    if (showToast) {
      showToast(
        addToToday ? `✅ ${added} lecture${added > 1 ? 's' : ''} added + to today` : `✅ ${added} lecture${added > 1 ? 's' : ''} added`,
        `${chapter.name} · L${nums[0]}${nums.length > 1 ? `-L${nums[nums.length - 1]}` : ''}`
      );
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto scroll-area"
        style={{ borderTop: `3px solid ${color.hex}` }}
      >
        <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color.hex}22` }}>
              <Plus size={16} style={{ color: color.hex }} />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Add Lecture</h2>
              <div className="text-[10px] text-muted-foreground truncate">{chapter.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Lecture number selection — checkboxes for L4, L5, L6, L7, L8 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-foreground">SELECT LECTURES</label>
            <button onClick={selectAllLecNums} className="text-[10px] text-teal-400">
              {selectedLecNums.size === selectableLecNums.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectableLecNums.map((num) => {
              const sel = selectedLecNums.has(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleLecNum(num)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-bold transition border',
                    sel ? 'text-black border-0' : 'border border-border bg-foreground/[0.04] text-muted-foreground'
                  )}
                  style={sel ? { background: color.hex } : undefined}
                >
                  L{num}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            {selectedLecNums.size > 0
              ? `${selectedLecNums.size} selected · will create L${Array.from(selectedLecNums).sort((a,b)=>a-b).map(n => `L${n}`).join(', ')}`
              : `Tap to select. If none selected, L${nextLecNo} will be created.`
            }
          </p>
        </div>

        {/* Topic input (optional, applies to all selected) */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">
            TOPIC NAME (optional)
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`Leave empty for auto "Lecture N"`}
            className="w-full bg-foreground/5 border border-border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-400/50"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>

        {/* Resource inclusions */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">
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
                    included ? 'border-2' : 'border border-border bg-foreground/[0.04]'
                  )}
                  style={included ? { background: `${res.color}15`, borderColor: res.color } : undefined}
                >
                  <span className="text-base">{res.icon}</span>
                  <span className={cn('text-xs font-semibold flex-1 text-left', included ? 'text-white' : 'text-muted-foreground')}>
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
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            Uncheck resources this lecture doesn't have
          </p>
        </div>

        {/* Add to today toggle */}
        <div className="mb-4 glass rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold">Add to today's targets</div>
            <div className="text-[10px] text-muted-foreground">Creates a 60-min target for today</div>
          </div>
          <button
            onClick={() => { setAddToToday(!addToToday); vibrate(8); }}
            className={cn('w-12 h-7 rounded-full transition relative', addToToday ? 'bg-teal-500' : 'bg-foreground/10')}
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
          <Plus size={16} /> Add {selectedLecNums.size > 0 ? `${selectedLecNums.size} ` : ''}Lecture{selectedLecNums.size > 1 ? 's' : ''}
        </button>
      </motion.div>
    </motion.div>
  );
}
