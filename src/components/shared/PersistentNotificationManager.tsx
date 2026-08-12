'use client';

import { useEffect, useRef } from 'react';
import { useSettings } from '@/lib/store/settings';
import { useSession } from '@/lib/store/session';
import { useSleep } from '@/lib/store/sleep';
import { useTests } from '@/lib/store/tests';
import {
  buildNotificationPayload,
  postNotificationUpdate,
  closePersistentNotification,
} from '@/lib/notification/persistent-notif';

/**
 * PersistentNotificationManager — keeps the persistent study notification
 * in sync with the app state.
 *
 * Behavior:
 *  - Only active when settings.persistentNotification === true AND
 *    Notification.permission === 'granted'
 *  - Rebuilds + reposts the notification every 60 seconds (for live timer)
 *  - Rebuilds immediately on any state change (session start/stop, sleep
 *    start/wake, settings change, tests change)
 *  - Listens for NOTIF_ACTION messages from the service worker (triggered
 *    by tapping action buttons) and dispatches the corresponding action:
 *      'sleep'  → startSleep()
 *      'wake'   → no-op (just focus; SleepLockScreen is already shown and
 *                 the user double-taps to trigger the math wake flow)
 *      'pause'  → session.pause()
 *      'stop'   → session.stop()
 *  - Closes the notification when the toggle is turned off
 *
 * Per user request, time-of-day mood changes (icons + scene) appear ONLY
 * in the SLEEPING state — awake states always use the app icon.
 *
 * Limitation (PWA): the notification disappears when the app is fully
 * closed (Android kills the SW after ~5min idle). For a truly persistent
 * notification we'd need a native Capacitor wrapper — see roadmap.
 */

const UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute

export function PersistentNotificationManager() {
  const enabled = useSettings((s) => s.persistentNotification);
  const sessionActive = useSession((s) => s.active);
  const sleepActive = useSleep((s) => s.activeSleep);
  const tests = useTests((s) => s.tests);
  const dailyGoalHours = useSettings((s) => s.dailyGoalHours);

  // Action callbacks — keep refs so we don't re-run the effect on every tick.
  // NOTE: must use individual scalar selectors, NOT a single selector returning
  // an object literal — that would create a new object every render and trigger
  // an infinite re-render loop with Zustand's default referential equality.
  const pauseSession = useSession((s) => s.pause);
  const stopSession = useSession((s) => s.stop);
  const startSleep = useSleep((s) => s.startSleep);
  const pauseRef = useRef(pauseSession);
  const stopRef = useRef(stopSession);
  const startSleepRef = useRef(startSleep);
  useEffect(() => {
    pauseRef.current = pauseSession;
    stopRef.current = stopSession;
    startSleepRef.current = startSleep;
  });

  // === Main effect: enable/disable + tick loop ===
  useEffect(() => {
    if (!enabled) {
      closePersistentNotification();
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;

    // Immediate first update
    const update = () => {
      const payload = buildNotificationPayload();
      if (payload) postNotificationUpdate(payload);
    };
    update();

    // Tick every 60s for live timer
    const interval = setInterval(update, UPDATE_INTERVAL_MS);

    // Listen for NOTIF_ACTION messages from the SW
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'NOTIF_ACTION') return;
      const action = data.action;
      if (action === 'sleep') {
        startSleepRef.current();
      } else if (action === 'pause') {
        pauseRef.current();
      } else if (action === 'stop') {
        stopRef.current();
      }
      // 'wake' = no-op: the SleepLockScreen is already shown when activeSleep
      // is set, so just focusing the app (which the SW already did) is enough.
      // The user then double-taps → math challenge → wakeUp().
      update();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      closePersistentNotification();
    };
  }, [enabled]);

  // === Re-update immediately on session/sleep/tests/goal state change ===
  // (NOT on every session tick — the 60s interval handles live timer updates.
  // We only need an immediate refresh when the STATE MODE changes: idle ↔
  // studying ↔ sleeping, or tests/goal changes affect the displayed info.)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const payload = buildNotificationPayload();
    if (payload) postNotificationUpdate(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionActive !== null, sleepActive !== null, tests, dailyGoalHours]);

  return null;
}
