'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Test, Subject, SubjectAnalytics, TestType, CoachingSource, PaperQuestion, PaperTestConfig } from '@/lib/types';
import { uid, todayKey, diffDays } from '@/lib/utils';
import { predictRankFromMarks } from '@/lib/neetRankData';

interface TestsStore {
  tests: Test[];
  addTest: (t: {
    name: string;
    date: string;
    type: TestType;
    coachingSource?: CoachingSource;
    syllabus?: { chapterIds: string[]; lectureIds: string[] };
    duration?: number;
  }) => string;
  updateTest: (id: string, patch: Partial<Test>) => void;
  deleteTest: (id: string) => void;
  setResult: (
    id: string,
    result: {
      totalMarks?: number;
      subjectMarks?: Record<Subject, number>;
      strongTopics?: string;
      weakTopics?: string;
      notes?: string;
      takenAt?: number;
    }
  ) => void;
  setAnalytics: (id: string, analytics: Record<Subject, SubjectAnalytics>) => void;
  setSyllabus: (id: string, syllabus: { chapterIds: string[]; lectureIds: string[] }) => void;

  // === Timer actions (simple test timer) ===
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  completeTimer: (id: string) => void;
  tickTimer: (id: string) => void;

  // === Paper Test Companion actions ===
  /** Initialize paper test with a config (question count, duration, extra time, etc.) */
  initPaperTest: (id: string, config?: Partial<PaperTestConfig>) => void;
  /** Record answer (A/B/C/D) for current question */
  recordPaperAnswer: (id: string, questionIdx: number, answer: 'A' | 'B' | 'C' | 'D') => void;
  /** Toggle flag on a question */
  togglePaperFlag: (id: string, questionIdx: number) => void;
  /** Move to next question (commits time on current, starts next) */
  nextPaperQuestion: (id: string) => void;
  /** Move to previous question */
  prevPaperQuestion: (id: string) => void;
  /** Jump to a specific question (from grid view) */
  jumpToPaperQuestion: (id: string, questionIdx: number) => void;
  /** Pause the paper test */
  pausePaperTest: (id: string) => void;
  /** Resume the paper test */
  resumePaperTest: (id: string) => void;
  /** End the paper test — finalizes all timing, sets ended=true + endedAt */
  endPaperTest: (id: string) => void;
  /** Clear paper test state (after summary dismissed) */
  clearPaperTest: (id: string) => void;
  /** Add extra seconds to the CURRENT question only (on-demand, via +30s button) */
  addQuestionExtraTime: (id: string, seconds: number) => void;
  /** Set text note on a question */
  setQuestionNote: (id: string, questionIdx: number, note: string) => void;
  /** Set question text (type or paste the actual question for future reference) */
  setQuestionText: (id: string, questionIdx: number, text: string) => void;
  /** Set photo (base64) on a question */
  setQuestionPhoto: (id: string, questionIdx: number, photo: string | undefined) => void;
  /** Set correct answer on a question (from answer key entry) */
  setCorrectAnswer: (id: string, questionIdx: number, answer: 'A' | 'B' | 'C' | 'D' | null) => void;
  /** Bulk-set correct answers from a 180-char string (e.g. "ABCDDCBA...") */
  setAnswerKey: (id: string, key: string) => void;

  getNextTest: () => Test | null;
  getUpcoming: () => Test[];
  getPast: () => Test[];
  getReadiness: (test: Test) => number;
}

export const useTests = create<TestsStore>()(
  persist(
    (set, get) => ({
      tests: [],

      addTest: (t) => {
        const id = uid();
        const test: Test = {
          id,
          name: t.name,
          date: t.date,
          type: t.type,
          coachingSource: t.coachingSource ?? 'Self',
          hasAnalytics: false,
          createdAt: Date.now(),
          syllabus: t.syllabus,
          duration: t.duration ?? (t.type === 'Full Syllabus' || t.type === 'AITS' ? 200 : t.type === 'Part Test' ? 60 : 180),
          timerState: 'not_started',
          timerElapsedSec: 0,
          timerPausedSec: 0,
        };
        set((s) => ({ tests: [...s.tests, test] }));
        return id;
      },

      updateTest: (id, patch) =>
        set((s) => ({
          tests: s.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      deleteTest: (id) =>
        set((s) => ({ tests: s.tests.filter((t) => t.id !== id) })),

      setResult: (id, result) =>
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id) return t;
            const updated: Test = { ...t, ...result };
            // Compute predicted rank from total marks if available
            if (result.totalMarks !== undefined) {
              const rank = predictRankFromMarks(result.totalMarks);
              if (rank) updated.predictedRank = rank;
            }
            return updated;
          }),
        })),

      setAnalytics: (id, analytics) =>
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? { ...t, analytics, hasAnalytics: true }
              : t
          ),
        })),

      setSyllabus: (id, syllabus) =>
        set((s) => ({
          tests: s.tests.map((t) => (t.id === id ? { ...t, syllabus } : t)),
        })),

      // === Timer actions ===
      startTimer: (id) =>
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? { ...t, timerState: 'running', timerStartedAt: Date.now(), takenAt: t.takenAt ?? Date.now() }
              : t
          ),
        })),

      pauseTimer: (id) => {
        // First commit the elapsed time since last start, then set paused
        const test = get().tests.find((t) => t.id === id);
        if (!test || test.timerState !== 'running' || !test.timerStartedAt) return;
        const delta = Math.floor((Date.now() - test.timerStartedAt) / 1000);
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? {
                  ...t,
                  timerState: 'paused',
                  timerElapsedSec: (t.timerElapsedSec || 0) + delta,
                  timerStartedAt: undefined,
                  timerPausedSec: (t.timerPausedSec || 0) + 0, // pause start tracked separately if needed
                }
              : t
          ),
        }));
      },

      resumeTimer: (id) =>
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id && t.timerState === 'paused'
              ? { ...t, timerState: 'running', timerStartedAt: Date.now() }
              : t
          ),
        })),

      completeTimer: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test) return;
        let finalElapsed = test.timerElapsedSec || 0;
        if (test.timerState === 'running' && test.timerStartedAt) {
          finalElapsed += Math.floor((Date.now() - test.timerStartedAt) / 1000);
        }
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? {
                  ...t,
                  timerState: 'completed',
                  timerElapsedSec: finalElapsed,
                  timerStartedAt: undefined,
                  takenAt: t.takenAt ?? Date.now(),
                }
              : t
          ),
        }));
      },

      tickTimer: (id) => {
        // Periodic commit — called every 30s by the UI to persist elapsed time
        // in case the app crashes or user closes the tab during a test.
        const test = get().tests.find((t) => t.id === id);
        if (!test || test.timerState !== 'running' || !test.timerStartedAt) return;
        const delta = Math.floor((Date.now() - test.timerStartedAt) / 1000);
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? { ...t, timerElapsedSec: (t.timerElapsedSec || 0) + delta, timerStartedAt: Date.now() }
              : t
          ),
        }));
      },

      // === Paper Test Companion actions ===
      initPaperTest: (id, config) => {
        const qCount = config?.questionCount ?? 180;
        const durMin = config?.durationMin ?? 200;
        // Default config — NEET standard 180 Q, 3h20m
        const fullConfig: PaperTestConfig = {
          questionCount: qCount,
          durationMin: durMin,
          defaultSecPerQuestion: config?.defaultSecPerQuestion ?? Math.floor((durMin * 60) / qCount),
          marksPerCorrect: config?.marksPerCorrect ?? 4,
          negativePerWrong: config?.negativePerWrong ?? 1,
          sectionsEnabled: config?.sectionsEnabled ?? true,
        };
        const subjects: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        const questions: PaperQuestion[] = [];
        // Distribute questions across subjects as evenly as possible.
        // For 180 Q: 45 each. For 60 Q: 15 each. For 100 Q: 25 each. For custom: even split.
        const perSubject = Math.ceil(fullConfig.questionCount / 4);
        let qNum = 1;
        for (let s = 0; s < 4; s++) {
          const count = Math.min(perSubject, fullConfig.questionCount - s * perSubject);
          for (let i = 0; i < count; i++) {
            questions.push({
              number: qNum++,
              subject: subjects[s],
              answer: null,
              correctAnswer: null,
              flagged: false,
              timeSpentSec: 0,
              startedAt: questions.length === 0 ? Date.now() : null,
            });
          }
        }
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id
              ? {
                  ...t,
                  paperTest: {
                    questions,
                    currentIdx: 0,
                    startedAt: Date.now(),
                    endedAt: null,
                    pausedSec: 0,
                    isPaused: false,
                    pausedAt: null,
                    ended: false,
                    config: fullConfig,
                    extraTimeUsedSec: 0,
                  },
                  timerState: 'running',
                  timerStartedAt: Date.now(),
                  takenAt: t.takenAt ?? Date.now(),
                }
              : t
          ),
        }));
      },

      recordPaperAnswer: (id, questionIdx, answer) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, answer } : q
                ),
              },
            };
          }),
        }));
      },

      togglePaperFlag: (id, questionIdx) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, flagged: !q.flagged } : q
                ),
              },
            };
          }),
        }));
      },

      nextPaperQuestion: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest) return;
        const now = Date.now();
        const currentQ = test.paperTest.questions[test.paperTest.currentIdx];
        // Commit time on current question
        const timeDelta = currentQ.startedAt && !test.paperTest.isPaused
          ? Math.floor((now - currentQ.startedAt) / 1000)
          : 0;
        const nextIdx = Math.min(179, test.paperTest.currentIdx + 1);
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                currentIdx: nextIdx,
                questions: t.paperTest.questions.map((q, i) => {
                  if (i === test.paperTest!.currentIdx) {
                    return { ...q, timeSpentSec: q.timeSpentSec + timeDelta, startedAt: null };
                  }
                  if (i === nextIdx) {
                    return { ...q, startedAt: now };
                  }
                  return q;
                }),
              },
            };
          }),
        }));
      },

      prevPaperQuestion: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest) return;
        const now = Date.now();
        const currentQ = test.paperTest.questions[test.paperTest.currentIdx];
        const timeDelta = currentQ.startedAt && !test.paperTest.isPaused
          ? Math.floor((now - currentQ.startedAt) / 1000)
          : 0;
        const prevIdx = Math.max(0, test.paperTest.currentIdx - 1);
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                currentIdx: prevIdx,
                questions: t.paperTest.questions.map((q, i) => {
                  if (i === test.paperTest!.currentIdx) {
                    return { ...q, timeSpentSec: q.timeSpentSec + timeDelta, startedAt: null };
                  }
                  if (i === prevIdx) {
                    return { ...q, startedAt: now };
                  }
                  return q;
                }),
              },
            };
          }),
        }));
      },

      jumpToPaperQuestion: (id, questionIdx) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest) return;
        const now = Date.now();
        const currentQ = test.paperTest.questions[test.paperTest.currentIdx];
        const timeDelta = currentQ.startedAt && !test.paperTest.isPaused
          ? Math.floor((now - currentQ.startedAt) / 1000)
          : 0;
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                currentIdx: questionIdx,
                questions: t.paperTest.questions.map((q, i) => {
                  if (i === test.paperTest!.currentIdx) {
                    return { ...q, timeSpentSec: q.timeSpentSec + timeDelta, startedAt: null };
                  }
                  if (i === questionIdx) {
                    return { ...q, startedAt: now };
                  }
                  return q;
                }),
              },
            };
          }),
        }));
      },

      pausePaperTest: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest || test.paperTest.isPaused) return;
        const now = Date.now();
        // Commit time on current question up to now
        const currentQ = test.paperTest.questions[test.paperTest.currentIdx];
        const timeDelta = currentQ.startedAt ? Math.floor((now - currentQ.startedAt) / 1000) : 0;
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                isPaused: true,
                pausedAt: now,
                questions: t.paperTest.questions.map((q, i) =>
                  i === t.paperTest!.currentIdx
                    ? { ...q, timeSpentSec: q.timeSpentSec + timeDelta, startedAt: null }
                    : q
                ),
              },
            };
          }),
        }));
      },

      resumePaperTest: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest || !test.paperTest.isPaused) return;
        const now = Date.now();
        const pauseDelta = test.paperTest.pausedAt
          ? Math.floor((now - test.paperTest.pausedAt) / 1000)
          : 0;
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                isPaused: false,
                pausedAt: null,
                pausedSec: t.paperTest.pausedSec + pauseDelta,
                questions: t.paperTest.questions.map((q, i) =>
                  i === t.paperTest!.currentIdx
                    ? { ...q, startedAt: now }
                    : q
                ),
              },
            };
          }),
        }));
      },

      endPaperTest: (id) => {
        const test = get().tests.find((t) => t.id === id);
        if (!test?.paperTest) return;
        const now = Date.now();
        // Commit time on current question
        const currentQ = test.paperTest.questions[test.paperTest.currentIdx];
        const timeDelta = currentQ.startedAt && !test.paperTest.isPaused
          ? Math.floor((now - currentQ.startedAt) / 1000)
          : 0;
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            const endTime = now;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                ended: true,
                endedAt: endTime,
                isPaused: false,
                pausedAt: null,
                questions: t.paperTest.questions.map((q, i) =>
                  i === t.paperTest!.currentIdx
                    ? { ...q, timeSpentSec: q.timeSpentSec + timeDelta, startedAt: null }
                    : q
                ),
              },
              // Stop the simple timer too — clear timerStartedAt so it stops counting
              timerState: 'completed',
              timerStartedAt: undefined,
              timerElapsedSec: Math.floor((endTime - t.paperTest.startedAt) / 1000) - t.paperTest.pausedSec,
            };
          }),
        }));
      },

      clearPaperTest: (id) => {
        set((s) => ({
          tests: s.tests.map((t) =>
            t.id === id ? { ...t, paperTest: undefined } : t
          ),
        }));
      },

      addQuestionExtraTime: (id, seconds) => {
        // Add extra seconds to the CURRENT question only.
        // This extends the per-question timer by increasing extraSecAdded
        // on the current question. Warning sound flags are reset in the
        // companion component (not here) so the beep can fire again before
        // the new deadline.
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            const idx = t.paperTest.currentIdx;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === idx
                    ? { ...q, extraSecAdded: (q.extraSecAdded || 0) + seconds }
                    : q
                ),
              },
            };
          }),
        }));
      },

      setQuestionNote: (id, questionIdx, note) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, note: note || undefined } : q
                ),
              },
            };
          }),
        }));
      },

      setQuestionText: (id, questionIdx, text) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, questionText: text || undefined } : q
                ),
              },
            };
          }),
        }));
      },

      setQuestionPhoto: (id, questionIdx, photo) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, photo } : q
                ),
              },
            };
          }),
        }));
      },

      setCorrectAnswer: (id, questionIdx, answer) => {
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) =>
                  i === questionIdx ? { ...q, correctAnswer: answer } : q
                ),
              },
            };
          }),
        }));
      },

      setAnswerKey: (id, key) => {
        // Parse a 180-char string of A/B/C/D into correct answers
        const cleaned = key.toUpperCase().replace(/[^ABCD]/g, '').slice(0, 180);
        set((s) => ({
          tests: s.tests.map((t) => {
            if (t.id !== id || !t.paperTest) return t;
            return {
              ...t,
              paperTest: {
                ...t.paperTest,
                questions: t.paperTest.questions.map((q, i) => {
                  const ch = cleaned[i];
                  const answer = (ch === 'A' || ch === 'B' || ch === 'C' || ch === 'D') ? ch : null;
                  return { ...q, correctAnswer: answer };
                }),
              },
            };
          }),
        }));
      },

      getNextTest: () => {
        const today = todayKey();
        const upcoming = get()
          .tests.filter((t) => diffDays(today, t.date) >= 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        return upcoming[0] || null;
      },

      getUpcoming: () => {
        const today = todayKey();
        return get()
          .tests.filter((t) => diffDays(today, t.date) >= 0)
          .sort((a, b) => a.date.localeCompare(b.date));
      },

      getPast: () => {
        const today = todayKey();
        return get()
          .tests.filter((t) => diffDays(today, t.date) < 0)
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      getReadiness: (test) => {
        if (test.totalMarks !== undefined) {
          return Math.round((test.totalMarks / 720) * 100);
        }
        return 0;
      },
    }),
    {
      name: 'neet-tests',
      version: 2,
      migrate: (persisted: any) => {
        // Set defaults for new fields on existing tests
        if (persisted?.state?.tests) {
          persisted.state.tests = persisted.state.tests.map((t: any) => ({
            ...t,
            coachingSource: t.coachingSource ?? 'Self',
            duration: t.duration ?? (t.type === 'Full Syllabus' || t.type === 'AITS' ? 200 : 180),
            timerState: t.timerState ?? 'not_started',
            timerElapsedSec: t.timerElapsedSec ?? 0,
            timerPausedSec: t.timerPausedSec ?? 0,
          }));
        }
        return persisted;
      },
    }
  )
);
