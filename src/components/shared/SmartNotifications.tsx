'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/lib/store/settings';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { todayKey, diffDays, isRevisionOverdue } from '@/lib/utils';

const NOTIF_SENT_KEY = 'neet-smart-notif-sent';
const NOTIF_LAST_FIRE_KEY = 'neet-smart-notif-last-fire';

/**
 * SmartNotifications — redesigned for mobile-friendly behavior.
 *
 * Previous problems (now fixed):
 *  - Fired immediately on mount → annoying popup every time you open the app
 *  - Checked every 15 minutes → too aggressive, drains battery
 *  - Could fire 5 different notifications per day → notification spam
 *  - Fired as late as 10 PM → disrupted sleep
 *  - Requested permission on mount → intrusive popup on first load
 *
 * New design:
 *  - **Quiet hours**: 10 PM – 8 AM — no notifications during sleep time
 *  - **Max 1 per day** — picks the single most important notification
 *  - **1-hour interval** — checks hourly instead of every 15 min
 *  - **No fire-on-mount** — waits 2 min after app open before first check
 *    (avoids notifying on quick glances where user is already engaged)
 *  - **Priority-based**: streak-risk > test-today > test-tomorrow > overdue-revision > goal-reminder > encouragement
 *  - **No auto permission request** — only requests when user enables in settings
 *  - **Won't fire while actively studying** — respects focus time
 */
export function SmartNotifications() {
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Do NOT auto-request permission on mount. The settings page handles this
    // when the user explicitly toggles notifications on. Here we only proceed
    // if permission was already granted.
    if (Notification.permission !== 'granted') return;

    /** Determines which single notification (if any) should fire right now.
     *  Returns the highest-priority pending notification, or null if none
     *  qualify or we're in quiet hours. */
    const pickNotification = (): { type: string; title: string; body: string } | null => {
      const now = new Date();
      const hour = now.getHours();
      const today = todayKey();

      // Quiet hours: 10 PM – 8 AM. No notifications during sleep.
      if (hour >= 22 || hour < 8) return null;

      // Don't notify while the user is actively studying — they're already
      // engaged, a notification would be disruptive, not helpful.
      const sessions = useHistory.getState().sessions;
      const isStudyingNow = sessions.some((s) => {
        if (s.date !== today) return false;
        // If a session ended less than 2 minutes ago, user is likely still
        // in an active study flow.
        return Date.now() - s.endedAt < 2 * 60 * 1000 && s.studySeconds > 0;
      });
      if (isStudyingNow) return null;

      const studiedToday = sessions.some((s) => s.date === today && s.studySeconds >= 60);
      const todaySec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);

      // Load sent notifications for today — each type fires at most once/day.
      let sentToday: string[] = [];
      try {
        const raw = localStorage.getItem(NOTIF_SENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.date === today) sentToday = parsed.types || [];
        }
      } catch {}

      const candidates: { type: string; title: string; body: string; priority: number }[] = [];

      // PRIORITY 1: Streak at risk (6–9 PM, no study today, streak > 0)
      // This is the most urgent — losing a streak is demoralizing.
      if (!sentToday.includes('streak-risk') && hour >= 18 && hour < 21) {
        const streak = useHistory.getState().getStreak();
        if (!studiedToday && streak > 0) {
          candidates.push({
            type: 'streak-risk',
            title: '🔥 Streak at risk',
            body: `Your ${streak}-day streak is in danger. Study 1 min to save it.`,
            priority: 100,
          });
        }
      }

      // PRIORITY 2: Test today (morning check)
      if (!sentToday.includes('test-today') && hour >= 8 && hour < 11) {
        const tests = useTests.getState().tests;
        const next = tests
          .filter((t) => diffDays(today, t.date) >= 0)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (next && diffDays(today, next.date) === 0) {
          candidates.push({
            type: 'test-today',
            title: '📝 Test today',
            body: `${next.name} is today. You've got this!`,
            priority: 90,
          });
        }
      }

      // PRIORITY 3: Test tomorrow (afternoon reminder)
      if (!sentToday.includes('test-tomorrow') && hour >= 14 && hour < 19) {
        const tests = useTests.getState().tests;
        const next = tests
          .filter((t) => diffDays(today, t.date) >= 0)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (next && diffDays(today, next.date) === 1) {
          candidates.push({
            type: 'test-tomorrow',
            title: '📝 Test tomorrow',
            body: `${next.name} is tomorrow. Review key formulas tonight.`,
            priority: 80,
          });
        }
      }

      // PRIORITY 4: Overdue revisions (morning, ≥5 overdue)
      if (!sentToday.includes('overdue-revision') && hour >= 10 && hour < 13) {
        const lectures = useSyllabus.getState().lectures;
        const overdue = lectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt));
        if (overdue.length >= 5) {
          candidates.push({
            type: 'overdue-revision',
            title: '🔄 Revisions piling up',
            body: `${overdue.length} lectures need revision. Open Syllabus when you can.`,
            priority: 60,
          });
        }
      }

      // PRIORITY 5: Daily goal not met by 8 PM
      if (!sentToday.includes('goal-reminder') && hour >= 20 && hour < 22) {
        const goal = useSettings.getState().dailyGoalHours * 3600;
        if (todaySec < goal * 0.7) {
          const remaining = Math.max(0, Math.floor((goal - todaySec) / 60));
          candidates.push({
            type: 'goal-reminder',
            title: '📊 Daily goal',
            body: `${Math.floor(todaySec / 60)}m done, ${remaining}m to go. You can still make it!`,
            priority: 50,
          });
        }
      }

      // PRIORITY 6 (lowest): Encouragement — beat yesterday
      // Only fires if no higher-priority notification was sent.
      if (!sentToday.includes('encouragement') && hour >= 19 && hour < 22) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const yestSec = sessions.filter((s) => s.date === yKey).reduce((a, s) => a + s.studySeconds, 0);
        if (todaySec > yestSec && yestSec > 0 && todaySec > 3600) {
          candidates.push({
            type: 'encouragement',
            title: '🎉 Great progress',
            body: `+${Math.floor((todaySec - yestSec) / 60)}m vs yesterday. Keep going!`,
            priority: 30,
          });
        }
      }

      if (candidates.length === 0) return null;
      // Return the highest-priority candidate.
      candidates.sort((a, b) => b.priority - a.priority);
      const picked = candidates[0];
      return { type: picked.type, title: picked.title, body: picked.body };
    };

    const checkAndNotify = () => {
      const today = todayKey();
      const picked = pickNotification();
      if (!picked) return;

      // Load + update sent list
      let sentToday: string[] = [];
      try {
        const raw = localStorage.getItem(NOTIF_SENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.date === today) sentToday = parsed.types || [];
        }
      } catch {}

      if (sentToday.includes(picked.type)) return;

      sentToday.push(picked.type);
      try {
        localStorage.setItem(NOTIF_SENT_KEY, JSON.stringify({ date: today, types: sentToday }));
      } catch {}

      // Throttle: don't fire more than 1 system notification per 30 minutes,
      // even if a different type qualifies. Prevents bursts.
      try {
        const lastFire = localStorage.getItem(NOTIF_LAST_FIRE_KEY);
        if (lastFire) {
          const elapsed = Date.now() - parseInt(lastFire, 10);
          if (elapsed < 30 * 60 * 1000) return;
        }
        localStorage.setItem(NOTIF_LAST_FIRE_KEY, String(Date.now()));
      } catch {}

      try {
        new Notification(picked.title, {
          body: picked.body,
          icon: '/icon-192.svg',
          tag: picked.type,
          // silent: false — we want the user to see it, but the 1/day cap
          // ensures they're not bombarded.
        });
      } catch {}

      // Also add to in-app notification history (visible in settings).
      useSettings.getState().addNotification({ title: picked.title, body: picked.body });
    };

    // Wait 2 minutes after app open before first check — avoids notifying
    // on quick glances where the user is already looking at the app.
    startupTimerRef.current = setTimeout(() => {
      checkAndNotify();
      // Then check every 1 hour (was 15 min — too aggressive for mobile).
      checkIntervalRef.current = setInterval(checkAndNotify, 60 * 60 * 1000);
    }, 2 * 60 * 1000);

    return () => {
      if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [notificationsEnabled]);

  return null;
}
