'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey } from '@/lib/utils';
import type { Subject } from '@/lib/types';

export interface PracticeQuestion {
  number: number;
  timeSpentSec: number;
  status: 'unanswered' | 'answered' | 'skipped' | 'review-later';
  result: 'correct' | 'wrong' | 'unmarked';
  userAnswer: string | null;      // 'A' | 'B' | 'C' | 'D' | ... | null — what user selected during practice
  correctAnswer: string | null;   // 'A' | 'B' | 'C' | 'D' | ... | null — correct answer (set during review)
  conceptNotes: string;
  formulaNotes: string;
  /** Question mode — set per-question via the hamburger menu mid-practice.
   *  - 'single'        (default): one MCQ with N options, exactly 1 correct
   *  - 'multi'         : one statement/scenario with N sub-MCQs, each with M options
   *  - 'multi-correct' : one question with N options, MULTIPLE can be correct (AIIMS format)
   *                      e.g. "Dog is…" → A) animal B) human friend C) military — A,B,C all correct
   *  - 'written'       : long-answer / numerical — user writes on paper, just marks done
   *  Stored so the report + edit phase can render the right UI per question. */
  mode?: 'single' | 'multi' | 'multi-correct' | 'written';
  /** For 'multi' mode: how many sub-questions (default 3). User-adjustable 1-6. */
  subQuestionCount?: number;
  /** For 'multi' mode: user's selected option per sub-question.
   *  Length = subQuestionCount. Each entry is 'A' | 'B' | 'C' | 'D' | ... | null. */
  subUserAnswers?: (string | null)[];
  /** For 'multi' mode: correct option per sub-question (set during review). */
  subCorrectAnswers?: (string | null)[];
  /** For 'multi-correct' mode: which options the user selected as correct
   *  during practice. Length = optionCount. true = selected. */
  multiCorrectUserAnswers?: boolean[];
  /** For 'multi-correct' mode: which options are actually correct (set during
   *  review). Length = optionCount. true = correct. */
  multiCorrectAnswers?: boolean[];
  /** For 'written' mode: brief note about the answer (optional, user can fill
   *  in during review). The actual written answer stays on paper. */
  writtenAnswer?: string;
  /** How many options this question has — some questions have 5, 6, 7 options
   *  (multi-correct, match-the-following, etc.). User-adjustable 2-8 per
   *  question via the hamburger menu. Default 4 (A/B/C/D).
   *  Letters used: A, B, C, D, E, F, G, H. */
  optionCount?: number;
  /** For 'multi' mode: how many options each sub-question has (default same
   *  as optionCount). If user wants different per-sub-question, they can edit
   *  during review. */
  subOptionCount?: number;
}

export interface PracticeSession {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  questionCount: number;
  timeLimitMin: number;
  startedAt: number;
  endedAt: number | null;
  totalTimeSec: number;
  questions: PracticeQuestion[];
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  unmarkedCount: number;
  accuracy: number;
  /** Total seconds elapsed when practice was paused — used on resume to
   *  restore the global timer (startedAt = Date.now() - accumulatedTimeSec*1000). */
  accumulatedTimeSec?: number;
  /** Timestamp when the practice was last paused — used for display in the
   *  "Resume" list. Null when running or completed. */
  pausedAt?: number | null;
  /** Question index the user was on when they paused — used on resume to
   *  jump the runner back to that question. */
  resumeQuestionIndex?: number;
}

interface PracticeStore {
  activePractice: PracticeSession | null;
  currentQuestionIndex: number;
  /** Jump to a specific question index (for navigating back to previous questions). */
  setCurrentQuestionIndex: (idx: number) => void;
  /** Rename the active practice session — updates the name everywhere. */
  renameActivePractice: (name: string) => void;
  /** Delete a question from the active practice by index. */
  deleteQuestion: (questionIndex: number) => void;
  history: PracticeSession[];
  /** Practices that the user paused mid-way — can be resumed later. */
  pausedPractices: PracticeSession[];

  startPractice: (opts: {
    name?: string;
    subject: string;
    chapter: string;
    questionCount: number;
    timeLimitMin: number;
  }) => void;

  answerQuestion: (status: 'answered' | 'skipped' | 'review-later') => void;
  endPractice: () => void;
  cancelPractice: () => void;

  /** Pause the active practice — snapshots current state (incl. current
   *  question's elapsed time + total elapsed time) into `pausedPractices`,
   *  clears `activePractice`. The runner UI unmounts. */
  pausePractice: (snapshot: PracticeSession) => void;
  /** Resume a previously-paused practice — restores it as `activePractice`
   *  with the timer continued from where it left off. Removes from `pausedPractices`. */
  resumePractice: (sessionId: string) => void;
  /** Discard a paused practice without resuming — just removes it from the list. */
  deletePausedPractice: (sessionId: string) => void;

  markQuestion: (sessionId: string, questionIndex: number, result: 'correct' | 'wrong' | 'unmarked') => void;
  markCorrectAnswer: (sessionId: string, questionIndex: number, correctAnswer: string | null) => void;
  saveNotes: (sessionId: string, questionIndex: number, conceptNotes: string, formulaNotes: string) => void;

  /** Change the current question's mode mid-practice.
   *  - 'single'  → 1 MCQ with A/B/C/D
   *  - 'multi'   → N sub-MCQs each with A/B/C/D (default N=3)
   *  - 'written' → just mark as done (answer is on paper)
   *  Persists the mode on the question + initializes sub-arrays for multi mode. */
  setQuestionMode: (questionIndex: number, mode: 'single' | 'multi' | 'multi-correct' | 'written', subCount?: number) => void;
  /** For multi mode: record the user's answer for one sub-question. */
  setSubAnswer: (questionIndex: number, subIndex: number, answer: string | null) => void;
  /** Change the number of options for the current question (2-8).
   *  Some questions have 5+ options (multi-correct, match-the-following, etc.). */
  setOptionCount: (questionIndex: number, count: number) => void;
  /** For multi-correct mode: toggle one option's selected state during practice. */
  toggleMultiCorrectUserAnswer: (questionIndex: number, optionIndex: number) => void;
  /** For multi-correct mode: set the correct set during review (per-option toggle). */
  toggleMultiCorrectAnswer: (sessionId: string, questionIndex: number, optionIndex: number) => void;
  /** For multi mode: set the correct answer for one sub-question during review. */
  setSubCorrectAnswer: (sessionId: string, questionIndex: number, subIndex: number, answer: string | null) => void;

  getRecent: (n: number) => PracticeSession[];
  getForDate: (date: string) => PracticeSession[];
}

export const usePractice = create<PracticeStore>()(
  persist(
    (set, get) => ({
      activePractice: null,
      currentQuestionIndex: 0,
      history: [],
      pausedPractices: [],

      startPractice: (opts) => {
        const id = `practice_${Date.now()}`;
        const name = opts.name || `${opts.subject}${opts.chapter !== 'All' ? ' · ' + opts.chapter : ''} · ${opts.questionCount || '∞'}Q`;
        const qCount = opts.questionCount || 0; // 0 = unlimited
        const questions: PracticeQuestion[] = qCount > 0
          ? Array.from({ length: qCount }, (_, i) => ({
              number: i + 1,
              timeSpentSec: 0,
              status: 'unanswered' as const,
              result: 'unmarked' as const,
              userAnswer: null,
              correctAnswer: null,
              conceptNotes: '',
              formulaNotes: '',
            }))
          : []; // unlimited — questions added on the fly

        const session: PracticeSession = {
          id,
          name,
          subject: opts.subject,
          chapter: opts.chapter,
          questionCount: qCount,
          timeLimitMin: opts.timeLimitMin,
          startedAt: Date.now(),
          endedAt: null,
          totalTimeSec: 0,
          questions,
          correctCount: 0,
          wrongCount: 0,
          skippedCount: 0,
          unmarkedCount: qCount,
          accuracy: 0,
        };

        set({ activePractice: session, currentQuestionIndex: 0 });
      },

      answerQuestion: (status) => {
        const session = get().activePractice;
        const idx = get().currentQuestionIndex;
        if (!session) return;

        // Ensure question exists (for unlimited mode, add on the fly)
        let questions = [...session.questions];
        while (questions.length <= idx) {
          questions.push({
            number: questions.length + 1,
            timeSpentSec: 0,
            status: 'unanswered',
            result: 'unmarked',
            userAnswer: null,
            correctAnswer: null,
            conceptNotes: '',
            formulaNotes: '',
          });
        }

        // Record time spent on current question
        // (timeSpentSec is accumulated by the runner component via tick)
        questions[idx] = {
          ...questions[idx],
          status,
        };

        // === Question numbering: the NEXT question's number must skip
        // ahead by the current question's "size" ===
        //   - single mode:  size = 1 (e.g., Q2 → Q3)
        //   - multi mode:   size = subQuestionCount (e.g., Q2 with 5 subs → Q7)
        //   - written mode: size = 1
        // This way, multi-questions consume multiple numbers and the next
        // single question picks up after them.
        const currentQ = questions[idx];
        const currentMode = currentQ?.mode || 'single';
        const sizeConsumed = currentMode === 'multi' ? (currentQ?.subQuestionCount || 3) : 1;
        const currentNumber = currentQ?.number || (idx + 1);
        const nextNumber = currentNumber + sizeConsumed;

        // Ensure next question exists (pad for unlimited mode) + set its number.
        while (questions.length <= idx + 1) {
          questions.push({
            number: questions.length === idx + 1 ? nextNumber : questions.length + 1,
            timeSpentSec: 0,
            status: 'unanswered',
            result: 'unmarked',
            userAnswer: null,
            correctAnswer: null,
            conceptNotes: '',
            formulaNotes: '',
          });
        }
        // Set the next question's number explicitly (in case it already existed
        // with a stale number from before the current question's mode change).
        questions[idx + 1] = { ...questions[idx + 1], number: nextNumber };

        // Update session
        const updatedSession = {
          ...session,
          questions,
          unmarkedCount: questions.filter(q => q.result === 'unmarked').length,
        };

        set({
          activePractice: updatedSession,
          currentQuestionIndex: idx + 1,
        });
      },

      endPractice: () => {
        const session = get().activePractice;
        if (!session) return;

        const now = Date.now();
        const totalTimeSec = Math.floor((now - session.startedAt) / 1000);
        const correct = session.questions.filter(q => q.result === 'correct').length;
        const wrong = session.questions.filter(q => q.result === 'wrong').length;
        const skipped = session.questions.filter(q => q.status === 'skipped').length;
        const unmarked = session.questions.filter(q => q.result === 'unmarked').length;
        const totalMarked = correct + wrong;
        const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;

        const completed: PracticeSession = {
          ...session,
          endedAt: now,
          totalTimeSec,
          correctCount: correct,
          wrongCount: wrong,
          skippedCount: skipped,
          unmarkedCount: unmarked,
          accuracy,
          questionCount: session.questions.length,
        };

        set((s) => ({
          activePractice: null,
          currentQuestionIndex: 0,
          history: [completed, ...s.history].slice(0, 200),
        }));
      },

      cancelPractice: () => {
        set({ activePractice: null, currentQuestionIndex: 0 });
      },

      /** Jump to a specific question (for navigating back to previous questions). */
      setCurrentQuestionIndex: (idx) => {
        const session = get().activePractice;
        if (!session) return;
        if (idx < 0 || idx >= session.questions.length) return;
        set({ currentQuestionIndex: idx });
      },

      /** Rename the active practice session. */
      renameActivePractice: (name) => {
        const session = get().activePractice;
        if (!session || !name.trim()) return;
        set({ activePractice: { ...session, name: name.trim() } });
      },

      /** Delete a question from the active practice by index.
       *  Removes the question, renumbers remaining questions, adjusts currentQuestionIndex. */
      deleteQuestion: (questionIndex) => {
        const session = get().activePractice;
        if (!session) return;
        if (questionIndex < 0 || questionIndex >= session.questions.length) return;
        if (session.questions.length <= 1) return; // Don't delete the last question

        const questions = session.questions.filter((_, i) => i !== questionIndex);
        // Renumber remaining questions
        questions.forEach((q, i) => { q.number = i + 1; });

        // Adjust currentQuestionIndex
        const currentIdx = get().currentQuestionIndex;
        let newIdx = currentIdx;
        if (questionIndex === currentIdx) {
          // Deleted the current question → stay at same index (or last if was last)
          newIdx = Math.min(currentIdx, questions.length - 1);
        } else if (questionIndex < currentIdx) {
          // Deleted a question before current → shift current down
          newIdx = currentIdx - 1;
        }

        set({
          activePractice: { ...session, questions, questionCount: questions.length },
          currentQuestionIndex: newIdx,
        });
      },

      /** Snapshot the current activePractice into pausedPractices, then
       *  clear activePractice so the runner UI unmounts.
       *  The runner is responsible for updating the current question's
       *  timeSpentSec + setting accumulatedTimeSec/pausedAt/resumeQuestionIndex
       *  on the session BEFORE calling this — we just snapshot what we get. */
      pausePractice: (snapshot) => {
        set((s) => ({
          activePractice: null,
          currentQuestionIndex: 0,
          pausedPractices: [snapshot, ...s.pausedPractices].slice(0, 50),
        }));
      },

      /** Move a paused practice back into activePractice with the timer
       *  restored to where it left off. The runner's mount effect reads
       *  accumulatedTimeSec + the current question's timeSpentSec to set
       *  questionStartRef correctly (so per-question timer continues). */
      resumePractice: (sessionId) => {
        const paused = get().pausedPractices.find((p) => p.id === sessionId);
        if (!paused) return;
        const accumulatedTimeSec = paused.accumulatedTimeSec || 0;
        const resumeIdx = paused.resumeQuestionIndex ?? 0;
        const restored: PracticeSession = {
          ...paused,
          // Shift startedAt so total elapsed timer shows accumulatedTimeSec
          // immediately on mount, then continues ticking from now.
          startedAt: Date.now() - accumulatedTimeSec * 1000,
          pausedAt: null,
        };
        set((s) => ({
          activePractice: restored,
          currentQuestionIndex: resumeIdx,
          pausedPractices: s.pausedPractices.filter((p) => p.id !== sessionId),
        }));
      },

      deletePausedPractice: (sessionId) => {
        set((s) => ({
          pausedPractices: s.pausedPractices.filter((p) => p.id !== sessionId),
        }));
      },

      markQuestion: (sessionId, questionIndex, result) => {
        set((s) => ({
          history: s.history.map((session) => {
            if (session.id !== sessionId) return session;
            const questions = [...session.questions];
            if (questionIndex >= 0 && questionIndex < questions.length) {
              questions[questionIndex] = { ...questions[questionIndex], result };
            }
            const correct = questions.filter(q => q.result === 'correct').length;
            const wrong = questions.filter(q => q.result === 'wrong').length;
            const unmarked = questions.filter(q => q.result === 'unmarked').length;
            const totalMarked = correct + wrong;
            const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
            return { ...session, questions, correctCount: correct, wrongCount: wrong, unmarkedCount: unmarked, accuracy };
          }),
        }));
      },

      markCorrectAnswer: (sessionId, questionIndex, correctAnswer) => {
        set((s) => ({
          history: s.history.map((session) => {
            if (session.id !== sessionId) return session;
            const questions = [...session.questions];
            if (questionIndex >= 0 && questionIndex < questions.length) {
              const q = questions[questionIndex];
              // Auto-determine result: if userAnswer matches correctAnswer → correct, else wrong
              const result = correctAnswer && q.userAnswer && correctAnswer === q.userAnswer
                ? 'correct' as const
                : correctAnswer && q.userAnswer && correctAnswer !== q.userAnswer
                  ? 'wrong' as const
                  : 'unmarked' as const;
              questions[questionIndex] = { ...q, correctAnswer, result };
            }
            const correct = questions.filter(q => q.result === 'correct').length;
            const wrong = questions.filter(q => q.result === 'wrong').length;
            const unmarked = questions.filter(q => q.result === 'unmarked').length;
            const totalMarked = correct + wrong;
            const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
            return { ...session, questions, correctCount: correct, wrongCount: wrong, unmarkedCount: unmarked, accuracy };
          }),
        }));
      },

      saveNotes: (sessionId, questionIndex, conceptNotes, formulaNotes) => {
        set((s) => ({
          history: s.history.map((session) => {
            if (session.id !== sessionId) return session;
            const questions = [...session.questions];
            if (questionIndex >= 0 && questionIndex < questions.length) {
              questions[questionIndex] = {
                ...questions[questionIndex],
                conceptNotes,
                formulaNotes,
              };
            }
            return { ...session, questions };
          }),
        }));
      },

      /** Change the current question's mode mid-practice.
       *  Operates on activePractice (the live running session). */
      setQuestionMode: (questionIndex, mode, subCount) => {
        const session = get().activePractice;
        if (!session) return;
        const questions = [...session.questions];
        // Pad if needed (for unlimited mode + idx beyond length)
        while (questions.length <= questionIndex) {
          questions.push({
            number: questions.length + 1, timeSpentSec: 0, status: 'unanswered' as const,
            result: 'unmarked' as const, userAnswer: null, correctAnswer: null,
            conceptNotes: '', formulaNotes: '',
          });
        }
        const q = questions[questionIndex];
        const updated: PracticeQuestion = { ...q, mode };
        if (mode === 'multi') {
          const n = Math.max(1, Math.min(6, subCount ?? q.subQuestionCount ?? 3));
          updated.subQuestionCount = n;
          // Preserve existing sub-answers if same length, otherwise resize (pad with null).
          const existing = q.subUserAnswers ?? [];
          updated.subUserAnswers = Array.from({ length: n }, (_, i) => existing[i] ?? null);
          const existingCorrect = q.subCorrectAnswers ?? [];
          updated.subCorrectAnswers = Array.from({ length: n }, (_, i) => existingCorrect[i] ?? null);
          // Clear multi-correct fields
          updated.multiCorrectUserAnswers = undefined;
          updated.multiCorrectAnswers = undefined;
        } else if (mode === 'multi-correct') {
          // Initialize multiCorrectUserAnswers to all false (none selected).
          const optN = q.optionCount ?? 4;
          const existing = q.multiCorrectUserAnswers ?? [];
          updated.multiCorrectUserAnswers = Array.from({ length: optN }, (_, i) => existing[i] ?? false);
          // Clear sub-mode fields
          updated.subQuestionCount = undefined;
          updated.subUserAnswers = undefined;
          updated.subCorrectAnswers = undefined;
          updated.writtenAnswer = undefined;
        } else if (mode === 'single') {
          // Clear multi-mode fields when reverting to single.
          updated.subQuestionCount = undefined;
          updated.subUserAnswers = undefined;
          updated.subCorrectAnswers = undefined;
          updated.writtenAnswer = undefined;
          updated.multiCorrectUserAnswers = undefined;
          updated.multiCorrectAnswers = undefined;
        } else if (mode === 'written') {
          // Clear multi-mode fields too.
          updated.subQuestionCount = undefined;
          updated.subUserAnswers = undefined;
          updated.subCorrectAnswers = undefined;
          updated.multiCorrectUserAnswers = undefined;
          updated.multiCorrectAnswers = undefined;
          if (!updated.writtenAnswer) updated.writtenAnswer = '';
        }
        questions[questionIndex] = updated;
        set({ activePractice: { ...session, questions } });
      },

      /** For multi mode: record the user's answer for one sub-question. */
      setSubAnswer: (questionIndex, subIndex, answer) => {
        const session = get().activePractice;
        if (!session) return;
        const questions = [...session.questions];
        if (questionIndex < 0 || questionIndex >= questions.length) return;
        const q = questions[questionIndex];
        const subAnswers = [...(q.subUserAnswers ?? [])];
        // Pad if needed
        while (subAnswers.length <= subIndex) subAnswers.push(null);
        subAnswers[subIndex] = answer;
        questions[questionIndex] = { ...q, subUserAnswers: subAnswers };
        set({ activePractice: { ...session, questions } });
      },

      /** Change the number of options for the current question (2-8).
       *  Some questions have 5, 6, 7+ options (multi-correct, match-the-following).
       *  Letters used: A, B, C, D, E, F, G, H.
       *  If userAnswer is now beyond the new count, clear it (user must re-pick). */
      setOptionCount: (questionIndex, count) => {
        const session = get().activePractice;
        if (!session) return;
        const n = Math.max(2, Math.min(8, count));
        const questions = [...session.questions];
        // Pad if needed
        while (questions.length <= questionIndex) {
          questions.push({
            number: questions.length + 1, timeSpentSec: 0, status: 'unanswered' as const,
            result: 'unmarked' as const, userAnswer: null, correctAnswer: null,
            conceptNotes: '', formulaNotes: '',
          });
        }
        const q = questions[questionIndex];
        // Clear userAnswer if it's beyond the new option count.
        const userAnswerLetter = q.userAnswer;
        const userAnswerIdx = userAnswerLetter ? userAnswerLetter.charCodeAt(0) - 65 : -1;
        const clearedUserAnswer = (userAnswerIdx >= n) ? null : userAnswerLetter;
        // Same for correctAnswer.
        const correctAnswerLetter = q.correctAnswer;
        const correctAnswerIdx = correctAnswerLetter ? correctAnswerLetter.charCodeAt(0) - 65 : -1;
        const clearedCorrectAnswer = (correctAnswerIdx >= n) ? null : correctAnswerLetter;
        // Resize multiCorrect arrays if in multi-correct mode
        let multiUserAns = q.multiCorrectUserAnswers;
        let multiCorr = q.multiCorrectAnswers;
        if (q.mode === 'multi-correct') {
          const oldUser = q.multiCorrectUserAnswers ?? [];
          multiUserAns = Array.from({ length: n }, (_, i) => oldUser[i] ?? false);
          const oldCorr = q.multiCorrectAnswers ?? [];
          multiCorr = Array.from({ length: n }, (_, i) => oldCorr[i] ?? false);
        }
        questions[questionIndex] = {
          ...q,
          optionCount: n,
          subOptionCount: n,
          userAnswer: clearedUserAnswer,
          correctAnswer: clearedCorrectAnswer,
          multiCorrectUserAnswers: multiUserAns,
          multiCorrectAnswers: multiCorr,
        };
        set({ activePractice: { ...session, questions } });
      },

      /** Multi-correct mode: toggle one option's selected state during practice. */
      toggleMultiCorrectUserAnswer: (questionIndex, optionIndex) => {
        const session = get().activePractice;
        if (!session) return;
        const questions = [...session.questions];
        if (questionIndex < 0 || questionIndex >= questions.length) return;
        const q = questions[questionIndex];
        const arr = [...(q.multiCorrectUserAnswers ?? [])];
        while (arr.length <= optionIndex) arr.push(false);
        arr[optionIndex] = !arr[optionIndex];
        questions[questionIndex] = { ...q, multiCorrectUserAnswers: arr };
        set({ activePractice: { ...session, questions } });
      },

      /** Multi-correct mode: toggle one option's correct state during review.
       *  Operates on a SAVED session in history (not activePractice). */
      toggleMultiCorrectAnswer: (sessionId, questionIndex, optionIndex) => {
        set((s) => ({
          history: s.history.map((session) => {
            if (session.id !== sessionId) return session;
            const questions = [...session.questions];
            if (questionIndex < 0 || questionIndex >= questions.length) return session;
            const q = questions[questionIndex];
            const arr = [...(q.multiCorrectAnswers ?? [])];
            while (arr.length <= optionIndex) arr.push(false);
            arr[optionIndex] = !arr[optionIndex];
            // Re-evaluate result: correct only if user's selection EXACTLY matches
            // the correct set (all correct options selected, no wrong ones).
            const userArr = q.multiCorrectUserAnswers ?? [];
            const optN = q.optionCount ?? 4;
            const userSet = Array.from({ length: optN }, (_, i) => userArr[i] ?? false);
            const corrSet = Array.from({ length: optN }, (_, i) => arr[i] ?? false);
            const isCorrect = userSet.every((v, i) => v === corrSet[i]);
            const result = isCorrect ? 'correct' as const : 'wrong' as const;
            questions[questionIndex] = {
              ...q, multiCorrectAnswers: arr, result,
              correctAnswer: arr.map((v, i) => v ? String.fromCharCode(65 + i) : null).filter(Boolean).join(',') || null,
            };
            // Recompute session totals
            const correct = questions.filter(qq => qq.result === 'correct').length;
            const wrong = questions.filter(qq => qq.result === 'wrong').length;
            const unmarked = questions.filter(qq => qq.result === 'unmarked').length;
            const totalMarked = correct + wrong;
            const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
            return { ...session, questions, correctCount: correct, wrongCount: wrong, unmarkedCount: unmarked, accuracy };
          }),
        }));
      },

      /** Multi mode: set the correct answer for one sub-question during review.
       *  Operates on a SAVED session in history (not activePractice). */
      setSubCorrectAnswer: (sessionId, questionIndex, subIndex, answer) => {
        set((s) => ({
          history: s.history.map((session) => {
            if (session.id !== sessionId) return session;
            const questions = [...session.questions];
            if (questionIndex < 0 || questionIndex >= questions.length) return session;
            const q = questions[questionIndex];
            const subArr = [...(q.subCorrectAnswers ?? [])];
            while (subArr.length <= subIndex) subArr.push(null);
            subArr[subIndex] = answer;
            // Re-evaluate parent result based on ALL sub-answers
            const userSubs = q.subUserAnswers ?? [];
            const subN = q.subQuestionCount ?? 0;
            let allCorrect = true;
            let anyMarked = false;
            for (let i = 0; i < subN; i++) {
              const u = userSubs[i];
              const c = subArr[i];
              if (u && c) {
                anyMarked = true;
                if (u !== c) allCorrect = false;
              }
            }
            const result = !anyMarked ? 'unmarked' as const : allCorrect ? 'correct' as const : 'wrong' as const;
            questions[questionIndex] = { ...q, subCorrectAnswers: subArr, result };
            // Recompute session totals
            const correct = questions.filter(qq => qq.result === 'correct').length;
            const wrong = questions.filter(qq => qq.result === 'wrong').length;
            const unmarked = questions.filter(qq => qq.result === 'unmarked').length;
            const totalMarked = correct + wrong;
            const accuracy = totalMarked > 0 ? Math.round((correct / totalMarked) * 100) : 0;
            return { ...session, questions, correctCount: correct, wrongCount: wrong, unmarkedCount: unmarked, accuracy };
          }),
        }));
      },

      getRecent: (n) => {
        return get().history.slice(0, n);
      },

      getForDate: (date) => {
        return get().history.filter((s) => {
          const d = new Date(s.startedAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return key === date;
        });
      },
    }),
    { name: 'neet-practice' }
  )
);
