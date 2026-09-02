'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Trash2, Clock, Pause } from 'lucide-react';
import { usePractice, type PracticeSession } from '@/lib/store/practice';
import { useSyllabus } from '@/lib/store/syllabus';
import { useSettings } from '@/lib/store/settings';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import { cn, vibrate, formatHMS } from '@/lib/utils';
import type { Subject } from '@/lib/types';

const SUBJECTS: (Subject | 'Mixed')[] = ['Mixed', 'Physics', 'Chemistry', 'Botany', 'Zoology'];

interface Props {
  open: boolean;
  onClose: () => void;
}

function timeSincePause(pausedAt?: number | null): string {
  if (!pausedAt) return '';
  const diffMs = Date.now() - pausedAt;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function PracticeSetupSheet({ open, onClose }: Props) {
  const startPractice = usePractice((s) => s.startPractice);
  const pausedPractices = usePractice((s) => s.pausedPractices);
  const resumePractice = usePractice((s) => s.resumePractice);
  const deletePausedPractice = usePractice((s) => s.deletePausedPractice);
  const subjects = useSyllabus((s) => s.subjects);
  const chapters = useSyllabus((s) => s.chapters);
  const haptics = useSettings((s) => s.haptics);

  const [step, setStep] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<'Mixed' | Subject>('Mixed');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('All');
  const [questionCount, setQuestionCount] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [practiceName, setPracticeName] = useState('');
  const [qInput, setQInput] = useState('');
  const [tInput, setTInput] = useState('');

  const availableChapters = selectedSubject === 'Mixed'
    ? []
    : chapters.filter((ch) => {
        const subj = subjects.find((s) => s.id === ch.subjectId);
        return subj?.name === selectedSubject;
      });

  const handleStart = () => {
    if (haptics) vibrate(15);
    const qCount = qInput ? parseInt(qInput) || 0 : questionCount;
    const tLimit = tInput ? parseInt(tInput) || 0 : timeLimit;
    const chapterName = selectedChapterId === 'All'
      ? 'All'
      : availableChapters.find((ch) => ch.id === selectedChapterId)?.name || 'All';
    startPractice({
      name: practiceName || undefined,
      subject: selectedSubject,
      chapter: chapterName,
      questionCount: qCount,
      timeLimitMin: tLimit,
    });
    onClose();
    setStep(0); setSelectedSubject('Mixed'); setSelectedChapterId('All');
    setQuestionCount(0); setTimeLimit(0); setPracticeName('');
    setQInput(''); setTInput('');
  };

  const canGoBack = step > 0;
  const handleBack = () => { if (haptics) vibrate(8); setStep(Math.max(0, step - 1)); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/90" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto glass-strong rounded-3xl p-5 pb-8"
          >
            {/* Top bar: Back + Close */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {canGoBack ? (
                  <button onClick={handleBack} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-foreground/10 transition">
                    <ChevronLeft size={18} />
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
                <span className="text-sm font-bold text-foreground">Practice Setup</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-foreground/10 transition">
                <X size={18} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn('flex-1 h-1 rounded-full transition', i <= step ? 'bg-teal-500' : 'bg-foreground/10')} />
              ))}
            </div>

            {/* === Resume Paused Practice section — only shown at step 0 if any exist === */}
            {step === 0 && pausedPractices.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Pause size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">Resume Paused Practice</span>
                </div>
                <div className="space-y-1.5">
                  {pausedPractices.map((p) => (
                    <PausedPracticeRow
                      key={p.id}
                      practice={p}
                      onResume={() => {
                        if (haptics) vibrate(15);
                        resumePractice(p.id);
                        onClose();
                        // reset setup state in case user opens again later
                        setStep(0); setSelectedSubject('Mixed'); setSelectedChapterId('All');
                        setQuestionCount(0); setTimeLimit(0); setPracticeName('');
                        setQInput(''); setTInput('');
                      }}
                      onDiscard={() => {
                        if (haptics) vibrate(8);
                        if (confirm(`Discard "${p.name}"? Progress will be lost.`)) {
                          deletePausedPractice(p.id);
                        }
                      }}
                    />
                  ))}
                </div>
                <div className="text-[9px] text-muted-foreground/60 text-center mt-2">
                  Or start a new practice below ↓
                </div>
              </div>
            )}

            {/* === Step 0: Subject === */}
            {step === 0 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Select Subject</h2>
                <p className="text-xs text-muted-foreground mb-4">Or Mixed for all subjects</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {SUBJECTS.map((subj) => (
                    <button key={subj} onClick={() => { if (haptics) vibrate(10); setSelectedSubject(subj); setSelectedChapterId('All'); }}
                      className={cn('py-3 rounded-xl text-sm font-semibold transition border-2', selectedSubject === subj ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-foreground/5')}>{subj}</button>
                  ))}
                </div>
                <button onClick={() => { if (haptics) vibrate(10); if (selectedSubject === 'Mixed') setStep(2); else setStep(1); }}
                  className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2">
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* === Step 1: Chapter === */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Select Chapter</h2>
                <p className="text-xs text-muted-foreground mb-4">{selectedSubject}</p>
                <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                  <button onClick={() => { if (haptics) vibrate(10); setSelectedChapterId('All'); }} className={cn('w-full p-3 rounded-xl text-left text-sm transition border-2', selectedChapterId === 'All' ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-foreground/5')}>All Chapters</button>
                  {availableChapters.map((ch) => (
                    <button key={ch.id} onClick={() => { if (haptics) vibrate(10); setSelectedChapterId(ch.id); }} className={cn('w-full p-3 rounded-xl text-left text-sm transition border-2', selectedChapterId === ch.id ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-foreground/5')}>{ch.name}</button>
                  ))}
                </div>
                <button onClick={() => { if (haptics) vibrate(10); setStep(2); }} className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2">Next <ChevronRight size={16} /></button>
              </div>
            )}

            {/* === Step 2: Questions & Time === */}
            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Questions & Time</h2>
                <p className="text-xs text-muted-foreground mb-4">Type exact numbers or use slider. 0 = unlimited.</p>

                {/* Question count — text input + slider */}
                <div className="mb-5">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground">Number of Questions</label>
                    <span className="text-sm font-bold text-teal-400">{qInput ? (parseInt(qInput) || 0) : questionCount === 0 ? '∞ Unlimited' : questionCount}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number" inputMode="numeric" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Type exact number (0=∞)" min={0} max={500}
                      className="flex-1 p-2.5 rounded-lg bg-foreground/5 border border-border text-sm focus:border-teal-500 outline-none"
                    />
                  </div>
                  <ScrollAwareSlider>
                    <input type="range" min={0} max={100} step={1} value={qInput ? Math.min(100, parseInt(qInput) || 0) : questionCount}
                      onChange={(e) => { setQuestionCount(Number(e.target.value)); setQInput(''); }} className="w-full" />
                  </ScrollAwareSlider>
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5"><span>0 = unlimited</span><span>100</span></div>
                </div>

                {/* Time limit — text input + slider */}
                <div className="mb-5">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground">Time Limit (minutes)</label>
                    <span className="text-sm font-bold text-amber-400">{tInput ? (parseInt(tInput) || 0) === 0 ? '∞ Unlimited' : `${tInput}m` : timeLimit === 0 ? '∞ Unlimited' : `${timeLimit}m`}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number" inputMode="numeric" value={tInput} onChange={(e) => setTInput(e.target.value)} placeholder="Type exact minutes (0=∞)" min={0} max={300}
                      className="flex-1 p-2.5 rounded-lg bg-foreground/5 border border-border text-sm focus:border-amber-500 outline-none"
                    />
                  </div>
                  <ScrollAwareSlider>
                    <input type="range" min={0} max={180} step={1} value={tInput ? Math.min(180, parseInt(tInput) || 0) : timeLimit}
                      onChange={(e) => { setTimeLimit(Number(e.target.value)); setTInput(''); }} className="w-full" style={{ accentColor: '#f59e0b' }} />
                  </ScrollAwareSlider>
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5"><span>0 = unlimited</span><span>180m</span></div>
                </div>

                <button onClick={() => { if (haptics) vibrate(10); setStep(3); }} className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2">Next <ChevronRight size={16} /></button>
              </div>
            )}

            {/* === Step 3: Name + Start === */}
            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold mb-1">Practice Name</h2>
                <p className="text-xs text-muted-foreground mb-4">Optional — auto-generated if left blank</p>
                <input type="text" value={practiceName} onChange={(e) => setPracticeName(e.target.value)}
                  placeholder={`${selectedSubject}${selectedChapterId !== 'All' ? ' · ' + (availableChapters.find((ch) => ch.id === selectedChapterId)?.name || '') : ''} · ${qInput || questionCount || '∞'}Q`}
                  className="w-full p-3 rounded-xl bg-foreground/5 border border-border text-sm mb-4 focus:border-teal-500 outline-none" />

                <div className="glass rounded-xl p-3 mb-4 space-y-1">
                  <div className="text-xs text-muted-foreground">Summary:</div>
                  <div className="text-sm">📚 Subject: <strong>{selectedSubject}</strong></div>
                  <div className="text-sm">📖 Chapter: <strong>{selectedChapterId === 'All' ? 'All' : availableChapters.find((ch) => ch.id === selectedChapterId)?.name}</strong></div>
                  <div className="text-sm">📝 Questions: <strong>{qInput ? (parseInt(qInput) || 0) === 0 ? '∞' : qInput : questionCount === 0 ? '∞' : questionCount}</strong></div>
                  <div className="text-sm">⏱ Time: <strong>{tInput ? (parseInt(tInput) || 0) === 0 ? '∞' : `${tInput}m` : timeLimit === 0 ? '∞' : `${timeLimit}m`}</strong></div>
                </div>

                <button onClick={handleStart} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-base active:scale-95 transition flex items-center justify-center gap-2">
                  Start Practice →
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Paused practice row (used in the Resume section) ---------- */

function PausedPracticeRow({
  practice,
  onResume,
  onDiscard,
}: {
  practice: PracticeSession;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const totalElapsed = practice.accumulatedTimeSec || 0;
  const answeredCount = practice.questions.filter(q => q.status === 'answered').length;
  const skippedCount = practice.questions.filter(q => q.status === 'skipped').length;
  const reviewCount = practice.questions.filter(q => q.status === 'review-later').length;
  const currentQ = practice.resumeQuestionIndex ?? 0;

  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-center gap-2">
      {/* Play button — resumes the practice */}
      <button
        onClick={onResume}
        className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500/30 active:scale-95 transition shrink-0"
        aria-label="Resume practice"
      >
        <Play size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white truncate">{practice.name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Clock size={9} />
          <span className="tabular">{formatHMS(totalElapsed)}</span>
          <span className="opacity-40">·</span>
          <span>Q{currentQ + 1}{practice.questionCount > 0 ? `/${practice.questionCount}` : ''}</span>
          {(answeredCount > 0 || skippedCount > 0 || reviewCount > 0) && (
            <span className="opacity-40">·</span>
          )}
          {answeredCount > 0 && <span className="text-green-400">✓{answeredCount}</span>}
          {skippedCount > 0 && <span className="text-muted-foreground">→{skippedCount}</span>}
          {reviewCount > 0 && <span className="text-amber-400">⚑{reviewCount}</span>}
        </div>
        <div className="text-[9px] text-muted-foreground/60 mt-0.5">
          Paused {timeSincePause(practice.pausedAt)}
        </div>
      </div>

      {/* Discard button */}
      <button
        onClick={onDiscard}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
        aria-label="Discard paused practice"
        title="Discard"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
