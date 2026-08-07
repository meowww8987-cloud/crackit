'use client';

import { create } from 'zustand';

/**
 * DragState — global state for the "drag from Syllabus → Study tab" feature.
 *
 * When the user long-presses a lecture in the Syllabus tab, it "picks up"
 * the lecture (sets draggedLectureId). The bottom nav Study tab shows a
 * drop zone. When the user drags over the Study tab and releases, the
 * Study tab creates a target for that lecture with the learned expected time.
 *
 * This is a lightweight state store (not persisted) that both the Syllabus
 * tab and AppShell can read/write.
 */

interface DragState {
  /** The lecture being dragged (null = not dragging). */
  draggedLectureId: string | null;
  /** The subject of the dragged lecture. */
  draggedSubject: string | null;
  /** Whether the user is currently hovering over the Study tab. */
  isOverStudyTab: boolean;

  startDrag: (lectureId: string, subject: string) => void;
  setOverStudyTab: (over: boolean) => void;
  endDrag: () => void;
}

export const useDragState = create<DragState>((set) => ({
  draggedLectureId: null,
  draggedSubject: null,
  isOverStudyTab: false,

  startDrag: (lectureId, subject) => {
    set({ draggedLectureId: lectureId, draggedSubject: subject, isOverStudyTab: false });
  },
  setOverStudyTab: (over) => set({ isOverStudyTab: over }),
  endDrag: () => set({ draggedLectureId: null, draggedSubject: null, isOverStudyTab: false }),
}));
