/**
 * Sleep Health Analyzer
 *
 * Analyzes the user's sleep history and produces:
 *  - Sleep type classification (night sleep / noon nap / evening nap / etc.)
 *  - Sleep health score (0-100) based on:
 *      • Duration vs 7-9h target for night sleep
 *      • Consistency of bedtime (low variance = better)
 *      • Quality ratings (1-5)
 *      • Sleep timing (10pm-11pm ideal, late nights penalized)
 *  - Last 7 nights breakdown
 *  - Personalized recommendations
 */

import type { SleepEntry } from '@/lib/store/sleep';
import { formatHM } from '@/lib/utils';

export type SleepType = 'night' | 'late-night' | 'noon-nap' | 'evening-nap' | 'short-nap';

export interface SleepAnalysis {
  type: SleepType;
  label: string;
  emoji: string;
  /** Health score for THIS sleep entry (0-100). */
  score: number;
  /** Short verdict: 'excellent' | 'good' | 'fair' | 'poor' */
  verdict: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface WeeklySleepReport {
  /** Average sleep hours over last 7 days (only counts nights, not naps). */
  avgNightHours: number;
  /** Average bedtime hour (0-24), e.g. 23.5 = 11:30 PM. */
  avgBedtime: number;
  /** Bedtime consistency: 0-100, higher = more consistent. */
  bedtimeConsistency: number;
  /** Average quality rating (1-5) over last 7 days. */
  avgQuality: number;
  /** Overall sleep health score (0-100). */
  healthScore: number;
  /** Verdict label. */
  verdict: 'excellent' | 'good' | 'fair' | 'poor';
  /** Last 7 nights analysis (oldest first). */
  nights: SleepNightEntry[];
  /** Personalized recommendations (max 3). */
  recommendations: string[];
}

export interface SleepNightEntry {
  date: string;
  bedTime: number;
  wakeTime: number | null;
  durationSec: number;
  type: SleepType;
  label: string;
  emoji: string;
  quality: number | null;
  score: number;
}

/** Classify a sleep entry by when it started + how long it lasted. */
export function classifySleep(bedTimeMs: number, durationSec: number): SleepAnalysis {
  const bedDate = new Date(bedTimeMs);
  const hour = bedDate.getHours() + bedDate.getMinutes() / 60;
  const hours = durationSec / 3600;

  // Nap = anything under 4 hours
  if (hours < 4) {
    if (hour >= 11 && hour < 17) {
      return { type: 'noon-nap', label: 'Noon Nap', emoji: '☀️', score: scoreNap(hours, 'noon'), verdict: 'good' };
    }
    if (hour >= 17 && hour < 21) {
      return { type: 'evening-nap', label: 'Evening Nap', emoji: '🌆', score: scoreNap(hours, 'evening'), verdict: 'fair' };
    }
    // Late-night short sleep — probably crashed while studying
    return { type: 'short-nap', label: 'Power Nap', emoji: '💤', score: 50, verdict: 'fair' };
  }

  // Full night sleep (4+ hours)
  // Ideal bedtime: 22:00 – 23:30
  // Late: 23:30 – 01:00
  // Very late: after 01:00
  let bedtimeScore = 100;
  if (hour >= 22 && hour < 23.5) bedtimeScore = 100;
  else if (hour >= 21 && hour < 22) bedtimeScore = 90;       // early bedtime, fine
  else if (hour >= 23.5 && hour < 24) bedtimeScore = 75;     // slightly late
  else if (hour >= 0 && hour < 1) bedtimeScore = 55;         // late
  else if (hour >= 1 && hour < 3) bedtimeScore = 35;         // very late
  else if (hour >= 3 && hour < 5) bedtimeScore = 25;         // all-nighter recovery
  else if (hour >= 20 && hour < 21) bedtimeScore = 85;       // early bird
  else bedtimeScore = 60; // any other time (rare)

  // Duration score: 7-9h = 100, 6-7h = 85, 5-6h = 65, <5h = 40, >9h = 80 (oversleep)
  let durScore = 100;
  if (hours >= 7 && hours < 9) durScore = 100;
  else if (hours >= 6 && hours < 7) durScore = 85;
  else if (hours >= 5 && hours < 6) durScore = 65;
  else if (hours >= 4 && hours < 5) durScore = 40;
  else if (hours >= 9 && hours < 10) durScore = 85;
  else if (hours >= 10) durScore = 65;
  else durScore = 30;

  const score = Math.round((bedtimeScore * 0.5 + durScore * 0.5));
  let type: SleepType = 'night';
  let label = 'Night Sleep';
  let emoji = '🌙';
  if (hour >= 23.5 && hour < 24) {
    type = 'late-night'; label = 'Late Night Sleep'; emoji = '🌃';
  } else if (hour >= 0 && hour < 3) {
    type = 'late-night'; label = 'Very Late Sleep'; emoji = '🌃';
  }

  const verdict = score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor';
  return { type, label, emoji, score, verdict };
}

function scoreNap(hours: number, period: 'noon' | 'evening'): number {
  // Naps 20-30 min = ideal power nap (score 90)
  // Naps 30-60 min = good (75)
  // Naps 60-120 min = decent for noon, less ideal for evening (60/45)
  // Naps >120 min = confused sleep schedule (40)
  if (hours < 0.5) return 80;       // very short
  if (hours < 0.6) return 90;       // 20-35 min — ideal
  if (hours < 1) return 80;
  if (hours < 2) return period === 'noon' ? 70 : 50;
  if (hours < 4) return 45;
  return 35;
}

export function verdictLabel(v: 'excellent' | 'good' | 'fair' | 'poor'): string {
  switch (v) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
  }
}

export function verdictColor(v: 'excellent' | 'good' | 'fair' | 'poor'): string {
  switch (v) {
    case 'excellent': return '#22c55e';
    case 'good': return '#84cc16';
    case 'fair': return '#f59e0b';
    case 'poor': return '#ef4444';
  }
}

/** Build the weekly sleep report from sleep history entries. */
export function buildWeeklySleepReport(history: SleepEntry[]): WeeklySleepReport {
  // Get the last 7 nights (filter out short naps < 4h, sort by bedTime desc, take 7)
  const nights = history
    .filter((e) => (e.durationSec || 0) >= 4 * 3600) // night sleep only
    .slice(0, 7)
    .map((e) => {
      const analysis = classifySleep(e.bedTime, e.durationSec || 0);
      return {
        date: e.date,
        bedTime: e.bedTime,
        wakeTime: e.wakeTime,
        durationSec: e.durationSec || 0,
        type: analysis.type,
        label: analysis.label,
        emoji: analysis.emoji,
        quality: e.quality,
        score: analysis.score,
      };
    })
    .reverse(); // oldest first for chart-like display

  if (nights.length === 0) {
    return {
      avgNightHours: 0,
      avgBedtime: 0,
      bedtimeConsistency: 0,
      avgQuality: 0,
      healthScore: 0,
      verdict: 'poor',
      nights: [],
      recommendations: ['No night sleep tracked yet. Start your first sleep tonight!'],
    };
  }

  // Average hours
  const totalSec = nights.reduce((a, n) => a + n.durationSec, 0);
  const avgNightHours = totalSec / nights.length / 3600;

  // Average bedtime (convert each to hour-of-day, handle wraparound)
  const bedtimes = nights.map((n) => {
    const d = new Date(n.bedTime);
    let h = d.getHours() + d.getMinutes() / 60;
    // Normalize: if bedtime is in evening (>= 18), keep as is
    // If bedtime is after midnight (< 12), add 24 so late-night sleep
    // doesn't average with early-evening sleep confusingly
    if (h < 12) h += 24;
    return h;
  });
  const avgBedtime = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;

  // Bedtime consistency: standard deviation (lower = better)
  const variance = bedtimes.reduce((a, h) => a + Math.pow(h - avgBedtime, 2), 0) / bedtimes.length;
  const stddev = Math.sqrt(variance);
  // Map: 0 stddev → 100, 3+ stddev → 0
  const bedtimeConsistency = Math.max(0, Math.round(100 - (stddev / 3) * 100));

  // Average quality
  const qualities = nights.filter((n) => n.quality != null).map((n) => n.quality as number);
  const avgQuality = qualities.length > 0
    ? qualities.reduce((a, b) => a + b, 0) / qualities.length
    : 0;

  // Health score: weighted blend
  //  - Duration (40%): 7-9h=100, 6-7h=85, 5-6h=65, <5=40
  let durScore: number;
  if (avgNightHours >= 7 && avgNightHours < 9) durScore = 100;
  else if (avgNightHours >= 6 && avgNightHours < 7) durScore = 85;
  else if (avgNightHours >= 5 && avgNightHours < 6) durScore = 65;
  else if (avgNightHours >= 9 && avgNightHours < 10) durScore = 85;
  else if (avgNightHours >= 4) durScore = 50;
  else durScore = 30;

  //  - Bedtime consistency (25%)
  const consScore = bedtimeConsistency;

  //  - Bedtime timing (20%): ideal 22:00-23:30
  // Normalize avgBedtime back to 0-24 range for scoring
  const normBedtime = avgBedtime >= 24 ? avgBedtime - 24 : avgBedtime;
  let timeScore: number;
  if (normBedtime >= 22 && normBedtime < 23.5) timeScore = 100;
  else if (normBedtime >= 21 && normBedtime < 22) timeScore = 90;
  else if (normBedtime >= 23.5 && normBedtime < 24) timeScore = 75;
  else if (normBedtime >= 0 && normBedtime < 1) timeScore = 55;
  else if (normBedtime >= 1 && normBedtime < 3) timeScore = 35;
  else timeScore = 50;

  //  - Quality rating (15%): 5=100, 4=80, 3=60, 2=40, 1=20
  const qualScore = avgQuality > 0 ? (avgQuality / 5) * 100 : 70; // default if no ratings

  const healthScore = Math.round(durScore * 0.4 + consScore * 0.25 + timeScore * 0.20 + qualScore * 0.15);
  const verdict = healthScore >= 85 ? 'excellent' : healthScore >= 65 ? 'good' : healthScore >= 45 ? 'fair' : 'poor';

  // Recommendations
  const recommendations: string[] = [];
  if (avgNightHours < 6) {
    recommendations.push(`Aim for 7+ hours — you averaged ${avgNightHours.toFixed(1)}h this week.`);
  } else if (avgNightHours >= 9) {
    recommendations.push(`Sleeping ${avgNightHours.toFixed(1)}h on average — check if you're oversleeping (7-9h is ideal).`);
  }
  if (bedtimeConsistency < 60) {
    recommendations.push('Try a fixed bedtime — your sleep schedule is inconsistent.');
  }
  if (normBedtime >= 1 && normBedtime < 3) {
    recommendations.push('You\'re going to bed very late (after 1 AM). Wind down by 11 PM for better recovery.');
  } else if (normBedtime >= 0 && normBedtime < 1) {
    recommendations.push('Bedtime is past midnight — try shifting 30 min earlier this week.');
  }
  if (avgQuality > 0 && avgQuality < 3.5) {
    recommendations.push('Sleep quality is low — avoid screens 30 min before bed and keep the room cool + dark.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Great sleep habits! Keep the consistent rhythm going. 🎯');
  }

  return {
    avgNightHours,
    avgBedtime: normBedtime,
    bedtimeConsistency,
    avgQuality,
    healthScore,
    verdict,
    nights,
    recommendations: recommendations.slice(0, 3),
  };
}

/** Format an hour-of-day (0-24, can be >24 for late-night normalization) as "11:30 PM". */
export function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/** Format duration (sec) as "7h 23m". */
export function formatSleepDuration(sec: number): string {
  return formatHM(sec);
}

// ===== Extended report with advantages / disadvantages / improvements =====

export interface SleepInsightReport extends WeeklySleepReport {
  /** What's going well (advantages). */
  advantages: string[];
  /** What needs work (disadvantages / risks). */
  disadvantages: string[];
  /** Concrete actionable improvements. */
  improvements: string[];
  /** Period label: "Last 7 days" or "Last 30 days". */
  periodLabel: string;
  /** Number of nights analyzed. */
  nightsAnalyzed: number;
  /** Number of naps analyzed. */
  napsAnalyzed: number;
  /** Total sleep hours in period. */
  totalHours: number;
  /** Best night (highest score). */
  bestNight: SleepNightEntry | null;
  /** Worst night (lowest score). */
  worstNight: SleepNightEntry | null;
}

/** Build an extended insight report for a given period (7 or 30 days). */
export function buildSleepInsightReport(
  history: SleepEntry[],
  days: number = 7
): SleepInsightReport {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const periodEntries = history.filter((e) => e.bedTime >= cutoff);
  const nights = periodEntries.filter((e) => (e.durationSec || 0) >= 4 * 3600);
  const naps = periodEntries.filter((e) => (e.durationSec || 0) < 4 * 3600);

  const base = buildWeeklySleepReport(nights);

  // Total hours
  const totalSec = periodEntries.reduce((a, e) => a + (e.durationSec || 0), 0);
  const totalHours = totalSec / 3600;

  // Best + worst night
  const nightEntries: SleepNightEntry[] = nights.map((e) => {
    const analysis = classifySleep(e.bedTime, e.durationSec || 0);
    return {
      date: e.date,
      bedTime: e.bedTime,
      wakeTime: e.wakeTime,
      durationSec: e.durationSec || 0,
      type: analysis.type,
      label: analysis.label,
      emoji: analysis.emoji,
      quality: e.quality,
      score: analysis.score,
    };
  });
  const sortedByScore = [...nightEntries].sort((a, b) => b.score - a.score);
  const bestNight = sortedByScore[0] || null;
  const worstNight = sortedByScore[sortedByScore.length - 1] || null;

  // === Advantages (what's going well) ===
  const advantages: string[] = [];
  if (base.avgNightHours >= 7 && base.avgNightHours < 9) {
    advantages.push(`Sleep duration is on target (${base.avgNightHours.toFixed(1)}h average — ideal 7-9h window).`);
  }
  if (base.bedtimeConsistency >= 75) {
    advantages.push(`Very consistent bedtime (${base.bedtimeConsistency}% regularity — your body clock is well-trained).`);
  }
  if (base.avgBedtime >= 22 && base.avgBedtime < 23.5) {
    advantages.push(`Healthy bedtime window (${formatHour(base.avgBedtime)} — matches the 10-11:30 PM ideal).`);
  }
  if (base.avgQuality >= 4) {
    advantages.push(`High sleep quality (${base.avgQuality.toFixed(1)}/5 — you wake up feeling rested).`);
  }
  if (nights.length >= days * 0.85) {
    advantages.push(`Consistent tracking (${nights.length} nights logged in the last ${days} days).`);
  }
  if (naps.length > 0 && naps.length <= days * 0.3) {
    advantages.push(`Healthy nap pattern (${naps.length} naps — supplemental without disrupting night sleep).`);
  }
  if (advantages.length === 0) {
    advantages.push('You\'re tracking your sleep — that\'s the first step to improving it! 📊');
  }

  // === Disadvantages (what needs work) ===
  const disadvantages: string[] = [];
  if (base.avgNightHours < 6) {
    disadvantages.push(`Sleeping too little (${base.avgNightHours.toFixed(1)}h — below the 6h minimum for memory consolidation).`);
  } else if (base.avgNightHours >= 9.5) {
    disadvantages.push(`Oversleeping (${base.avgNightHours.toFixed(1)}h — may indicate sleep debt or low-quality sleep).`);
  }
  if (base.bedtimeConsistency < 50) {
    disadvantages.push(`Irregular bedtime (${base.bedtimeConsistency}% consistency — body clock confused, hard to fall asleep).`);
  }
  if (base.avgBedtime >= 0 && base.avgBedtime < 3) {
    disadvantages.push(`Very late bedtime (${formatHour(base.avgBedtime)} — after 1 AM reduces deep sleep by 30%).`);
  } else if (base.avgBedtime >= 23.5 && base.avgBedtime < 24) {
    disadvantages.push(`Slightly late bedtime (${formatHour(base.avgBedtime)} — pushing past the 11:30 PM sweet spot).`);
  }
  if (base.avgQuality > 0 && base.avgQuality < 3.5) {
    disadvantages.push(`Low sleep quality (${base.avgQuality.toFixed(1)}/5 — sleep isn't restorative even when long enough).`);
  }
  if (naps.length > days * 0.5) {
    disadvantages.push(`Too many naps (${naps.length} in ${days} days — may be fragmenting your night sleep).`);
  }
  if (nights.length < days * 0.5) {
    disadvantages.push(`Inconsistent tracking (${nights.length}/${days} nights logged — can't analyze what isn't measured).`);
  }
  if (disadvantages.length === 0) {
    disadvantages.push('No major red flags — small tweaks will optimize further.');
  }

  // === Improvements (actionable) ===
  const improvements: string[] = [];
  if (base.avgNightHours < 7) {
    improvements.push(`Aim to sleep 30 min earlier — you need ${Math.max(0, 7 - base.avgNightHours).toFixed(1)}h more to hit the 7h minimum.`);
  }
  if (base.bedtimeConsistency < 70) {
    improvements.push('Fix your wake time first (even on weekends) — this anchors your body clock more than bedtime.');
  }
  if (base.avgBedtime >= 0 && base.avgBedtime < 3) {
    improvements.push('Shift bedtime 30 min earlier every 3 days until you hit 11 PM — gradual shift sticks better than sudden.');
  }
  if (base.avgQuality > 0 && base.avgQuality < 4) {
    improvements.push('No screens 30 min before bed + keep room cool (18-20°C) + dark — these 3 changes boost quality most.');
  }
  if (naps.length > days * 0.4) {
    improvements.push('Limit naps to 1 per day, before 3 PM, max 20 min — longer/later naps steal from night sleep.');
  }
  if (nights.length < days * 0.7) {
    improvements.push(`Log more nights — you've only tracked ${nights.length}/${days}. Use the NEET logo tap to sleep so it's automatic.`);
  }
  if (improvements.length === 0) {
    improvements.push('You\'re in great shape! Focus on maintaining this rhythm through exam stress. 🎯');
  }

  return {
    ...base,
    advantages: advantages.slice(0, 4),
    disadvantages: disadvantages.slice(0, 4),
    improvements: improvements.slice(0, 4),
    periodLabel: `Last ${days} days`,
    nightsAnalyzed: nights.length,
    napsAnalyzed: naps.length,
    totalHours,
    bestNight,
    worstNight,
  };
}
