'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Layers, Zap, Check } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor } from '@/lib/colors';
import type { SubjectEntity } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  subject: SubjectEntity;
  onClose: () => void;
  showToast?: (msg: string, sub?: string) => void;
}

export function AddChapterSheet({ subject, onClose, showToast }: Props) {
  const addChapter = useSyllabus((s) => s.addChapter);
  const bulkAddLectures = useSyllabus((s) => s.bulkAddLectures);

  const color = subjectColor(subject.name);

  const [chapterName, setChapterName] = useState('');
  const [lecturesText, setLecturesText] = useState('');
  const [pyqCount, setPyqCount] = useState(0);

  // Parse lectures text into array
  const parsedLectures = useMemo(() => {
    return lecturesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }, [lecturesText]);

  const handleQuickAdd = (count: number) => {
    vibrate(8);
    const lines: string[] = [];
    const existing = parsedLectures.length;
    for (let i = 1; i <= count; i++) {
      lines.push(`L${existing + i} - Topic ${existing + i}`);
    }
    setLecturesText(lecturesText + (lecturesText ? '\n' : '') + lines.join('\n'));
  };

  const handleCreate = () => {
    if (!chapterName.trim()) return;
    vibrate(15);

    // 1. Create chapter
    const chapterId = addChapter(subject.id, chapterName.trim());

    // 2. Bulk-add lectures if provided
    let lecturesAdded = 0;
    if (parsedLectures.length > 0) {
      lecturesAdded = bulkAddLectures(chapterId, parsedLectures);
    }

    // 3. Show toast
    if (showToast) {
      const parts: string[] = [`1 chapter: ${chapterName.trim()}`];
      if (lecturesAdded > 0) parts.push(`${lecturesAdded} lectures`);
      showToast('✅ Chapter created', parts.join(' · '));
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
        className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col"
        style={{ borderTop: `3px solid ${color.hex}` }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color.hex}22` }}
              >
                <Layers size={16} style={{ color: color.hex }} />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">New Chapter</h2>
                <div className="text-[10px] font-bold uppercase" style={{ color: color.hex }}>
                  {subject.name}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto scroll-area px-5 py-4">

        {/* Chapter name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">CHAPTER NAME *</label>
          <input
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder="e.g. Kinematics"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-400/50"
            style={chapterName ? { borderColor: `${color.hex}50` } : undefined}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {/* Quick-add lectures */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-white/60">QUICK-ADD LECTURES</label>
            <span className="text-[10px] text-white/40 tabular">{parsedLectures.length} lectures</span>
          </div>
          <textarea
            value={lecturesText}
            onChange={(e) => setLecturesText(e.target.value)}
            placeholder={'One lecture per line, e.g.\nL1 - Motion in a Straight Line\nL2 - Uniform Acceleration\nL3 - Equations of Motion'}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-teal-400/50 min-h-[90px] font-mono"
          />
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => handleQuickAdd(5)}
              className="flex-1 py-1.5 rounded-lg bg-white/5 text-white/70 text-[10px] font-semibold hover:bg-white/10 transition flex items-center justify-center gap-1"
            >
              <Zap size={10} /> +5 Lectures
            </button>
            <button
              onClick={() => handleQuickAdd(10)}
              className="flex-1 py-1.5 rounded-lg bg-white/5 text-white/70 text-[10px] font-semibold hover:bg-white/10 transition flex items-center justify-center gap-1"
            >
              <Zap size={10} /> +10 Lectures
            </button>
            <button
              onClick={() => setLecturesText('')}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 text-[10px] font-semibold hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>

        {/* PYQ count */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">PYQ COUNT (optional)</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPyqCount(Math.max(0, pyqCount - 1)); vibrate(6); }}
              className="w-9 h-9 rounded-lg bg-white/5 text-white text-lg font-bold flex items-center justify-center"
            >
              −
            </button>
            <span className="text-xl font-bold tabular flex-1 text-center" style={{ color: pyqCount > 0 ? color.hex : '#ffffff60' }}>
              {pyqCount}
            </span>
            <button
              onClick={() => { setPyqCount(pyqCount + 1); vibrate(6); }}
              className="w-9 h-9 rounded-lg bg-white/5 text-white text-lg font-bold flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Live preview */}
        {(chapterName.trim() || parsedLectures.length > 0) && (
          <div className="mb-4 glass rounded-xl p-3 border" style={{ borderColor: `${color.hex}30` }}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-2">Will create:</div>
            <div className="space-y-1 text-xs">
              {chapterName.trim() && (
                <div className="flex items-center gap-1.5">
                  <Check size={11} style={{ color: color.hex }} />
                  <span className="text-white/80">1 chapter: <strong>{chapterName.trim()}</strong></span>
                </div>
              )}
              {parsedLectures.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Check size={11} style={{ color: color.hex }} />
                  <span className="text-white/80"><strong>{parsedLectures.length}</strong> lectures</span>
                </div>
              )}
              {pyqCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Check size={11} style={{ color: color.hex }} />
                  <span className="text-white/80"><strong>{pyqCount}</strong> PYQ count</span>
                </div>
              )}
            </div>
          </div>
        )}

        </div>

        {/* Sticky footer with Create button */}
        <div className="sticky bottom-0 z-10 px-5 py-3 glass" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={handleCreate}
            disabled={!chapterName.trim()}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2',
              chapterName.trim()
                ? 'text-black'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
            )}
            style={chapterName.trim() ? { background: color.hex } : undefined}
          >
            <Plus size={16} />
            Create Chapter
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
