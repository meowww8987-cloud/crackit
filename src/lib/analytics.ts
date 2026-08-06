// Pure analytics functions — no React, no store dependencies
// All functions take sessions array + optional params and return chart-ready data

import type { SavedSession, Subject, Mood } from './types';
import { SUBJECTS, subjectColor } from './colors';
import { dateKey, addDays, todayKey } from './utils';

// ===== Weekly bar chart (last 7 days) =====
export function weeklyBarData(sessions: SavedSession[]): { date: string; label: string; study: number; wasted: number }[] {
  const result: { date: string; label: string; study: number; wasted: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    const daySessions = sessions.filter((s) => s.date === key);
    const study = daySessions.reduce((a, s) => a + s.studySeconds, 0);
    const wasted = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
    result.push({
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      study: Math.round(study / 60), // minutes
      wasted: Math.round(wasted / 60),
    });
  }
  return result;
}

// ===== Subject distribution donut =====
export function subjectDistribution(sessions: SavedSession[]): { name: Subject; value: number; color: string }[] {
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    totals[s.subject] = (totals[s.subject] || 0) + s.studySeconds;
  }
  return SUBJECTS.map((subj) => ({
    name: subj,
    value: Math.round((totals[subj] || 0) / 60), // minutes
    color: subjectColor(subj).hex,
  })).filter((d) => d.value > 0);
}

// ===== 30-day trend line =====
export function trendData(sessions: SavedSession[], days: number = 30): { date: string; label: string; minutes: number }[] {
  const result: { date: string; label: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    const study = sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0);
    result.push({
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: Math.round(study / 60),
    });
  }
  return result;
}

// ===== Mood distribution =====
export function moodDistribution(sessions: SavedSession[]): { name: string; value: number; color: string; emoji: string }[] {
  const moods: { key: Mood | 'none'; name: string; color: string; emoji: string }[] = [
    { key: 'confident', name: 'Confident', color: '#22c55e', emoji: '😊' },
    { key: 'okay', name: 'Okay', color: '#14b8a6', emoji: '🙂' },
    { key: 'struggling', name: 'Struggling', color: '#f59e0b', emoji: '😰' },
    { key: 'tired', name: 'Tired', color: '#6b7280', emoji: '😴' },
    { key: 'none', name: 'No mood', color: '#475569', emoji: '·' },
  ];
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    const key = s.mood || 'none';
    totals[key] = (totals[key] || 0) + 1;
  }
  return moods
    .map((m) => ({ name: m.name, value: totals[m.key] || 0, color: m.color, emoji: m.emoji }))
    .filter((d) => d.value > 0);
}

// ===== Wasted time ratio (gauge) =====
export function wastedRatio(sessions: SavedSession[]): { studyMin: number; wastedMin: number; ratio: number } {
  const studyMin = Math.round(sessions.reduce((a, s) => a + s.studySeconds, 0) / 60);
  const wastedMin = Math.round(sessions.reduce((a, s) => a + s.wastedSeconds, 0) / 60);
  const total = studyMin + wastedMin;
  const ratio = total > 0 ? Math.round((wastedMin / total) * 100) : 0;
  return { studyMin, wastedMin, ratio };
}

// ===== Best study hour (24-hour bar) =====
export function bestHourData(sessions: SavedSession[]): { hour: string; minutes: number }[] {
  const buckets: number[] = new Array(24).fill(0);
  for (const s of sessions) {
    const startHour = new Date(s.startedAt).getHours();
    buckets[startHour] += s.studySeconds;
  }
  return buckets.map((sec, hour) => ({
    hour: `${hour}:00`,
    minutes: Math.round(sec / 60),
  }));
}

// ===== Weekly comparison (this week vs last week) =====
export function weeklyComparison(sessions: SavedSession[]): {
  thisWeekStudy: number;
  thisWeekWasted: number;
  lastWeekStudy: number;
  lastWeekWasted: number;
  studyTrend: number;
  wastedTrend: number;
} {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;

  const thisWeekSessions = sessions.filter((s) => s.endedAt >= weekAgo);
  const lastWeekSessions = sessions.filter((s) => s.endedAt >= twoWeeksAgo && s.endedAt < weekAgo);

  const thisWeekStudy = Math.round(thisWeekSessions.reduce((a, s) => a + s.studySeconds, 0) / 60);
  const thisWeekWasted = Math.round(thisWeekSessions.reduce((a, s) => a + s.wastedSeconds, 0) / 60);
  const lastWeekStudy = Math.round(lastWeekSessions.reduce((a, s) => a + s.studySeconds, 0) / 60);
  const lastWeekWasted = Math.round(lastWeekSessions.reduce((a, s) => a + s.wastedSeconds, 0) / 60);

  const studyTrend = lastWeekStudy > 0 ? Math.round(((thisWeekStudy - lastWeekStudy) / lastWeekStudy) * 100) : thisWeekStudy > 0 ? 100 : 0;
  const wastedTrend = lastWeekWasted > 0 ? Math.round(((thisWeekWasted - lastWeekWasted) / lastWeekWasted) * 100) : thisWeekWasted > 0 ? 100 : 0;

  return { thisWeekStudy, thisWeekWasted, lastWeekStudy, lastWeekWasted, studyTrend, wastedTrend };
}

// ===== Neglected subjects (<5% of total study time) =====
export function neglectedSubjects(sessions: SavedSession[]): { subject: Subject; minutes: number; pct: number }[] {
  const totals: Record<string, number> = {};
  let grandTotal = 0;
  for (const s of sessions) {
    totals[s.subject] = (totals[s.subject] || 0) + s.studySeconds;
    grandTotal += s.studySeconds;
  }
  if (grandTotal === 0) return [];
  const result = SUBJECTS.map((subj) => {
    const sec = totals[subj] || 0;
    const pct = Math.round((sec / grandTotal) * 100);
    return { subject: subj, minutes: Math.round(sec / 60), pct };
  });
  // Neglected = <5% OR zero
  return result.filter((r) => r.pct < 5);
}

// ===== Day-of-week pattern (which weekday user studies which subject) =====
export function weekdaySubjectPattern(sessions: SavedSession[]): Record<number, Record<Subject, number>> {
  // Returns: { 0: { Physics: 120, ... }, ... } (weekday -> subject -> minutes)
  const pattern: Record<number, Record<Subject, number>> = {};
  for (let i = 0; i < 7; i++) {
    pattern[i] = {} as Record<Subject, number>;
    for (const subj of SUBJECTS) pattern[i][subj] = 0;
  }
  for (const s of sessions) {
    const wd = new Date(s.startedAt).getDay();
    pattern[wd][s.subject] += s.studySeconds;
  }
  // Convert to minutes
  for (const wd of Object.keys(pattern)) {
    for (const subj of SUBJECTS) {
      pattern[Number(wd)][subj] = Math.round(pattern[Number(wd)][subj] / 60);
    }
  }
  return pattern;
}
