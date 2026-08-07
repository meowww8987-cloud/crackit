'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubjectEntity, Chapter, Lecture, Subject, LectureResource } from '@/lib/types';
import { uid, nextRevisionDate, todayKey } from '@/lib/utils';
import { useProgress } from './progress';

interface SyllabusStore {
  subjects: SubjectEntity[];
  chapters: Chapter[];
  lectures: Lecture[];
  addSubject: (name: Subject) => string;
  addChapter: (subjectId: string, name: string) => string;
  addLecture: (chapterId: string, topic: string, date?: string) => string;
  addCustomLecture: (chapterId: string, topic: string, date?: string) => string;
  bulkAddLectures: (chapterId: string, topics: string[]) => number;
  toggleLectureDone: (id: string) => void;
  toggleLectureResource: (id: string, resource: LectureResource) => void;
  updateLecture: (id: string, patch: Partial<Lecture>) => void;
  setHardness: (id: string, hardness: number) => void;
  deleteLecture: (id: string) => void;
  deleteChapter: (id: string) => void;
  reorderChapters: (subjectId: string, newOrder: string[]) => void;
  advanceRevision: (id: string) => void;
  getCompletionPercent: () => number;
  getOverdueRevisions: () => Lecture[];
  addLectureStats: (id: string, studySec: number, wastedSec: number, confidence?: number) => void;
  markLectureDoneWithStats: (id: string, studySec: number, wastedSec: number, confidence: number) => void;
}

export const useSyllabus = create<SyllabusStore>()(
  persist(
    (set, get) => ({
      subjects: [],
      chapters: [],
      lectures: [],

      addSubject: (name) => {
        const id = uid();
        const s: SubjectEntity = {
          id,
          name,
          order: get().subjects.length,
          createdAt: Date.now(),
        };
        set((st) => ({ subjects: [...st.subjects, s] }));
        return id;
      },

      addChapter: (subjectId, name) => {
        const id = uid();
        const c: Chapter = {
          id,
          subjectId,
          name,
          pyqCount: 0,
          createdAt: Date.now(),
        };
        set((st) => ({ chapters: [...st.chapters, c] }));
        return id;
      },

      addLecture: (chapterId, topic, date) => {
        const id = uid();
        const chapterLecs = get().lectures.filter((l) => l.chapterId === chapterId && !l.isCustom);
        const l: Lecture = {
          id,
          chapterId,
          lecNo: chapterLecs.length + 1,
          isCustom: false,
          topic,
          date,
          done: false,
          dppDone: false,
          notesDone: false,
          revisionDone: false,
          hardness: 3,
          pyqCount: 0,
          revisionStage: -1,
          createdAt: Date.now(),
        };
        set((st) => ({ lectures: [...st.lectures, l] }));
        return id;
      },

      addCustomLecture: (chapterId, topic, date) => {
        const id = uid();
        const chapterCustomLecs = get().lectures.filter((l) => l.chapterId === chapterId && l.isCustom);
        const l: Lecture = {
          id,
          chapterId,
          lecNo: chapterCustomLecs.length + 1,
          isCustom: true,
          topic,
          date,
          done: false,
          dppDone: false,
          notesDone: false,
          revisionDone: false,
          hardness: 3,
          pyqCount: 0,
          revisionStage: -1,
          createdAt: Date.now(),
        };
        set((st) => ({ lectures: [...st.lectures, l] }));
        return id;
      },

      bulkAddLectures: (chapterId, topics) => {
        const state = get();
        const existingCount = state.lectures.filter(
          (l) => l.chapterId === chapterId && !l.isCustom
        ).length;
        const newLectures: Lecture[] = topics
          .map((topic, i) => topic.trim())
          .filter(Boolean)
          .map((topic, i) => ({
            id: uid(),
            chapterId,
            lecNo: existingCount + i + 1,
            isCustom: false,
            topic,
            done: false,
            dppDone: false,
            notesDone: false,
            revisionDone: false,
            hardness: 3,
            pyqCount: 0,
            revisionStage: -1,
            createdAt: Date.now(),
          }));
        if (newLectures.length === 0) return 0;
        set((st) => ({ lectures: [...st.lectures, ...newLectures] }));
        return newLectures.length;
      },

      toggleLectureDone: (id) => {
        const state = get();
        const lecture = state.lectures.find((l) => l.id === id);
        if (!lecture) return;

        const newDone = !lecture.done;
        const chapter = state.chapters.find((c) => c.id === lecture.chapterId);
        const subject = chapter ? state.subjects.find((s) => s.id === chapter.subjectId) : null;

        // Update the lecture
        set((st) => ({
          lectures: st.lectures.map((l) => {
            if (l.id !== id) return l;
            if (newDone) {
              return {
                ...l,
                done: true,
                revisionStage: 0,
                lastRevisedAt: Date.now(),
                nextRevisionAt: nextRevisionDate(0),
              };
            } else {
              return {
                ...l,
                done: false,
                revisionStage: -1,
                lastRevisedAt: undefined,
                nextRevisionAt: undefined,
              };
            }
          }),
        }));

        // Log progress event (only if we have chapter/subject context)
        if (chapter && subject) {
          const labelPrefix = lecture.isCustom ? 'C' : 'L';
          useProgress.getState().logEvent({
            type: newDone ? 'lecture_done' : 'lecture_undone',
            lectureId: lecture.id,
            chapterId: chapter.id,
            subject: subject.name,
            chapterName: chapter.name,
            lectureLabel: `${labelPrefix}${lecture.lecNo}`,
            topic: lecture.topic,
          });

          // Check if this completed the chapter (all lectures now done)
          if (newDone) {
            const updatedState = get();
            const chLectures = updatedState.lectures.filter((l) => l.chapterId === chapter.id);
            const allDone = chLectures.length > 0 && chLectures.every((l) => l.done);
            if (allDone) {
              useProgress.getState().logEvent({
                type: 'chapter_complete',
                chapterId: chapter.id,
                subject: subject.name,
                chapterName: chapter.name,
                topic: `Chapter complete: ${chapter.name}`,
              });
            }
          }
        }
      },

      toggleLectureResource: (id, resource) => {
        const state = get();
        const lecture = state.lectures.find((l) => l.id === id);
        if (!lecture) return;
        const chapter = state.chapters.find((c) => c.id === lecture.chapterId);
        const subject = chapter ? state.subjects.find((s) => s.id === chapter.subjectId) : null;

        set((st) => ({
          lectures: st.lectures.map((l) => {
            if (l.id !== id) return l;
            switch (resource) {
              case 'lecture':
                return { ...l, done: !l.done, doneDate: !l.done ? Date.now() : l.doneDate };
              case 'dpp':
                return { ...l, dppDone: !l.dppDone };
              case 'notes':
                return { ...l, notesDone: !l.notesDone };
              case 'revision':
                return { ...l, revisionDone: !l.revisionDone };
              default:
                return l;
            }
          }),
        }));

        // Log progress event for lecture done/undone
        if (resource === 'lecture' && chapter && subject) {
          const labelPrefix = lecture.isCustom ? 'C' : 'L';
          const newDone = !lecture.done;
          useProgress.getState().logEvent({
            type: newDone ? 'lecture_done' : 'lecture_undone',
            lectureId: lecture.id,
            chapterId: chapter.id,
            subject: subject.name,
            chapterName: chapter.name,
            lectureLabel: `${labelPrefix}${lecture.lecNo}`,
            topic: lecture.topic,
          });

          // Bi-directional sync: sync any today targets linked to this lecture
          import('./targets').then(({ useTargets }) => {
            const targetsState = useTargets.getState();
            const today = todayKey();
            const todayTargets = targetsState.byDate[today] || [];
            for (const t of todayTargets) {
              if (t.lectureId === lecture.id && !t.isChapterTarget && t.done !== newDone) {
                useTargets.setState((s) => ({
                  byDate: {
                    ...s.byDate,
                    [today]: s.byDate[today].map((x) =>
                      x.id === t.id ? { ...x, done: newDone } : x
                    ),
                  },
                }));

                // If marking DONE and there's an active session for this target → auto-stop
                if (newDone) {
                  import('./session').then(({ useSession }) => {
                    const session = useSession.getState();
                    if (session.active && session.active.targetId === t.id) {
                      session.stop();
                    }
                  });
                }
              }
            }
          });

          // Check chapter completion
          if (newDone) {
            const updatedState = get();
            const chLectures = updatedState.lectures.filter((l) => l.chapterId === chapter.id);
            const allDone = chLectures.length > 0 && chLectures.every((l) => l.done);
            if (allDone) {
              useProgress.getState().logEvent({
                type: 'chapter_complete',
                chapterId: chapter.id,
                subject: subject.name,
                chapterName: chapter.name,
                topic: `Chapter complete: ${chapter.name}`,
              });
            }
          }
        }
      },

      updateLecture: (id, patch) =>
        set((st) => ({
          lectures: st.lectures.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      setHardness: (id, hardness) =>
        set((st) => ({
          lectures: st.lectures.map((l) =>
            l.id === id ? { ...l, hardness: Math.max(1, Math.min(5, hardness)) } : l
          ),
        })),

      deleteLecture: (id) =>
        set((st) => ({ lectures: st.lectures.filter((l) => l.id !== id) })),

      deleteChapter: (id) =>
        set((st) => ({
          chapters: st.chapters.filter((c) => c.id !== id),
          lectures: st.lectures.filter((l) => l.chapterId !== id),
        })),

      reorderChapters: (subjectId, newOrder) =>
        set((st) => {
          // Update the order field on each chapter in the subject
          const updatedChapters = st.chapters.map((c) => {
            if (c.subjectId !== subjectId) return c;
            const idx = newOrder.indexOf(c.id);
            return idx >= 0 ? { ...c, order: idx } : c;
          });
          return { chapters: updatedChapters };
        }),

      advanceRevision: (id) => {
        const state = get();
        const lecture = state.lectures.find((l) => l.id === id);
        if (!lecture) return;
        const chapter = state.chapters.find((c) => c.id === lecture.chapterId);
        const subject = chapter ? state.subjects.find((s) => s.id === chapter.subjectId) : null;

        set((st) => ({
          lectures: st.lectures.map((l) => {
            if (l.id !== id) return l;
            const nextStage = Math.min(l.revisionStage + 1, 4);
            return {
              ...l,
              revisionStage: nextStage,
              lastRevisedAt: Date.now(),
              nextRevisionAt: nextRevisionDate(nextStage),
            };
          }),
        }));

        if (chapter && subject) {
          const labelPrefix = lecture.isCustom ? 'C' : 'L';
          useProgress.getState().logEvent({
            type: 'revision_done',
            lectureId: lecture.id,
            chapterId: chapter.id,
            subject: subject.name,
            chapterName: chapter.name,
            lectureLabel: `${labelPrefix}${lecture.lecNo}`,
            topic: `Revision: ${lecture.topic}`,
          });
        }
      },

      getCompletionPercent: () => {
        const total = get().lectures.length;
        if (total === 0) return 0;
        const done = get().lectures.filter((l) => l.done).length;
        return Math.round((done / total) * 100);
      },

      getOverdueRevisions: () => {
        const now = Date.now();
        return get().lectures.filter(
          (l) => l.done && l.revisionStage >= 0 && l.nextRevisionAt && l.nextRevisionAt < now
        );
      },

      addLectureStats: (id, studySec, wastedSec, confidence) =>
        set((st) => ({
          lectures: st.lectures.map((l) => {
            if (l.id !== id) return l;
            return {
              ...l,
              timeSpentSec: (l.timeSpentSec || 0) + studySec,
              timeWastedSec: (l.timeWastedSec || 0) + wastedSec,
              confidence: confidence || l.confidence,
            };
          }),
        })),

      markLectureDoneWithStats: (id, studySec, wastedSec, confidence) =>
        set((st) => ({
          lectures: st.lectures.map((l) => {
            if (l.id !== id) return l;
            return {
              ...l,
              done: true,
              doneDate: Date.now(),
              timeSpentSec: (l.timeSpentSec || 0) + studySec,
              timeWastedSec: (l.timeWastedSec || 0) + wastedSec,
              confidence,
              // Enter spaced repetition if not already
              revisionStage: l.revisionStage < 0 ? 0 : l.revisionStage,
              lastRevisedAt: l.lastRevisedAt || Date.now(),
              nextRevisionAt: l.nextRevisionAt || nextRevisionDate(0),
            };
          }),
        })),
    }),
    {
      name: 'neet-syllabus',
      migrate: (persisted: any) => {
        // Migrate old lectures to new model with all stats fields
        if (persisted?.state?.lectures) {
          persisted.state.lectures = persisted.state.lectures.map((l: any) => ({
            ...l,
            dppDone: l.dppDone ?? false,
            notesDone: l.notesDone ?? false,
            revisionDone: l.revisionDone ?? false,
            timeSpentSec: l.timeSpentSec ?? 0,
            timeWastedSec: l.timeWastedSec ?? 0,
            confidence: l.confidence ?? 0,
            doneDate: l.doneDate ?? undefined,
          }));
        }
        return persisted;
      },
      version: 3,
    }
  )
);
