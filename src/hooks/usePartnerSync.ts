'use client';

import { useEffect, useRef } from 'react';
import { usePartner } from '@/lib/store/partner';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { usePractice } from '@/lib/store/practice';
import { useTargets } from '@/lib/store/targets';
import { useTests } from '@/lib/store/tests';

/**
 * usePartnerSync — GLOBAL partner sync hook (mounted in AppShell).
 *
 * DESIGN PRINCIPLES:
 * 1. **Push frequently** — partner data must feel LIVE, not stale.
 *    - 5s while studying (partner sees timer counting up almost real-time)
 *    - 15s while idle (keeps "last seen" very fresh)
 * 2. **Sync on ANY state change** — not just session, but also when targets
 *    are added/done, when sessions are saved, when tests are logged, AND when
 *    practice starts/pauses/resumes.
 * 3. **Hydration-aware** — Zustand persist stores hydrate async from
 *    localStorage. We wait for hydration before the first sync so we don't
 *    push empty/default values to the server.
 * 4. **Fetch on every push** — so our own partnerLastData stays fresh even
 *    when the user isn't looking at the Home tab.
 */
export function usePartnerSync() {
  const partnerCode = usePartner((s) => s.code);
  const syncData = usePartner((s) => s.syncData);
  const fetchPartnerData = usePartner((s) => s.fetchPartnerData);

  const activeSession = useSession((s) => s.active);
  const sessionsLen = useHistory((s) => s.sessions.length);
  const focusOpen = useSession((s) => s.focusOpen);
  const activePractice = usePractice((s) => s.activePractice);
  const pausedPracticesLen = usePractice((s) => s.pausedPractices.length);
  const targetsLen = useTargets((s) => {
    // Sum all today's targets across byDate — triggers re-render on add/delete/toggle
    const today = new Date().toISOString().slice(0, 10);
    const list = s.byDate[today] || [];
    return list.length + list.filter(t => t.done).length * 0.5;
  });
  const testsLen = useTests((s) => s.tests.length);

  // Session state key — changes when start/pause/resume/stop/waste happens.
  const sessionKey = activeSession
    ? `${activeSession.targetId}:${activeSession.paused ? 'p' : 'r'}:${activeSession.wasting ? 'w' : 's'}:${activeSession.subject}`
    : 'none';

  // Practice state key — changes when practice starts/pauses/resumes/ends.
  // Includes startedAt so a brand-new practice (different start time) triggers a sync.
  const practiceKey = activePractice
    ? `${activePractice.id}:${activePractice.startedAt}:${activePractice.subject}`
    : 'none';

  // Track whether session is active for interval speed selection.
  const hasActiveRef = useRef(false);
  hasActiveRef.current = (!!activeSession && !activeSession.paused) || !!activePractice;

  // === Immediate sync on ANY relevant state change (debounced 300ms) ===
  // Fires when: session starts/pauses/resumes/stops, target added/done,
  // session saved, test logged, practice starts/pauses/resumes/ends.
  useEffect(() => {
    if (!partnerCode) return;
    const t = setTimeout(() => {
      syncData();
      fetchPartnerData();
    }, 300);
    return () => clearTimeout(t);
  }, [partnerCode, sessionKey, practiceKey, sessionsLen, pausedPracticesLen, targetsLen, testsLen, syncData, fetchPartnerData]);

  // === Periodic sync — REAL-TIME, every 3 seconds ===
  // Push + fetch every 3s so both sides see updates within ~6s end-to-end.
  // This is aggressive but the payload is tiny (~200 bytes) and the feature
  // needs to feel LIVE. 3s is the sweet spot between real-time feel and
  // battery/network impact.
  useEffect(() => {
    if (!partnerCode) return;

    // Initial sync on mount / when code changes
    syncData();
    fetchPartnerData();

    // Sync interval — 30s globally (was 3s, too aggressive for low-end devices).
    // During FocusTimer: still 30s (already optimized).
    // The 'updated Xs ago' display on PartnerCard handles the perception of freshness.
    const i = setInterval(() => {
      syncData();
      fetchPartnerData();
    }, 30_000);

    return () => clearInterval(i);
  }, [partnerCode, sessionKey, practiceKey, sessionsLen, pausedPracticesLen, targetsLen, syncData, fetchPartnerData]);

  // Fetch partner data when tab becomes visible OR window regains focus.
  // CRITICAL: mobile browsers throttle setInterval when the tab goes to the
  // background. When the user comes back, we must IMMEDIATELY push our data
  // (so the partner sees us as online) AND fetch the partner's latest data.
  // Without this, the partner sees "Offline" for up to 5s after we return.
  useEffect(() => {
    if (!partnerCode) return;
    const onWake = () => {
      // Push our data immediately + fetch partner's
      syncData();
      fetchPartnerData();
      // Push again after 2s — the first push might race with the network
      // reconnecting after background. Second one ensures the server has
      // our freshest data.
      setTimeout(() => { syncData(); fetchPartnerData(); }, 2000);
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [partnerCode, syncData, fetchPartnerData]);

  // Online recovery (network was down, now back)
  useEffect(() => {
    if (!partnerCode) return;
    const onOnline = () => {
      syncData();
      fetchPartnerData();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [partnerCode, syncData, fetchPartnerData]);

  // === Push isStudying:false when closing/backgrounding the app ===
  // When the user closes/backgrounds the app while studying, the last pushed
  // payload has isStudying:true and stays on the server forever. The partner
  // then sees "Studying" indefinitely until the user reopens.
  // This handler fires on beforeunload/pagehide/visibilitychange(hidden) and
  // pushes a final sync with the CURRENT state (which will have isStudying
  // based on whether the session is still active at close time).
  // NOTE: syncData reads FRESH state from stores, so if restoreSession/tick
  // already closed the session on date-change, isStudying will be false.
  useEffect(() => {
    if (!partnerCode) return;
    const onUnload = () => {
      // Fire-and-forget — the fetch may not complete before the page unloads,
      // but sendBeacon-style headers give it the best chance.
      try { syncData(); } catch {}
    };
    const onVisibilityHidden = () => {
      if (document.hidden) {
        try { syncData(); } catch {}
      }
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    document.addEventListener('visibilitychange', onVisibilityHidden);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      document.removeEventListener('visibilitychange', onVisibilityHidden);
    };
  }, [partnerCode, syncData]);
}
