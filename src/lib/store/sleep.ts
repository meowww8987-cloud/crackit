'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayKey, dateKey, addDays } from '@/lib/utils';

/**
 * SleepEntry — one complete sleep record (bed → wake).
 * `wakeTime` is null while sleeping is in progress.
 */
export interface SleepEntry {
  id: string;
  /** Timestamp (ms) when user went to bed. */
  bedTime: number;
  /** Timestamp (ms) when user woke up. Null while sleeping is active. */
  wakeTime: number | null;
  /** Duration in seconds (computed on wake). Null while sleeping. */
  durationSec: number | null;
  /** Date key (YYYY-MM-DD) of the WAKE date — used for daily grouping.
   *  If you sleep 11 PM Mon → 7 AM Tue, the entry belongs to Tuesday. */
  date: string;
  /** Quality rating 1-5, set on wake (optional). */
  quality: number | null;
}

interface SleepStore {
  /** Currently active sleep session, or null if awake. */
  activeSleep: SleepEntry | null;
  /** Past completed sleep entries (most recent first). */
  history: SleepEntry[];

  /** Start a sleep session — sets activeSleep, fires a persistent
   *  notification (if permission granted). */
  startSleep: () => void;
  /** End the active sleep session — moves it to history with wakeTime +
   *  durationSec. Optionally set quality (1-5). */
  wakeUp: (quality?: number) => void;
  /** Cancel an accidental sleep start (no entry saved). */
  cancelSleep: () => void;
  /** Manually add a past sleep entry (for backfilling forgotten nights).
   *  Takes bed time + wake time as timestamps; computes duration + date. */
  addManualSleep: (bedTime: number, wakeTime: number, quality?: number) => void;
  /** Delete a sleep entry from history (for correcting mistakes). */
  deleteSleep: (id: string) => void;

  /** Get all sleep entries for a given date (YYYY-MM-DD). */
  getForDate: (date: string) => SleepEntry[];
  /** Get the last 7 days of sleep entries. */
  getWeek: () => SleepEntry[];
  /** Total sleep seconds for a given date. */
  getDurationForDate: (date: string) => number;
  /** Average sleep hours over the last N days. */
  getAverageHours: (days: number) => number;
}

export const useSleep = create<SleepStore>()(
  persist(
    (set, get) => ({
      activeSleep: null,
      history: [],

      startSleep: () => {
        // Don't start if already sleeping
        if (get().activeSleep) return;
        const now = Date.now();
        const entry: SleepEntry = {
          id: `sleep_${now}`,
          bedTime: now,
          wakeTime: null,
          durationSec: null,
          // Date = the date when you WAKE (assume you'll wake tomorrow if
          // you sleep after midnight). We compute this on wakeUp instead,
          // but set a placeholder here so getForDate works mid-sleep.
          date: todayKey(),
          quality: null,
        };
        set({ activeSleep: entry });
        // The PersistentNotificationManager component will detect this state
        // change and update the persistent notification to the sleep scene
        // (time-of-day themed icon + "Tap to wake" body + Wake Up button).
      },

      wakeUp: (quality) => {
        const active = get().activeSleep;
        if (!active) return;
        const now = Date.now();
        const durationSec = Math.max(0, Math.floor((now - active.bedTime) / 1000));
        // Date = wake date (so an 11 PM → 7 AM sleep belongs to the wake day)
        const wakeDate = todayKey();
        const completed: SleepEntry = {
          ...active,
          wakeTime: now,
          durationSec,
          date: wakeDate,
          quality: quality ?? null,
        };
        set((s) => ({
          activeSleep: null,
          history: [completed, ...s.history].slice(0, 100), // keep last 100
        }));
        // The PersistentNotificationManager will detect activeSleep = null
        // and revert the notification to the awake (idle) state.
      },

      cancelSleep: () => {
        set({ activeSleep: null });
        // The PersistentNotificationManager will revert to awake state.
      },

      addManualSleep: (bedTime, wakeTime, quality) => {
        // Validate: wakeTime must be after bedTime
        if (wakeTime <= bedTime) return;
        const durationSec = Math.max(0, Math.floor((wakeTime - bedTime) / 1000));
        // Date = the WAKE date (consistent with wakeUp logic)
        const wakeDate = dateKey(new Date(wakeTime));
        const entry: SleepEntry = {
          id: `sleep_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          bedTime,
          wakeTime,
          durationSec,
          date: wakeDate,
          quality: quality ?? null,
        };
        set((s) => ({
          history: [entry, ...s.history].slice(0, 100),
        }));
      },

      deleteSleep: (id) => {
        set((s) => ({
          history: s.history.filter((e) => e.id !== id),
        }));
      },

      getForDate: (date) => {
        return get().history.filter((e) => e.date === date);
      },

      getWeek: () => {
        const result: SleepEntry[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = addDays(new Date(), -i);
          const key = dateKey(d);
          result.push(...get().history.filter((e) => e.date === key));
        }
        return result;
      },

      getDurationForDate: (date) => {
        return get()
          .history.filter((e) => e.date === date)
          .reduce((sum, e) => sum + (e.durationSec || 0), 0);
      },

      getAverageHours: (days) => {
        let totalSec = 0;
        let count = 0;
        for (let i = 0; i < days; i++) {
          const d = addDays(new Date(), -i);
          const key = dateKey(d);
          const daySec = get().getDurationForDate(key);
          if (daySec > 0) {
            totalSec += daySec;
            count++;
          }
        }
        if (count === 0) return 0;
        return (totalSec / count) / 3600;
      },
    }),
    { name: 'neet-sleep' }
  )
);
