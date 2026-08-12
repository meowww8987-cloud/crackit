/**
 * Persistent Notification builder.
 *
 * Composes the notification payload (title, body, icon, actions, progress)
 * based on the current app state — one of three modes:
 *
 *  1. AWAKE · IDLE    — Today stats + NEET countdown + target progress + Sleep btn
 *  2. AWAKE · STUDYING — Current subject + live timer + session progress + Sleep btn
 *  3. SLEEPING        — Sleep duration + time-of-day themed scene + Wake Up btn
 *
 * The SLEEPING mode is the only one that uses the time-of-day themed icons
 * (per user request: "mood changes I want in sleeping time only"). 5 scenes:
 * night (22-5), dawn (5-7), morning (7-11), noon (11-16), dusk (16-19), evening (19-22).
 *
 * All payloads are sent to the service worker which calls showNotification().
 * The service worker also handles notificationclick → focus the app + dispatch
 * the action (sleep / wake / pause / stop) back to the React layer.
 */

import { useSession } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useSleep } from '@/lib/store/sleep';
import { useSettings } from '@/lib/store/settings';
import { useTests } from '@/lib/store/tests';
import { todayKey, diffDays } from '@/lib/utils';

const NEET_EXAM_DATE = '2027-05-01'; // NEET 2027 exam date

export interface NotifAction {
  action: string;
  title: string;
}

export interface NotifPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  progress?: number; // 0-100
  actions?: NotifAction[];
  url?: string;
}

/** Pick a time-of-day scene for the SLEEPING notification. */
export function getSleepScene(hour: number): {
  icon: string;
  body: string;
  image?: string;
} {
  // 22:00 – 5:00 → night
  if (hour >= 22 || hour < 5) {
    return {
      icon: '/notif/night.png',
      image: '/notif/sleep-scene.png',
      body: 'Sweet dreams under the moon 🌙 Tap to wake (double-tap + math)',
    };
  }
  // 5:00 – 7:00 → dawn
  if (hour < 7) {
    return {
      icon: '/notif/dawn.png',
      body: 'First light peeking through — sleep well 🌅 Tap to wake',
    };
  }
  // 7:00 – 11:00 → morning (you slept in!)
  if (hour < 11) {
    return {
      icon: '/notif/morning.png',
      body: 'Morning sun is up ☀️ Time to wake? Tap to start wake flow',
    };
  }
  // 11:00 – 16:00 → noon (sleeping in very late)
  if (hour < 16) {
    return {
      icon: '/notif/noon.png',
      body: 'Midday nap? Tap to wake up and start studying',
    };
  }
  // 16:00 – 19:00 → dusk nap
  if (hour < 19) {
    return {
      icon: '/notif/dusk.png',
      body: 'Evening nap — tap to wake and finish the day strong',
    };
  }
  // 19:00 – 22:00 → evening (early night sleep)
  return {
    icon: '/notif/evening.png',
    body: 'Early night 🌆 Tap to wake if you want to study more',
  };
}

function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function daysToNeet(): number {
  const today = todayKey();
  return Math.max(0, diffDays(today, NEET_EXAM_DATE));
}

function getNextTest(): { name: string; days: number } | null {
  const tests = useTests.getState().tests;
  const today = todayKey();
  const upcoming = tests
    .filter((t) => diffDays(today, t.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!upcoming) return null;
  return { name: upcoming.name, days: diffDays(today, upcoming.date) };
}

/** Compose the right notification payload for the current app state. */
export function buildNotificationPayload(): NotifPayload | null {
  const sleep = useSleep.getState();
  const session = useSession.getState();
  const history = useHistory.getState();
  const settings = useSettings.getState();

  // === SLEEPING state — highest priority ===
  if (sleep.activeSleep) {
    const elapsedSec = Math.floor((Date.now() - sleep.activeSleep.bedTime) / 1000);
    const bedTimeStr = new Date(sleep.activeSleep.bedTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const scene = getSleepScene(new Date().getHours());
    // Sleep target progress (default 8h = 28800s)
    const sleepTargetSec = 8 * 3600;
    const progress = Math.min(100, Math.round((elapsedSec / sleepTargetSec) * 100));

    return {
      title: `😴 Sleeping · ${fmtClock(elapsedSec)}`,
      body: `Asleep since ${bedTimeStr}\n${scene.body}`,
      icon: scene.icon,
      image: scene.image,
      progress,
      actions: [{ action: 'wake', title: '☀️ Wake Up' }],
      url: '/',
    };
  }

  // === AWAKE · STUDYING state ===
  if (session.active) {
    const subj = session.active.subject || 'Study';
    const chapter = session.active.chapter || '';
    const startTs = session.active.startedAt;
    const plannedSec = (session.active.expectedMinutes || 25) * 60;
    const elapsedSec = Math.floor((Date.now() - startTs) / 1000);
    const progress = Math.min(100, Math.round((elapsedSec / Math.max(60, plannedSec)) * 100));

    // Today total
    const today = todayKey();
    const todaySec = history.sessions
      .filter((s) => s.date === today)
      .reduce((a, s) => a + s.studySeconds, 0);

    const title = `${subj}${chapter ? ' · ' + chapter : ''}`;
    const body = `${fmtClock(elapsedSec)} studied · ${progress}% of ${session.active.expectedMinutes || 25}min\nToday: ${fmtClock(todaySec)}`;

    return {
      title,
      body,
      icon: '/icon-192.png',
      progress,
      actions: [
        { action: 'pause', title: '⏸ Pause' },
        { action: 'sleep', title: '🌙 Sleep' },
      ],
      url: '/',
    };
  }

  // === AWAKE · IDLE state ===
  const today = todayKey();
  const todaySessions = history.sessions.filter((s) => s.date === today);
  const todaySec = todaySessions.reduce((a, s) => a + s.studySeconds, 0);
  const wastedSec = todaySessions.reduce((a, s) => a + (s.wastedSeconds || 0), 0);
  const goalSec = settings.dailyGoalHours * 3600;
  const goalProgress = Math.min(100, Math.round((todaySec / Math.max(60, goalSec)) * 100));

  // Last studied time
  const lastSession = todaySessions
    .filter((s) => s.endedAt)
    .sort((a, b) => b.endedAt - a.endedAt)[0];
  let lastLine = 'Tap to start studying';
  if (lastSession) {
    const ago = Math.floor((Date.now() - lastSession.endedAt) / 60000);
    if (ago < 60) lastLine = `Last studied ${ago}m ago`;
    else lastLine = `Last studied ${Math.floor(ago / 60)}h ${ago % 60}m ago`;
  }

  const neetDays = daysToNeet();
  const nextTest = getNextTest();

  const title = `NEET 2027 · ${neetDays} days to go`;
  let body = `${fmtClock(todaySec)} studied · ${fmtClock(wastedSec)} wasted\n${lastLine}`;
  if (nextTest) {
    body += `\n📝 ${nextTest.name}: ${nextTest.days === 0 ? 'today' : nextTest.days === 1 ? 'tomorrow' : `in ${nextTest.days} days`}`;
  }

  return {
    title,
    body,
    icon: '/icon-192.png',
    progress: goalProgress,
    actions: [{ action: 'sleep', title: '🌙 Sleep' }],
    url: '/',
  };
}

/** Post a SHOW_NOTIFICATION message to the active service worker. */
export async function postNotificationUpdate(payload: NotifPayload): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', payload });
  } catch {
    // SW not ready yet — skip this update
  }
}

/** Post a CLOSE_NOTIFICATION message to the active service worker. */
export async function closePersistentNotification(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'CLOSE_NOTIFICATION' });
  } catch {
    // noop
  }
}
