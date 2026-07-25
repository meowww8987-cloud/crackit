// Subject Health Score calculation

import type { Lecture, Chapter, SubjectEntity, Test, SavedSession, Subject } from './types';
import { SUBJECTS } from './colors';

export interface SubjectHealth {
  subject: Subject;
  score: number; // 0-100
  completion: number;
  confidence: number;
  timeScore: number;
  testScore: number;
  color: string;
}

export function getSubjectHealthScores(
  lectures: Lecture[],
  chapters: Chapter[],
  subjects: SubjectEntity[],
  sessions: SavedSession[],
  tests: Test[],
  subjectWeightage: Record<string, number>
): SubjectHealth[] {
  const result: SubjectHealth[] = [];

  for (const subj of SUBJECTS) {
    const subjEntity = subjects.find(s => s.name === subj);
    const subjChapterIds = subjEntity ? chapters.filter(c => c.subjectId === subjEntity.id).map(c => c.id) : [];
    const subjLectures = lectures.filter(l => subjChapterIds.includes(l.chapterId));

    // 1. Completion (30%)
    const completion = subjLectures.length > 0
      ? (subjLectures.filter(l => l.done).length / subjLectures.length) * 100
      : 0;

    // 2. Confidence (25%)
    const doneWithConf = subjLectures.filter(l => l.done && l.confidence && l.confidence > 0);
    const avgConfidence = doneWithConf.length > 0
      ? (doneWithConf.reduce((a, l) => a + (l.confidence || 0), 0) / doneWithConf.length / 5) * 100
      : 0;

    // 3. Time Investment vs Weightage (25%)
    const subjTime = sessions.filter(s => s.subject === subj).reduce((a, s) => a + s.studySeconds, 0);
    const totalWeightage = subjectWeightage[subj] || 50;
    const totalTime = sessions.reduce((a, s) => a + s.studySeconds, 0);
    const expectedTime = totalTime > 0 ? (totalWeightage / 720) * totalTime : 0;
    const timeScore = expectedTime > 0 ? Math.min(100, (subjTime / expectedTime) * 100) : 0;

    // 4. Mock Test Performance (20%)
    const subjectTests = tests.filter(t => t.subjectMarks && t.subjectMarks[subj] !== undefined);
    const testScore = subjectTests.length > 0
      ? (subjectTests.reduce((a, t) => a + ((t.subjectMarks![subj] || 0) / 180), 0) / subjectTests.length) * 100
      : 50; // default if no tests

    const score = Math.round(completion * 0.3 + avgConfidence * 0.25 + timeScore * 0.25 + testScore * 0.2);

    result.push({
      subject: subj,
      score: Math.min(100, Math.max(0, score)),
      completion: Math.round(completion),
      confidence: Math.round(avgConfidence),
      timeScore: Math.round(timeScore),
      testScore: Math.round(testScore),
      color: score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444',
    });
  }

  return result;
}
