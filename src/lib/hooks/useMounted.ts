'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `false` on the server and during the first client render,
 * then `true` after mount. Use this to gate rendering of any UI that
 * depends on Zustand-persisted state (which is 0/empty on the server
 * but populated on the client after rehydration) — otherwise React
 * throws a hydration mismatch error.
 *
 * @example
 * const mounted = useMounted();
 * return mounted && count > 0 ? <Badge>{count}</Badge> : null;
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  return mounted;
}
