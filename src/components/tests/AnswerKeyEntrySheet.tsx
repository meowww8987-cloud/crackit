'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Clipboard, Edit3, Check, ChevronRight, AlertCircle } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { subjectColor } from '@/lib/colors';
import { cn, vibrate } from '@/lib/utils';
import { pushToast } from '@/components/shared/Toast';
import type { Subject } from '@/lib/types';

interface Props {
  testId: string;
  onClose: () => void;
}

type Mode = 'choose' | 'paste' | 'oneByOne';

/**
 * AnswerKeyEntrySheet — enter correct answers for a paper test so the app
 * can auto-score it (marks per subject, total /720, wrong/skipped lists).
 *
 * Three modes:
 *  - 'choose' (default): pick how to enter the answer key
 *  - 'paste': paste a 180-char string of A/B/C/D (from coaching PDF/website)
 *  - 'oneByOne': step through each question, tap correct option
 *
 * Scoring: +4 for correct, -1 for wrong, 0 for skipped/unanswered.
 * Total = sum across 180 questions, max 720.
 */
export function AnswerKeyEntrySheet({ testId, onClose }: Props) {
  const test = useTests((s) => s.tests.find((t) => t.id === testId));
  const setAnswerKey = useTests((s) => s.setAnswerKey);
  const setCorrectAnswer = useTests((s) => s.setCorrectAnswer);
  const setResult = useTests((s) => s.setResult);

  const [mode, setMode] = useState<Mode>('choose');
  const [pasteValue, setPasteValue] = useState('');
  const [oneByOneIdx, setOneByOneIdx] = useState(0);

  const questions = test?.paperTest?.questions || [];
  const subjects: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  const marksPerCorrect = test?.paperTest?.config?.marksPerCorrect ?? 4;
  const negativePerWrong = test?.paperTest?.config?.negativePerWrong ?? 1;
  const maxMarks = (test?.paperTest?.config?.questionCount ?? questions.length) * marksPerCorrect;

  // Compute score from current correct answers
  const scoring = useMemo(() => {
    let correct = 0, wrong = 0, skipped = 0, scored = 0;
    const subjectStats: Record<Subject, { correct: number; wrong: number; skipped: number; marks: number }> = {
      Physics: { correct: 0, wrong: 0, skipped: 0, marks: 0 },
      Chemistry: { correct: 0, wrong: 0, skipped: 0, marks: 0 },
      Botany: { correct: 0, wrong: 0, skipped: 0, marks: 0 },
      Zoology: { correct: 0, wrong: 0, skipped: 0, marks: 0 },
      General: { correct: 0, wrong: 0, skipped: 0, marks: 0 },
    };
    for (const q of questions) {
      const subj = q.subject;
      if (q.correctAnswer === null) {
        skipped++;
        subjectStats[subj].skipped++;
        continue;
      }
      scored++;
      if (q.answer === null) {
        // User didn't answer → 0 marks (no negative for unattempted in NEET)
        subjectStats[subj].skipped++;
      } else if (q.answer === q.correctAnswer) {
        correct++;
        subjectStats[subj].correct++;
        subjectStats[subj].marks += marksPerCorrect;
      } else {
        wrong++;
        subjectStats[subj].wrong++;
        subjectStats[subj].marks -= negativePerWrong;
      }
    }
    const totalMarks = Object.values(subjectStats).reduce((a, s) => a + s.marks, 0);
    return { correct, wrong, skipped, scored, subjectStats, totalMarks: Math.max(0, totalMarks) };
  }, [questions]);

  const handlePasteSubmit = () => {
    const cleaned = pasteValue.toUpperCase().replace(/[^ABCD]/g, '');
    if (cleaned.length < 180) {
      pushToast(
        'Incomplete key',
        `${cleaned.length}/180 answers parsed. Remaining will be unscored.`,
        'info',
      );
    }
    setAnswerKey(testId, cleaned);
    vibrate(15);
    setMode('choose');
    pushToast('Answer key saved', `${cleaned.length} answers parsed`, 'success');
  };

  const handleOneByOneAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    vibrate(8);
    setCorrectAnswer(testId, oneByOneIdx, answer);
    if (oneByOneIdx < 179) {
      setOneByOneIdx(oneByOneIdx + 1);
    }
  };

  const handleSkipOneByOne = () => {
    vibrate(6);
    setCorrectAnswer(testId, oneByOneIdx, null);
    if (oneByOneIdx < 179) setOneByOneIdx(oneByOneIdx + 1);
  };

  const handleSaveScore = () => {
    vibrate(15);
    const subjectMarks: Record<Subject, number> = {} as any;
    for (const subj of subjects) {
      subjectMarks[subj] = scoring.subjectStats[subj].marks;
    }
    setResult(testId, {
      totalMarks: scoring.totalMarks,
      subjectMarks,
    });
    pushToast(
      'Score saved!',
      `${scoring.totalMarks}/${maxMarks} · ${scoring.correct} correct · ${scoring.wrong} wrong`,
      'success',
    );
    onClose();
  };

  const currentQ = questions[oneByOneIdx];
  const currentSubjectIdx = Math.floor(oneByOneIdx / 45);
  const currentSubject = subjects[currentSubjectIdx];
  const c = subjectColor(currentSubject);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto scroll-area"
      >
        <div className="w-10 h-1 bg-foreground/30 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Answer Key</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* === Mode: choose === */}
        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-snug">
              Enter correct answers to auto-score your test. Scoring: +{marksPerCorrect} correct, −{negativePerWrong} wrong, 0 skipped.
            </p>

            {/* Current score preview if any answers set */}
            {scoring.scored > 0 && (
              <div className="glass rounded-xl p-3 border border-teal-500/20">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                  Current Score
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold tabular text-green-400">{scoring.correct}</div>
                    <div className="text-[8px] text-muted-foreground uppercase">Correct</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular text-red-400">{scoring.wrong}</div>
                    <div className="text-[8px] text-muted-foreground uppercase">Wrong</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular text-muted-foreground">{scoring.skipped}</div>
                    <div className="text-[8px] text-muted-foreground uppercase">Skipped</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular text-teal-400">{scoring.totalMarks}</div>
                    <div className="text-[8px] text-muted-foreground uppercase">Marks</div>
                  </div>
                </div>
                {scoring.scored === 180 && (
                  <button
                    onClick={handleSaveScore}
                    className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-xs active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <Check size={12} /> Save Score ({scoring.totalMarks}/{maxMarks})
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => { vibrate(8); setMode('paste'); }}
              className="w-full p-3 rounded-xl bg-foreground/5 border border-border flex items-center gap-3 text-left hover:bg-foreground/[0.07] transition"
            >
              <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                <Clipboard size={16} className="text-teal-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Paste Answer Key</div>
                <div className="text-[10px] text-muted-foreground">
                  Paste 180 chars (ABCDDCBA...) from coaching PDF · Fastest
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/60" />
            </button>

            <button
              onClick={() => { vibrate(8); setMode('oneByOne'); setOneByOneIdx(0); }}
              className="w-full p-3 rounded-xl bg-foreground/5 border border-border flex items-center gap-3 text-left hover:bg-foreground/[0.07] transition"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                <Edit3 size={16} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Enter One-by-One</div>
                <div className="text-[10px] text-muted-foreground">
                  Step through each Q, tap correct option · Slower but accurate
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/60" />
            </button>

            {scoring.scored > 0 && scoring.scored < 180 && (
              <div className="text-[10px] text-amber-400 flex items-center gap-1 justify-center">
                <AlertCircle size={10} /> {180 - scoring.scored} questions still need correct answers
              </div>
            )}
          </div>
        )}

        {/* === Mode: paste === */}
        {mode === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('choose')}
                className="text-[10px] text-muted-foreground"
              >
                ← Back
              </button>
              <span className="text-xs font-semibold text-teal-400">Paste Mode</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Paste the answer key from your coaching's PDF or website. Format: 180 letters
              (A/B/C/D), one per question in order. Spaces/commas/newlines are auto-removed.
            </p>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="ABCDDCBAABCD..."
              className="w-full bg-foreground/5 border border-border rounded-xl px-3 py-2.5 text-sm font-mono tabular focus:outline-none focus:border-teal-400/50 min-h-[120px] resize-none"
              autoFocus
            />
            <div className="text-[10px] text-muted-foreground tabular">
              {pasteValue.toUpperCase().replace(/[^ABCD]/g, '').length}/180 valid answers
            </div>
            <button
              onClick={handlePasteSubmit}
              disabled={pasteValue.toUpperCase().replace(/[^ABCD]/g, '').length === 0}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98]',
                pasteValue ? 'bg-gradient-to-r from-teal-500 to-green-500 text-black' : 'bg-foreground/5 text-muted-foreground/60'
              )}
            >
              Parse & Save
            </button>
          </div>
        )}

        {/* === Mode: one-by-one === */}
        {mode === 'oneByOne' && currentQ && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('choose')}
                className="text-[10px] text-muted-foreground"
              >
                ← Back
              </button>
              <span className="text-xs font-semibold text-purple-400">One-by-One Mode</span>
              <span className="text-[10px] text-muted-foreground ml-auto tabular">
                {oneByOneIdx + 1}/180
              </span>
            </div>

            {/* Question header */}
            <div className="text-center py-3">
              <div className="text-[10px] text-muted-foreground uppercase">Correct answer for</div>
              <div className="text-4xl font-bold tabular text-white">Q{currentQ.number}</div>
              <div
                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                style={{ background: `${c.hex}25`, color: c.hex }}
              >
                {currentSubject}
              </div>
              {currentQ.answer && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Your answer: <span className="font-bold text-white">{currentQ.answer}</span>
                </div>
              )}
            </div>

            {/* A/B/C/D */}
            <div className="grid grid-cols-2 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const isSet = currentQ.correctAnswer === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleOneByOneAnswer(opt)}
                    className={cn(
                      'py-4 rounded-xl text-xl font-bold transition active:scale-95',
                      isSet ? 'text-black' : 'bg-foreground/5 text-foreground'
                    )}
                    style={isSet ? { background: c.hex } : undefined}
                  >
                    {opt}
                    {isSet && <Check size={14} className="inline ml-1.5" />}
                  </button>
                );
              })}
            </div>

            {/* Skip + auto-next info */}
            <button
              onClick={handleSkipOneByOne}
              className="w-full py-2 rounded-xl bg-foreground/5 text-muted-foreground text-xs font-semibold"
            >
              Skip (no correct answer)
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
              Auto-advances to next question on tap
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
