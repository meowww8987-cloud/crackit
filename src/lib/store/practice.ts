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
  userAnswer: string | null;      // 'A' | 'B' | 'C' | 'D' | null — what user selected during practice
  correctAnswer: string | null;   // 'A' | 'B' | 'C' | 'D' | null — correct answer (set during review)
  conceptNotes: string;
  formulaNotes: string;
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
