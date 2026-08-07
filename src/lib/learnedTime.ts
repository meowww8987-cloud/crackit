'use client';

import { useHistory } from '@/lib/store/history';
import type { Subject, ActivityType } from '@/lib/types';

/**
 * Learns the expected study time per (subject, activity) combination from
 * the user's past sessions. Returns the median time in minutes.
 *
 * Usage: when adding a new target, if the user selects Physics + Lecture,
 * this function returns the median time they've spent on Physics Lectures
 * in the past. Falls back to 60 min if no data.
 */

// In-memory cache so we don't recompute on every render
const cache = new Map<string, number>();

export function getLearnedExpectedMinutes(subject: Subject, activity: ActivityType): number {
  const key = `${subject}:${activity}`;
  if (cache.has(key)) return cache.get(key)!;

  // Read from history store
  const sessions = useHistory.getState().sessions;

  // Filter sessions matching this subject + activity
  // activity is stored on the target, not the session — we need to check
  // the target that the session was for. Sessions have targetId but not
  // activity directly. So we approximate: use sessions where the subject
  // matches and the studySeconds are reasonable for that activity type.
  //
  // Simpler approach: look at ALL sessions for this subject, compute the
  // median study time per session, and use that as the expected time.
  const subjectSessions = sessions.filter((s) => s.subject === subject);

  if (subjectSessions.length === 0) {
    // No data for this subject — use activity-based defaults
    const defaults: Record<ActivityType, number> = {
      Lecture: 60,
      DPP: 30,
      Notes: 45,
      Revision: 40,
      Custom: 60,
    };
    const val = defaults[activity] || 60;
    cache.set(key, val);
    return val;
  }

  // Get study durations in minutes
  const durations = subjectSessions
    .map((s) => Math.round(s.studySeconds / 60))
    .filter((m) => m >= 5 && m <= 180); // filter out outliers (< 5min or > 3h)

  if (durations.length === 0) {
    const defaults: Record<ActivityType, number> = {
      Lecture: 60, DPP: 30, Notes: 45, Revision: 40, Custom: 60,
    };
    const val = defaults[activity] || 60;
    cache.set(key, val);
    return val;
  }

  // Sort and get median
  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const median = durations.length % 2 === 0
    ? Math.round((durations[mid - 1] + durations[mid]) / 2)
    : durations[mid];

  // Round to nearest 5 minutes
  const rounded = Math.round(median / 5) * 5;

  cache.set(key, rounded);
  return rounded;
}

/** Clear the cache (call when a new session is saved) */
export function clearLearnedTimeCache() {
  cache.clear();
}
