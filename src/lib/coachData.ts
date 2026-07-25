'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, todayKey, formatHM, diffDays, isRevisionOverdue } from '@/lib/utils';
import type { Subject } from '@/lib/types';

// ===== Formula Vault Store =====
export interface FormulaEntry {
  id: string;
  subject: Subject;
  chapter: string;
  title: string;
  content: string; // formula text or concept
  createdAt: number;
  lastReviewed?: number;
  reviewCount: number;
}

interface FormulaStore {
  formulas: FormulaEntry[];
  addFormula: (f: Omit<FormulaEntry, 'id' | 'createdAt' | 'reviewCount'>) => string;
  deleteFormula: (id: string) => void;
  markReviewed: (id: string) => void;
}

export const useFormulaVault = create<FormulaStore>()(
  persist(
    (set) => ({
      formulas: [],
      addFormula: (f) => {
        const id = uid();
        set((s) => ({
          formulas: [...s.formulas, { ...f, id, createdAt: Date.now(), reviewCount: 0 }],
        }));
        return id;
      },
      deleteFormula: (id) =>
        set((s) => ({ formulas: s.formulas.filter((f) => f.id !== id) })),
      markReviewed: (id) =>
        set((s) => ({
          formulas: s.formulas.map((f) =>
            f.id === id ? { ...f, lastReviewed: Date.now(), reviewCount: f.reviewCount + 1 } : f
          ),
        })),
    }),
    { name: 'neet-formula-vault' }
  )
);

// ===== AI Study Coach =====
export interface CoachInsight {
  id: string;
  type: 'warning' | 'positive' | 'suggestion' | 'info';
  priority: number; // 1 = highest
  emoji: string;
  title: string;
  detail: string;
  action?: { label: string; tab: string };
}

import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { subjectColor, SUBJECTS } from '@/lib/colors';

export function generateCoachInsights(): CoachInsight[] {
  const sessions = useHistory.getState().sessions;
  const lectures = useSyllabus.getState().lectures;
  const chapters = useSyllabus.getState().chapters;
  const subjects = useSyllabus.getState().subjects;
  const tests = useTests.getState().tests;
  const dailyGoal = useSettings.getState().dailyGoalHours;
  const insights: CoachInsight[] = [];

  const today = todayKey();

  // 1. Today's study status
  const todaySec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);
  const todayGoalSec = dailyGoal * 3600;
  if (todaySec === 0) {
    const hour = new Date().getHours();
    insights.push({
      id: 'no-study-today',
      type: hour >= 18 ? 'warning' : 'suggestion',
      priority: 1,
      emoji: hour >= 18 ? '⚠️' : '📚',
      title: hour >= 18 ? 'No study yet today!' : 'Ready to start studying?',
      detail: hour >= 18
        ? `It's ${hour}:00 and you haven't studied today. Your streak may be at risk.`
        : `Open the Study tab and pick a target to begin.`,
      action: { label: 'Go to Study', tab: 'study' },
    });
  } else if (todaySec < todayGoalSec * 0.5) {
    insights.push({
      id: 'low-study-today',
      type: 'suggestion',
      priority: 2,
      emoji: '📊',
      title: `${Math.round((todaySec / todayGoalSec) * 100)}% of daily goal`,
      detail: `You've studied ${formatHM(todaySec)} out of ${dailyGoal}h. Keep going!`,
    });
  } else if (todaySec >= todayGoalSec) {
    insights.push({
      id: 'goal-done',
      type: 'positive',
      priority: 5,
      emoji: '🎉',
      title: 'Daily goal complete!',
      detail: `You studied ${formatHM(todaySec)} today — great work!`,
    });
  }

  // 2. Neglected subject (last 7 days)
  const weekAgo = Date.now() - 7 * 86400000;
  const subjectTimes: Record<string, number> = {};
  for (const s of sessions.filter((s) => s.endedAt >= weekAgo)) {
    subjectTimes[s.subject] = (subjectTimes[s.subject] || 0) + s.studySeconds;
  }
  const neetSubjects = SUBJECTS.filter((s) => s !== 'General');
  let mostNeglected: Subject | null = null;
  let minTime = Infinity;
  for (const subj of neetSubjects) {
    const time = subjectTimes[subj] || 0;
    if (time < minTime) { minTime = time; mostNeglected = subj; }
  }
  if (mostNeglected && minTime < 1800) { // less than 30 min in 7 days
    insights.push({
      id: 'neglected-subject',
      type: 'warning',
      priority: 2,
      emoji: '⚠️',
      title: `${mostNeglected} needs attention`,
      detail: `Only ${formatHM(minTime)} in the last 7 days. Allocate more time to this subject.`,
      action: { label: 'Study ' + mostNeglected, tab: 'study' },
    });
  }

  // 3. Overdue revisions
  const overdue = lectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt));
  if (overdue.length > 0) {
    const oldest = overdue.sort((a, b) => (a.nextRevisionAt || 0) - (b.nextRevisionAt || 0))[0];
    const chapter = chapters.find((c) => c.id === oldest.chapterId);
    const subject = subjects.find((s) => s.id === chapter?.subjectId);
    insights.push({
      id: 'overdue-revision',
      type: 'warning',
      priority: 3,
      emoji: '🔄',
      title: `${overdue.length} revision${overdue.length === 1 ? '' : 's'} overdue`,
      detail: `${oldest.topic}${chapter ? ` (${chapter.name})` : ''} was due for revision. Tap to review.`,
      action: { label: 'Open Syllabus', tab: 'syllabus' },
    });
  }

  // 4. Test readiness
  const nextTest = tests
    .filter((t) => diffDays(today, t.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (nextTest) {
    const days = diffDays(today, nextTest.date);
    if (days <= 7) {
      const syllabusCount = nextTest.syllabus?.chapterIds.length || 0;
      insights.push({
        id: 'test-approaching',
        type: days <= 2 ? 'warning' : 'info',
        priority: days <= 2 ? 1 : 3,
        emoji: '📝',
        title: `${nextTest.name} in ${days === 0 ? 'today' : days + ' days'}`,
        detail: syllabusCount > 0
          ? `${syllabusCount} chapters in scope. Check your readiness.`
          : `No syllabus scope set. Add one for readiness tracking.`,
        action: { label: 'Open Tests', tab: 'tests' },
      });
    }
  }

  // 5. Recent test performance
  const recentTests = tests
    .filter((t) => t.totalMarks !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (recentTests.length >= 2) {
    const latest = recentTests[0];
    const prev = recentTests[1];
    const delta = (latest.totalMarks || 0) - (prev.totalMarks || 0);
    if (delta > 10) {
      insights.push({
        id: 'test-improvement',
        type: 'positive',
        priority: 4,
        emoji: '📈',
        title: `+${delta} marks improvement!`,
        detail: `${latest.name}: ${latest.totalMarks} vs ${prev.name}: ${prev.totalMarks}. Keep the momentum!`,
      });
    } else if (delta < -10) {
      insights.push({
        id: 'test-decline',
        type: 'warning',
        priority: 3,
        emoji: '📉',
        title: `${delta} marks drop`,
        detail: `${latest.name}: ${latest.totalMarks} vs ${prev.name}: ${prev.totalMarks}. Review weak topics.`,
        action: { label: 'Review tests', tab: 'tests' },
      });
    }
  }

  // 6. Subject imbalance from test scores
  if (recentTests.length >= 1 && recentTests[0].subjectMarks) {
    const marks = recentTests[0].subjectMarks;
    const entries = neetSubjects.map((s) => ({ subject: s, marks: marks[s] || 0 }));
    entries.sort((a, b) => a.marks - b.marks);
    const weakest = entries[0];
    const strongest = entries[entries.length - 1];
    if (strongest.marks - weakest.marks > 30) {
      insights.push({
        id: 'subject-imbalance',
        type: 'suggestion',
        priority: 3,
        emoji: '⚖️',
        title: `${weakest.subject} is behind`,
        detail: `Last test: ${weakest.subject} ${weakest.marks} vs ${strongest.subject} ${strongest.marks}. Focus on ${weakest.subject} this week.`,
        action: { label: 'Study ' + weakest.subject, tab: 'study' },
      });
    }
  }

  // 7. Best study time
  const hourCounts: Record<number, number> = {};
  for (const s of sessions.filter((s) => s.endedAt >= weekAgo)) {
    const hour = new Date(s.startedAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + s.studySeconds;
  }
  let bestHour = -1;
  let bestTime = 0;
  for (const [h, t] of Object.entries(hourCounts)) {
    if (t > bestTime) { bestTime = t; bestHour = Number(h); }
  }
  if (bestHour >= 0 && bestTime > 3600) {
    const period = bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : bestHour < 21 ? 'evening' : 'night';
    insights.push({
      id: 'best-time',
      type: 'info',
      priority: 6,
      emoji: '⏰',
      title: `Your best study time is ${period}`,
      detail: `You study most productively around ${bestHour}:00. Schedule important topics then.`,
    });
  }

  // Sort by priority
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

// ===== Weekly Report Generator =====
export interface WeeklyReport {
  weekStart: string;
  totalStudySec: number;
  totalWastedSec: number;
  bestDay: { date: string; sec: number };
  worstDay: { date: string; sec: number };
  subjectBreakdown: { subject: Subject; sec: number }[];
  testsTaken: number;
  avgTestScore: number;
  comparisonVsLastWeek: number; // percentage change
  topInsight: string;
}

export function generateWeeklyReport(): WeeklyReport | null {
  const sessions = useHistory.getState().sessions;
  const tests = useTests.getState().tests;

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;

  const thisWeekSessions = sessions.filter((s) => s.endedAt >= weekAgo);
  const lastWeekSessions = sessions.filter((s) => s.endedAt >= twoWeeksAgo && s.endedAt < weekAgo);

  if (thisWeekSessions.length === 0) return null;

  const totalStudySec = thisWeekSessions.reduce((a, s) => a + s.studySeconds, 0);
  const totalWastedSec = thisWeekSessions.reduce((a, s) => a + s.wastedSeconds, 0);
  const lastWeekStudy = lastWeekSessions.reduce((a, s) => a + s.studySeconds, 0);

  // Per-day breakdown
  const dayMap: Record<string, number> = {};
  for (const s of thisWeekSessions) {
    dayMap[s.date] = (dayMap[s.date] || 0) + s.studySeconds;
  }
  const dayEntries = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
  const bestDay = { date: dayEntries[0]?.[0] || '', sec: dayEntries[0]?.[1] || 0 };
  const worstDay = { date: dayEntries[dayEntries.length - 1]?.[0] || '', sec: dayEntries[dayEntries.length - 1]?.[1] || 0 };

  // Subject breakdown
  const subjMap: Record<string, number> = {};
  for (const s of thisWeekSessions) {
    subjMap[s.subject] = (subjMap[s.subject] || 0) + s.studySeconds;
  }
  const subjectBreakdown = Object.entries(subjMap)
    .map(([subject, sec]) => ({ subject: subject as Subject, sec }))
    .sort((a, b) => b.sec - a.sec);

  // Tests
  const weekTests = tests.filter((t) => t.takenAt && t.takenAt >= weekAgo && t.totalMarks !== undefined);
  const avgTestScore = weekTests.length > 0
    ? Math.round(weekTests.reduce((a, t) => a + (t.totalMarks || 0), 0) / weekTests.length)
    : 0;

  // Comparison
  const comparisonVsLastWeek = lastWeekStudy > 0
    ? Math.round(((totalStudySec - lastWeekStudy) / lastWeekStudy) * 100)
    : 100;

  // Top insight
  let topInsight = '';
  if (comparisonVsLastWeek > 20) topInsight = `Great progress — ${comparisonVsLastWeek}% more than last week!`;
  else if (comparisonVsLastWeek < -20) topInsight = `Study time dropped ${Math.abs(comparisonVsLastWeek)}%. Let's get back on track.`;
  else if (totalWastedSec > totalStudySec * 0.2) topInsight = `${Math.round((totalWastedSec / totalStudySec) * 100)}% of your time was wasted. Focus on minimizing distractions.`;
  else if (subjectBreakdown.length > 0 && subjectBreakdown[0].sec > totalStudySec * 0.6) topInsight = `${subjectBreakdown[0].subject} dominated this week. Balance your subjects.`;
  else topInsight = 'Consistent week. Keep the momentum going!';

  return {
    weekStart: new Date(weekAgo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    totalStudySec,
    totalWastedSec,
    bestDay,
    worstDay,
    subjectBreakdown,
    testsTaken: weekTests.length,
    avgTestScore,
    comparisonVsLastWeek,
    topInsight,
  };
}
