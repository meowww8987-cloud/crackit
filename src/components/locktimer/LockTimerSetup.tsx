'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Lock, AlertTriangle } from 'lucide-react';
import { useLockTimer } from '@/lib/store/lockTimer';
import { useSyllabus } from '@/lib/store/syllabus';
import { getLearnedExpectedMinutes } from '@/lib/store/learnedTime';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';

interface Props {
  onClose: () => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function LockTimerSetup({ onClose }: Props) {
  const start = useLockTimer((s) => s.start);
  const [subject, setSubject] = useState<Subject>('Physics');
  const [chapter, setChapter] = useState<string>('');
  const [targetMinutes, setTargetMinutes] = useState(45);
  const syllabusSubjects = useSyllabus((s) => s.subjects);
  const syllabusChapters = useSyllabus((s) => s.chapters);

  // Auto-fill expected time from learned patterns when subject changes
  useEffect(() => {
    const learned = getLearnedExpectedMinutes(subject, 'Lecture');
    setTargetMinutes(learned);
  }, [subject]);

  // Filter chapters by selected subject
  const subjectChapters = syllabusChapters.filter((c) => {
    const subj = syllabusSubjects.find((s) => s.id === c.subjectId);
    return subj?.name === subject;
  });

  const handleStart = () => {
    vibrate([10, 20, 10]);
    start({
      subject,
      chapter: chapter || undefined,
      targetMinutes,
    });
    onClose();
  };

  const color = subjectColor(subject);

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
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl pointer-events-auto"
          style={{
            background: 'var(--popover, rgba(20,22,30,0.96))',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with subject-color gradient */}
          <div
            className="px-5 pt-5 pb-4 sticky top-0 z-10"
            style={{
              background: `linear-gradient(135deg, ${color.hex}25, ${color.hex}08)`,
              borderBottom: `1px solid ${color.hex}20`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color.hex}25`, color: color.hex }}>
                  <Lock size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Lock-In Timer</h2>
                  <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Commit to focused study</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
                aria-label="Close"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Subject picker */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Subject
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {SUBJECTS.map((s) => {
                  const sc = subjectColor(s);
                  const sel = subject === s;
                  return (
                    <button
                      key={s}
                      onClick={() => { setSubject(s); setChapter(''); vibrate(6); }}
                      className={cn(
                        'px-3 py-2 rounded-xl text-[12px] font-semibold transition border active:scale-95 flex items-center gap-1.5',
                        sel ? 'text-white border-transparent' : 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
                      )}
                      style={sel ? { background: sc.hex, boxShadow: `0 2px 8px -2px ${sc.glow}` } : undefined}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: sel ? '#fff' : sc.hex }} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chapter picker (optional) */}
            {subjectChapters.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                  Chapter <span className="opacity-50">(optional)</span>
                </label>
                <select
                  value={chapter}
                  onChange={(e) => { setChapter(e.target.value); vibrate(6); }}
                  className="w-full bg-foreground/5 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
                  style={{ color: 'var(--foreground)' }}
                >
                  <option value="">No specific chapter</option>
                  {subjectChapters.map((ch) => (
                    <option key={ch.id} value={ch.name}>{ch.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration presets */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Duration
              </label>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {DURATION_PRESETS.map((d) => {
                  const sel = targetMinutes === d;
                  return (
                    <button
                      key={d}
                      onClick={() => { setTargetMinutes(d); vibrate(6); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[12px] font-bold tabular transition border active:scale-95',
                        sel ? 'text-white border-transparent' : 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
                      )}
                      style={sel ? { background: color.hex } : undefined}
                    >
                      {d < 60 ? `${d}m` : `${d / 60}h`}
                    </button>
                  );
                })}
              </div>

              {/* Custom slider */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Custom</span>
                <span className="text-[12px] font-bold tabular" style={{ color: color.hex }}>{targetMinutes} min</span>
              </div>
              <ScrollAwareSlider>
                <input
                  type="range" min={5} max={180} step={5}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="w-full"
                />
              </ScrollAwareSlider>
            </div>

            {/* Warning */}
            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: `${color.hex}10`, border: `1px solid ${color.hex}25` }}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: color.hex }} />
              <div className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Cannot be paused.</span> Double-tap to cancel — partial time will count as study. App can be closed; timer resumes on reopen.
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`,
                boxShadow: `0 4px 16px -4px ${color.glow}`,
              }}
            >
              <Lock size={16} />
              Start Lock-In ({targetMinutes < 60 ? `${targetMinutes}m` : `${targetMinutes / 60}h`})
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
