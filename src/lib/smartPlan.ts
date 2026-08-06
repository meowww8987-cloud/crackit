// Smart Plan algorithm — suggests today's targets based on:
// 1. Overdue revisions (priority-sorted by confidence + overdue duration)
// 2. Weekday subject pattern (what user usually studies on this weekday)
// 3. Next undone lecture from syllabus (high-weightage first)
// 4. Weak topics (low confidence lectures need revision)
// 5. DPP practice suggestions

import type { SmartSuggestion, SavedSession, Lecture, Chapter, SubjectEntity } from './types';
import { SUBJECTS } from './colors';
import { weekdaySubjectPattern } from './analytics';
import { isRevisionOverdue } from './utils';

// Forgetting curve: lower confidence = shorter revision interval needed
function getRevisionPriority(lec: Lecture): number {
  let priority = 0;
  // Overdue lectures get base priority
  if (lec.nextRevisionAt && lec.nextRevisionAt < Date.now()) {
    const overdueDays = Math.floor((Date.now() - lec.nextRevisionAt) / 86400000);
    priority += overdueDays * 10; // more overdue = higher priority
  }
  // Low confidence = higher priority for revision
  if (lec.confidence && lec.confidence <= 2) priority += 50;
  else if (lec.confidence && lec.confidence <= 3) priority += 20;
  // Higher revision stage = more important to maintain
  priority += lec.revisionStage * 5;
  return priority;
}

// Priority score for undone lectures (weightage-based)
function getUndonePriority(lec: Lecture, ch?: Chapter): number {
  let priority = 0;
  // High weightage chapters get priority
  if (ch?.pyqCount) priority += ch.pyqCount * 5;
  // Low confidence on previously attempted lectures
  if (lec.confidence && lec.confidence <= 2) priority += 30;
  return priority;
}

export function generateSmartPlan(
  sessions: SavedSession[],
  lectures: Lecture[],
  chapters: Chapter[],
  subjects: SubjectEntity[],
  excludeTopics: string[] = [] // already-added topics today
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  const today = new Date().getDay();
  const pattern = weekdaySubjectPattern(sessions);

  // Find top subject for today's weekday
  const todayPattern = pattern[today];
  let topSubject: Subject | null = null;
  let topMinutes = 0;
  for (const subj of SUBJECTS) {
    if (todayPattern[subj] > topMinutes) {
      topMinutes = todayPattern[subj];
      topSubject = subj;
    }
  }

  // 1. Overdue revisions (sorted by priority — most overdue + lowest confidence first)
  const overdueLectures = lectures
    .filter((l) => l.done && l.revisionStage >= 0 && isRevisionOverdue(l.nextRevisionAt))
    .sort((a, b) => getRevisionPriority(b) - getRevisionPriority(a));

  for (const lec of overdueLectures.slice(0, 3)) {
    const ch = chapters.find((c) => c.id === lec.chapterId);
    const subj = subjects.find((s) => s.id === ch?.subjectId);
    if (!ch || !subj) continue;
    const topic = `Revise: ${lec.topic}`;
    if (excludeTopics.includes(topic)) continue;

    // Forgetting curve: suggest shorter time for low-confidence topics
    const expectedMinutes = lec.confidence && lec.confidence <= 2 ? 45 : 30;

    const reasonParts: string[] = [];
    const overdueDays = lec.nextRevisionAt ? Math.floor((Date.now() - lec.nextRevisionAt) / 86400000) : 0;
    if (overdueDays > 0) reasonParts.push(`${overdueDays}d overdue`);
    if (lec.confidence && lec.confidence <= 2) reasonParts.push('low confidence');
    else reasonParts.push(`Rev ${lec.revisionStage + 1}/5`);

    suggestions.push({
      subject: subj.name,
      activity: 'Revision',
      chapter: ch.name,
      lecture: `L${lec.lecNo}`,
      topic,
      expectedMinutes,
      reason: reasonParts.join(' · '),
      lectureId: lec.id,
    });
  }

  // 2. Weak topics (done lectures with confidence ≤ 2 that aren't overdue)
  const weakLectures = lectures
    .filter((l) => l.done && l.confidence && l.confidence <= 2 && !isRevisionOverdue(l.nextRevisionAt))
    .sort((a, b) => (b.confidence || 3) - (a.confidence || 3)); // most struggling first

  if (weakLectures.length > 0 && suggestions.length < 4) {
    const lec = weakLectures[0];
    const ch = chapters.find((c) => c.id === lec.chapterId);
    const subj = subjects.find((s) => s.id === ch?.subjectId);
    if (ch && subj) {
      const topic = `Practice: ${lec.topic}`;
      if (!excludeTopics.includes(topic)) {
        suggestions.push({
          subject: subj.name,
          activity: 'DPP',
          chapter: ch.name,
          lecture: `L${lec.lecNo}`,
          topic,
          expectedMinutes: 45,
          reason: 'Weak topic — needs practice',
          lectureId: lec.id,
        });
      }
    }
  }

  // 3. Next undone lecture (priority: high-weightage + weekday subject first)
  const findNextUndone = (subjectName?: Subject): Lecture | null => {
    const filtered = lectures
      .filter((l) => !l.done && (!subjectName || chapters.find((c) => c.id === l.chapterId)?.subjectId === subjects.find((s) => s.name === subjectName)?.id))
      .sort((a, b) => {
        const chA = chapters.find((c) => c.id === a.chapterId);
        const chB = chapters.find((c) => c.id === b.chapterId);
        return getUndonePriority(b, chB) - getUndonePriority(a, chA);
      });
    return filtered[0] || null;
  };

  // Try top weekday subject first
  if (topSubject && suggestions.length < 4) {
    const next = findNextUndone(topSubject);
    if (next) {
      const ch = chapters.find((c) => c.id === next.chapterId);
      if (ch) {
        const topic = next.topic;
        if (!excludeTopics.includes(topic)) {
          suggestions.push({
            subject: topSubject,
            activity: 'Lecture',
            chapter: ch.name,
            lecture: `L${next.lecNo}`,
            topic,
            expectedMinutes: 60,
            reason: `${new Date().toLocaleDateString('en-US', { weekday: 'long' })} is usually ${topSubject}${ch.pyqCount > 4 ? ' · high yield' : ''}`,
            lectureId: next.id,
          });
        }
      }
    }
  }

  // 4. Next undone lecture from any subject (high weightage first)
  const nextAny = findNextUndone();
  if (nextAny && suggestions.length < 4) {
    const ch = chapters.find((c) => c.id === nextAny.chapterId);
    const subj = subjects.find((s) => s.id === ch?.subjectId);
    if (ch && subj) {
      const topic = nextAny.topic;
      if (!excludeTopics.includes(topic)) {
        suggestions.push({
          subject: subj.name,
          activity: 'Lecture',
          chapter: ch.name,
          lecture: `L${nextAny.lecNo}`,
          topic,
          expectedMinutes: 60,
          reason: ch.pyqCount > 4 ? 'High yield chapter' : 'Next undone lecture',
          lectureId: nextAny.id,
        });
      }
    }
  }

  // 5. If no syllabus data, suggest default based on weekday
  if (suggestions.length === 0) {
    const wdMap: Record<number, Subject> = {
      0: 'Botany', 1: 'Physics', 2: 'Chemistry', 3: 'Zoology',
      4: 'Physics', 5: 'Chemistry', 6: 'Botany',
    };
    const subj = topSubject || wdMap[today];
    suggestions.push({
      subject: subj,
      activity: 'Lecture',
      chapter: 'General',
      topic: 'Study session',
      expectedMinutes: 60,
      reason: `${new Date().toLocaleDateString('en-US', { weekday: 'long' })} is usually ${subj}`,
    });
    suggestions.push({
      subject: 'Chemistry',
      activity: 'DPP',
      chapter: 'Practice',
      topic: 'Daily Practice Problems',
      expectedMinutes: 45,
      reason: 'Daily practice recommended',
    });
    suggestions.push({
      subject: 'Physics',
      activity: 'Revision',
      chapter: 'Recent topics',
      topic: 'Revise recent topics',
      expectedMinutes: 30,
      reason: 'Spaced repetition',
    });
  }

  // Dedupe by topic
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.topic)) return false;
    seen.add(s.topic);
    return true;
  }).slice(0, 5);
}

// Helper: count revisions due today
export function getRevisionsDueToday(lectures: Lecture[]): number {
  return lectures.filter((l) => l.done && l.revisionStage >= 0 && isRevisionOverdue(l.nextRevisionAt)).length;
}

// Helper: count weak topics
export function getWeakTopicsCount(lectures: Lecture[]): number {
  return lectures.filter((l) => l.done && l.confidence && l.confidence <= 2).length;
}
