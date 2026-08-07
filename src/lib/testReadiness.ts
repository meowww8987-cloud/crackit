// Pure analytics functions for test readiness, behavior patterns, and leaderboards.
// All functions are side-effect free and read from stores via the passed-in data.

import type { Test, Subject, SubjectAnalytics, Chapter, Lecture, SubjectEntity } from '@/lib/types';
import { getChaptersForSubject, findChapterById, getSubjectForChapter, NEETChapter } from '@/lib/neetSyllabus';
import { subjectColor } from '@/lib/colors';

export interface SubjectReadiness {
  subject: Subject;
  total: number; // total lectures in test syllabus for this subject
  done: number; // completed lectures
  pct: number; // 0-100
  missingHighWeightage: { chapterId: string; chapterName: string; weightage: number }[];
}

export interface TestReadinessResult {
  overallPct: number; // weighted by subject coverage
  subjects: SubjectReadiness[];
  totalLectures: number;
  doneLectures: number;
  /**
   * Top untested high-weightage chapters across all subjects in the test.
   * Sorted by weightage descending. Used for the "Add missing as targets" CTA.
   * Returns chapter IDs from the NEET syllabus catalog (NOT user syllabus IDs)
   * so the caller can resolve them to either catalog or user-syllabus chapters.
   */
  criticalGaps: { neetChapterId: string; chapterName: string; subject: Subject; weightage: number }[];
}

/**
 * Compute readiness for a test based on its syllabus coverage.
 *
 * Strategy:
 * 1. If the test has explicit `syllabus.chapterIds`, use those (matched against
 *    user's syllabus chapters by name → resolve to lectures).
 * 2. If the test is "Full Syllabus" type with no syllabus set, fall back to all
 *    NEET chapters across all 4 subjects.
 * 3. For each subject, count done lectures / total lectures in the test's scope.
 * 4. Surface missing high-weightage chapters as "criticalGaps".
 */
export function computeTestReadiness(
  test: Test,
  userChapters: Chapter[],
  userLectures: Lecture[],
  userSubjects: SubjectEntity[],
): TestReadinessResult {
  // Determine the test's NEET chapter scope
  let neetChapterIds: string[] = [];

  if (test.syllabus?.chapterIds && test.syllabus.chapterIds.length > 0) {
    // User picked chapters — these are user-syllabus chapter IDs, so we need
    // to resolve them back to NEET catalog IDs by name.
    const userChaptersInTest = userChapters.filter((c) => test.syllabus!.chapterIds.includes(c.id));
    // Build a name → neetChapterId map across all subjects
    const allNeetChapters: NEETChapter[] = [];
    for (const subj of ['Physics', 'Chemistry', 'Botany', 'Zoology'] as Subject[]) {
      allNeetChapters.push(...getChaptersForSubject(subj));
    }
    const nameToNeetId = new Map(allNeetChapters.map((c) => [c.name, c.id]));
    neetChapterIds = userChaptersInTest
      .map((c) => nameToNeetId.get(c.name))
      .filter((x): x is string => !!x);
  } else if (test.type === 'Full Syllabus') {
    // Default: all NEET chapters across 4 subjects
    neetChapterIds = [];
    for (const subj of ['Physics', 'Chemistry', 'Botany', 'Zoology'] as Subject[]) {
      neetChapterIds.push(...getChaptersForSubject(subj).map((c) => c.id));
    }
  }

  // Build per-subject readiness
  const subjects: SubjectReadiness[] = [];
  let totalLectures = 0;
  let doneLectures = 0;

  for (const subj of ['Physics', 'Chemistry', 'Botany', 'Zoology'] as Subject[]) {
    const neetChaptersForSubject = getChaptersForSubject(subj);
    const relevantNeetChapters = neetChaptersForSubject.filter((c) =>
      neetChapterIds.length === 0 || neetChapterIds.includes(c.id),
    );

    if (relevantNeetChapters.length === 0) continue;

    // Find matching user chapters by name
    const subjectEntity = userSubjects.find((s) => s.name === subj);
    if (!subjectEntity) {
      // Subject not in user's syllabus — show 0% but list as gap
      subjects.push({
        subject: subj,
        total: relevantNeetChapters.reduce((a, c) => a + c.lectures.length, 0),
        done: 0,
        pct: 0,
        missingHighWeightage: relevantNeetChapters
          .filter((c) => (c.weightage ?? 4) >= 6)
          .sort((a, b) => (b.weightage ?? 4) - (a.weightage ?? 4))
          .slice(0, 3)
          .map((c) => ({ chapterId: c.id, chapterName: c.name, weightage: c.weightage ?? 4 })),
      });
      totalLectures += relevantNeetChapters.reduce((a, c) => a + c.lectures.length, 0);
      continue;
    }

    const userChaptersForSubject = userChapters.filter((c) => c.subjectId === subjectEntity.id);
    let subjTotal = 0;
    let subjDone = 0;
    const missingHighWeightage: SubjectReadiness['missingHighWeightage'] = [];

    for (const neetCh of relevantNeetChapters) {
      const userCh = userChaptersForSubject.find((uc) => uc.name === neetCh.name);
      const lectureCount = neetCh.lectures.length;
      subjTotal += lectureCount;
      if (userCh) {
        const userLecs = userLectures.filter((l) => l.chapterId === userCh.id);
        subjDone += userLecs.filter((l) => l.done).length;
        // If chapter has high weightage AND less than 50% done → flag as gap
        const chDone = userLecs.filter((l) => l.done).length;
        if ((neetCh.weightage ?? 4) >= 6 && chDone < lectureCount / 2) {
          missingHighWeightage.push({
            chapterId: neetCh.id,
            chapterName: neetCh.name,
            weightage: neetCh.weightage ?? 4,
          });
        }
      } else {
        // Chapter not even added to user syllabus → all lectures missing
        if ((neetCh.weightage ?? 4) >= 6) {
          missingHighWeightage.push({
            chapterId: neetCh.id,
            chapterName: neetCh.name,
            weightage: neetCh.weightage ?? 4,
          });
        }
      }
    }

    subjects.push({
      subject: subj,
      total: subjTotal,
      done: subjDone,
      pct: subjTotal > 0 ? Math.round((subjDone / subjTotal) * 100) : 0,
      missingHighWeightage: missingHighWeightage
        .sort((a, b) => b.weightage - a.weightage)
        .slice(0, 3),
    });
    totalLectures += subjTotal;
    doneLectures += subjDone;
  }

  // Overall: weighted by total lectures per subject (so a subject with 50 lectures
  // counts more than one with 10)
  const overallPct = totalLectures > 0 ? Math.round((doneLectures / totalLectures) * 100) : 0;

  // Critical gaps: top untested high-weightage chapters across subjects
  const criticalGaps: TestReadinessResult['criticalGaps'] = [];
  for (const sr of subjects) {
    for (const mh of sr.missingHighWeightage) {
      criticalGaps.push({
        neetChapterId: mh.chapterId,
        chapterName: mh.chapterName,
        subject: sr.subject,
        weightage: mh.weightage,
      });
    }
  }
  criticalGaps.sort((a, b) => b.weightage - a.weightage);

  return {
    overallPct,
    subjects,
    totalLectures,
    doneLectures,
    criticalGaps: criticalGaps.slice(0, 8),
  };
}

// ===== Behavior Pattern Detection =====

export interface BehaviorInsight {
  id: string;
  type: 'positive' | 'warning' | 'neutral';
  title: string;
  detail: string;
  emoji: string;
}

/**
 * Detect cross-test behavior patterns. Needs at least 3 past tests with results
 * to produce meaningful insights. Returns insights sorted by impact.
 */
export function detectBehaviorPatterns(tests: Test[]): BehaviorInsight[] {
  const past = tests
    .filter((t) => t.totalMarks !== undefined && t.takenAt)
    .sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
  if (past.length < 3) {
    if (past.length > 0) {
      return [{
        id: 'need-more',
        type: 'neutral',
        title: 'More data needed',
        detail: `Take ${3 - past.length} more test${3 - past.length === 1 ? '' : 's'} to unlock behavior insights.`,
        emoji: '📊',
      }];
    }
    return [];
  }

  const insights: BehaviorInsight[] = [];

  // === Time-of-day effect ===
  // Bucket tests by hour started: morning (5-11), afternoon (12-16), evening (17-21), night (22-4)
  const buckets: Record<string, { tests: Test[]; label: string }> = {
    morning: { tests: [], label: 'Morning (5-11 AM)' },
    afternoon: { tests: [], label: 'Afternoon (12-4 PM)' },
    evening: { tests: [], label: 'Evening (5-9 PM)' },
    night: { tests: [], label: 'Night (10 PM-4 AM)' },
  };
  for (const t of past) {
    const hour = new Date(t.takenAt!).getHours();
    if (hour >= 5 && hour <= 11) buckets.morning.tests.push(t);
    else if (hour >= 12 && hour <= 16) buckets.afternoon.tests.push(t);
    else if (hour >= 17 && hour <= 21) buckets.evening.tests.push(t);
    else buckets.night.tests.push(t);
  }
  // Find best & worst buckets (need at least 2 tests each for significance)
  const validBuckets = Object.entries(buckets).filter(([, b]) => b.tests.length >= 2);
  if (validBuckets.length >= 2) {
    const avgMarks = (tests: Test[]) =>
      tests.reduce((a, t) => a + (t.totalMarks ?? 0), 0) / tests.length;
    const sorted = validBuckets
      .map(([key, b]) => ({ key, label: b.label, avg: avgMarks(b.tests), count: b.tests.length }))
      .sort((a, b) => b.avg - a.avg);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const delta = Math.round(best.avg - worst.avg);
    if (delta >= 30) {
      insights.push({
        id: 'time-of-day',
        type: delta >= 60 ? 'warning' : 'neutral',
        title: `You score ${delta} marks higher in ${best.label.toLowerCase()}`,
        detail: `Avg ${Math.round(best.avg)} in ${best.label} vs ${Math.round(worst.avg)} in ${worst.label}. Consider scheduling tests in your best window.`,
        emoji: '⏰',
      });
    }
  }

  // === Improvement / decline trend ===
  // Compare last 3 tests vs the 3 before that
  if (past.length >= 6) {
    const recent = past.slice(-3);
    const prior = past.slice(-6, -3);
    const avgRecent = recent.reduce((a, t) => a + (t.totalMarks ?? 0), 0) / 3;
    const avgPrior = prior.reduce((a, t) => a + (t.totalMarks ?? 0), 0) / 3;
    const trendDelta = Math.round(avgRecent - avgPrior);
    if (Math.abs(trendDelta) >= 20) {
      insights.push({
        id: 'trend',
        type: trendDelta > 0 ? 'positive' : 'warning',
        title: trendDelta > 0
          ? `On fire! +${trendDelta} marks vs previous 3 tests`
          : `Slipping: ${trendDelta} marks vs previous 3 tests`,
        detail: trendDelta > 0
          ? `Recent avg ${Math.round(avgRecent)} vs prior ${Math.round(avgPrior)}. Keep doing what you're doing.`
          : `Recent avg ${Math.round(avgRecent)} vs prior ${Math.round(avgPrior)}. Review weak topics from recent tests.`,
        emoji: trendDelta > 0 ? '🔥' : '📉',
      });
    }
  }

  // === Consistency (std deviation) ===
  if (past.length >= 4) {
    const marks = past.map((t) => t.totalMarks ?? 0);
    const mean = marks.reduce((a, b) => a + b, 0) / marks.length;
    const variance = marks.reduce((a, m) => a + (m - mean) ** 2, 0) / marks.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev >= 50) {
      insights.push({
        id: 'consistency',
        type: 'warning',
        title: `Inconsistent: ±${Math.round(stdDev)} marks swing`,
        detail: `Your scores vary widely (avg ${Math.round(mean)}). Focus on stabilizing easy-question accuracy first.`,
        emoji: '🎢',
      });
    } else if (stdDev < 20 && mean >= 400) {
      insights.push({
        id: 'consistency-good',
        type: 'positive',
        title: `Very consistent: ±${Math.round(stdDev)} marks`,
        detail: `Avg ${Math.round(mean)} with low variance. Now push the ceiling by attempting harder questions.`,
        emoji: '🎯',
      });
    }
  }

  // === Silly mistakes trend (if analytics available) ===
  const withAnalytics = past.filter((t) => t.hasAnalytics && t.analytics);
  if (withAnalytics.length >= 3) {
    const recent3 = withAnalytics.slice(-3);
    const prior3 = withAnalytics.slice(-6, -3);
    if (prior3.length >= 1) {
      const sillyRecent = recent3.reduce((a, t) => {
        const sm = Object.values(t.analytics!).reduce((x, s) => x + s.sillyMistakes, 0);
        return a + sm;
      }, 0) / recent3.length;
      const sillyPrior = prior3.reduce((a, t) => {
        const sm = Object.values(t.analytics!).reduce((x, s) => x + s.sillyMistakes, 0);
        return a + sm;
      }, 0) / prior3.length;
      const delta = Math.round(sillyRecent - sillyPrior);
      if (Math.abs(delta) >= 3) {
        insights.push({
          id: 'silly-trend',
          type: delta < 0 ? 'positive' : 'warning',
          title: delta < 0
            ? `Silly mistakes down ${Math.abs(delta)} per test`
            : `Silly mistakes up ${delta} per test`,
          detail: delta < 0
            ? 'Your accuracy discipline is improving. Keep the calm-test mindset.'
            : 'Slow down on easy questions. Read each one twice before answering.',
          emoji: delta < 0 ? '✨' : '⚠️',
        });
      }
    }
  }

  // === Subject imbalance (if subjectMarks available) ===
  const withSubjects = past.filter((t) => t.subjectMarks);
  if (withSubjects.length >= 3) {
    const subjAvgs: Record<Subject, number> = {} as any;
    for (const subj of ['Physics', 'Chemistry', 'Botany', 'Zoology'] as Subject[]) {
      const vals = withSubjects
        .map((t) => t.subjectMarks?.[subj])
        .filter((v): v is number => typeof v === 'number');
      if (vals.length >= 2) {
        subjAvgs[subj] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
    }
    const entries = Object.entries(subjAvgs) as [Subject, number][];
    if (entries.length >= 3) {
      entries.sort((a, b) => a[1] - b[1]);
      const weakest = entries[0];
      const strongest = entries[entries.length - 1];
      const gap = Math.round(strongest[1] - weakest[1]);
      if (gap >= 30) {
        insights.push({
          id: 'subject-imbalance',
          type: 'warning',
          title: `${weakest[0]} is ${gap} marks behind ${strongest[0]}`,
          detail: `Avg ${Math.round(weakest[1])} in ${weakest[0]} vs ${Math.round(strongest[1])} in ${strongest[0]}. Allocate one extra hour daily to ${weakest[0]}.`,
          emoji: '⚖️',
        });
      }
    }
  }

  return insights.sort((a, b) => {
    const order = { warning: 0, positive: 1, neutral: 2 };
    return order[a.type] - order[b.type];
  });
}

// ===== Test Streak Badges =====

export interface TestBadge {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export function computeTestBadges(tests: Test[]): TestBadge[] {
  const past = tests
    .filter((t) => t.totalMarks !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Improvement streak: each consecutive test (most-recent first) scored higher than previous
  let improveStreak = 0;
  for (let i = past.length - 1; i > 0; i--) {
    if ((past[i].totalMarks ?? 0) > (past[i - 1].totalMarks ?? 0)) improveStreak++;
    else break;
  }

  // Tests taken
  const totalTests = past.length;

  // First 600+
  const has600 = past.some((t) => (t.totalMarks ?? 0) >= 600);

  // First 650+
  const has650 = past.some((t) => (t.totalMarks ?? 0) >= 650);

  // First 700+
  const has700 = past.some((t) => (t.totalMarks ?? 0) >= 700);

  // Zero silly mistakes (in tests with analytics)
  const zeroSilly = tests.filter(
    (t) => t.hasAnalytics && t.analytics &&
      Object.values(t.analytics).reduce((a, s) => a + s.sillyMistakes, 0) === 0,
  );

  // 100% attempt rate
  const fullAttempt = tests.filter(
    (t) => t.hasAnalytics && t.analytics &&
      Object.values(t.analytics).reduce((a, s) => a + s.attempted, 0) === 180,
  );

  // 5 tests in a row with improving score
  const fiveImprove = improveStreak >= 5;

  // 10+ tests taken
  const tenTests = totalTests >= 10;

  return [
    {
      id: 'first-test',
      label: 'First Test',
      description: 'Take your first mock test',
      emoji: '🎯',
      unlocked: totalTests >= 1,
      progress: { current: Math.min(totalTests, 1), target: 1 },
    },
    {
      id: 'five-tests',
      label: 'Getting Serious',
      description: 'Take 5 mock tests',
      emoji: '📚',
      unlocked: totalTests >= 5,
      progress: { current: Math.min(totalTests, 5), target: 5 },
    },
    {
      id: 'ten-tests',
      label: 'Test Veteran',
      description: 'Take 10 mock tests',
      emoji: '🏆',
      unlocked: tenTests,
      progress: { current: Math.min(totalTests, 10), target: 10 },
    },
    {
      id: 'first-600',
      label: '600 Club',
      description: 'Score 600+ in a single test',
      emoji: '💎',
      unlocked: has600,
    },
    {
      id: 'first-650',
      label: '650 Elite',
      description: 'Score 650+ in a single test',
      emoji: '👑',
      unlocked: has650,
    },
    {
      id: 'first-700',
      label: '700 Legend',
      description: 'Score 700+ in a single test',
      emoji: '🚀',
      unlocked: has700,
    },
    {
      id: 'improve-3',
      label: 'Climbing',
      description: 'Improve score 3 tests in a row',
      emoji: '📈',
      unlocked: improveStreak >= 3,
      progress: { current: Math.min(improveStreak, 3), target: 3 },
    },
    {
      id: 'improve-5',
      label: 'Momentum Master',
      description: 'Improve score 5 tests in a row',
      emoji: '🔥',
      unlocked: fiveImprove,
      progress: { current: Math.min(improveStreak, 5), target: 5 },
    },
    {
      id: 'zero-silly',
      label: 'No Silly Mistakes',
      description: 'A test with zero silly mistakes',
      emoji: '🧠',
      unlocked: zeroSilly.length > 0,
    },
    {
      id: 'full-attempt',
      label: 'Full Attempt',
      description: 'Attempt all 180 questions in a test',
      emoji: '⚡',
      unlocked: fullAttempt.length > 0,
    },
  ];
}

// ===== Test Type Leaderboard (self) =====

export interface TestTypeLeader {
  type: TestType;
  bestScore: number;
  bestTestName: string;
  bestTestId: string;
  avgScore: number;
  count: number;
  latestScore: number;
  trend: 'up' | 'down' | 'flat';
}

import type { TestType } from '@/lib/types';

export function computeTestLeaderboard(tests: Test[]): TestTypeLeader[] {
  const types: TestType[] = ['Part Test', 'Full Syllabus', 'Rank Booster', 'AITS'];
  const leaders: TestTypeLeader[] = [];

  for (const type of types) {
    const typed = tests
      .filter((t) => t.type === type && t.totalMarks !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (typed.length === 0) continue;

    const scores = typed.map((t) => t.totalMarks!);
    const best = Math.max(...scores);
    const bestIdx = scores.indexOf(best);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const latest = scores[scores.length - 1];
    const prev = scores.length >= 2 ? scores[scores.length - 2] : latest;
    const trend: 'up' | 'down' | 'flat' =
      latest - prev > 10 ? 'up' : latest - prev < -10 ? 'down' : 'flat';

    leaders.push({
      type,
      bestScore: best,
      bestTestName: typed[bestIdx].name,
      bestTestId: typed[bestIdx].id,
      avgScore: Math.round(avg),
      count: typed.length,
      latestScore: latest,
      trend,
    });
  }

  return leaders.sort((a, b) => b.bestScore - a.bestScore);
}

// ===== Test Day Detection =====

/**
 * Check if there's a test today. Returns the test (if any) and how many hours
 * until it typically starts. NEET mock tests usually run 2-5 PM, so we use 2 PM
 * as the default "test start" reference for the day-of countdown.
 */
export function getTestToday(tests: Test[]): { test: Test; hoursUntilStart: number; hasStarted: boolean } | null {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todaysTests = tests.filter((t) => t.date === todayKey);
  if (todaysTests.length === 0) return null;
  // Pick the soonest today (or first if multiple)
  const test = todaysTests[0];

  // Reference start time: 14:00 (2 PM) — typical NEET mock start
  const startRef = new Date(today);
  startRef.setHours(14, 0, 0, 0);
  const diffMs = startRef.getTime() - today.getTime();
  const hoursUntilStart = Math.round((diffMs / 3600000) * 10) / 10;
  const hasStarted = diffMs < 0;

  return { test, hoursUntilStart, hasStarted };
}
