'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Infinity as InfinityIcon, Clock } from 'lucide-react';
import { usePractice } from '@/lib/store/practice';
import { useSyllabus } from '@/lib/store/syllabus';
import { useSettings } from '@/lib/store/settings';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import { cn, vibrate } from '@/lib/utils';
import type { Subject } from '@/lib/types';

const SUBJECTS: (Subject | 'Mixed')[] = ['Mixed', 'Physics', 'Chemistry', 'Botany', 'Zoology'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PracticeSetupSheet({ open, onClose }: Props) {
  const startPractice = usePractice((s) => s.startPractice);
  const subjects = useSyllabus((s) => s.subjects);
  const chapters = useSyllabus((s) => s.chapters);
  const haptics = useSettings((s) => s.haptics);

  const [step, setStep] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<'Mixed' | Subject>('Mixed');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('All');
  const [questionCount, setQuestionCount] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [practiceName, setPracticeName] = useState('');

  const availableChapters = selectedSubject === 'Mixed'
    ? []
    : chapters.filter((ch) => {
        const subj = subjects.find((s) => s.id === ch.subjectId);
        return subj?.name === selectedSubject;
      });

  const handleStart = () => {
    if (haptics) vibrate(15);
    const chapterName = selectedChapterId === 'All'
      ? 'All'
      : availableChapters.find((ch) => ch.id === selectedChapterId)?.name || 'All';
    startPractice({
      name: practiceName || undefined,
      subject: selectedSubject,
      chapter: chapterName,
      questionCount,
      timeLimitMin: timeLimit,
    });
    onClose();
    setStep(0); setSelectedSubject('Mixed'); setSelectedChapterId('All');
    setQuestionCount(0); setTimeLimit(0); setPracticeName('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8 force-dark-ui"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"><X size={16} /></button>

            <div className="flex items-center gap-1.5 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn('flex-1 h-1 rounded-full transition', i <= step ? 'bg-teal-500' : 'bg-white/10')} />
              ))}
            </div>

            {step === 0 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Practice Setup</h2>
                <p className="text-xs text-white/50 mb-4">Select subject (or Mixed for all)</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {SUBJECTS.map((subj) => (
                    <button key={subj} onClick={() => { if (haptics) vibrate(10); setSelectedSubject(subj); setSelectedChapterId('All'); if (subj === 'Mixed') setStep(2); else setStep(1); }}
                      className={cn('py-3 rounded-xl text-sm font-semibold transition border-2', selectedSubject === subj ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-white/5')}>{subj}</button>
                  ))}
                </div>
                {selectedSubject !== 'Mixed' && (
                  <button onClick={() => setStep(1)} className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition">Next: Select Chapter →</button>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Select Chapter</h2>
                <p className="text-xs text-white/50 mb-4">{selectedSubject}</p>
                <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                  <button onClick={() => { if (haptics) vibrate(10); setSelectedChapterId('All'); }} className={cn('w-full p-3 rounded-xl text-left text-sm transition border-2', selectedChapterId === 'All' ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-white/5')}>All Chapters</button>
                  {availableChapters.map((ch) => (
                    <button key={ch.id} onClick={() => { if (haptics) vibrate(10); setSelectedChapterId(ch.id); }} className={cn('w-full p-3 rounded-xl text-left text-sm transition border-2', selectedChapterId === ch.id ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-white/5')}>{ch.name}</button>
                  ))}
                </div>
                <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition">Next: Questions →</button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Questions & Time</h2>
                <p className="text-xs text-white/50 mb-4">Set limits or leave at 0 for unlimited</p>
                <div className="mb-4">
                  <div className="flex justify-between mb-2"><label className="text-xs font-semibold text-white/60">Number of Questions</label><span className="text-sm font-bold text-teal-400">{questionCount === 0 ? '∞ Unlimited' : questionCount}</span></div>
                  <ScrollAwareSlider><input type="range" min={0} max={100} step={5} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full" /></ScrollAwareSlider>
                  <div className="flex justify-between text-[9px] text-white/30 mt-0.5"><span>0 = unlimited</span><span>100</span></div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between mb-2"><label className="text-xs font-semibold text-white/60">Time Limit (minutes)</label><span className="text-sm font-bold text-amber-400">{timeLimit === 0 ? '∞ Unlimited' : `${timeLimit}m`}</span></div>
                  <ScrollAwareSlider><input type="range" min={0} max={180} step={5} value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="w-full" style={{ accentColor: '#f59e0b' }} /></ScrollAwareSlider>
                  <div className="flex justify-between text-[9px] text-white/30 mt-0.5"><span>0 = unlimited</span><span>180m</span></div>
                </div>
                <button onClick={() => setStep(3)} className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition">Next: Name →</button>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Practice Name</h2>
                <p className="text-xs text-white/50 mb-4">Optional — auto-generated if left blank</p>
                <input type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder={`${selectedSubject}${selectedChapterId !== 'All' ? ' · ' + (availableChapters.find((ch) => ch.id === selectedChapterId)?.name || '') : ''} · ${questionCount || '∞'}Q`} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm mb-4 focus:border-teal-500 outline-none" />
                <div className="glass rounded-xl p-3 mb-4 space-y-1">
                  <div className="text-xs text-white/50">Summary:</div>
                  <div className="text-sm">📚 Subject: <strong>{selectedSubject}</strong></div>
                  <div className="text-sm">📖 Chapter: <strong>{selectedChapterId === 'All' ? 'All' : availableChapters.find((ch) => ch.id === selectedChapterId)?.name}</strong></div>
                  <div className="text-sm">📝 Questions: <strong>{questionCount || '∞'}</strong></div>
                  <div className="text-sm">⏱ Time: <strong>{timeLimit ? `${timeLimit}m` : '∞'}</strong></div>
                </div>
                <button onClick={handleStart} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-base active:scale-95 transition">Start Practice →</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
