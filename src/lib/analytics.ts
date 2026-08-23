// Pure analytics functions — no React, no store dependencies
// All functions take sessions array + optional params and return chart-ready data

import type { SavedSession, Subject, Mood } from './types';
import { SUBJECTS, subjectColor } from './colors';
import { dateKey, addDays, todayKey } from './utils';

// ===== Weekly bar chart (last 7 days, with optional week offset) =====
export function weeklyBarData(sessions: SavedSession[], weekOffset = 0): { date: string; label: string; study: number; wasted: number }[] {
  const result: { date: string; label: string; study: number; wasted: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -(i + weekOffset * 7));
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

// ===== Week Story v2 — rich per-day data for the redesigned weekly card =====

export interface WeekDaySubject {
  name: Subject;
  minutes: number;
  color: string;
}

export interface WeekDayData {
  date: string; // YYYY-MM-DD
  dayLetter: string; // "M", "T", "W"...
  dateNum: number; // 12, 13, 14...
  studyMinutes: number;
  wastedMinutes: number;
  sessionCount: number;
  subjects: WeekDaySubject[];
  isToday: boolean;
  hitGoal: boolean;
  /** 0-4 intensity for tile color (0=none, 4=high) */
  intensity: number;
}

export interface WeekStoryData {
  days: WeekDayData[]; // 7 entries (oldest → newest)
  totalStudyMin: number;
  totalWastedMin: number;
  dailyGoalMin: number;
  weeklyGoalMin: number;
  goalPct: number; // totalStudyMin / weeklyGoalMin * 100
  daysActive: number; // days with study > 0
  daysHitGoal: number;
  dailyAvgMin: number;
  bestDay: WeekDayData | null;
  worstDay: WeekDayData | null; // worst among active days
  trendPct: number; // vs previous week (positive = improvement)
  weekOffset: number;
  weekLabel: string; // "This Week" / "1 Week Ago" / etc.
}

export function weekStoryData(
  sessions: SavedSession[],
  weekOffset: number,
  dailyGoalHours: number
): WeekStoryData {
  const today = todayKey();
  const dailyGoalMin = Math.round(dailyGoalHours * 60);
  const weeklyGoalMin = dailyGoalMin * 7;

  const days: WeekDayData[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -(i + weekOffset * 7));
    const key = dateKey(d);
    const daySessions = sessions.filter((s) => s.date === key);
    const studySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
    const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
    const studyMin = Math.round(studySec / 60);
    const wastedMin = Math.round(wastedSec / 60);

    // Per-day subject breakdown
    const subjMap: Record<string, number> = {};
    for (const s of daySessions) {
      subjMap[s.subject] = (subjMap[s.subject] || 0) + s.studySeconds;
    }
    const subjects: WeekDaySubject[] = SUBJECTS
      .map((subj) => ({
        name: subj,
        minutes: Math.round((subjMap[subj] || 0) / 60),
        color: subjectColor(subj).hex,
      }))
      .filter((s) => s.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    const hours = studySec / 3600;
    const intensity = hours >= 7 ? 4 : hours >= 4 ? 3 : hours >= 2 ? 2 : hours > 0 ? 1 : 0;

    days.push({
      date: key,
      dayLetter: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dateNum: d.getDate(),
      studyMinutes: studyMin,
      wastedMinutes: wastedMin,
      sessionCount: daySessions.length,
      subjects,
      isToday: key === today,
      hitGoal: studyMin >= dailyGoalMin,
      intensity,
    });
  }

  const totalStudyMin = days.reduce((a, d) => a + d.studyMinutes, 0);
  const totalWastedMin = days.reduce((a, d) => a + d.wastedMinutes, 0);
  const daysActive = days.filter((d) => d.studyMinutes > 0).length;
  const daysHitGoal = days.filter((d) => d.hitGoal).length;
  const dailyAvgMin = daysActive > 0 ? Math.round(totalStudyMin / 7) : 0;
  const goalPct = weeklyGoalMin > 0 ? Math.round((totalStudyMin / weeklyGoalMin) * 100) : 0;

  const activeDays = days.filter((d) => d.studyMinutes > 0);
  const bestDay = activeDays.length > 0
    ? activeDays.reduce((max, d) => (d.studyMinutes > max.studyMinutes ? d : max))
    : null;
  const worstDay = activeDays.length > 0
    ? activeDays.reduce((min, d) => (d.studyMinutes < min.studyMinutes ? d : min))
    : null;

  // Trend: compare this week's total to previous week's total
  let prevWeekMin = 0;
  for (let i = 13; i >= 7; i--) {
    const d = addDays(new Date(), -(i + weekOffset * 7));
    const key = dateKey(d);
    prevWeekMin += Math.round(sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0) / 60);
  }
  const trendPct = prevWeekMin > 0
    ? Math.round(((totalStudyMin - prevWeekMin) / prevWeekMin) * 100)
    : totalStudyMin > 0 ? 100 : 0;

  let weekLabel: string;
  if (weekOffset === 0) weekLabel = 'This Week';
  else if (weekOffset === 1) weekLabel = 'Last Week';
  else weekLabel = `${weekOffset} Weeks Ago`;

  return {
    days,
    totalStudyMin,
    totalWastedMin,
    dailyGoalMin,
    weeklyGoalMin,
    goalPct,
    daysActive,
    daysHitGoal,
    dailyAvgMin,
    bestDay,
    worstDay,
    trendPct,
    weekOffset,
    weekLabel,
  };
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

// ===== Subject Breakdown v2 — per-subject weekly detail with per-day + chapters =====

export interface SubjectWeekDay {
  date: string; // YYYY-MM-DD
  dayName: string; // "Mon", "Tue"
  dateNum: number;
  studySec: number;
  wastedSec: number;
  sessionCount: number;
  isToday: boolean;
}

export interface SubjectChapterStat {
  chapter: string;
  studySec: number;
  pct: number; // % of subject total
}

export interface SubjectDetail {
  subject: Subject;
  color: string;
  totalStudySec: number;
  totalWastedSec: number;
  sessionCount: number;
  daysActive: number; // unique days studied this subject
  avgPerSessionSec: number;
  pctOfWeek: number; // % of total weekly study time
  days: SubjectWeekDay[]; // 7 entries
  topChapters: SubjectChapterStat[];
  isBest: boolean; // highest totalStudySec this week
  isNeglected: boolean; // <5% of week
}

export interface SubjectBreakdownData {
  subjects: SubjectDetail[]; // sorted by totalStudySec desc
  totalStudySec: number; // grand total across all subjects this week
  totalWastedSec: number;
  weekAgo: number;
}

export function subjectBreakdownData(sessions: SavedSession[]): SubjectBreakdownData {
  const weekAgo = Date.now() - 7 * 86400000;
  const today = todayKey();

  // Filter sessions from last 7 days
  const weekSessions = sessions.filter((s) => s.endedAt >= weekAgo);

  const subjects: SubjectDetail[] = SUBJECTS.map((subj) => {
    const subjSessions = weekSessions.filter((s) => s.subject === subj);
    const totalStudySec = subjSessions.reduce((a, s) => a + s.studySeconds, 0);
    const totalWastedSec = subjSessions.reduce((a, s) => a + s.wastedSeconds, 0);
    const sessionCount = subjSessions.length;
    const avgPerSessionSec = sessionCount > 0 ? Math.round(totalStudySec / sessionCount) : 0;

    // 7-day breakdown
    const days: SubjectWeekDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const daySessions = subjSessions.filter((s) => s.date === key);
      days.push({
        date: key,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateNum: d.getDate(),
        studySec: daySessions.reduce((a, s) => a + s.studySeconds, 0),
        wastedSec: daySessions.reduce((a, s) => a + s.wastedSeconds, 0),
        sessionCount: daySessions.length,
        isToday: key === today,
      });
    }

    const daysActive = days.filter((d) => d.studySec > 0).length;

    // Top chapters
    const chapterMap: Record<string, number> = {};
    for (const s of subjSessions) {
      const ch = s.chapter || 'Unknown';
      chapterMap[ch] = (chapterMap[ch] || 0) + s.studySeconds;
    }
    const topChapters: SubjectChapterStat[] = Object.entries(chapterMap)
      .map(([chapter, sec]) => ({
        chapter,
        studySec: sec,
        pct: totalStudySec > 0 ? Math.round((sec / totalStudySec) * 100) : 0,
      }))
      .sort((a, b) => b.studySec - a.studySec)
      .slice(0, 5);

    return {
      subject: subj,
      color: subjectColor(subj).hex,
      totalStudySec,
      totalWastedSec,
      sessionCount,
      daysActive,
      avgPerSessionSec,
      pctOfWeek: 0, // filled after we know grand total
      days,
      topChapters,
      isBest: false,
      isNeglected: false,
    };
  });

  const totalStudySec = subjects.reduce((a, s) => a + s.totalStudySec, 0);
  const totalWastedSec = subjects.reduce((a, s) => a + s.totalWastedSec, 0);

  // Fill in pctOfWeek, isBest, isNeglected
  const subjectsWithStudy = subjects.filter((s) => s.totalStudySec > 0);
  const bestSubject = subjectsWithStudy.length > 0
    ? subjectsWithStudy.reduce((max, s) => (s.totalStudySec > max.totalStudySec ? s : max))
    : null;

  for (const s of subjects) {
    s.pctOfWeek = totalStudySec > 0 ? Math.round((s.totalStudySec / totalStudySec) * 100) : 0;
    s.isBest = bestSubject?.subject === s.subject;
    s.isNeglected = s.pctOfWeek < 5 && s.pctOfWeek > 0;
  }

  // Sort: studied subjects first (by totalStudySec desc), then unused
  const sorted = subjects.sort((a, b) => b.totalStudySec - a.totalStudySec);

  return { subjects: sorted, totalStudySec, totalWastedSec, weekAgo };
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

// ===== Month Summary — stats header for the Heatmap Calendar (Month tab) =====
// Merges Month Story's stats (total, trend, streak, goal, days, best, avg)
// into the Heatmap Calendar so there's ONE unified Month view.

export interface MonthSummary {
  totalStudySec: number;
  totalWastedSec: number;
  dailyGoalSec: number;
  monthlyGoalSec: number;
  goalPct: number;
  daysStudied: number;
  daysInMonth: number;
  currentStreak: number;
  bestDaySec: number;
  dailyAvgSec: number;
  trendPct: number; // vs same point last month
  monthLabel: string; // "August 2026"
}

export function monthSummary(sessions: SavedSession[], dailyGoalHours: number): MonthSummary {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKeyStr = todayKey();
  const dailyGoalSec = Math.round(dailyGoalHours * 3600);
  const monthlyGoalSec = dailyGoalSec * daysInMonth;

  let totalStudySec = 0;
  let totalWastedSec = 0;
  let daysStudied = 0;
  let bestDaySec = 0;

  for (let d = 1; d <= today; d++) {
    const date = new Date(year, month, d);
    const key = dateKey(date);
    const daySessions = sessions.filter((s) => s.date === key);
    const study = daySessions.reduce((a, s) => a + s.studySeconds, 0);
    const wasted = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
    totalStudySec += study;
    totalWastedSec += wasted;
    if (study > 0) daysStudied++;
    if (study > bestDaySec) bestDaySec = study;
  }

  // Current streak (consecutive days ending today)
  let currentStreak = 0;
  for (let d = today; d >= 1; d--) {
    const date = new Date(year, month, d);
    const key = dateKey(date);
    const study = sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0);
    if (study > 0) currentStreak++;
    else break;
  }

  const goalPct = monthlyGoalSec > 0 ? Math.round((totalStudySec / monthlyGoalSec) * 100) : 0;
  const dailyAvgSec = today > 0 ? Math.round(totalStudySec / today) : 0;

  // Trend: compare to same-day-last-month total
  const lastMonth = new Date(year, month - 1, 1);
  const lastMonthYear = lastMonth.getFullYear();
  const lastMonthMonth = lastMonth.getMonth();
  let prevStudySec = 0;
  for (let d = 1; d <= today; d++) {
    const date = new Date(lastMonthYear, lastMonthMonth, d);
    const key = dateKey(date);
    prevStudySec += sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0);
  }
  const trendPct = prevStudySec > 0
    ? Math.round(((totalStudySec - prevStudySec) / prevStudySec) * 100)
    : totalStudySec > 0 ? 100 : 0;

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return {
    totalStudySec,
    totalWastedSec,
    dailyGoalSec,
    monthlyGoalSec,
    goalPct,
    daysStudied,
    daysInMonth,
    currentStreak,
    bestDaySec,
    dailyAvgSec,
    trendPct,
    monthLabel,
  };
}

// ===== Month Story v2 — 30-day tiles + streak + weekly groups =====

export interface MonthDayData {
  date: string; // YYYY-MM-DD
  dayNum: number;
  studySec: number;
  wastedSec: number;
  sessionCount: number;
  isToday: boolean;
  hasStudy: boolean;
  /** 0-4 intensity for tile color */
  intensity: number;
}

export interface MonthWeekData {
  weekNum: number; // 1-5
  label: string; // "Week 1" / "Week 2"...
  dateRange: string; // "Jul 28 - Aug 3"
  days: MonthDayData[]; // 7 entries (or fewer for partial weeks)
  totalStudySec: number;
  isCurrent: boolean;
}

export interface MonthStoryData {
  days: MonthDayData[]; // 30 entries, oldest → newest
  weeks: MonthWeekData[]; // ~4-5 weeks
  totalStudySec: number;
  totalWastedSec: number;
  dailyGoalSec: number;
  monthlyGoalSec: number;
  goalPct: number;
  daysStudied: number; // days with study > 0
  currentStreak: number; // consecutive days with study up to today
  bestDay: MonthDayData | null;
  dailyAvgSec: number; // totalStudySec / 30
  trendPct: number; // vs previous 30 days
  monthLabel: string; // "Last 30 Days"
}

export function monthStoryData(sessions: SavedSession[], dailyGoalHours: number): MonthStoryData {
  const today = todayKey();
  const dailyGoalSec = Math.round(dailyGoalHours * 3600);
  const monthlyGoalSec = dailyGoalSec * 30;

  // Build 30 days
  const days: MonthDayData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    const daySessions = sessions.filter((s) => s.date === key);
    const studySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
    const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
    const hours = studySec / 3600;
    const intensity = hours >= 6 ? 4 : hours >= 4 ? 3 : hours >= 2 ? 2 : hours > 0 ? 1 : 0;

    days.push({
      date: key,
      dayNum: d.getDate(),
      studySec,
      wastedSec,
      sessionCount: daySessions.length,
      isToday: key === today,
      hasStudy: studySec > 0,
      intensity,
    });
  }

  // Group into weeks (starting from the oldest day in the range)
  const weeks: MonthWeekData[] = [];
  const startDate = addDays(new Date(), -29);
  for (let w = 0; w < 5; w++) {
    const weekDays: MonthDayData[] = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (idx >= days.length) break;
      weekDays.push(days[idx]);
    }
    if (weekDays.length === 0) continue;

    const weekStart = addDays(startDate, w * 7);
    const weekEnd = addDays(weekStart, 6);
    const dateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const totalStudySec = weekDays.reduce((a, d) => a + d.studySec, 0);
    const isCurrent = weekDays.some((d) => d.isToday);

    weeks.push({
      weekNum: w + 1,
      label: `Week ${w + 1}`,
      dateRange,
      days: weekDays,
      totalStudySec,
      isCurrent,
    });
  }

  const totalStudySec = days.reduce((a, d) => a + d.studySec, 0);
  const totalWastedSec = days.reduce((a, d) => a + d.wastedSec, 0);
  const daysStudied = days.filter((d) => d.hasStudy).length;
  const goalPct = monthlyGoalSec > 0 ? Math.round((totalStudySec / monthlyGoalSec) * 100) : 0;
  const dailyAvgSec = Math.round(totalStudySec / 30);

  // Current streak (consecutive days with study, ending today)
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].hasStudy) currentStreak++;
    else break;
  }

  // Best day
  const studiedDays = days.filter((d) => d.hasStudy);
  const bestDay = studiedDays.length > 0
    ? studiedDays.reduce((max, d) => (d.studySec > max.studySec ? d : max))
    : null;

  // Trend: compare this 30 days to previous 30 days
  let prevStudySec = 0;
  for (let i = 59; i >= 30; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    prevStudySec += sessions
      .filter((s) => s.date === key)
      .reduce((a, s) => a + s.studySeconds, 0);
  }
  const trendPct = prevStudySec > 0
    ? Math.round(((totalStudySec - prevStudySec) / prevStudySec) * 100)
    : totalStudySec > 0 ? 100 : 0;

  return {
    days,
    weeks,
    totalStudySec,
    totalWastedSec,
    dailyGoalSec,
    monthlyGoalSec,
    goalPct,
    daysStudied,
    currentStreak,
    bestDay,
    dailyAvgSec,
    trendPct,
    monthLabel: 'Last 30 Days',
  };
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

// ===== Best study hour (24-hour bar) — legacy, kept for backwards compat =====
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

// ===== Peak Study Time v2 — splits sessions across all hours they span =====

export interface HourStat {
  hour: number; // 0-23
  label: string; // "9 PM"
  shortLabel: string; // "9p"
  totalMinutes: number; // total study minutes at this hour (across all sessions)
  wastedMinutes: number;
  sessionCount: number; // total sessions that touched this hour
  dayCount: number; // unique days user studied at this hour
  avgMinutes: number; // totalMinutes / dayCount (avg per day, not per session)
  avgWasted: number;
  efficiency: number; // study / (study + wasted) * 100, 0 if no data
}

export interface TimeBlockStat {
  id: 'dawn' | 'morning' | 'noon' | 'evening' | 'night' | 'late';
  name: string;
  icon: string; // emoji
  range: string; // "5–8 AM"
  hours: number[];
  totalMinutes: number;
  wastedMinutes: number;
  dayCount: number;
  avgMinutes: number;
}

export interface BestHourAnalysis {
  hours: HourStat[]; // 24 entries
  blocks: TimeBlockStat[]; // 6 entries
  peakHour: HourStat | null; // hour with highest avgMinutes (requires sessionCount > 0)
  peakBlock: TimeBlockStat | null; // block with highest totalMinutes
  worstWastedHour: HourStat | null; // hour with most wasted minutes
  totalDaysTracked: number; // unique dates in all sessions
}

/** Format hour 0-23 → "12 AM", "1 AM", ..., "11 PM" */
function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display} ${period}`;
}

/** Format hour 0-23 → "12a", "1a", ..., "11p" (compact for chart axis) */
function formatHourShort(hour: number): string {
  const period = hour < 12 ? 'a' : 'p';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}${period}`;
}

/** Distribute a single session's study/wasted seconds across all the hours it spans.
 *  Uses proportional split based on real elapsed time per hour bucket.
 *  Fixes the legacy bug where only the start hour got credit. */
function distributeSessionAcrossHours(session: SavedSession): { hour: number; studySec: number; wastedSec: number }[] {
  const start = session.startedAt;
  const end = session.endedAt;
  const elapsedSec = (end - start) / 1000;
  if (elapsedSec <= 0) {
    return [{ hour: new Date(start).getHours(), studySec: session.studySeconds, wastedSec: session.wastedSeconds }];
  }
  // Rates: study/wasted seconds per real second
  const studyRate = session.studySeconds / elapsedSec;
  const wastedRate = session.wastedSeconds / elapsedSec;
  const result: { hour: number; studySec: number; wastedSec: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    // Find end of the current clock-hour bucket (e.g. 9:00 → 10:00)
    const bucketDate = new Date(cursor);
    bucketDate.setMinutes(0, 0, 0);
    const bucketEnd = bucketDate.getTime() + 3600000;
    const segEnd = Math.min(end, bucketEnd);
    const segSec = (segEnd - cursor) / 1000;
    result.push({
      hour: new Date(cursor).getHours(),
      studySec: segSec * studyRate,
      wastedSec: segSec * wastedRate,
    });
    cursor = segEnd;
  }
  return result;
}

export function bestHourDataV2(sessions: SavedSession[]): BestHourAnalysis {
  const hourBuckets: {
    totalStudySec: number;
    totalWastedSec: number;
    sessionCount: number;
    daysSet: Set<string>;
  }[] = Array.from({ length: 24 }, () => ({
    totalStudySec: 0,
    totalWastedSec: 0,
    sessionCount: 0,
    daysSet: new Set<string>(),
  }));

  const allDays = new Set<string>();

  for (const s of sessions) {
    allDays.add(s.date);
    const segments = distributeSessionAcrossHours(s);
    const hoursTouched = new Set<number>();
    for (const seg of segments) {
      hourBuckets[seg.hour].totalStudySec += seg.studySec;
      hourBuckets[seg.hour].totalWastedSec += seg.wastedSec;
      hoursTouched.add(seg.hour);
    }
    // count session once per distinct hour it touched
    for (const h of hoursTouched) {
      hourBuckets[h].sessionCount += 1;
      hourBuckets[h].daysSet.add(s.date);
    }
  }

  const hours: HourStat[] = hourBuckets.map((b, hour) => {
    const totalMinutes = Math.round(b.totalStudySec / 60);
    const wastedMinutes = Math.round(b.totalWastedSec / 60);
    const dayCount = b.daysSet.size;
    const avgMinutes = dayCount > 0 ? Math.round((b.totalStudySec / 60) / dayCount) : 0;
    const avgWasted = dayCount > 0 ? Math.round((b.totalWastedSec / 60) / dayCount) : 0;
    const totalAll = totalMinutes + wastedMinutes;
    const efficiency = totalAll > 0 ? Math.round((totalMinutes / totalAll) * 100) : 0;
    return {
      hour,
      label: formatHourLabel(hour),
      shortLabel: formatHourShort(hour),
      totalMinutes,
      wastedMinutes,
      sessionCount: b.sessionCount,
      dayCount,
      avgMinutes,
      avgWasted,
      efficiency,
    };
  });

  const blockDefs: { id: TimeBlockStat['id']; name: string; icon: string; range: string; hours: number[] }[] = [
    { id: 'dawn', name: 'Dawn', icon: '🌅', range: '5–8 AM', hours: [5, 6, 7] },
    { id: 'morning', name: 'Morning', icon: '🌞', range: '8 AM–12 PM', hours: [8, 9, 10, 11] },
    { id: 'noon', name: 'Noon', icon: '☀️', range: '12–4 PM', hours: [12, 13, 14, 15] },
    { id: 'evening', name: 'Evening', icon: '🌆', range: '4–8 PM', hours: [16, 17, 18, 19] },
    { id: 'night', name: 'Night', icon: '🌙', range: '8 PM–12 AM', hours: [20, 21, 22, 23] },
    { id: 'late', name: 'Late Night', icon: '🦉', range: '12–5 AM', hours: [0, 1, 2, 3, 4] },
  ];

  const blocks: TimeBlockStat[] = blockDefs.map((def) => {
    const sub = def.hours.map((h) => hours[h]);
    const totalMinutes = sub.reduce((a, h) => a + h.totalMinutes, 0);
    const wastedMinutes = sub.reduce((a, h) => a + h.wastedMinutes, 0);
    const daySet = new Set<string>();
    for (const h of def.hours) {
      for (const d of hourBuckets[h].daysSet) daySet.add(d);
    }
    const dayCount = daySet.size;
    const avgMinutes = dayCount > 0 ? Math.round(totalMinutes / dayCount) : 0;
    return { ...def, totalMinutes, wastedMinutes, dayCount, avgMinutes };
  });

  const hoursWithData = hours.filter((h) => h.sessionCount > 0);
  const peakHour = hoursWithData.length > 0
    ? hoursWithData.reduce((max, h) => (h.avgMinutes > max.avgMinutes ? h : max))
    : null;

  const blocksWithData = blocks.filter((b) => b.totalMinutes > 0);
  const peakBlock = blocksWithData.length > 0
    ? blocksWithData.reduce((max, b) => (b.totalMinutes > max.totalMinutes ? b : max))
    : null;

  const hoursWithWasted = hours.filter((h) => h.wastedMinutes > 0);
  const worstWastedHour = hoursWithWasted.length > 0
    ? hoursWithWasted.reduce((max, h) => (h.wastedMinutes > max.wastedMinutes ? h : max))
    : null;

  return {
    hours,
    blocks,
    peakHour,
    peakBlock,
    worstWastedHour,
    totalDaysTracked: allDays.size,
  };
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
