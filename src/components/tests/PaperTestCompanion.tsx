'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, Grid3x3, ChevronLeft, ChevronRight, Flag, Clock, CheckCircle, AlertCircle, StickyNote, Camera, X, Clipboard, Trophy } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { cn, vibrate, formatClock, formatHM } from '@/lib/utils';
import { playSound } from '@/lib/sounds';
import { QuestionNoteSheet } from '@/components/tests/QuestionNoteSheet';
import { AnswerKeyEntrySheet } from '@/components/tests/AnswerKeyEntrySheet';
import type { Subject } from '@/lib/types';

interface Props {
  testId: string;
  onClose: () => void;
}

type View = 'question' | 'grid' | 'summary';

/**
 * PaperTestCompanion — full-screen NEET paper test companion.
 *
 * Tracks per-question timing, answers (A/B/C/D), and flags for review.
 * Designed for paper-based tests where the user solves on physical paper
 * and uses the app as a smart timer + answer logger.
 *
 * Views:
 *  - 'question' (default): current question #, time on it, A/B/C/D buttons, Next
 *  - 'grid': 180 squares (45 per subject), color-coded by status, tap to jump
 *  - 'summary': shown after "End Test" — time per Q, flagged, section pace
 *
 * Activation: long-press Tests tab → pick test → launches this companion.
 *
 * Persistence: state saved every 5s via store updates. Reopening shows
 * "Resume test?" prompt if a paper test is in progress.
 */
export function PaperTestCompanion({ testId, onClose }: Props) {
  const test = useTests((s) => s.tests.find((t) => t.id === testId));
  const initPaperTest = useTests((s) => s.initPaperTest);
  const recordAnswer = useTests((s) => s.recordPaperAnswer);
  const toggleFlag = useTests((s) => s.togglePaperFlag);
  const nextQuestion = useTests((s) => s.nextPaperQuestion);
  const prevQuestion = useTests((s) => s.prevPaperQuestion);
  const jumpToQuestion = useTests((s) => s.jumpToPaperQuestion);
  const pauseTest = useTests((s) => s.pausePaperTest);
  const resumeTest = useTests((s) => s.resumePaperTest);
  const endTest = useTests((s) => s.endPaperTest);
  const clearPaperTest = useTests((s) => s.clearPaperTest);
  const addQuestionExtraTime = useTests((s) => s.addQuestionExtraTime);
  const haptics = useSettings((s) => s.haptics);
  const reduceAnimations = useSettings((s) => s.reduceAnimations);

  const [view, setView] = useState<View>('question');
  const [, setTick] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastCurrentIdxRef = useRef<number>(-1);
  // Track which warning sounds have played for the current question
  // (so we don't repeat the questionWarning beep every 500ms tick)
  const qWarningPlayedRef = useRef<boolean>(false);
  const qExtraWarningPlayedRef = useRef<boolean>(false);
  // Track which test-level warning sounds have played
  const test5minPlayedRef = useRef<boolean>(false);
  const test1minPlayedRef = useRef<boolean>(false);
  const testEndPlayedRef = useRef<boolean>(false);

  // Initialize paper test if not already started
  useEffect(() => {
    if (test && !test.paperTest) {
      initPaperTest(testId);
    }
  }, [testId, test, initPaperTest]);

  // Live ticking — 500ms for smooth display
  // === HEAT FIX: Skip when tab hidden ===
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(i);
  }, []);

  // Auto-scroll question strip so current question is always visible.
  // Fires whenever pt.currentIdx changes (Next/Prev/Jump).
  useEffect(() => {
    if (!test?.paperTest) return;
    const idx = test.paperTest.currentIdx;
    if (idx === lastCurrentIdxRef.current) return;
    lastCurrentIdxRef.current = idx;
    if (stripRef.current) {
      // Find the current subject's offset (strip shows current subject's Qs only)
      const ps = Math.ceil((test.paperTest.questions.length) / 4);
      const sectionStart = Math.floor(idx / ps) * ps;
      const relativeIdx = idx - sectionStart;
      const chip = stripRef.current.children[relativeIdx] as HTMLElement;
      if (chip) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [test?.paperTest?.currentIdx]);

  // Wake lock — keep screen awake during test
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    const onVis = () => {
      if (!document.hidden && test?.paperTest && !test.paperTest.isPaused) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
      }
    };
  }, [test?.paperTest?.isPaused]);

  // === Pre-compute values needed by hooks (with fallbacks for when test/paperTest is null) ===
  // These MUST be computed before any early return because hooks below use them.
  const pt = test?.paperTest;
  const safeCurrentIdx = pt && pt.currentIdx >= 0 && pt.currentIdx < pt.questions.length
    ? pt.currentIdx : 0;
  const currentQ = pt?.questions?.[safeCurrentIdx] ?? null;
  const config = pt?.config;
  const defaultSecPerQ = config?.defaultSecPerQuestion ?? Math.floor(((config?.durationMin ?? 200) * 60) / (config?.questionCount ?? 180));
  const extraAdded = currentQ?.extraSecAdded || 0;
  const totalSecPerQ = defaultSecPerQ + extraAdded;
  const currentQElapsed = currentQ?.startedAt && pt && !pt.isPaused
    ? Math.floor((Date.now() - currentQ.startedAt) / 1000)
    : 0;
  const qPhase: 'main' | 'extra' | 'out' =
    currentQElapsed >= totalSecPerQ ? 'out'
    : currentQElapsed >= defaultSecPerQ ? 'extra'
    : 'main';

  // === ALL useEffect hooks MUST be before any early return (Rules of Hooks) ===

  // Reset warning flags when question changes OR when extra time is added
  useEffect(() => {
    if (!pt || !currentQ) return;
    qWarningPlayedRef.current = false;
    qExtraWarningPlayedRef.current = false;
    setRedFlash(false);
  }, [pt?.currentIdx, extraAdded]);

  // Per-question warning sounds
  useEffect(() => {
    if (!pt || !currentQ || pt.isPaused || pt.ended) return;
    if (!qWarningPlayedRef.current && defaultSecPerQ > 10 && currentQElapsed === defaultSecPerQ - 5) {
      qWarningPlayedRef.current = true;
      playSound('questionWarning');
    }
    if (
      extraAdded > 0 &&
      !qExtraWarningPlayedRef.current &&
      currentQElapsed === totalSecPerQ - 5
    ) {
      qExtraWarningPlayedRef.current = true;
      playSound('questionWarning');
    }
    if (qPhase === 'out' && !redFlash) {
      setRedFlash(true);
      if (haptics) vibrate(30);
      playSound('questionWarning');
      setTimeout(() => setRedFlash(false), 3000);
    }
  }, [currentQElapsed, defaultSecPerQ, extraAdded, totalSecPerQ, qPhase, redFlash, pt?.isPaused, pt?.ended, haptics]);

  // Test-level warning sounds
  useEffect(() => {
    if (!pt || pt.isPaused || pt.ended) return;
    const testTotalSec = (config?.durationMin ?? 200) * 60;
    const testElapsedSec = Math.floor((Date.now() - pt.startedAt) / 1000) - pt.pausedSec;
    const testRemainingSec = Math.max(0, testTotalSec - testElapsedSec);
    if (!test5minPlayedRef.current && testRemainingSec <= 300 && testRemainingSec > 240) {
      test5minPlayedRef.current = true;
      playSound('test5min');
      if (haptics) vibrate([10, 50, 10]);
    }
    if (!test1minPlayedRef.current && testRemainingSec <= 60 && testRemainingSec > 30) {
      test1minPlayedRef.current = true;
      playSound('test1min');
      if (haptics) vibrate([10, 30, 10, 30, 10]);
    }
    if (!testEndPlayedRef.current && testRemainingSec === 0) {
      testEndPlayedRef.current = true;
      playSound('testEnd');
      if (haptics) vibrate([30, 100, 30, 100, 30]);
    }
  });

  // === Early returns (AFTER all hooks) ===
  if (!test) return null;

  // If paper test ended → show summary
  if (test.paperTest?.ended) {
    return (
      <PaperTestSummary
        testId={testId}
        onDone={() => { clearPaperTest(testId); onClose(); }}
      />
    );
  }

  if (!test.paperTest) return null;

  if (pt.questions.length === 0) return null;
  if (!currentQ) return null;

  const totalElapsed = Math.floor((Date.now() - pt.startedAt) / 1000) - pt.pausedSec;

  // Section calculation — DYNAMIC per-subject question count (not hardcoded 45).
  // perSubject = total questions / 4 subjects. For 180 Q → 45, 60 Q → 15, 100 Q → 25.
  const subjects: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  const perSubject = pt.questions.length > 0 ? Math.ceil(pt.questions.length / 4) : 1;
  const currentSectionIdx = Math.min(3, Math.floor(safeCurrentIdx / perSubject));
  const currentSection = subjects[currentSectionIdx];
  const sectionStartIdx = currentSectionIdx * perSubject;
  const sectionEndIdx = Math.min(sectionStartIdx + perSubject, pt.questions.length);
  const sectionAnswered = pt.questions.slice(sectionStartIdx, sectionEndIdx).filter(q => q.answer).length;

  // Stats
  const totalAnswered = pt.questions.filter(q => q.answer).length;
  const totalFlagged = pt.questions.filter(q => q.flagged).length;

  // Section time tracking — dynamic perSubject slicing
  const sectionTimes = subjects.map((_, sIdx) => {
    const start = sIdx * perSubject;
    const end = Math.min(start + perSubject, pt.questions.length);
    return pt.questions.slice(start, end).reduce((a, q) => a + q.timeSpentSec, 0);
  });

  const c = subjectColor(currentSection);

  const handleAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    if (pt.isPaused) return;
    if (haptics) vibrate(10);
    recordAnswer(testId, safeCurrentIdx, answer);
    playSound('tap');
    // Auto-advance to next question after 250ms (lets user see their selection
    // briefly before moving on — no need to tap "Next" manually).
    if (safeCurrentIdx < pt.questions.length - 1) {
      setTimeout(() => {
        // Only auto-advance if user hasn't manually navigated away
        const latest = useTests.getState().tests.find((t) => t.id === testId);
        if (latest?.paperTest && latest.paperTest.currentIdx === safeCurrentIdx && !latest.paperTest.isPaused) {
          nextQuestion(testId);
        }
      }, 250);
    }
  };

  const handleNext = () => {
    if (pt.currentIdx >= pt.questions.length - 1) return;
    if (haptics) vibrate(12);
    playSound('tap');
    nextQuestion(testId);
  };

  const handlePrev = () => {
    if (pt.currentIdx <= 0) return;
    if (haptics) vibrate(8);
    prevQuestion(testId);
  };

  const handleFlag = () => {
    if (haptics) vibrate(10);
    toggleFlag(testId, pt.currentIdx);
  };

  const handlePause = () => {
    if (haptics) vibrate(10);
    if (pt.isPaused) resumeTest(testId);
    else pauseTest(testId);
  };

  const handleEnd = () => {
    setShowEndConfirm(true);
  };

  const confirmEnd = () => {
    if (haptics) vibrate([20, 50, 20]);
    playSound('complete');
    endTest(testId);
    setShowEndConfirm(false);
  };

  // Values already computed above (before hooks) — config, defaultSecPerQ,
  // extraAdded, totalSecPerQ, currentQElapsed, qPhase, qRemaining all available.
  const qRemaining = Math.max(0, totalSecPerQ - currentQElapsed);

  // Handle +30s button — adds 30s to current question only, resets warning flags
  // so the beep can fire again before the new deadline.
  const handleAddExtra = () => {
    if (haptics) vibrate([10, 30, 10]);
    addQuestionExtraTime(testId, 30);
    // Reset warning flags so beeps fire again before new deadline
    qWarningPlayedRef.current = false;
    qExtraWarningPlayedRef.current = false;
    setRedFlash(false);
    playSound('tap');
  };

  // Test-level values for display
  const testTotalSec = (config?.durationMin ?? 200) * 60;
  const testElapsedSec = Math.floor((Date.now() - pt.startedAt) / 1000) - pt.pausedSec;
  const testRemainingSec = Math.max(0, testTotalSec - testElapsedSec);

  return (
    <motion.div
      data-paper-test-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col py-8 px-5 force-dark-ui"
      style={{
        backgroundColor: '#000000',
        backgroundImage: pt.isPaused
          ? 'radial-gradient(circle at 50% 30%, rgba(245,158,11,0.12), transparent 60%)'
          : `radial-gradient(circle at 50% 30%, ${c.hex}15, transparent 60%)`,
      }}
    >
      {/* === Top bar === */}
      <div className="flex items-center justify-between text-xs">
        <div className="text-muted-foreground uppercase tracking-widest">
          {pt.isPaused ? '⏸ Paused' : '● Test in progress'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'grid' ? 'question' : 'grid')}
            className="text-muted-foreground hover:text-white p-1"
            aria-label="Toggle grid"
          >
            <Grid3x3 size={16} />
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white text-[10px]"
          >
            Exit
          </button>
        </div>
      </div>

      {/* === Test name + total elapsed === */}
      <div className="text-center mt-2 mb-4">
        <div className="text-sm font-bold text-white truncate">{test.name}</div>
        <div className="text-3xl font-bold tabular mt-1" style={{ color: pt.isPaused ? '#f59e0b' : '#fff' }}>
          {formatClock(totalElapsed)}
        </div>
        <div className="text-[10px] text-muted-foreground">total elapsed</div>
      </div>

      {/* === Section progress dots === */}
      <div className="flex justify-center gap-1.5 mb-4">
        {subjects.map((subj, i) => {
          const sc = subjectColor(subj);
          const isCurrent = i === currentSectionIdx;
          const sStart = i * perSubject;
          const sEnd = Math.min(sStart + perSubject, pt.questions.length);
          const sectionAns = pt.questions.slice(sStart, sEnd).filter(q => q.answer).length;
          const sectionTotal = sEnd - sStart;
          return (
            <button
              key={subj}
              onClick={() => jumpToQuestion(testId, sStart)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-bold transition',
                isCurrent ? 'text-black' : 'text-muted-foreground'
              )}
              style={{
                background: isCurrent ? sc.hex : `${sc.hex}20`,
                border: `1px solid ${sc.hex}40`,
              }}
            >
              {subj.slice(0, 4)} {sectionAns}/{sectionTotal}
            </button>
          );
        })}
      </div>

      {/* === Main view === */}
      <AnimatePresence mode="wait">
        {view === 'question' && (
          <motion.div
            key="question"
            initial={reduceAnimations ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceAnimations ? {} : { opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col relative"
          >
            {/* Red flash overlay when per-question time is out — ONE-TIME flash
                (3 seconds), NOT infinite blinking. Auto-clears via setTimeout. */}
            <AnimatePresence>
              {redFlash && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.2, 0.05, 0.2, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 3, ease: 'easeInOut' }}
                  className="absolute inset-0 z-50 rounded-2xl pointer-events-none"
                  style={{ background: '#ef4444' }}
                />
              )}
            </AnimatePresence>
            {/* Inline question number strip — horizontal scroll of current subject's 45 questions.
                Tap any chip to jump. Color: green=answered, amber=flagged, dark=unanswered, ring=current. */}
            <div ref={stripRef} className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-1 px-1">
              {pt.questions.slice(sectionStartIdx, sectionEndIdx).map((q, qIdx) => {
                const absoluteIdx = sectionStartIdx + qIdx;
                const isCurrent = absoluteIdx === pt.currentIdx;
                const isAnswered = q.answer !== null;
                const isFlagged = q.flagged;
                const hasNote = !!q.note || !!q.photo;
                return (
                  <button
                    key={qIdx}
                    onClick={() => jumpToQuestion(testId, absoluteIdx)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      'shrink-0 w-7 h-7 rounded-md text-[10px] font-bold tabular flex items-center justify-center transition',
                      isCurrent && 'ring-2 ring-white scale-110',
                    )}
                    style={{
                      background: isFlagged
                        ? '#f59e0b'
                        : isAnswered
                        ? c.hex
                        : 'rgba(255,255,255,0.05)',
                      color: isFlagged || isAnswered ? '#000' : '#ffffff60',
                      position: 'relative',
                    }}
                    title={`Q${q.number}${isAnswered ? ` · ${q.answer}` : ''}${isFlagged ? ' · flagged' : ''}${hasNote ? ' · has note' : ''}`}
                  >
                    {q.number - sectionStartIdx}
                    {hasNote && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400"
                        style={{ fontSize: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Question number + time on this question */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="text-xs text-muted-foreground uppercase tracking-widest">
                  Question
                </div>
                {/* Note/photo button — opens QuestionNoteSheet for this question */}
                <button
                  onClick={() => setShowNoteSheet(true)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center transition',
                    (currentQ.note || currentQ.photo) ? 'bg-blue-500/30 text-blue-300' : 'bg-foreground/5 text-muted-foreground'
                  )}
                  title="Add note or photo"
                >
                  <StickyNote size={11} />
                </button>
              </div>
              <div className="text-5xl font-bold tabular text-white mb-1">
                {currentQ.number}
                <span className="text-2xl text-muted-foreground/60"> / {pt.questions.length}</span>
              </div>
              <div
                className="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: `${c.hex}25`, color: c.hex }}
              >
                {currentSection}
              </div>

              {/* Show question text if exists (preview, tap to edit) */}
              {currentQ.questionText && (
                <div
                  className="mt-2 mx-auto max-w-xs text-[11px] text-foreground bg-foreground/5 rounded-lg px-2 py-1.5 border border-border cursor-pointer"
                  onClick={() => setShowNoteSheet(true)}
                >
                  <span className="text-[9px] text-teal-400 font-bold uppercase">Q Text:</span>{' '}
                  {currentQ.questionText.length > 80
                    ? currentQ.questionText.slice(0, 80) + '…'
                    : currentQ.questionText}
                </div>
              )}
              {/* Show note preview if exists */}
              {currentQ.note && (
                <div className="mt-2 mx-auto max-w-xs text-[10px] text-blue-300 bg-blue-500/10 rounded-lg px-2 py-1 border border-blue-500/20">
                  📝 {currentQ.note}
                </div>
              )}
              {currentQ.photo && (
                <div className="mt-2 mx-auto max-w-[120px]">
                  <img
                    src={currentQ.photo}
                    alt="Question"
                    className="rounded-lg w-full h-auto"
                    onClick={() => setShowNoteSheet(true)}
                  />
                </div>
              )}

              {/* Time on this question — per-Q timer with main + extra phases */}
              <div className="mt-4">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {qPhase === 'out'
                    ? '⏰ Time up — tap Next'
                    : qPhase === 'extra'
                    ? '⚡ Extra time'
                    : 'Time on this question'}
                </div>
                <div
                  className="text-4xl font-bold tabular"
                  style={{
                    color: qPhase === 'out' ? '#ef4444'
                      : qPhase === 'extra' ? '#f59e0b'
                      : qRemaining <= 5 ? '#ef4444'
                      : qRemaining <= 15 ? '#f59e0b'
                      : c.hex,
                  }}
                >
                  {qPhase === 'out' ? '0:00' : `${Math.floor(qRemaining / 60)}:${String(qRemaining % 60).padStart(2, '0')}`}
                </div>
                {/* Phase indicator: default → extra (if added) → out */}
                <div className="flex items-center justify-center gap-2 mt-2 text-[10px]">
                  <span style={{ color: qPhase === 'main' ? c.hex : '#ffffff40', fontWeight: qPhase === 'main' ? 700 : 400 }}>
                    Default {defaultSecPerQ}s
                  </span>
                  {extraAdded > 0 && (
                    <>
                      <span className="text-muted-foreground/30">→</span>
                      <span style={{ color: qPhase === 'extra' ? '#f59e0b' : '#ffffff40', fontWeight: qPhase === 'extra' ? 700 : 400 }}>
                        +{extraAdded}s extra
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground/30">→</span>
                  <span style={{ color: qPhase === 'out' ? '#ef4444' : '#ffffff40', fontWeight: qPhase === 'out' ? 700 : 400 }}>
                    Done
                  </span>
                </div>
                {/* +30s button — adds 30s to THIS question only.
                    BIG and prominent — always visible during the test so user can
                    extend anytime. Resets warning flags so beep fires again. */}
                <button
                  onClick={handleAddExtra}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={pt.isPaused}
                  className={cn(
                    'mt-3 px-6 py-2.5 rounded-xl text-sm font-bold transition active:scale-95',
                    pt.isPaused
                      ? 'bg-foreground/5 text-muted-foreground/60'
                      : 'bg-amber-500/25 text-amber-300 hover:bg-amber-500/35 border border-amber-500/30',
                  )}
                >
                  +30s for this question
                </button>
                {qPhase === 'out' && (
                  <div className="text-[10px] text-red-400 mt-1 flex items-center justify-center gap-1 animate-pulse">
                    <AlertCircle size={10} /> Time's up — tap Next to move on
                  </div>
                )}
              </div>
            </div>

            {/* A/B/C/D answer buttons — compact (py-3.5 instead of py-5) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const isSelected = currentQ.answer === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={pt.isPaused}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      'py-3.5 rounded-2xl text-xl font-bold transition active:scale-95',
                      pt.isPaused && 'opacity-40',
                      isSelected ? 'text-black' : 'bg-foreground/5 text-foreground'
                    )}
                    style={isSelected ? { background: c.hex } : undefined}
                  >
                    {opt}
                    {isSelected && <CheckCircle size={12} className="inline ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* Flag + Prev + Next — compact */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleFlag}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-90',
                  currentQ.flagged ? 'bg-amber-500 text-black' : 'bg-foreground/5 text-muted-foreground'
                )}
                aria-label="Flag for review"
              >
                <Flag size={16} fill={currentQ.flagged ? 'currentColor' : 'none'} />
              </button>

              <button
                onClick={handlePrev}
                disabled={pt.currentIdx === 0}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-xl bg-foreground/5 text-white flex items-center justify-center active:scale-90 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={handleNext}
                disabled={pt.currentIdx >= pt.questions.length - 1}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-black active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ background: c.hex }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>

            {/* Bottom controls: pause + SUBMIT TEST — always visible */}
            <div className="flex gap-2">
              <button
                onClick={handlePause}
                className="flex-1 py-2.5 rounded-xl bg-foreground/5 text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {pt.isPaused ? <><Play size={12} fill="currentColor" /> Resume</> : <><Pause size={12} fill="currentColor" /> Pause</>}
              </button>
              <button
                onClick={handleEnd}
                className="flex-1 py-2.5 rounded-xl bg-red-500/25 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 border border-red-500/30"
              >
                <Square size={12} fill="currentColor" /> Submit Test
              </button>
            </div>
          </motion.div>
        )}

        {view === 'grid' && (
          <motion.div
            key="grid"
            initial={reduceAnimations ? {} : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceAnimations ? {} : { opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto scroll-area"
          >
            {/* Summary bar */}
            <div className="flex justify-around text-center mb-4 text-xs">
              <div>
                <div className="text-lg font-bold tabular text-green-400">{totalAnswered}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Answered</div>
              </div>
              <div>
                <div className="text-lg font-bold tabular text-amber-400">{totalFlagged}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Flagged</div>
              </div>
              <div>
                <div className="text-lg font-bold tabular text-muted-foreground">{180 - totalAnswered}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Remaining</div>
              </div>
            </div>

            {/* Section grids */}
            {subjects.map((subj, sIdx) => {
              const sc = subjectColor(subj);
              const gStart = sIdx * perSubject;
              const gEnd = Math.min(gStart + perSubject, pt.questions.length);
              const sectionQs = pt.questions.slice(gStart, gEnd);
              const sectionTime = sectionTimes[sIdx];
              return (
                <div key={subj} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: sc.hex }}>
                      {subj}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular">
                      {formatHM(sectionTime)} · {sectionQs.filter(q => q.answer).length}/{sectionQs.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-9 gap-1">
                    {sectionQs.map((q, qIdx) => {
                      const absoluteIdx = gStart + qIdx;
                      const isCurrent = absoluteIdx === pt.currentIdx;
                      const isAnswered = q.answer !== null;
                      const isFlagged = q.flagged;
                      return (
                        <button
                          key={qIdx}
                          onClick={() => { jumpToQuestion(testId, absoluteIdx); setView('question'); vibrate(8); }}
                          className={cn(
                            'aspect-square rounded-md text-[8px] font-bold tabular flex items-center justify-center transition',
                            isCurrent && 'ring-2 ring-white scale-110',
                          )}
                          style={{
                            background: isFlagged
                              ? '#f59e0b'
                              : isAnswered
                              ? sc.hex
                              : 'rgba(255,255,255,0.05)',
                            color: isFlagged || isAnswered ? '#000' : '#ffffff60',
                          }}
                        >
                          {q.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex justify-center gap-3 text-[9px] text-muted-foreground mt-2 mb-4">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#22c55e' }} /> Answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Flagged
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-foreground/10" /> Unanswered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm ring-1 ring-white" /> Current
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End test confirmation */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="text-4xl mb-3">📝</div>
              <h3 className="text-lg font-bold mb-2">Submit the test?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                You've answered <strong className="text-white">{totalAnswered}/{pt.questions.length}</strong> questions.
                {totalAnswered < pt.questions.length && ` ${pt.questions.length - totalAnswered} will be marked as skipped.`}
                {totalFlagged > 0 && ` ${totalFlagged} flagged for review.`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-foreground/5 text-white font-semibold text-sm"
                >
                  Keep Going
                </button>
                <button
                  onClick={confirmEnd}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm"
                >
                  Submit Test
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question note/photo sheet — opened by tapping the note icon */}
      {showNoteSheet && (
        <QuestionNoteSheet
          testId={testId}
          questionIdx={pt.currentIdx}
          questionNumber={currentQ.number}
          subject={currentQ.subject}
          onClose={() => setShowNoteSheet(false)}
        />
      )}
    </motion.div>
  );
}

// ===== Summary View =====

function PaperTestSummary({ testId, onDone }: { testId: string; onDone: () => void }) {
  const test = useTests((s) => s.tests.find((t) => t.id === testId));
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [reviewQuestionIdx, setReviewQuestionIdx] = useState<number | null>(null);
  if (!test?.paperTest) return null;

  const pt = test.paperTest;
  const subjects: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  // Use endedAt if test was ended, otherwise Date.now() (for live summary view).
  const endTime = pt.endedAt ?? Date.now();
  const totalTime = Math.floor((endTime - pt.startedAt) / 1000) - pt.pausedSec;
  // Total question count from config (default 180)
  const totalQ = pt.config?.questionCount ?? pt.questions.length;
  const perSubject = Math.ceil(totalQ / 4);
  // Marking scheme from config
  const marksPerCorrect = pt.config?.marksPerCorrect ?? 4;
  const negativePerWrong = pt.config?.negativePerWrong ?? 1;

  // Per-section stats — slice questions per subject dynamically based on config
  const sectionStats = subjects.map((subj, sIdx) => {
    const start = sIdx * perSubject;
    const end = Math.min(start + perSubject, totalQ);
    const qs = pt.questions.slice(start, end);
    const answered = qs.filter(q => q.answer).length;
    const flagged = qs.filter(q => q.flagged).length;
    const time = qs.reduce((a, q) => a + q.timeSpentSec, 0);
    const avgPerQ = qs.length > 0 ? time / qs.length : 0;
    // Score per subject if correct answers are set
    let marks = 0;
    let correct = 0, wrong = 0, skipped = 0;
    for (const q of qs) {
      if (q.correctAnswer === null) { skipped++; continue; }
      if (q.answer === null) { skipped++; continue; }
      if (q.answer === q.correctAnswer) { correct++; marks += marksPerCorrect; }
      else { wrong++; marks -= negativePerWrong; }
    }
    return { subject: subj, answered, flagged, time, avgPerQ, marks, correct, wrong, skipped };
  });

  // Overall stats
  const totalAnswered = pt.questions.filter(q => q.answer).length;
  const totalFlagged = pt.questions.filter(q => q.flagged).length;
  const flaggedQuestions = pt.questions.filter(q => q.flagged);
  const avgPerQ = totalQ > 0 ? totalTime / totalQ : 0;

  // Scoring (if correct answers are set)
  const hasScore = pt.questions.some(q => q.correctAnswer !== null);
  const totalMarks = sectionStats.reduce((a, s) => a + s.marks, 0);
  const totalCorrect = sectionStats.reduce((a, s) => a + s.correct, 0);
  const totalWrong = sectionStats.reduce((a, s) => a + s.wrong, 0);
  const totalSkipped = sectionStats.reduce((a, s) => a + s.skipped, 0);

  // Wrong questions (for review)
  const wrongQuestions = pt.questions.filter(q => q.correctAnswer !== null && q.answer !== null && q.answer !== q.correctAnswer);
  // Questions with notes/photos (for review)
  const notedQuestions = pt.questions.filter(q => q.note || q.photo || q.questionText);

  // Slowest questions (top 5)
  const slowest = [...pt.questions]
    .filter(q => q.timeSpentSec > 0)
    .sort((a, b) => b.timeSpentSec - a.timeSpentSec)
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] overflow-y-auto scroll-area force-dark-ui"
      style={{ backgroundColor: '#000000' }}
    >
      <div className="max-w-md mx-auto px-5 py-10">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="text-5xl mb-2"
          >
            🎯
          </motion.div>
          <h2 className="text-xl font-bold">Test Complete</h2>
          <p className="text-xs text-muted-foreground mt-1">{test.name}</p>
        </div>

        {/* Total time */}
        <div className="glass rounded-2xl p-5 mb-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Time</div>
          <div className="text-4xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
            {formatClock(totalTime)}
          </div>
          {pt.pausedSec > 0 && (
            <div className="text-[10px] text-amber-400 mt-1">
              ⏸ Paused for {formatHM(pt.pausedSec)}
            </div>
          )}
        </div>

        {/* Overall stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-2xl font-bold tabular text-green-400">{totalAnswered}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Answered</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-2xl font-bold tabular text-amber-400">{totalFlagged}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Flagged</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-2xl font-bold tabular text-white">{Math.round(avgPerQ)}s</div>
            <div className="text-[9px] text-muted-foreground uppercase">Avg/Q</div>
          </div>
        </div>

        {/* Section breakdown */}
        <div className="glass rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Section Breakdown
          </h3>
          <div className="space-y-2">
            {sectionStats.map((s) => {
              const sc = subjectColor(s.subject);
              const sectionTotal = s.correct + s.wrong + s.skipped;
              return (
                <div key={s.subject} className="flex items-center gap-2 text-xs">
                  <span className="w-16 font-bold" style={{ color: sc.hex }}>{s.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-foreground/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${sectionTotal > 0 ? (s.answered / sectionTotal) * 100 : 0}%`,
                        background: sc.hex,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground tabular w-12 text-right">{s.answered}/{sectionTotal}</span>
                  <span className="text-muted-foreground tabular w-12 text-right">{formatHM(s.time)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flagged questions */}
        {flaggedQuestions.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-4 border border-amber-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-400 mb-2 flex items-center gap-1">
              <Flag size={11} /> Flagged for Review ({flaggedQuestions.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {flaggedQuestions.map((q) => (
                <span
                  key={q.number}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300"
                >
                  Q{q.number}
                  {q.answer && ` · ${q.answer}`}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Review these questions first when checking your answers.</p>
          </div>
        )}

        {/* Slowest questions */}
        {slowest.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Clock size={11} /> Slowest Questions
            </h3>
            <div className="space-y-1">
              {slowest.map((q) => {
                const sc = subjectColor(q.subject);
                return (
                  <div key={q.number} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted-foreground">Q{q.number}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${sc.hex}20`, color: sc.hex }}>
                      {q.subject.slice(0, 4)}
                    </span>
                    <span className="flex-1 text-muted-foreground">
                      {q.answer ? `Answer: ${q.answer}` : 'Skipped'}
                    </span>
                    <span className="tabular text-red-400">{formatHM(q.timeSpentSec)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === Scoring section === */}
        {/* If answer key is set → show score; otherwise show "Enter answer key" CTA */}
        {hasScore ? (
          <div className="glass rounded-2xl p-4 mb-4 border border-teal-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Your Score
              </span>
              <button
                onClick={() => setShowAnswerKey(true)}
                className="ml-auto text-[10px] text-teal-400 hover:text-teal-300"
              >
                Edit Key
              </button>
            </div>
            <div className="text-center mb-3">
              <div className="text-5xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
                {totalMarks}
              </div>
              <div className="text-xs text-muted-foreground">/ {totalQ * marksPerCorrect} marks</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold tabular text-green-400">{totalCorrect}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Correct (+4)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular text-red-400">{totalWrong}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Wrong (−1)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tabular text-muted-foreground">{totalSkipped}</div>
                <div className="text-[9px] text-muted-foreground uppercase">Skipped (0)</div>
              </div>
            </div>
            {/* Per-subject marks */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              {sectionStats.map((s) => {
                const sc = subjectColor(s.subject);
                return (
                  <div key={s.subject} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-bold" style={{ color: sc.hex }}>{s.subject}</span>
                    <span className="tabular text-muted-foreground ml-auto">{s.correct}/{s.correct + s.wrong} correct</span>
                    <span className="tabular font-bold w-12 text-right" style={{ color: s.marks >= 0 ? '#22c55e' : '#ef4444' }}>
                      {s.marks >= 0 ? '+' : ''}{s.marks}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 mb-4 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Clipboard size={14} className="text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Score Your Test
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mb-3">
              Enter the correct answer key to auto-calculate your marks. NEET: +4 correct, −1 wrong, 0 skipped.
            </p>
            <button
              onClick={() => setShowAnswerKey(true)}
              className="w-full py-2.5 rounded-xl bg-purple-500/20 text-purple-300 font-bold text-xs active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Clipboard size={12} /> Enter Answer Key
            </button>
          </div>
        )}

        {/* === Wrong questions review === */}
        {wrongQuestions.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-4 border border-red-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wide text-red-400 mb-2">
              Wrong Answers ({wrongQuestions.length})
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto scroll-area">
              {wrongQuestions.map((q) => {
                const sc = subjectColor(q.subject);
                return (
                  <button
                    key={q.number}
                    onClick={() => setReviewQuestionIdx(pt.questions.indexOf(q))}
                    className="w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-foreground/5 transition"
                  >
                    <span className="w-8 text-muted-foreground">Q{q.number}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${sc.hex}20`, color: sc.hex }}>
                      {q.subject.slice(0, 4)}
                    </span>
                    <span className="text-red-400 tabular">✗ {q.answer}</span>
                    <span className="text-muted-foreground/60">→</span>
                    <span className="text-green-400 tabular">✓ {q.correctAnswer}</span>
                    {(q.note || q.photo) && <StickyNote size={10} className="text-blue-400 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* === Noted/photo questions review === */}
        {notedQuestions.length > 0 && (
          <div className="glass rounded-2xl p-4 mb-4 border border-blue-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wide text-blue-400 mb-2 flex items-center gap-1">
              <StickyNote size={11} /> Notes & Photos ({notedQuestions.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
              {notedQuestions.map((q) => {
                const sc = subjectColor(q.subject);
                return (
                  <button
                    key={q.number}
                    onClick={() => setReviewQuestionIdx(pt.questions.indexOf(q))}
                    className="w-full text-left rounded-lg p-2 bg-foreground/[0.04] hover:bg-foreground/5 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">Q{q.number}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${sc.hex}20`, color: sc.hex }}>
                        {q.subject.slice(0, 4)}
                      </span>
                      {q.flagged && <Flag size={9} className="text-amber-400" fill="currentColor" />}
                    </div>
                    {q.questionText && (
                      <div className="text-[11px] text-foreground mb-1 bg-foreground/5 rounded px-2 py-1 border border-border">
                        <span className="text-[8px] text-teal-400 font-bold uppercase">Q:</span> {q.questionText}
                      </div>
                    )}
                    {q.note && (
                      <div className="text-[11px] text-muted-foreground mb-1">📝 {q.note}</div>
                    )}
                    {q.photo && (
                      <img src={q.photo} alt={`Q${q.number}`} loading="lazy" className="w-full max-h-32 object-contain rounded-md" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Done button */}
        <button
          onClick={onDone}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] mb-3"
        >
          Done
        </button>
        <p className="text-[10px] text-muted-foreground text-center">
          {hasScore
            ? `Score saved: ${totalMarks}/${totalQ * marksPerCorrect} · ${totalCorrect} correct · ${totalWrong} wrong`
            : 'Your answers + timing have been saved. Enter the answer key to score.'}
        </p>
      </div>

      {/* Answer key entry sheet */}
      {showAnswerKey && (
        <AnswerKeyEntrySheet testId={testId} onClose={() => setShowAnswerKey(false)} />
      )}

      {/* Question review sheet (when tapping a wrong/noted question) */}
      {reviewQuestionIdx !== null && (
        <QuestionNoteSheet
          testId={testId}
          questionIdx={reviewQuestionIdx}
          questionNumber={pt.questions[reviewQuestionIdx].number}
          subject={pt.questions[reviewQuestionIdx].subject}
          onClose={() => setReviewQuestionIdx(null)}
        />
      )}
    </motion.div>
  );
}
