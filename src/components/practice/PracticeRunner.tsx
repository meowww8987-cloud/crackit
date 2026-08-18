'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Flag, Save } from 'lucide-react';
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

// ===== Review Phase — List with A/B/C/D (questions persist even when correct) =====
function ReviewPhase({ session, markCorrectAnswer, saveNotes, onClose, haptics }: {
  session: PracticeSession;
  markCorrectAnswer: (sessionId: string, questionIndex: number, correctAnswer: string | null) => void;
  saveNotes: (sessionId: string, questionIndex: number, conceptNotes: string, formulaNotes: string) => void;
  onClose: () => void;
  haptics: boolean;
}) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
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

  // Sort: wrong first, then unmarked, then correct
  const sortedQuestions = [...session.questions].sort((a, b) => {
    const order = { wrong: 0, unmarked: 1, correct: 2 };
    return (order[a.result] ?? 1) - (order[b.result] ?? 1);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto force-dark-ui"
      style={{ background: '#000000' }}>
      <div className="p-5 pt-[env(safe-area-inset-top,0px)] pt-8 max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📊</div>
          <h2 className="text-lg font-bold text-white">Answer Key</h2>
          <p className="text-xs text-white/40 mt-0.5">{session.name}</p>
          <p className="text-[10px] text-white/30 mt-1">Select correct answer for each question. Tap to expand for notes.</p>
        </div>

        {/* Stats */}
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div><div className="text-2xl font-bold text-green-400 tabular">{correct}</div><div className="text-[9px] text-white/40">Correct</div></div>
            <div><div className="text-2xl font-bold text-red-400 tabular">{wrong}</div><div className="text-[9px] text-white/40">Wrong</div></div>
            <div><div className="text-2xl font-bold text-white/40 tabular">{unmarked}</div><div className="text-[9px] text-white/40">Unmarked</div></div>
          </div>
          <div className="h-px bg-white/10 my-3" />
          <div className="grid grid-cols-2 gap-2 text-center">
            <div><div className="text-sm font-bold text-amber-400 tabular">{formatHM(session.totalTimeSec)}</div><div className="text-[9px] text-white/40">Total Time</div></div>
            <div><div className="text-sm font-bold text-teal-400 tabular">{accuracy}%</div><div className="text-[9px] text-white/40">Accuracy</div></div>
          </div>
          {times.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-center mt-2">
              <div><div className="text-xs text-green-300 tabular">{formatHM(fastest)}</div><div className="text-[9px] text-white/30">Fastest</div></div>
              <div><div className="text-xs text-red-300 tabular">{formatHM(slowest)}</div><div className="text-[9px] text-white/30">Slowest</div></div>
            </div>
          )}
        </div>

        {/* Question list — ALL questions persist, even when correct */}
        <div className="space-y-1.5 mb-6">
          {sortedQuestions.map((q) => {
            const originalIdx = session.questions.indexOf(q);
            const isExpanded = expandedQ === originalIdx;
            const resultColor = q.result === 'correct' ? '#22c55e' : q.result === 'wrong' ? '#ef4444' : 'rgba(255,255,255,0.15)';
            return (
              <div key={originalIdx} className="rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${resultColor}` }}>
                <div className="glass p-2.5 flex items-center gap-3" onClick={() => {
                  if (isExpanded) { setExpandedQ(null); }
                  else { setExpandedQ(originalIdx); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); }
                }}>
                  <div className="text-xs font-bold w-8 tabular" style={{ color: resultColor }}>Q{q.number}</div>
                  <div className="flex-1 text-[10px] text-white/50">
                    {formatHM(q.timeSpentSec)} · {q.status}
                    {q.userAnswer && <span className="ml-1 text-white/70">You: {q.userAnswer}</span>}
                    {q.conceptNotes && <span className="ml-1 text-amber-400/60">📝</span>}
                  </div>
                  {q.result === 'correct' && <Check size={14} className="text-green-400" />}
                  {q.result === 'wrong' && <X size={14} className="text-red-400" />}
                </div>

                {isExpanded && (
                  <div className="p-3 bg-white/[0.02] space-y-2">
                    {/* Your answer + correct answer */}
                    <div className="text-xs text-white/60">
                      Your answer: <span className="font-bold text-white">{q.userAnswer || '—'}</span>
                      {q.correctAnswer && <span className="ml-2">| Correct: <span className="font-bold text-white">{q.correctAnswer}</span></span>}
                      {q.result === 'correct' && <span className="ml-2 text-green-400">✓ Correct!</span>}
                      {q.result === 'wrong' && <span className="ml-2 text-red-400">✗ Wrong</span>}
                    </div>

                    {/* Correct answer selector — always available, even when already correct */}
                    <div>
                      <label className="text-[9px] text-white/40 uppercase">Select / change correct answer:</label>
                      <div className="flex gap-2 mt-1">
                        {OPTIONS.map((opt) => {
                          const isSelected = q.correctAnswer === opt;
                          const optIdx = OPTIONS.indexOf(opt);
                          const isYourAnswer = q.userAnswer === opt;
                          return (
                            <button key={opt} onClick={() => { if (haptics) vibrate(10); markCorrectAnswer(session.id, originalIdx, isSelected ? null : opt); }}
                              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2', isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10')}
                              style={isSelected ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx] } : isYourAnswer ? { borderColor: `${OPTION_COLORS[optIdx]}80` } : {}}>
                              {opt}
                              {isYourAnswer && <span className="block text-[7px] mt-0.5">yours</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[9px] text-white/40 uppercase">Concept / what went wrong</label>
                      <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="e.g. Forgot the formula..." className="w-full p-2 rounded-lg bg-white/5 text-xs mt-1 h-14 resize-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-white/40 uppercase">Formula for revision</label>
                      <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="e.g. R = u²sin2θ/g" className="w-full p-2 rounded-lg bg-white/5 text-xs mt-1 h-10 resize-none" />
                    </div>
                    <button onClick={() => { saveNotes(session.id, originalIdx, conceptDraft, formulaDraft); if (haptics) vibrate(10); setExpandedQ(null); }}
                      className="w-full py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition">
                      <Save size={12} /> Save & Close
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => { if (haptics) vibrate(15); onClose(); }} className="w-full py-3.5 rounded-xl bg-teal-500 text-black font-bold text-base active:scale-95 transition">Save & Close</button>
      </div>
    </motion.div>
  );
}
