'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Check, X as XIcon, AlertCircle, Sparkles } from 'lucide-react';
import { useRecall } from '@/lib/store/recall';
import { useSyllabus } from '@/lib/store/syllabus';
import type { RecallRating, Subject } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';
import { subjectColor } from '@/lib/colors';

interface Props {
  onClose: () => void;
}

type Phase = 'intro' | 'challenge' | 'results';

export function ActiveRecallChallenge({ onClose }: Props) {
  const generateChallenge = useRecall((s) => s.generateChallenge);
  const saveResults = useRecall((s) => s.saveResults);
  const syllabus = useSyllabus();

  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<string, RecallRating>>({});
  const [finalScore, setFinalScore] = useState(0);

  const challenge = useMemo(() => generateChallenge(), [generateChallenge]);

  // Map topicIds to lecture data
  const topics = useMemo(() => {
    return challenge.topicIds
      .map((id) => syllabus.lectures.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => !!l);
  }, [challenge.topicIds, syllabus.lectures]);

  const handleRate = (rating: RecallRating) => {
    vibrate(12);
    const topic = topics[currentIndex];
    if (!topic) return;
    const newResults = { ...results, [topic.id]: rating };
    setResults(newResults);

    if (currentIndex < topics.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Done — save results
      const saved = saveResults(newResults);
      setFinalScore(saved.retentionScore);
      setPhase('results');
    }
  };

  const handleSkip = () => {
    vibrate(8);
    if (currentIndex < topics.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const saved = saveResults(results);
      setFinalScore(saved.retentionScore);
      setPhase('results');
    }
  };

  // ===== INTRO PHASE =====
  if (phase === 'intro') {
    return (
      <motion.div
        data-focus-overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-[#0a0a0f] flex flex-col px-6 py-10 force-dark-ui"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-purple-400" />
            <span className="text-sm font-bold">Daily Recall Challenge</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 flex flex-col">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-2xl p-5 mb-6 text-center"
          >
            <Sparkles size={32} className="text-purple-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold mb-1">Test your memory</h2>
            <p className="text-xs text-muted-foreground">
              Recall key points from topics you studied in the past week.
              Self-rate how well you remember each one.
            </p>
          </motion.div>

          {topics.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No topics available for recall yet. Mark some lectures as done in the Syllabus tab first.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-teal-500 text-black text-sm font-bold"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">Today's {topics.length} topics:</div>
              <div className="space-y-1.5 mb-6 max-h-[40vh] overflow-y-auto scroll-area">
                {topics.map((t, i) => {
                  const ch = syllabus.chapters.find((c) => c.id === t.chapterId);
                  const subj = syllabus.subjects.find((s) => s.id === ch?.subjectId);
                  const color = subj ? subjectColor(subj.name) : null;
                  return (
                    <div key={t.id} className="glass rounded-xl p-2.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground tabular">{i + 1}</span>
                      {color && <div className="w-2 h-2 rounded-full" style={{ background: color.hex }} />}
                      <span className="text-xs flex-1 truncate">{t.topic}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => { setPhase('challenge'); vibrate(15); }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm active:scale-[0.98]"
              >
                Start Challenge
              </button>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  // ===== CHALLENGE PHASE =====
  if (phase === 'challenge') {
    const topic = topics[currentIndex];
    if (!topic) {
      setPhase('results');
      return null;
    }
    const ch = syllabus.chapters.find((c) => c.id === topic.chapterId);
    const subj = syllabus.subjects.find((s) => s.id === ch?.subjectId);
    const color = subj ? subjectColor(subj.name) : null;

    return (
      <motion.div
        data-focus-overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-[#0a0a0f] flex flex-col px-6 py-10 force-dark-ui"
      >
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Question {currentIndex + 1} of {topics.length}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              animate={{ width: `${((currentIndex) / topics.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="glass rounded-2xl p-6 mb-6"
            >
              <div className="text-[10px] uppercase tracking-widest text-purple-400/70 mb-2">Recall this topic</div>
              {color && subj && (
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: color.hex }} />
                  <span className="text-[10px] font-bold uppercase" style={{ color: color.hex }}>{subj.name}</span>
                  {ch && <span className="text-[10px] text-muted-foreground">· {ch.name}</span>}
                </div>
              )}
              <h2 className="text-xl font-bold leading-tight mb-3">{topic.topic}</h2>
              <p className="text-xs text-muted-foreground">
                Take a moment to recall the key points, formulas, and concepts.
                Then rate how well you remembered it.
              </p>
              {topic.notes && (
                <div className="mt-3 p-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground">
                  {topic.notes}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center mb-3">How well did you remember?</p>
            <button
              onClick={() => handleRate('remembered')}
              className="w-full py-3.5 rounded-2xl bg-green-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Check size={16} /> Remembered
            </button>
            <button
              onClick={() => handleRate('vague')}
              className="w-full py-3.5 rounded-2xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <AlertCircle size={16} /> Vague
            </button>
            <button
              onClick={() => handleRate('forgot')}
              className="w-full py-3.5 rounded-2xl bg-red-500/90 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <XIcon size={16} /> Forgot
            </button>
            <button
              onClick={handleSkip}
              className="w-full py-2 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Skip →
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ===== RESULTS PHASE =====
  const forgotten = topics.filter((t) => results[t.id] === 'forgot' || results[t.id] === 'vague');
  const scoreColor = finalScore >= 70 ? '#22c55e' : finalScore >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-[#0a0a0f] flex flex-col px-6 py-10 force-dark-ui"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-purple-400" />
          <span className="text-sm font-bold">Results</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass rounded-2xl p-6 mb-6 text-center"
        >
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Retention Score</div>
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="text-6xl font-bold tabular mb-2"
            style={{ color: scoreColor }}
          >
            {finalScore}%
          </motion.div>
          <p className="text-xs text-muted-foreground">
            {finalScore >= 70 ? 'Excellent recall!' : finalScore >= 40 ? 'Decent — keep practicing.' : 'Review these topics soon.'}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <ResultStat label="Remembered" count={Object.values(results).filter(r => r === 'remembered').length} color="#22c55e" />
          <ResultStat label="Vague" count={Object.values(results).filter(r => r === 'vague').length} color="#f59e0b" />
          <ResultStat label="Forgot" count={Object.values(results).filter(r => r === 'forgot').length} color="#ef4444" />
        </div>

        {/* Forgotten topics (re-queued) */}
        {forgotten.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-6">
            <h3 className="text-xs font-bold text-muted-foreground mb-2">Re-queued for tomorrow:</h3>
            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto scroll-area">
              {forgotten.map((t) => {
                const ch = syllabus.chapters.find((c) => c.id === t.chapterId);
                const subj = syllabus.subjects.find((s) => s.id === ch?.subjectId);
                const color = subj ? subjectColor(subj.name) : null;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    {color && <div className="w-2 h-2 rounded-full" style={{ background: color.hex }} />}
                    <span className="flex-1 truncate text-muted-foreground">{t.topic}</span>
                    <span className="text-[10px] text-muted-foreground">{results[t.id]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}

function ResultStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center">
      <div className="text-xl font-bold tabular" style={{ color }}>{count}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
