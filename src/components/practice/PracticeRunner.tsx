'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Flag, Save, XCircle } from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { useSettings } from '@/lib/store/settings';
import { formatHM, cn, vibrate } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

export function PracticeRunner() {
  const activePractice = usePractice((s) => s.activePractice);
  const currentIdx = usePractice((s) => s.currentQuestionIndex);
  const answerQuestion = usePractice((s) => s.answerQuestion);
  const endPractice = usePractice((s) => s.endPractice);
  const cancelPractice = usePractice((s) => s.cancelPractice);
  const markCorrectAnswer = usePractice((s) => s.markCorrectAnswer);
  const saveNotes = usePractice((s) => s.saveNotes);
  const history = usePractice((s) => s.history);
  const haptics = useSettings((s) => s.haptics);

  const [, setTick] = useState(0);
  const questionStartRef = useRef(Date.now());
  const [phase, setPhase] = useState<'practicing' | 'reviewing'>('practicing');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [orientationAngle, setOrientationAngle] = useState(0);
  const wakeLockRef = useRef<any>(null);

  const reviewSession = reviewSessionId ? history.find((s) => s.id === reviewSessionId) : null;

  const handleEnd = useCallback(() => {
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed };
      usePractice.setState({ activePractice: { ...session, questions } });
    }
    endPractice();
    const justEnded = usePractice.getState().history[0];
    if (justEnded) { setReviewSessionId(justEnded.id); setPhase('reviewing'); }
  }, [endPractice]);

  const handleSelectOption = useCallback((option: string) => {
    if (haptics) vibrate(10);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed, status: 'answered', userAnswer: option };
      usePractice.setState({ activePractice: { ...session, questions } });
    }
    answerQuestion('answered');
  }, [haptics, answerQuestion]);

  const handleSkip = useCallback(() => {
    if (haptics) vibrate(8);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed, status: 'skipped' };
      usePractice.setState({ activePractice: { ...session, questions } });
    }
    answerQuestion('skipped');
  }, [haptics, answerQuestion]);

  const handleReviewLater = useCallback(() => {
    if (haptics) vibrate(10);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed, status: 'review-later' };
      usePractice.setState({ activePractice: { ...session, questions } });
    }
    answerQuestion('review-later');
  }, [haptics, answerQuestion]);

  useEffect(() => { questionStartRef.current = Date.now(); }, [currentIdx]);

  useEffect(() => {
    if (!activePractice) return;
    const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {} };
    requestWakeLock();
    const onVis = () => { if (!document.hidden && usePractice.getState().activePractice) requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; } };
  }, [activePractice]);

  useEffect(() => {
    if (!activePractice) return;
    const update = () => { if (typeof screen !== 'undefined' && screen.orientation) setOrientationAngle(screen.orientation.angle || 0); };
    update();
    if (typeof screen !== 'undefined' && screen.orientation) { screen.orientation.addEventListener('change', update); return () => screen.orientation?.removeEventListener('change', update); }
  }, [activePractice]);

  useEffect(() => {
    if (!activePractice) return;
    const i = setInterval(() => { setTick((t) => t + 1); const session = usePractice.getState().activePractice; if (session && session.timeLimitMin > 0) { const elapsed = Math.floor((Date.now() - session.startedAt) / 1000); if (elapsed >= session.timeLimitMin * 60) handleEnd(); } }, 500);
    return () => clearInterval(i);
  }, [activePractice, handleEnd]);

  useEffect(() => { if (!activePractice) return; if (activePractice.questionCount > 0 && currentIdx >= activePractice.questionCount) handleEnd(); }, [currentIdx, activePractice, handleEnd]);

  if (!activePractice && phase === 'practicing' && !reviewSession) return null;

  if (phase === 'reviewing' && reviewSession) {
    return <ReviewPhase session={reviewSession} markCorrectAnswer={markCorrectAnswer} saveNotes={saveNotes} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }

  if (!activePractice) return null;

  const totalElapsed = Math.floor((Date.now() - activePractice.startedAt) / 1000);
  const questionElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
  const answeredCount = activePractice.questions.filter(q => q.status === 'answered').length;
  const skippedCount = activePractice.questions.filter(q => q.status === 'skipped').length;
  const reviewCount = activePractice.questions.filter(q => q.status === 'review-later').length;
  const timeLimitSec = activePractice.timeLimitMin * 60;
  const visibleQuestions = activePractice.questions.slice(0, Math.max(30, currentIdx + 5));
  const qStatusColor = (q: typeof visibleQuestions[0]) => { if (q.status === 'answered') return '#22c55e'; if (q.status === 'skipped') return '#6b7280'; if (q.status === 'review-later') return '#f59e0b'; return 'rgba(255,255,255,0.15)'; };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-hidden force-dark-ui flex flex-col items-center justify-center p-6"
      style={{ background: '#000000', transform: `rotate(${orientationAngle}deg)` }}>
      <div className="absolute top-[env(safe-area-inset-top,0px)] top-6 left-0 right-0 px-4 z-10">
        <div className="flex flex-wrap gap-1 justify-center max-w-md mx-auto">
          {visibleQuestions.map((q, i) => (<div key={i} className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold transition', i === currentIdx && 'ring-2 ring-white')} style={{ background: qStatusColor(q), color: q.status === 'unanswered' ? 'rgba(255,255,255,0.5)' : '#000' }}>{q.number}</div>))}
          {activePractice.questionCount === 0 && (<div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold bg-white/10 text-white/50">{currentIdx + 2}</div>)}
        </div>
      </div>
      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Question {currentIdx + 1}{activePractice.questionCount > 0 ? ` of ${activePractice.questionCount}` : ''}</div>
        <div className="text-4xl font-bold tabular text-white mb-1">{formatHM(questionElapsed)}</div>
        <div className="text-sm text-white/50">Total: <span className="tabular text-amber-400">{formatHM(totalElapsed)}</span>{timeLimitSec > 0 && <span className="ml-2">· Left: <span className={cn('tabular', timeLimitSec - totalElapsed < 60 ? 'text-red-400' : 'text-white/40')}>{formatHM(Math.max(0, timeLimitSec - totalElapsed))}</span></span>}</div>
        <div className="flex items-center justify-center gap-3 mt-2 text-xs"><span className="text-green-400">✓ {answeredCount}</span><span className="text-white/40">→ {skippedCount}</span><span className="text-amber-400">⚑ {reviewCount}</span></div>
      </div>
      <div className="text-xs text-white/30 mb-5">{activePractice.name}</div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-4">
        {OPTIONS.map((opt, i) => (<button key={opt} onClick={() => handleSelectOption(opt)} className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 active:scale-95 transition" style={{ borderColor: `${OPTION_COLORS[i]}40`, background: `${OPTION_COLORS[i]}15` }}><span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: OPTION_COLORS[i], color: '#fff' }}>{opt}</span></button>))}
      </div>
      <div className="flex gap-3 w-full max-w-xs mb-4">
        <button onClick={handleSkip} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/50 active:scale-95 transition flex items-center justify-center gap-1.5"><ChevronRight size={14} /> Skip</button>
        <button onClick={handleReviewLater} className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 active:scale-95 transition flex items-center justify-center gap-1.5"><Flag size={14} /> Review Later</button>
      </div>
      <button onClick={() => { if (haptics) vibrate([10, 30, 10]); handleEnd(); }} className="px-8 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold active:scale-95 transition">End Practice</button>
      <button onClick={() => { if (confirm('Cancel practice? Progress will be lost.')) cancelPractice(); }} className="mt-2 text-[10px] text-white/30 underline">Cancel</button>
    </motion.div>
  );
}

// ===== Review Phase — List → Bubble hybrid =====
// Unmarked questions show as list rows with A/B/C/D selector.
// Once you mark the correct answer, the row animates into a floating bubble.
// Tap a bubble to re-expand it for editing (notes, change answer, etc.)
function ReviewPhase({ session, markCorrectAnswer, saveNotes, onClose, haptics }: {
  session: PracticeSession;
  markCorrectAnswer: (sessionId: string, questionIndex: number, correctAnswer: string | null) => void;
  saveNotes: (sessionId: string, questionIndex: number, conceptNotes: string, formulaNotes: string) => void;
  onClose: () => void;
  haptics: boolean;
}) {
  const [expandedBubble, setExpandedBubble] = useState<number | null>(null);
  const [conceptDraft, setConceptDraft] = useState('');
  const [formulaDraft, setFormulaDraft] = useState('');

  const correct = session.questions.filter(q => q.result === 'correct').length;
  const wrong = session.questions.filter(q => q.result === 'wrong').length;
  const unmarked = session.questions.filter(q => q.result === 'unmarked').length;
  const totalMarked = correct + wrong;
  const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
  const times = session.questions.map(q => q.timeSpentSec).filter(t => t > 0);
  const fastest = times.length > 0 ? Math.min(...times) : 0;
  const slowest = times.length > 0 ? Math.max(...times) : 0;

  // Split: marked (have correctAnswer) → bubbles; unmarked → list rows
  const markedQuestions = session.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.correctAnswer !== null);
  const unmarkedQuestions = session.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.correctAnswer === null);

  const bubbleColor = (q: PracticeQuestion): string => {
    if (q.result === 'correct') return '#22c55e';
    if (q.result === 'wrong') return '#ef4444';
    if (q.status === 'review-later') return '#f59e0b';
    if (q.status === 'skipped') return '#6b7280';
    return 'rgba(255,255,255,0.15)';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto force-dark-ui"
      style={{ background: '#000000' }}>
      <div className="p-4 pt-[env(safe-area-inset-top,0px)] pt-8 max-w-md mx-auto">

        {/* Header + stats */}
        <div className="text-center mb-3">
          <div className="text-3xl mb-1">📊</div>
          <h2 className="text-lg font-bold text-white">Answer Key</h2>
          <p className="text-[10px] text-white/40 mt-0.5">{session.name} · Select correct answer for each question</p>
        </div>

        <div className="glass rounded-2xl p-3 mb-4">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div><div className="text-lg font-bold text-green-400 tabular">{correct}</div><div className="text-[8px] text-white/40">✓</div></div>
            <div><div className="text-lg font-bold text-red-400 tabular">{wrong}</div><div className="text-[8px] text-white/40">✗</div></div>
            <div><div className="text-lg font-bold text-white/40 tabular">{unmarked}</div><div className="text-[8px] text-white/40">?</div></div>
            <div><div className="text-lg font-bold text-teal-400 tabular">{accuracy}%</div><div className="text-[8px] text-white/40">Acc</div></div>
          </div>
          {times.length > 0 && (
            <div className="grid grid-cols-2 gap-1 text-center mt-2 pt-2 border-t border-white/5">
              <div><span className="text-[9px] text-white/30">Fastest </span><span className="text-xs text-green-300 tabular">{formatHM(fastest)}</span></div>
              <div><span className="text-[9px] text-white/30">Slowest </span><span className="text-xs text-red-300 tabular">{formatHM(slowest)}</span></div>
            </div>
          )}
        </div>

        {/* === Floating bubbles (marked questions) === */}
        {markedQuestions.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2">Marked ({markedQuestions.length})</div>
            <div className="flex flex-wrap gap-1.5 justify-start min-h-[40px]">
              {markedQuestions.map(({ q, i }, idx) => {
                const color = bubbleColor(q);
                const text = `${q.number}${q.userAnswer || '?'}`;
                const isExpanded = expandedBubble === i;
                const bubbleIdx = idx; // for stagger animation
                return (
                  <motion.button
                    key={i}
                    layoutId={`bubble-${i}`}
                    onClick={() => {
                      if (haptics) vibrate(8);
                      if (isExpanded) { setExpandedBubble(null); }
                      else { setExpandedBubble(i); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); }
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, y: [0, -3, 0] }}
                    transition={{
                      scale: { type: 'spring', stiffness: 400, damping: 20, delay: bubbleIdx * 0.03 },
                      opacity: { delay: bubbleIdx * 0.03 },
                      y: { duration: 3 + (bubbleIdx % 3), repeat: Infinity, ease: 'easeInOut', delay: bubbleIdx * 0.1 },
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={cn('px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition', isExpanded && 'ring-2 ring-white')}
                    style={{
                      background: color,
                      color: q.result === 'unmarked' ? 'rgba(255,255,255,0.7)' : '#000',
                      borderColor: q.result === 'unmarked' ? 'rgba(255,255,255,0.1)' : color,
                    }}
                  >
                    {text}
                    {q.conceptNotes && <span className="text-[8px]">📝</span>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* === Expanded bubble (editing) === */}
        <AnimatePresence mode="wait">
          {expandedBubble !== null && session.questions[expandedBubble] && (
            <motion.div
              key={expandedBubble}
              layoutId={`expanded-${expandedBubble}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {(() => {
                const q = session.questions[expandedBubble];
                const color = bubbleColor(q);
                return (
                  <div className="glass rounded-2xl p-4 mb-4" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{ color }}>Q{q.number}</span>
                      <span className="text-[10px] text-white/50">{formatHM(q.timeSpentSec)} · {q.status}</span>
                    </div>
                    <div className="text-xs text-white/60 mb-3">
                      Your answer: <span className="font-bold text-white">{q.userAnswer || '—'}</span>
                      {q.correctAnswer && <span className="ml-2">| Correct: <span className="font-bold text-white">{q.correctAnswer}</span></span>}
                      {q.result === 'correct' && <span className="ml-2 text-green-400">✓</span>}
                      {q.result === 'wrong' && <span className="ml-2 text-red-400">✗</span>}
                    </div>
                    {/* Change correct answer */}
                    <div className="text-[9px] text-white/40 uppercase mb-1.5">Change correct answer:</div>
                    <div className="flex gap-2 mb-3">
                      {OPTIONS.map((opt) => {
                        const isSelected = q.correctAnswer === opt;
                        const optIdx = OPTIONS.indexOf(opt);
                        const isYourAnswer = q.userAnswer === opt;
                        return (
                          <button key={opt} onClick={() => { if (haptics) vibrate(10); markCorrectAnswer(session.id, expandedBubble, isSelected ? null : opt); }}
                            className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2', isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10')}
                            style={isSelected ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx] } : isYourAnswer ? { borderColor: `${OPTION_COLORS[optIdx]}80` } : {}}>
                            {opt}{isYourAnswer && <span className="block text-[7px] mt-0.5">yours</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Notes */}
                    <div className="space-y-2">
                      <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="Concept / what went wrong..." className="w-full p-2 rounded-lg bg-white/5 text-xs h-12 resize-none" />
                      <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Formula for revision..." className="w-full p-2 rounded-lg bg-white/5 text-xs h-10 resize-none" />
                      <button onClick={() => { saveNotes(session.id, expandedBubble, conceptDraft, formulaDraft); if (haptics) vibrate(10); setExpandedBubble(null); }}
                        className="w-full py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition">
                        <Save size={12} /> Save & Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Unmarked questions (list with A/B/C/D selector) === */}
        {unmarkedQuestions.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wide mb-2">Unmarked ({unmarkedQuestions.length})</div>
            <div className="space-y-1.5">
              {unmarkedQuestions.map(({ q, i }) => (
                <motion.div
                  key={i}
                  layoutId={`row-${i}`}
                  className="glass rounded-xl p-2.5 flex items-center gap-3"
                >
                  <span className="text-xs font-bold text-white/40 w-7">Q{q.number}</span>
                  <span className="text-[10px] text-white/40 flex-1">
                    {formatHM(q.timeSpentSec)}
                    {q.userAnswer && <span className="ml-1 text-white/60">You: {q.userAnswer}</span>}
                    {q.status === 'skipped' && <span className="ml-1 text-gray-500">skipped</span>}
                    {q.status === 'review-later' && <span className="ml-1 text-amber-400">⚑</span>}
                  </span>
                  {/* A/B/C/D selector */}
                  <div className="flex gap-1">
                    {OPTIONS.map((opt) => {
                      const optIdx = OPTIONS.indexOf(opt);
                      const isYourAnswer = q.userAnswer === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            if (haptics) vibrate(10);
                            markCorrectAnswer(session.id, i, opt);
                          }}
                          className={cn('w-6 h-6 rounded text-[10px] font-bold transition border',
                            isYourAnswer ? 'text-white' : 'text-white/40 bg-white/5 border-white/10')}
                          style={isYourAnswer ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx] } : {}}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} /><span className="text-white/40">Correct</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} /><span className="text-white/40">Wrong</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} /><span className="text-white/40">Review</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#6b7280' }} /><span className="text-white/40">Skipped</span></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} /><span className="text-white/40">Unmarked</span></span>
        </div>

        <button onClick={() => { if (haptics) vibrate(15); onClose(); }} className="w-full py-3.5 rounded-xl bg-teal-500 text-black font-bold text-base active:scale-95 transition">Save & Close</button>
      </div>
    </motion.div>
  );
}
