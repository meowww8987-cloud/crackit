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

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const OPTION_COLORS: Record<string, string> = {
  A: '#3b82f6', B: '#22c55e', C: '#f59e0b', D: '#ef4444',
  E: '#a855f7', F: '#06b6d4', G: '#ec4899', H: '#84cc16',
};

type QuestionMode = 'single' | 'multi' | 'written';

/** Hook to detect viewport orientation — returns true when viewport is
 *  wider than it is tall (landscape). Updates on window resize. */
function useViewportLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isLandscape;
}

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
  const setOptionCount = usePractice((s) => s.setOptionCount);
  const history = usePractice((s) => s.history);
  const haptics = useSettings((s) => s.haptics);

  // === Viewport orientation — drives layout, NOT rotation ===
  // The browser already handles device rotation (the viewport becomes
  // landscape when the user tilts their phone). We just detect this and
  // apply a 2-column layout that uses the wide viewport properly.
  const isLandscape = useViewportLandscape();

  const [, setTick] = useState(0);
  const questionStartRef = useRef(Date.now());
  const [phase, setPhase] = useState<'practicing' | 'report' | 'edit'>('practicing');
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const handleSelectSubAnswer = useCallback((subIndex: number, option: string) => {
    if (haptics) vibrate(10);
    const idx = usePractice.getState().currentQuestionIndex;
    setSubAnswer(idx, subIndex, option);
  }, [haptics, setSubAnswer]);

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
      questions.push({ number: questions.length + 1, timeSpentSec: 0, status: 'unanswered', result: 'unmarked', userAnswer: null, correctAnswer: null, conceptNotes: '', formulaNotes: '' });
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
      questionStartRef.current += pausedMs;
      menuOpenSinceRef.current = null;
      setTick((t) => t + 1);
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
    const i = setInterval(() => {
      if (menuOpen) return;
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
  if (phase === 'report' && reviewSession) {
    return <ReportPhase session={reviewSession} onEdit={() => setPhase('edit')} onClose={() => { setPhase('practicing'); setReviewSessionId(null); }} haptics={haptics} />;
  }
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

  const currentQ = activePractice.questions[currentIdx];
  const currentMode: QuestionMode = (currentQ?.mode as QuestionMode) || 'single';
  const subCount = currentQ?.subQuestionCount ?? 3;
  const subAnswers = currentQ?.subUserAnswers ?? Array(subCount).fill(null);
  const optionCount = currentQ?.optionCount ?? 4;  // 2-8, default 4 (A/B/C/D)
  const currentOptions = OPTION_LETTERS.slice(0, optionCount);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-hidden force-dark-ui"
      style={{ background: '#000000' }}>
      {/* === Inner content — orientation-aware layout (NO rotation) ===
          - Portrait: single column (timer on top, options below, actions at bottom)
          - Landscape: 2-column row (timer+stats on LEFT, options+actions on RIGHT)
          The browser already handles device rotation — when the user tilts their
          phone, the viewport becomes landscape (width > height) and we detect it
          via the useViewportLandscape hook (resize + orientationchange events). */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: isLandscape ? 'stretch' : 'center',
        justifyContent: isLandscape ? 'space-between' : 'flex-start',
        padding: isLandscape ? '1rem 1.5rem' : '1.5rem 1rem',
        paddingTop: isLandscape ? '1rem' : 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
        paddingBottom: isLandscape ? '1rem' : 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        gap: isLandscape ? '1rem' : 0,
      } as React.CSSProperties}>
        {/* === Top bar: question pills + hamburger menu ===
            Always at the top, full width. flexShrink: 0. */}
        <div className="w-full max-w-2xl flex items-start justify-between gap-2" style={{ flexShrink: 0 }}>
          <div className="flex-1 min-w-0 flex flex-wrap gap-1 justify-start max-w-[calc(100%-50px)]">
            {visibleQuestions.map((q, i) => (
              <div key={i} className={cn('w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold transition', i === currentIdx && 'ring-2 ring-white')}
                style={{ background: q.status === 'answered' ? '#22c55e' : q.status === 'skipped' ? '#6b7280' : q.status === 'review-later' ? '#f59e0b' : 'rgba(255,255,255,0.3)', color: q.status === 'unanswered' ? 'rgba(255,255,255,0.6)' : '#000' }}>{q.number}</div>
            ))}
          </div>
          <button
            onClick={() => { if (haptics) vibrate(8); setMenuOpen(true); }}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/20 active:scale-90 transition"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
            aria-label="Practice menu">
            <Menu size={20} />
          </button>
        </div>

        {/* === Main content area ===
            - Portrait: single column (timer on top → options → actions)
            - Landscape: 2 columns (timer+practice-name on LEFT, options+actions on RIGHT)
            flex: 1 + minHeight: 0 so it takes remaining space after top bar */}
        <div style={{
          flex: '1 1 0',
          minHeight: 0,
          display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          alignItems: isLandscape ? 'stretch' : 'center',
          justifyContent: isLandscape ? 'space-between' : 'flex-start',
          gap: isLandscape ? '1rem' : 0,
          width: '100%',
          maxWidth: isLandscape ? 'none' : '20rem',
          marginTop: '0.5rem',
        } as React.CSSProperties}>

        {/* === LEFT column (portrait: top / landscape: left ~30%): Timer + stats + practice name + (landscape) actions === */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isLandscape ? 'center' : 'flex-start',
          flex: isLandscape ? '0 0 30%' : '0 0 auto',
          width: isLandscape ? '30%' : '100%',
          maxWidth: isLandscape ? '14rem' : 'none',
          textAlign: 'center',
          gap: '0.5rem',
        } as React.CSSProperties}>

        {/* === Timer + stats === (flexShrink: 0) */}
        <div className="text-center" style={{ color: '#ffffff', flexShrink: 0 }}>
          <div className="text-[10px] uppercase tracking-[0.2em] mb-0.5 flex items-center justify-center gap-1.5 flex-wrap" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span>Question {currentIdx + 1}{activePractice.questionCount > 0 ? ` of ${activePractice.questionCount}` : ''}</span>
            {currentMode !== 'single' && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                {currentMode === 'multi' ? `${subCount} sub` : 'Written'}
              </span>
            )}
            {optionCount !== 4 && currentMode !== 'written' && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                style={{ background: 'rgba(168,85,247,0.2)', color: '#d8b4fe' }}>
                {optionCount} opts
              </span>
            )}
            {menuOpen && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase animate-pulse"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                Paused
              </span>
            )}
          </div>
          <div className="text-3xl sm:text-4xl font-bold tabular mb-0.5" style={{ color: '#ffffff' }}>{formatHMS(questionElapsed)}</div>
          <div className="text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total: <span className="tabular" style={{ color: '#fbbf24' }}>{formatHMS(totalElapsed)}</span>{timeLimitSec > 0 && <span className="ml-2">· Left: <span className="tabular" style={{ color: timeLimitSec - totalElapsed < 60 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{formatHMS(Math.max(0, timeLimitSec - totalElapsed))}</span></span>}</div>
          <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
            <span style={{ color: '#4ade80' }}>✓ {answeredCount}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>→ {skippedCount}</span>
            <span style={{ color: '#fbbf24' }}>⚑ {reviewCount}</span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{activePractice.name}</div>
        </div>

        {/* === Action buttons: Skip / Review Later ===
            In LANDSCAPE: placed inside LEFT column (under timer + practice name).
            In PORTRAIT: hidden here — rendered at the bottom of the main column instead. */}
        {isLandscape && (
          <div className="w-full mt-3 flex flex-col gap-2" style={{ flexShrink: 0 }}>
            <button onClick={handleSkip}
              className="w-full py-2 rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              <ChevronRight size={13} /> Skip
            </button>
            <button onClick={handleReviewLater}
              className="w-full py-2 rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              <Flag size={13} /> Review
            </button>
          </div>
        )}
        </div>{/* === END LEFT column === */}

        {/* === RIGHT column (portrait: bottom / landscape: right ~70%): Options ===
            In landscape: takes most of the width so option buttons have plenty of
            horizontal space (they're tapped frequently). No max-width constraint. */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: isLandscape ? 'center' : 'flex-start',
          flex: isLandscape ? '1 1 0' : '1 1 0',
          width: isLandscape ? '70%' : '100%',
          maxWidth: isLandscape ? 'none' : '20rem',
          minHeight: 0,
        } as React.CSSProperties}>

        {/* === Question options — flex: 1 + SCROLLABLE ===
            Takes remaining vertical space. When content exceeds available
            height (e.g. 6 sub-questions, 8 options), it scrolls vertically
            instead of overflowing off-screen. */}
        <div className="w-full flex flex-col"
          style={{
            flex: '1 1 0',
            minHeight: 0,  // critical for flexbox overflow to work
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          } as React.CSSProperties}>
          {/* Hide scrollbar for cleaner look but keep functionality */}
          <style>{`.practice-scroll::-webkit-scrollbar { width: 4px; } .practice-scroll::-webkit-scrollbar-track { background: transparent; } .practice-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }`}</style>

          {currentMode === 'single' && (
            <div className={cn('grid gap-2',
              isLandscape
                ? (optionCount <= 4 ? 'grid-cols-4' : 'grid-cols-4')
                : (optionCount <= 4 ? 'grid-cols-2' : 'grid-cols-3')
            )}>
              {currentOptions.map((opt) => {
                const isSelected = currentQ?.userAnswer === opt;
                return (
                  <button key={opt} onClick={() => handleSelectOption(opt)}
                    className={cn('flex items-center justify-center gap-2 py-3 rounded-2xl border-2 active:scale-95 transition',
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
            <div className="space-y-1.5">
              <p className="text-[10px] text-center mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                One statement, {subCount} sub-questions — tap an option for each
              </p>
              {Array.from({ length: subCount }, (_, si) => (
                <div key={si} className="rounded-lg p-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Q{currentQ?.number ?? currentIdx + 1}.{si + 1}
                    </span>
                    {subAnswers[si] && (
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="font-bold" style={{ color: OPTION_COLORS[subAnswers[si] as string] }}>{subAnswers[si]}</span>
                      </span>
                    )}
                  </div>
                  <div className={cn('grid gap-1', optionCount <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                    {currentOptions.map((opt) => {
                      const isSelected = subAnswers[si] === opt;
                      return (
                        <button key={opt} onClick={() => handleSelectSubAnswer(si, opt)}
                          className="py-1 rounded-md text-[10px] font-bold transition border"
                          style={isSelected
                            ? { background: OPTION_COLORS[opt], borderColor: OPTION_COLORS[opt], color: '#fff' }
                            : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={handleMultiDone}
                className="w-full py-2 rounded-xl text-xs font-bold active:scale-95 transition flex items-center justify-center gap-1.5 mt-1 sticky bottom-0"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                <Check size={13} /> Mark Answered
              </button>
            </div>
          )}

          {currentMode === 'written' && (
            <div className="space-y-2">
              <div className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <PenLine size={24} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Write your answer on paper</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap below once you've written it</p>
              </div>
              <button onClick={handleWrittenDone}
                className="w-full py-2.5 rounded-xl text-sm font-bold active:scale-95 transition flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                <Check size={14} /> I've Written the Answer
              </button>
            </div>
          )}
        </div>
        </div>{/* === END RIGHT column === */}

        {/* === Action buttons (PORTRAIT ONLY): Skip / Review Later at the bottom ===
            In landscape, these are inside the LEFT column instead (under timer). */}
        {!isLandscape && (
          <div className="w-full max-w-xs mt-2" style={{ flexShrink: 0 }}>
            <div className="flex gap-2">
              <button onClick={handleSkip}
                className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                <ChevronRight size={13} /> Skip
              </button>
              <button onClick={handleReviewLater}
                className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95 transition flex items-center justify-center gap-1"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                <Flag size={13} /> Review
              </button>
            </div>
          </div>
        )}
        </div>{/* === END Main content area === */}
      </div>

      {/* === Hamburger menu overlay === */}
      <AnimatePresence>
        {menuOpen && (
          <PracticeMenu
            activePractice={activePractice}
            currentIdx={currentIdx}
            currentMode={currentMode}
            subCount={subCount}
            optionCount={optionCount}
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
            onAdjustOptionCount={(delta) => {
              const newCount = Math.max(2, Math.min(8, optionCount + delta));
              setOptionCount(currentIdx, newCount);
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
  activePractice, currentIdx, currentMode, subCount, optionCount, haptics,
  onClose, onSetMode, onAdjustSubCount, onAdjustOptionCount, onEnd, onPause, onCancel,
}: {
  activePractice: PracticeSession;
  currentIdx: number;
  currentMode: QuestionMode;
  subCount: number;
  optionCount: number;
  haptics: boolean;
  onClose: () => void;
  onSetMode: (mode: QuestionMode, subCount?: number) => void;
  onAdjustSubCount: (delta: number) => void;
  onAdjustOptionCount: (delta: number) => void;
  onEnd: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  // All colors via inline style — BULLETPROOF against any theme override.
  // (Previous version used text-white Tailwind classes which got overridden
  // to dark colors on light themes, making text invisible on dark menu bg.)
  const C = {
    bg: '#0a0b15',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.5)',
    textFaint: 'rgba(255,255,255,0.4)',
    textDim: 'rgba(255,255,255,0.3)',
    border: 'rgba(255,255,255,0.1)',
    surface: 'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.1)',
    amber: '#fbbf24',
    green: '#4ade80',
    red: '#f87171',
    blue: '#93c5fd',
  };
  return (
    <>
      {/* Dim backdrop — inline style so guaranteed dark on all themes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[10000] backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.75)' }}
      />
      {/* Menu sheet — inline style bg so guaranteed dark on ALL themes */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-0 right-0 bottom-0 z-[10001] w-[85%] max-w-xs flex flex-col force-dark-ui"
        style={{ background: C.bg, borderLeft: `1px solid ${C.border}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div className="text-sm font-bold" style={{ color: C.text }}>Practice Menu</div>
            <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: C.amber }}>
              <Pause size={10} /> Timer paused
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition"
            style={{ background: C.surface, color: C.textSecondary }}
            aria-label="Close menu">
            <XIcon size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* === Section 1: Question Type === */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold mb-2 flex items-center gap-1"
              style={{ color: C.textFaint }}>
              <ListTree size={11} /> Question Type — Q{activePractice.questions[currentIdx]?.number ?? currentIdx + 1}
            </div>
            <div className="space-y-1.5">
              <MenuOption icon={FileText} title="Single MCQ" desc="One question, multiple options"
                active={currentMode === 'single'} onClick={() => onSetMode('single')} color="#22c55e" />
              <MenuOption icon={ListTree} title="Multi-Question" desc="One statement, multiple sub-MCQs"
                active={currentMode === 'multi'} onClick={() => onSetMode('multi', subCount)} color="#3b82f6" />
              {/* Sub-question count adjuster (only in multi mode) */}
              {currentMode === 'multi' && (
                <AdjusterRow
                  label="Sub-questions"
                  value={subCount}
                  min={1} max={6}
                  onDecrement={() => onAdjustSubCount(-1)}
                  onIncrement={() => onAdjustSubCount(1)}
                />
              )}
              <MenuOption icon={PenLine} title="Written / Numerical" desc="Long answer on paper"
                active={currentMode === 'written'} onClick={() => onSetMode('written')} color="#f59e0b" />
            </div>
          </div>

          {/* === Section 2: Options count (applies to single + multi, NOT written) === */}
          {currentMode !== 'written' && (
            <div>
              <div className="text-[10px] uppercase tracking-wide font-bold mb-2 flex items-center gap-1"
                style={{ color: C.textFaint }}>
                <Plus size={11} /> Options per question
              </div>
              <AdjusterRow
                label={`Options (A–${OPTION_LETTERS[optionCount - 1]})`}
                value={optionCount}
                min={2} max={8}
                onDecrement={() => onAdjustOptionCount(-1)}
                onIncrement={() => onAdjustOptionCount(1)}
                big
              />
              <p className="text-[9px] mt-1.5 leading-relaxed" style={{ color: C.textFaint }}>
                Some questions have 5+ options (multi-correct, match-the-following).
                Adjust to match the question paper.
              </p>
            </div>
          )}

          {/* === Section 3: Actions === */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold mb-2" style={{ color: C.textFaint }}>
              Actions
            </div>
            <div className="space-y-1.5">
              <ActionButton icon={Pause} title="Pause Practice" desc="Save progress, resume later"
                onClick={onPause} color="#f59e0b" />
              <ActionButton icon={Check} title="End Practice" desc="Finish + see report"
                onClick={onEnd} color="#22c55e" />
              <ActionButton icon={X} title="Cancel" desc="Discard all progress"
                onClick={onCancel} color="#ef4444" />
            </div>
          </div>

          <div className="text-[9px] text-center pt-2 leading-relaxed" style={{ color: C.textDim }}>
            Timer stays paused while this menu is open.<br />Close to resume.
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
  // Inline styles for ALL colors — bulletproof against theme overrides.
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition"
      style={active
        ? { background: `${color}20`, border: `2px solid ${color}` }
        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, color }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#ffffff' }}>
          {title}
          {active && <Check size={11} style={{ color }} />}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</div>
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
  // Inline styles for ALL colors — bulletproof against theme overrides.
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition"
      style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}25`, color }}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold" style={{ color: '#ffffff' }}>{title}</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</div>
      </div>
    </button>
  );
}

/** Reusable +/- adjuster row used for both sub-question count + option count. */
function AdjusterRow({
  label, value, min, max, onDecrement, onIncrement, big,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onDecrement: () => void;
  onIncrement: () => void;
  big?: boolean;
}) {
  // Inline styles for ALL colors — bulletproof against theme overrides.
  return (
    <div className="ml-3 mt-1.5 flex items-center justify-between rounded-lg p-2.5"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={onDecrement} disabled={value <= min}
          className="w-7 h-7 rounded flex items-center justify-center transition disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
          <Minus size={13} />
        </button>
        <span className={cn('font-bold tabular text-center', big ? 'text-base w-8' : 'text-sm w-6')}
          style={{ color: '#ffffff' }}>{value}</span>
        <button onClick={onIncrement} disabled={value >= max}
          className="w-7 h-7 rounded flex items-center justify-center transition disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

// ===== REPORT PHASE =====
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
          {session.questions.flatMap((q, i) => {
            const color = qColor(q);
            const mode = q.mode || 'single';

            // For multi-mode questions, render each sub-question as a SEPARATE
            // row so the user sees Q2.1, Q2.2, Q2.3, ... with their own answers.
            // Previously only ONE row was shown per multi-mode question with
            // all sub-answers condensed into a single bracket — confusing.
            if (mode === 'multi' && q.subUserAnswers && q.subUserAnswers.length > 0) {
              const subCount = q.subUserAnswers.length;
              const subCorrect = q.subCorrectAnswers ?? [];
              return Array.from({ length: subCount }, (_, si) => {
                const userAns = q.subUserAnswers![si];
                const correctAns = subCorrect[si] ?? null;
                // Per-sub result: 'correct' if userAns === correctAns (and both set),
                // 'wrong' if both set but differ, 'unmarked' otherwise.
                let subResult: 'correct' | 'wrong' | 'unmarked' = 'unmarked';
                if (userAns && correctAns) {
                  subResult = userAns === correctAns ? 'correct' : 'wrong';
                }
                const subColor = subResult === 'correct' ? correctColor : subResult === 'wrong' ? wrongColor : unmarkedColor;
                return (
                  <div key={`${i}-${si}`} className="glass rounded-xl p-2.5 flex items-center gap-3"
                    style={{ borderLeft: `3px solid ${subColor}` }}>
                    <span className="text-xs font-bold w-12 shrink-0" style={{ color: subColor }}>Q{q.number}.{si + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px]" style={{ color: subTextColor }}>
                        {formatHMS(q.timeSpentSec)}
                        {userAns && <span className="ml-1" style={{ color: textColor }}>You: {userAns}</span>}
                        {correctAns && <span className="ml-1" style={{ color: subColor }}>Ans: {correctAns}</span>}
                        {!userAns && !correctAns && <span className="ml-1" style={{ color: subTextColor }}>unanswered</span>}
                      </div>
                    </div>
                    {subResult === 'correct' && <Check size={14} style={{ color: correctColor }} />}
                    {subResult === 'wrong' && <X size={14} style={{ color: wrongColor }} />}
                  </div>
                );
              });
            }

            // For single + written questions, render one row (current behavior).
            return (
              <div key={i} className="glass rounded-xl p-2.5 flex items-center gap-3" style={{ borderLeft: `3px solid ${color}` }}>
                <span className="text-xs font-bold w-8 shrink-0" style={{ color }}>Q{q.number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px]" style={{ color: subTextColor }}>
                    {formatHMS(q.timeSpentSec)}
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

// ===== EDIT PHASE =====
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
            const qOptionCount = q.optionCount ?? 4;
            const qOptions = OPTION_LETTERS.slice(0, qOptionCount);
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
                  {mode === 'single' && (
                    <div className={cn('flex gap-0.5 shrink-0', qOptionCount > 4 && 'flex-wrap max-w-[120px]')}>
                      {qOptions.map((opt) => {
                        const isSelected = q.correctAnswer === opt;
                        const isYourAnswer = q.userAnswer === opt;
                        return (
                          <button key={opt} onClick={() => { if (haptics) vibrate(10); markCorrectAnswer(session.id, i, isSelected ? null : opt); }}
                            className="w-6 h-6 rounded text-[10px] font-bold transition border"
                            style={isSelected
                              ? { background: OPTION_COLORS[opt], borderColor: OPTION_COLORS[opt], color: '#fff' }
                              : isYourAnswer
                                ? { borderColor: `${OPTION_COLORS[opt]}80`, color: OPTION_COLORS[opt], background: 'transparent' }
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
