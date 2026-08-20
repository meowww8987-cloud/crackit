'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, ChevronRight, Flag, Save, Edit, Clock, TrendingUp, Pause,
  Menu, X as XIcon, Play, FileText, ListTree, PenLine, AlertCircle, Plus, Minus,
} from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { formatHMS, formatHM, cn, vibrate, todayKey } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS: Record<string, string> = { A: '#3b82f6', B: '#22c55e', C: '#f59e0b', D: '#ef4444' };

type QuestionMode = 'single' | 'multi' | 'written';

export function PracticeRunner() {
  const activePractice = usePractice((s) => s.activePractice);
  const currentIdx = usePractice((s) => s.currentQuestionIndex);
  const answerQuestion = usePractice((s) => s.answerQuestion);
  const endPractice = usePractice((s) => s.endPractice);
  const cancelPractice = usePractice((s) => s.cancelPractice);
  const pausePractice = usePractice((s) => s.pausePractice);
  const markCorrectAnswer = usePractice((s) => s.markCorrectAnswer);
  const saveNotes = usePractice((s) => s.saveNotes);
  const setQuestionMode = usePractice((s) => s.setQuestionMode);
  const setSubAnswer = usePractice((s) => s.setSubAnswer);
  const history = usePractice((s) => s.history);
  const haptics = useSettings((s) => s.haptics);

  const [, setTick] = useState(0);
  const questionStartRef = useRef(Date.now());
  const [phase, setPhase] = useState<'practicing' | 'report' | 'edit'>('practicing');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  // Hamburger menu — when open, timer is paused (user is configuring question mode).
  const [menuOpen, setMenuOpen] = useState(false);
  // Pause reference — when menu is open, we freeze questionStartRef so timer
  // doesn't advance. On close, we shift questionStartRef forward by the time
  // the menu was open.
  const menuOpenSinceRef = useRef<number | null>(null);
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
      setPhase('report');
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

  /** Multi-mode: record one sub-question's answer. */
  const handleSelectSubAnswer = useCallback((subIndex: number, option: string) => {
    if (haptics) vibrate(10);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (!session) return;
    // Toggle: if already selected, allow tap to deselect? Keep it simple — just set.
    setSubAnswer(idx, subIndex, option);
  }, [haptics, setSubAnswer]);

  /** Multi-mode: mark the question as answered (after user picks sub-answers). */
  const handleMultiDone = useCallback(() => {
    if (haptics) vibrate(12);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed, status: 'answered' };
      usePractice.setState({ activePractice: { ...session, questions } });
    }
    answerQuestion('answered');
  }, [haptics, answerQuestion]);

  /** Written mode: mark as answered (answer is on paper). */
  const handleWrittenDone = useCallback(() => {
    if (haptics) vibrate(12);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (session) {
      const questions = [...session.questions];
      while (questions.length <= idx) {
        questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
      }
      const qElapsed = Math.floor((Date.now() - questionStartRef.current) / 1000);
      questions[idx] = { ...questions[idx], timeSpentSec: qElapsed, status: 'answered' };
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

  const handlePause = useCallback(() => {
    if (haptics) vibrate([10, 30, 10]);
    const session = usePractice.getState().activePractice;
    const idx = usePractice.getState().currentQuestionIndex;
    if (!session) return;
    const now = Date.now();
    const qElapsed = Math.floor((now - questionStartRef.current) / 1000);
    const totalElapsed = Math.floor((now - session.startedAt) / 1000);
    const questions = [...session.questions];
    while (questions.length <= idx) {
      questions.push({
        number: questions.length + 1, timeSpentSec: 0, status: 'unanswered',
        result: 'unmarked', userAnswer: null, correctAnswer: null,
        conceptNotes: '', formulaNotes: '',
      });
    }
    questions[idx] = { ...questions[idx], timeSpentSec: qElapsed };
    const snapshot: PracticeSession = {
      ...session, questions,
      accumulatedTimeSec: totalElapsed, pausedAt: now, resumeQuestionIndex: idx,
    };
    pausePractice(snapshot);
    timerResetRef.current = false;
  }, [haptics, pausePractice]);

  // Open menu → freeze timer. Close → shift questionStartRef forward.
  useEffect(() => {
    if (menuOpen) {
      menuOpenSinceRef.current = Date.now();
    } else if (menuOpenSinceRef.current !== null) {
      const pausedMs = Date.now() - menuOpenSinceRef.current;
      questionStartRef.current += pausedMs;  // shift forward so timer doesn't jump
      menuOpenSinceRef.current = null;
      setTick((t) => t + 1);  // force re-render of timer display
    }
  }, [menuOpen]);

  useEffect(() => { questionStartRef.current = Date.now(); }, [currentIdx]);

  useEffect(() => {
    if (activePractice && !timerResetRef.current) {
      timerResetRef.current = true;
      const isResume = !!(activePractice.accumulatedTimeSec && activePractice.accumulatedTimeSec > 0);
      if (isResume) {
        const currentQ = activePractice.questions[currentIdx];
        const qElapsedBeforePause = currentQ?.timeSpentSec || 0;
        questionStartRef.current = Date.now() - qElapsedBeforePause * 1000;
      } else {
        usePractice.setState({ activePractice: { ...activePractice, startedAt: Date.now() } });
        questionStartRef.current = Date.now();
      }
    }
  }, [activePractice, currentIdx]);

  // Wake lock — keep screen awake during practice.
  useEffect(() => {
    if (!activePractice) return;
    const requestWakeLock = async () => { try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {} };
    requestWakeLock();
    const onVis = () => { if (!document.hidden && usePractice.getState().activePractice) requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; } };
  }, [activePractice]);

  // 500ms tick — refreshes the timer display. Stopped while menu is open.
  useEffect(() => {
    if (!activePractice) return;
    const i = setInterval(() => {
      if (menuOpen) return;  // timer frozen while menu open
      setTick((t) => t + 1);
      const session = usePractice.getState().activePractice;
      if (session && session.timeLimitMin > 0) {
        const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
        if (elapsed >= session.timeLimitMin * 60) handleEnd();
      }
    }, 500);
    return () => clearInterval(i);
  }, [activePractice, handleEnd, menuOpen]);

  useEffect(() => { if (!activePractice) return; if (activePractice.questionCount > 0 && currentIdx >= activePractice.questionCount) handleEnd(); }, [currentIdx, activePractice, handleEnd]);

  if (!activePractice && phase === 'practicing' && !reviewSession) return null;

  // === REPORT PHASE ===
  if (phase === 'report' && reviewSession) {
    return <ReportPhase session={reviewSession} onEdit={() => setPhase('edit')} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }
  // === EDIT PHASE ===
  if (phase === 'edit' && reviewSession) {
    return <EditPhase session={reviewSession} markCorrectAnswer={markCorrectAnswer} saveNotes={saveNotes} onBack={() => setPhase('report')} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }
  if (!activePractice) return null;

  const totalElapsed = Math.floor((Date.now() - activePractice.startedAt) / 1000);
  const questionElapsed = menuOpen
    ? Math.floor(((menuOpenSinceRef.current ?? Date.now()) - questionStartRef.current) / 1000)
    : Math.floor((Date.now() - questionStartRef.current) / 1000);
  const answeredCount = activePractice.questions.filter(q => q.status === 'answered').length;
  const skippedCount = activePractice.questions.filter(q => q.status === 'skipped').length;
  const reviewCount = activePractice.questions.filter(q => q.status === 'review-later').length;
  const timeLimitSec = activePractice.timeLimitMin * 60;
  const visibleQuestions = activePractice.questions.slice(0, Math.max(30, currentIdx + 5));

  // Current question + its mode
  const currentQ = activePractice.questions[currentIdx];
  const currentMode: QuestionMode = (currentQ?.mode as QuestionMode) || 'single';
  const subCount = currentQ?.subQuestionCount ?? 3;
  const subAnswers = currentQ?.subUserAnswers ?? Array(subCount).fill(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-hidden force-dark-ui flex flex-col items-center justify-center p-6"
      style={{ background: '#000000' }}>
      {/* === Top bar: question pills (centered) + hamburger menu (top-right) === */}
      <div className="absolute top-[env(safe-area-inset-top,0px)] top-5 left-0 right-0 px-4 z-10 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 flex flex-wrap gap-1 justify-start max-w-[calc(100%-50px)] mx-auto">
          {visibleQuestions.map((q, i) => (
            <div key={i} className={cn('w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold transition', i === currentIdx && 'ring-2 ring-white')}
              style={{ background: q.status === 'answered' ? '#22c55e' : q.status === 'skipped' ? '#6b7280' : q.status === 'review-later' ? '#f59e0b' : 'rgba(255,255,255,0.3)', color: q.status === 'unanswered' ? 'rgba(255,255,255,0.6)' : '#000' }}>{q.number}</div>
          ))}
        </div>
        {/* Hamburger menu button */}
        <button
          onClick={() => { if (haptics) vibrate(8); setMenuOpen(true); }}
          className="shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-90 transition"
          aria-label="Practice menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* === Timer + stats === */}
      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1 flex items-center justify-center gap-1.5">
          <span>Question {currentIdx + 1}{activePractice.questionCount > 0 ? ` of ${activePractice.questionCount}` : ''}</span>
          {currentMode !== 'single' && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[8px] font-bold uppercase">
              {currentMode === 'multi' ? `${subCount} sub-Q` : 'Written'}
            </span>
          )}
          {menuOpen && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] font-bold uppercase animate-pulse">
              Paused
            </span>
          )}
        </div>
        <div className="text-4xl font-bold tabular text-white mb-1">{formatHMS(questionElapsed)}</div>
        <div className="text-sm text-white/50">Total: <span className="tabular text-amber-400">{formatHMS(totalElapsed)}</span>{timeLimitSec > 0 && <span className="ml-2">· Left: <span className={cn('tabular', timeLimitSec - totalElapsed < 60 ? 'text-red-400' : 'text-white/40')}>{formatHMS(Math.max(0, timeLimitSec - totalElapsed))}</span></span>}</div>
        <div className="flex items-center justify-center gap-3 mt-2 text-xs"><span className="text-green-400">✓ {answeredCount}</span><span className="text-white/40">→ {skippedCount}</span><span className="text-amber-400">⚑ {reviewCount}</span></div>
      </div>

      <div className="text-xs text-white/30 mb-5">{activePractice.name}</div>

      {/* === Question options — render based on mode === */}
      <div className="w-full max-w-xs mb-4">
        {currentMode === 'single' && (
          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map((opt, i) => {
              const isSelected = currentQ?.userAnswer === opt;
              return (
                <button key={opt} onClick={() => handleSelectOption(opt)}
                  className={cn('flex items-center justify-center gap-2 py-4 rounded-2xl border-2 active:scale-95 transition',
                    isSelected ? 'border-white' : '')}
                  style={{ borderColor: isSelected ? '#ffffff' : `${OPTION_COLORS[opt]}40`, background: isSelected ? `${OPTION_COLORS[opt]}30` : `${OPTION_COLORS[opt]}15` }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: OPTION_COLORS[opt], color: '#fff' }}>{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentMode === 'multi' && (
          <div className="space-y-2">
            <p className="text-[10px] text-white/50 text-center mb-1">
              One statement, {subCount} sub-questions — tap an option for each
            </p>
            {Array.from({ length: subCount }, (_, si) => (
              <div key={si} className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white/70">
                    Q{currentIdx + 1}.{si + 1}
                  </span>
                  {subAnswers[si] && (
                    <span className="text-[9px] text-white/40">Selected: <span className="font-bold" style={{ color: OPTION_COLORS[subAnswers[si] as string] }}>{subAnswers[si]}</span></span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {OPTIONS.map((opt) => {
                    const isSelected = subAnswers[si] === opt;
                    return (
                      <button key={opt} onClick={() => handleSelectSubAnswer(si, opt)}
                        className={cn('py-2 rounded-lg text-[11px] font-bold transition border', isSelected ? 'text-white' : 'text-white/60 bg-white/5 border-white/10')}
                        style={isSelected
                          ? { background: OPTION_COLORS[opt], borderColor: OPTION_COLORS[opt] }
                          : {}}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={handleMultiDone}
              className="w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-bold active:scale-95 transition flex items-center justify-center gap-1.5 mt-2">
              <Check size={14} /> Mark Answered
            </button>
          </div>
        )}

        {currentMode === 'written' && (
          <div className="space-y-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <PenLine size={24} className="text-white/40 mx-auto mb-2" />
              <p className="text-xs text-white/70 mb-1">Write your answer on paper</p>
              <p className="text-[10px] text-white/40">Tap below once you've written it</p>
            </div>
            <button onClick={handleWrittenDone}
              className="w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-bold active:scale-95 transition flex items-center justify-center gap-1.5">
              <Check size={14} /> I've Written the Answer
            </button>
          </div>
        )}
      </div>

      {/* === Bottom: Skip / Review Later only === */}
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={handleSkip} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/50 active:scale-95 transition flex items-center justify-center gap-1.5"><ChevronRight size={14} /> Skip</button>
        <button onClick={handleReviewLater} className="flex-1 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 active:scale-95 transition flex items-center justify-center gap-1.5"><Flag size={14} /> Review Later</button>
      </div>

      {/* === Hamburger menu overlay === */}
      <AnimatePresence>
        {menuOpen && (
          <PracticeMenu
            activePractice={activePractice}
            currentIdx={currentIdx}
            currentMode={currentMode}
            subCount={subCount}
            haptics={haptics}
            onClose={() => setMenuOpen(false)}
            onSetMode={(mode, n) => {
              setQuestionMode(currentIdx, mode, n);
              if (haptics) vibrate(12);
            }}
            onAdjustSubCount={(delta) => {
              const newCount = Math.max(1, Math.min(6, subCount + delta));
              setQuestionMode(currentIdx, 'multi', newCount);
              if (haptics) vibrate(8);
            }}
            onEnd={() => { setMenuOpen(false); setTimeout(() => handleEnd(), 100); }}
            onPause={() => { setMenuOpen(false); setTimeout(() => handlePause(), 100); }}
            onCancel={() => {
              setMenuOpen(false);
              setTimeout(() => {
                if (confirm('Cancel practice? Progress will be lost.')) cancelPractice();
              }, 100);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ============ Hamburger menu — slides in from right ============ */
function PracticeMenu({
  activePractice, currentIdx, currentMode, subCount, haptics,
  onClose, onSetMode, onAdjustSubCount, onEnd, onPause, onCancel,
}: {
  activePractice: PracticeSession;
  currentIdx: number;
  currentMode: QuestionMode;
  subCount: number;
  haptics: boolean;
  onClose: () => void;
  onSetMode: (mode: QuestionMode, subCount?: number) => void;
  onAdjustSubCount: (delta: number) => void;
  onEnd: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      {/* Dim backdrop — clicks close the menu */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm"
      />
      {/* Menu sheet — slides in from right */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-0 right-0 bottom-0 z-[10001] w-[85%] max-w-xs bg-[#0a0b15] border-l border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)] pt-4 pb-3 border-b border-white/10">
          <div>
            <div className="text-sm font-bold text-white">Practice Menu</div>
            <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
              <Pause size={10} /> Timer paused
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 active:scale-90 transition"
            aria-label="Close menu">
            <XIcon size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* === Section 1: Question Type === */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/40 font-bold mb-2 flex items-center gap-1">
              <ListTree size={11} /> Question Type — Q{currentIdx + 1}
            </div>
            <div className="space-y-1.5">
              <MenuOption
                icon={FileText}
                title="Single MCQ"
                desc="One question, 4 options (A/B/C/D)"
                active={currentMode === 'single'}
                onClick={() => onSetMode('single')}
                color="#22c55e"
              />
              <MenuOption
                icon={ListTree}
                title="Multi-Question"
                desc="One statement, multiple sub-MCQs"
                active={currentMode === 'multi'}
                onClick={() => onSetMode('multi', subCount)}
                color="#3b82f6"
              />
              {/* Sub-question count adjuster (only in multi mode) */}
              {currentMode === 'multi' && (
                <div className="ml-3 mt-1.5 flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <span className="text-[11px] text-white/60">Sub-questions</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onAdjustSubCount(-1)}
                      className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-90 transition">
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-white tabular w-6 text-center">{subCount}</span>
                    <button onClick={() => onAdjustSubCount(1)}
                      className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 active:scale-90 transition">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )}
              <MenuOption
                icon={PenLine}
                title="Written / Numerical"
                desc="Long answer on paper — just mark done"
                active={currentMode === 'written'}
                onClick={() => onSetMode('written')}
                color="#f59e0b"
              />
            </div>
          </div>

          {/* === Section 2: Actions === */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/40 font-bold mb-2">
              Actions
            </div>
            <div className="space-y-1.5">
              <ActionButton
                icon={Pause}
                title="Pause Practice"
                desc="Save progress, resume later"
                onClick={onPause}
                color="#f59e0b"
              />
              <ActionButton
                icon={Check}
                title="End Practice"
                desc="Finish + see report"
                onClick={onEnd}
                color="#22c55e"
              />
              <ActionButton
                icon={X}
                title="Cancel"
                desc="Discard all progress"
                onClick={onCancel}
                color="#ef4444"
              />
            </div>
          </div>

          {/* Footer hint */}
          <div className="text-[9px] text-white/30 text-center pt-2 leading-relaxed">
            Timer stays paused while this menu is open.
            <br />Close to resume.
          </div>
        </div>
      </motion.div>
    </>
  );
}

function MenuOption({
  icon: Icon, title, desc, active, onClick, color,
}: {
  icon: typeof FileText;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 p-3 rounded-xl border text-left active:scale-[0.98] transition',
        active ? 'border-2' : 'border')}
      style={active
        ? { background: `${color}20`, borderColor: color }
        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, color }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white flex items-center gap-1.5">
          {title}
          {active && <Check size={11} style={{ color }} />}
        </div>
        <div className="text-[10px] text-white/50 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

function ActionButton({
  icon: Icon, title, desc, onClick, color,
}: {
  icon: typeof Pause;
  title: string;
  desc: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left active:scale-[0.98] transition"
      style={{ background: `${color}15`, borderColor: `${color}40` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}25`, color }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white">{title}</div>
        <div className="text-[10px] text-white/50 mt-0.5">{desc}</div>
      </div>
    </button>
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

  const correctColor = '#16a34a';
  const wrongColor = '#dc2626';
  const unmarkedColor = '#6b7280';
  const accentColor = '#0891b2';
  const textColor = '#1f2937';
  const subTextColor = '#6b7280';

  const qColor = (q: PracticeQuestion) => q.result === 'correct' ? correctColor : q.result === 'wrong' ? wrongColor : unmarkedColor;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'var(--bg-app, #0a0b15)' }}>
      <div className="p-4 pt-[env(safe-area-inset-top,0px)] pt-8 max-w-md mx-auto">

        <div className="text-center mb-4">
          <div className="text-4xl mb-1">📊</div>
          <h2 className="text-lg font-bold" style={{ color: textColor }}>Practice Report</h2>
          <p className="text-[10px] mt-0.5" style={{ color: subTextColor }}>{session.name}</p>
        </div>

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

        <div className="space-y-1.5 mb-4">
          {session.questions.map((q, i) => {
            const color = qColor(q);
            const mode = q.mode || 'single';
            return (
              <div key={i} className="glass rounded-xl p-2.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${color}` }}>
                <span className="text-xs font-bold w-8 shrink-0" style={{ color }}>Q{q.number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px]" style={{ color: subTextColor }}>
                    {formatHMS(q.timeSpentSec)}
                    {mode === 'multi' && q.subUserAnswers && (
                      <span className="ml-1.5 text-blue-500">[{q.subUserAnswers.filter(Boolean).join('/')}]</span>
                    )}
                    {mode === 'written' && <span className="ml-1.5 text-amber-500">written</span>}
                    {mode === 'single' && q.userAnswer && <span className="ml-1" style={{ color: textColor }}>You: {q.userAnswer}</span>}
                    {mode === 'single' && q.correctAnswer && <span className="ml-1" style={{ color }}>Ans: {q.correctAnswer}</span>}
                  </div>
                  {q.conceptNotes && <div className="text-[9px] truncate" style={{ color: '#b45309' }}>📝 {q.conceptNotes}</div>}
                </div>
                {q.result === 'correct' && <Check size={14} style={{ color: correctColor }} />}
                {q.result === 'wrong' && <X size={14} style={{ color: wrongColor }} />}
              </div>
            );
          })}
        </div>

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

        <p className="text-xs mb-3 text-center" style={{ color: subTextColor }}>Tap A/B/C/D to mark correct answer. Tap + for notes.</p>

        <div className="space-y-1.5 mb-4">
          {session.questions.map((q, i) => {
            const isExpanded = expandedQ === i;
            const color = qColor(q);
            const mode = q.mode || 'single';
            return (
              <div key={i} className="rounded-xl overflow-hidden glass" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="p-2 flex items-center gap-2">
                  <span className="text-xs font-bold w-7 shrink-0" style={{ color }}>Q{q.number}</span>
                  <span className="text-[10px] flex-1 min-w-0 truncate" style={{ color: subTextColor }}>
                    {formatHMS(q.timeSpentSec)}
                    {mode === 'multi' && <span className="ml-1 text-blue-500">[{q.subQuestionCount ?? 0} sub]</span>}
                    {mode === 'written' && <span className="ml-1 text-amber-500">written</span>}
                    {mode === 'single' && q.userAnswer && <span className="ml-1" style={{ color: textColor }}>You:{q.userAnswer}</span>}
                    {mode === 'single' && q.result === 'correct' && <span className="ml-1" style={{ color: correctColor }}>✓</span>}
                    {mode === 'single' && q.result === 'wrong' && <span className="ml-1" style={{ color: wrongColor }}>✗</span>}
                    {q.conceptNotes && <span className="ml-1" style={{ color: '#b45309' }}>📝</span>}
                  </span>
                  {/* Inline A/B/C/D — only for single mode */}
                  {mode === 'single' && (
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
                  )}
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
