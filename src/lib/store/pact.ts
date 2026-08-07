'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayKey, dateKey, addDays } from '@/lib/utils';

/**
 * StudyPact — a mutual commitment between paired study partners.
 *
 * Both partners commit to studying X hours in a day. If BOTH hit the
 * target, they earn a "pact day" (counts toward a pact streak). If
 * EITHER misses, the pact streak resets to 0 for both.
 *
 * The pact is set daily (or recurring). Each partner's progress is
 * tracked via their synced `todaySec` in the PartnerSyncPayload.
 *
 * NOTE: This is a local-first implementation. The pact target is stored
 * locally and the partner's progress is read from partnerLastData (which
 * is already synced via the existing partner polling). No new API routes
 * needed — the pact "state" is derived from each side's synced data.
 */

export interface PactDay {
  date: string;        // YYYY-MM-DD
  targetHours: number; // committed hours
  // Filled in at end-of-day (midnight rollover):
  mySec: number;       // seconds I studied that day
  partnerSec: number;  // seconds partner studied that day
  success: boolean;    // both hit target
}

interface PactStore {
  /** Active daily target in hours. Null = no pact active. */
  activeTargetHours: number | null;
  /** Date the active pact was set (YYYY-MM-DD). */
  activePactDate: string | null;
  /** Whether the pact recurs daily (auto-sets same target next day). */
  recurring: boolean;
  /** Past completed pact days (most recent first). */
  history: PactDay[];
  /** Current pact streak (consecutive successful days). */
  streak: number;

  /** Set a daily pact target. If recurring=true, auto-renews next day. */
  setPact: (hours: number, recurring: boolean) => void;
  /** Cancel the active pact. */
  cancelPact: () => void;
  /** Called at midnight rollover (or on app open) to finalize yesterday's
   *  pact: reads mySec + partnerSec, computes success, updates streak. */
  finalizeYesterday: (mySec: number, partnerSec: number) => void;
  /** Get today's pact (or null). */
  getTodayPact: () => { targetHours: number; targetSec: number } | null;
}

export const usePact = create<PactStore>()(
  persist(
    (set, get) => ({
      activeTargetHours: null,
      activePactDate: null,
      recurring: false,
      history: [],
      streak: 0,

      setPact: (hours, recurring) => {
        const today = todayKey();
        set({
          activeTargetHours: hours,
          activePactDate: today,
          recurring,
        });
      },

      cancelPact: () => {
        set({
          activeTargetHours: null,
          activePactDate: null,
          recurring: false,
        });
      },

      finalizeYesterday: (mySec, partnerSec) => {
        const s = get();
        if (!s.activePactDate) return;
        const today = todayKey();
        // If the active pact date is yesterday (or older), finalize it.
        if (s.activePactDate >= today) return; // still today, don't finalize

        const targetSec = (s.activeTargetHours || 0) * 3600;
        const success = mySec >= targetSec && partnerSec >= targetSec;

        const day: PactDay = {
          date: s.activePactDate,
          targetHours: s.activeTargetHours || 0,
          mySec,
          partnerSec,
          success,
        };

        const newStreak = success ? s.streak + 1 : 0;

        set({
          history: [day, ...s.history].slice(0, 90), // keep 90 days
          streak: newStreak,
          // If recurring, set today's pact with the same target
          activePactDate: s.recurring ? today : null,
          activeTargetHours: s.recurring ? s.activeTargetHours : null,
        });
      },

      getTodayPact: () => {
        const s = get();
        if (!s.activeTargetHours || s.activePactDate !== todayKey()) {
          // If recurring but pact date is stale, refresh it
          if (s.recurring && s.activeTargetHours && s.activePactDate !== todayKey()) {
            set({ activePactDate: todayKey() });
            return { targetHours: s.activeTargetHours, targetSec: s.activeTargetHours * 3600 };
          }
          return null;
        }
        return {
          targetHours: s.activeTargetHours,
          targetSec: s.activeTargetHours * 3600,
        };
      },
    }),
    { name: 'neet-pact' }
  )
);
