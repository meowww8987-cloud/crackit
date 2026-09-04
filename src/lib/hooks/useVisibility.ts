'use client';

import { useState, useEffect } from 'react';

/**
 * useVisibility — returns false when the document is hidden (tab switched,
 * app backgrounded, screen off). Use this to pause infinite animations and
 * intervals when the user isn't looking — saves battery + reduces heating.
 *
 * On mount, also fires on `visibilitychange` + `blur`/`focus` events.
 */
export function useVisibility(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    const onFocus = () => setVisible(true);
    const onBlur = () => setVisible(false);
    update(); // sync on mount

    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return visible;
}

/**
 * useReducedMotion — reads the user's reduceAnimations setting + OS preference.
 * Returns true if animations should be minimal.
 */
export function useReducedMotion(): boolean {
  // Lazy import to avoid circular deps
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Check OS preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const osReduced = mq.matches;

    // Check app setting (from localStorage to avoid circular dep with store)
    let appReduced = false;
    try {
      const stored = localStorage.getItem('neet-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        appReduced = parsed?.state?.reduceAnimations ?? false;
      }
    } catch {}

    setReduced(osReduced || appReduced);

    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
