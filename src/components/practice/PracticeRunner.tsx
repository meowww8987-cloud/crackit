'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Flag, Save, Edit, Clock, TrendingUp } from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { formatHMS, formatHM, cn, vibrate, todayKey } from '@/lib/utils';

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
  const [phase, setPhase] = useState<'practicing' | 'report' | 'edit'>('practicing');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [orientationAngle, setOrientationAngle] = useState(0);
  const wakeLockRef = useRef<any>(null);
  const timerResetRef = useRef(false);

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
    timerResetRef.current = false;
    const justEnded = usePractice.getState().history[0];
    if (justEnded) {
      const studySubject = (justEnded.subject === 'Mixed' ? 'General' : justEnded.subject) as any;
      useHistory.getState().addSession({
        targetId: null, subject: studySubject, chapter: justEnded.chapter, lecture: '',
        topic: justEnded.name, mode: 'free', studySeconds: justEnded.totalTimeSec, wastedSeconds: 0,
        startedAt: justEnded.startedAt, endedAt: justEnded.endedAt || Date.now(), date: todayKey(), mood: 'neutral' as any,
      });
      setReviewSessionId(justEnded.id);
      setPhase('report'); // Go to REPORT first, not answer key
    }
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
    if (activePractice && !timerResetRef.current) {
      timerResetRef.current = true;
      usePractice.setState({ activePractice: { ...activePractice, startedAt: Date.now() } });
      questionStartRef.current = Date.now();
    }
  }, [activePractice]);

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

  // === REPORT PHASE (shows after practice ends — NOT the answer key) ===
  if (phase === 'report' && reviewSession) {
    return <ReportPhase session={reviewSession} onEdit={() => setPhase('edit')} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }

  // === EDIT PHASE (answer key — accessible from report via Edit button) ===
  if (phase === 'edit' && reviewSession) {
    return <EditPhase session={reviewSession} markCorrectAnswer={markCorrectAnswer} saveNotes={saveNotes} onBack={() => setPhase('report')} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }

  if (!activePractice) return null;

  const totalElapsed = Math.floor((Date.now() - activePractice.startedAt) / 1000);
  const questionElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
  const answeredCount = activePractice.questions.filter(q => q.status === 'answered').length;
  const skippedCount = activePractice.questions.filter(q => q.status === 'skipped').length;
  const reviewCount = activePractice.questions.filter(q => q.status === 'review-later').length;
  const timeLimitSec = activePractice.timeLimitMin * 60;
  const visibleQuestions = activePractice.questions.slice(0, Math.max(30, currentIdx + 5));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-hidden force-dark-ui flex flex-col items-center justify-center p-6"
      style={{ background: '#000000', transform: `rotate(${orientationAngle}deg)` }}>
      <div className="absolute top-[env(safe-area-inset-top,0px)] top-6 left-0 right-0 px-4 z-10">
        <div className="flex flex-wrap gap-1 justify-center max-w-md mx-auto">
          {visibleQuestions.map((q, i) => (
            <div key={i} className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold transition', i === currentIdx && 'ring-2 ring-white')}
              style={{ background: q.status === 'answered' ? '#22c55e' : q.status === 'skipped' ? '#6b7280' : q.status === 'review-later' ? '#f59e0b' : 'rgba(255,255,255,0.3)', color: q.status === 'unanswered' ? 'rgba(255,255,255,0.6)' : '#000' }}>{q.number}</div>
          ))}
        </div>
      </div>
      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Question {currentIdx + 1}{activePractice.questionCount > 0 ? ` of ${activePractice.questionCount}` : ''}</div>
        <div className="text-4xl font-bold tabular text-white mb-1">{formatHMS(questionElapsed)}</div>
        <div className="text-sm text-white/50">Total: <span className="tabular text-amber-400">{formatHMS(totalElapsed)}</span>{timeLimitSec > 0 && <span className="ml-2">· Left: <span className={cn('tabular', timeLimitSec - totalElapsed < 60 ? 'text-red-400' : 'text-white/40')}>{formatHMS(Math.max(0, timeLimitSec - totalElapsed))}</span></span>}</div>
        <div className="flex items-center justify-center gap-3 mt-2 text-xs"><span className="text-green-400">✓ {answeredCount}</span><span className="text-white/40">→ {skippedCount}</span><span className="text-amber-400">⚑ {reviewCount}</span></div>
      </div>
      <div className="text-xs text-white/30 mb-5">{activePractice.name}</div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-4">
        {OPTIONS.map((opt, i) => (
          <button key={opt} onClick={() => handleSelectOption(opt)} className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 active:scale-95 transition" style={{ borderColor: `${OPTION_COLORS[i]}40`, background: `${OPTION_COLORS[i]}15` }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: OPTION_COLORS[i], color: '#fff' }}>{opt}</span>
          </button>
        ))}
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

// ===== REPORT PHASE — shows stats + per-question results (NOT answer key) =====
function ReportPhase({ session, onEdit, onClose, haptics }: {
  session: PracticeSession;
  onEdit: () => void;
  onClose: () => void;
  haptics: boolean;
}) {
  const correct = session.questions.filter(q => q.result === 'correct').length;
  const wrong = session.questions.filter(q => q.result === 'wrong').length;
  const unmarked = session.questions.filter(q => q.result === 'unmarked').length;
  const totalMarked = correct + wrong;
  const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
  const times = session.questions.map(q => q.timeSpentSec).filter(t => t > 0);
  const fastest = times.length > 0 ? Math.min(...times) : 0;
  const slowest = times.length > 0 ? Math.max(...times) : 0;
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  // Colors that work on BOTH light and dark themes (using inline styles)
  const correctColor = '#16a34a'; // green-600 — visible on light AND dark
  const wrongColor = '#dc2626';   // red-600 — visible on light AND dark
  const unmarkedColor = '#6b7280'; // gray-500 — visible on light AND dark
  const accentColor = '#0891b2';   // cyan-600 — visible on light AND dark
  const textColor = '#1f2937';     // gray-800 — visible on light themes
  const subTextColor = '#6b7280';   // gray-500 — visible on light themes

  const qColor = (q: PracticeQuestion) => q.result === 'correct' ? correctColor : q.result === 'wrong' ? wrongColor : unmarkedColor;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'var(--bg-app, #0a0b15)' }}>
      <div className="p-4 pt-[env(safe-area-inset-top,0px)] pt-8 max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">📊</div>
          <h2 className="text-lg font-bold" style={{ color: textColor }}>Practice Report</h2>
          <p className="text-[10px] mt-0.5" style={{ color: subTextColor }}>{session.name}</p>
        </div>

        {/* Stats card */}
        <div className="glass-strong rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <div><div className="text-2xl font-bold tabular" style={{ color: correctColor }}>{correct}</div><div className="text-[9px]" style={{ color: subTextColor }}>✓ Correct</div></div>
            <div><div className="text-2xl font-bold tabular" style={{ color: wrongColor }}>{wrong}</div><div className="text-[9px]" style={{ color: subTextColor }}>✗ Wrong</div></div>
            <div><div className="text-2xl font-bold tabular" style={{ color: unmarkedColor }}>{unmarked}</div><div className="text-[9px]" style={{ color: subTextColor }}>? Unmarked</div></div>
            <div><div className="text-2xl font-bold tabular" style={{ color: accentColor }}>{accuracy}%</div><div className="text-[9px]" style={{ color: subTextColor }}>Accuracy</div></div>
          </div>
          <div className="h-px bg-black/10 my-3" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs font-bold tabular" style={{ color: textColor }}>{formatHMS(session.totalTimeSec)}</div><div className="text-[9px]" style={{ color: subTextColor }}>Total</div></div>
            <div><div className="text-xs font-bold tabular" style={{ color: correctColor }}>{fastest ? formatHMS(fastest) : '—'}</div><div className="text-[9px]" style={{ color: subTextColor }}>Fastest</div></div>
            <div><div className="text-xs font-bold tabular" style={{ color: wrongColor }}>{slowest ? formatHMS(slowest) : '—'}</div><div className="text-[9px]" style={{ color: subTextColor }}>Slowest</div></div>
          </div>
        </div>

        {/* Per-question results list */}
        <div className="space-y-1.5 mb-4">
          {session.questions.map((q, i) => {
            const color = qColor(q);
            return (
              <div key={i} className="glass rounded-xl p-2.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${color}` }}>
                <span className="text-xs font-bold w-8 shrink-0" style={{ color }}>Q{q.number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px]" style={{ color: subTextColor }}>
                    {formatHMS(q.timeSpentSec)}
                    {q.userAnswer && <span className="ml-1" style={{ color: textColor }}>You: {q.userAnswer}</span>}
                    {q.correctAnswer && <span className="ml-1" style={{ color }}>Ans: {q.correctAnswer}</span>}
                  </div>
                  {q.conceptNotes && <div className="text-[9px] truncate" style={{ color: '#b45309' }}>📝 {q.conceptNotes}</div>}
                </div>
                {q.result === 'correct' && <Check size={14} style={{ color: correctColor }} />}
                {q.result === 'wrong' && <X size={14} style={{ color: wrongColor }} />}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button onClick={() => { if (haptics) vibrate(10); onEdit(); }}
            className="w-full py-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-2"
            style={{ color: '#2563eb' }}>
            <Edit size={14} /> Edit Answers & Notes
          </button>
          <button onClick={() => { if (haptics) vibrate(15); onClose(); }}
            className="w-full py-3.5 rounded-xl bg-teal-500 text-black font-bold text-base active:scale-95 transition">
            Done
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ===== EDIT PHASE — answer key (accessible from report via Edit button) =====
function EditPhase({ session, markCorrectAnswer, saveNotes, onBack, onClose, haptics }: {
  session: PracticeSession;
  markCorrectAnswer: (sessionId: string, questionIndex: number, correctAnswer: string | null) => void;
  saveNotes: (sessionId: string, questionIndex: number, conceptNotes: string, formulaNotes: string) => void;
  onBack: () => void;
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

  // Theme-safe colors via inline style (not text-white/N which gets overridden)
  const textColor = '#1f2937';
  const subTextColor = '#6b7280';
  const correctColor = '#16a34a';
  const wrongColor = '#dc2626';
  const unmarkedColor = '#9ca3af';

  const qColor = (q: PracticeQuestion) => q.result === 'correct' ? correctColor : q.result === 'wrong' ? wrongColor : unmarkedColor;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'var(--bg-app, #0a0b15)' }}>
      <div className="p-4 pt-[env(safe-area-inset-top,0px)] pt-8 max-w-md mx-auto">

        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { if (haptics) vibrate(8); onBack(); }}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center active:scale-90 transition"
            style={{ color: textColor }}>
            ←
          </button>
          <div>
            <h2 className="text-lg font-bold" style={{ color: textColor }}>Edit Answers</h2>
            <p className="text-[10px]" style={{ color: subTextColor }}>{correct}✓ {wrong}✗ {unmarked}? · {accuracy}%</p>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs mb-3 text-center" style={{ color: subTextColor }}>Tap A/B/C/D to mark correct answer. Tap + for notes.</p>

        {/* Question list — inline A/B/C/D on each row */}
        <div className="space-y-1.5 mb-4">
          {session.questions.map((q, i) => {
            const isExpanded = expandedQ === i;
            const color = qColor(q);
            return (
              <div key={i} className="rounded-xl overflow-hidden glass" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="p-2 flex items-center gap-2">
                  <span className="text-xs font-bold w-7 shrink-0" style={{ color }}>Q{q.number}</span>
                  <span className="text-[10px] flex-1 min-w-0 truncate" style={{ color: subTextColor }}>
                    {formatHMS(q.timeSpentSec)}
                    {q.userAnswer && <span className="ml-1" style={{ color: textColor }}>You:{q.userAnswer}</span>}
                    {q.result === 'correct' && <span className="ml-1" style={{ color: correctColor }}>✓</span>}
                    {q.result === 'wrong' && <span className="ml-1" style={{ color: wrongColor }}>✗</span>}
                    {q.conceptNotes && <span className="ml-1" style={{ color: '#b45309' }}>📝</span>}
                  </span>
                  {/* Inline A/B/C/D */}
                  <div className="flex gap-0.5 shrink-0">
                    {OPTIONS.map((opt) => {
                      const isSelected = q.correctAnswer === opt;
                      const optIdx = OPTIONS.indexOf(opt);
                      const isYourAnswer = q.userAnswer === opt;
                      return (
                        <button key={opt} onClick={() => { if (haptics) vibrate(10); markCorrectAnswer(session.id, i, isSelected ? null : opt); }}
                          className={cn('w-6 h-6 rounded text-[10px] font-bold transition border')}
                          style={isSelected
                            ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx], color: '#fff' }
                            : isYourAnswer
                              ? { borderColor: `${OPTION_COLORS[optIdx]}80`, color: OPTION_COLORS[optIdx], background: 'transparent' }
                              : { color: subTextColor, background: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.1)' }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => { if (isExpanded) { setExpandedQ(null); } else { setExpandedQ(i); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); } }}
                    className="text-[12px] shrink-0 w-4" style={{ color: '#b45309' }}>{isExpanded ? '−' : '+'}</button>
                </div>
                {isExpanded && (
                  <div className="p-2.5 space-y-2" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="Concept / what went wrong..." className="w-full p-2 rounded-lg text-xs h-12 resize-none" style={{ background: 'rgba(0,0,0,0.05)', color: textColor }} />
                    <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Formula for revision..." className="w-full p-2 rounded-lg text-xs h-10 resize-none" style={{ background: 'rgba(0,0,0,0.05)', color: textColor }} />
                    <button onClick={() => { saveNotes(session.id, i, conceptDraft, formulaDraft); if (haptics) vibrate(10); setExpandedQ(null); }}
                      className="w-full py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition"
                      style={{ background: 'rgba(180,83,9,0.15)', color: '#b45309' }}>
                      <Save size={10} /> Save Notes
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => { if (haptics) vibrate(15); onBack(); }}
          className="w-full py-3.5 rounded-xl bg-teal-500 text-black font-bold text-base active:scale-95 transition">
          Back to Report
        </button>
      </div>
    </motion.div>
  );
}
