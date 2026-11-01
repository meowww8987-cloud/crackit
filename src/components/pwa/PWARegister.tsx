'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, X, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  // === FIX (hydration mismatch): fullscreenHintDismissed is only knowable on
  // the client (localStorage). It starts `null` on both server and first client
  // render so they match, then becomes `true`/`false` after mount. This prevents
  // "Hydration failed because the server rendered HTML didn't match the client"
  // which happened because the server rendered the hint (can't read localStorage)
  // while the client skipped it (localStorage said dismissed). ===
  const [fullscreenHintDismissed, setFullscreenHintDismissed] = useState<boolean | null>(null);
  // === Stale-bundle guard ===
  // True when the server is serving a newer build than the one this page is
  // running (user left the app open, HMR connection died, code was fixed).
  const [staleBundle, setStaleBundle] = useState(false);
  const staleCheckBusy = useRef(false);

  // === STALE-BUNDLE GUARD — "you are testing old code" detector ===
  //
  // Problem this solves: the page stays open on the user's phone for hours.
  // When the dev server rebuilds (a fix is deployed), the HMR websocket may
  // already be dead (screen was locked / network dropped), so the open page
  // silently keeps running the OLD bundle. The user then "tests" the fix,
  // sees the old bug still there, and reports it as broken — even though the
  // fix is live on the server.
  //
  // How it works: fetch the shell HTML fresh (no-store) and compare the
  // /_next/static/chunks/*.js URLs the server references against the script
  // URLs this page actually loaded. A rebuild changes the chunk hashes, so a
  // mismatch means this page is outdated.
  //
  // When it checks (keeps false positives near zero):
  //   • on returning to the app after being hidden ≥ 30s (the classic case:
  //     user locked the phone, fix deployed, user comes back)
  //   • every 15 minutes while visible (long-lived foreground pages whose HMR
  //     socket silently dropped)
  // Never auto-reloads — only a small tappable pill (a session may be running).
  useEffect(() => {
    let disposed = false;
    const HIDDEN_THRESHOLD_MS = 30_000;
    const PERIODIC_MS = 15 * 60_000;
    let hiddenAt: number | null = null;

    const checkForStaleBundle = async () => {
      if (document.hidden || staleCheckBusy.current || staleBundle) return;
      staleCheckBusy.current = true;
      try {
        const res = await fetch('/', { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        // All chunk script URLs the server currently references
        const serverChunks = Array.from(html.matchAll(/src="(\/_next\/static\/chunks\/[^"']+\.js)"/g)).map((m) => m[1]);
        if (serverChunks.length === 0) return; // not a Next shell — skip
        // All script URLs this page has loaded (initial + dynamic imports)
        const loaded = new Set(
          Array.from(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src'))
        );
        const isStale = serverChunks.some((c) => !loaded.has(c));
        if (isStale && !disposed) setStaleBundle(true);
      } catch {
        // offline / server restarting — ignore, next check will retry
      } finally {
        staleCheckBusy.current = false;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        const away = hiddenAt ? Date.now() - hiddenAt : Infinity;
        hiddenAt = null;
        if (away >= HIDDEN_THRESHOLD_MS) {
          // Give the browser a moment to settle after wakeup before fetching
          setTimeout(checkForStaleBundle, 1500);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    const periodic = setInterval(checkForStaleBundle, PERIODIC_MS);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(periodic);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleBundle]);

  // Check if the app is running in PWA fullscreen/standalone mode.
  // If NOT, the user is in a browser tab — we should encourage installation
  // for the true fullscreen (no status bar) experience.
  useEffect(() => {
    const checkDisplayMode = () => {
      const isFS = window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true; // iOS Safari
      setIsFullscreenMode(isFS);
    };
    checkDisplayMode();
    window.matchMedia('(display-mode: fullscreen)').addEventListener('change', checkDisplayMode);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkDisplayMode);
    return () => {
      window.matchMedia('(display-mode: fullscreen)').removeEventListener('change', checkDisplayMode);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkDisplayMode);
    };
  }, []);

  // === FIX (hydration mismatch): read the fullscreen-hint dismissal flag ONLY
  // after mount, so SSR and first client render both produce the same output
  // (hint visible). The dismissal state is applied on the second render. ===
  useEffect(() => {
    try {
      setFullscreenHintDismissed(localStorage.getItem('neet-fullscreen-hint-dismissed') === '1');
    } catch {
      setFullscreenHintDismissed(false);
    }
  }, []);

  // Register service worker + clear old caches
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // First: unregister any existing service workers to clear stale caches
      navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        for (const reg of registrations) {
          await reg.unregister();
        }
        // Clear all caches
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        // Re-register fresh
        navigator.serviceWorker
          .register('/sw.js?v=49')
          .catch(() => {});
      });
    }
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show install banner if not previously dismissed
      const dismissed = localStorage.getItem('neet-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowInstall(true), 3000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Online/offline indicator
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
      setInstallPrompt(null);
    }
  };

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem('neet-install-dismissed', '1');
  };

  return (
    <>
      {/* Offline indicator */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-black text-center py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <WifiOff size={12} /> You're offline — app works from cache
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install prompt — shown when the app is NOT in fullscreen mode.
          Emphasizes that installing gives true fullscreen (no status bar,
          no browser chrome, no distractions). */}
      <AnimatePresence>
        {showInstall && installPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-3 right-3 z-[150] max-w-md mx-auto"
          >
            <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-teal-500/30 shadow-2xl">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center shrink-0">
                <Download size={16} className="text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Install for Fullscreen</div>
                <div className="text-[10px] text-muted-foreground">
                  {isFullscreenMode
                    ? 'Add to home screen for offline use'
                    : 'No status bar, no browser chrome — zero distractions'}
                </div>
              </div>
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-lg bg-teal-500 text-black text-xs font-bold active:scale-95"
              >
                Install
              </button>
              <button
                onClick={dismissInstall}
                className="text-muted-foreground hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Fullscreen hint — shown when the app is NOT installed (running in
          a browser tab) and the user hasn't dismissed it. Encourages the user
          to "Add to Home Screen" for true fullscreen.
          === FIX: uses fullscreenHintDismissed STATE (set after mount) instead
          of reading localStorage during render. `null` means "not mounted yet"
          → hint hidden until we know for sure, avoiding any hydration flash. === */}
      <AnimatePresence>
        {!isFullscreenMode && !installPrompt && fullscreenHintDismissed === false && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ delay: 2 }}
            className="fixed bottom-20 left-3 right-3 z-[140] max-w-md mx-auto"
          >
            <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-purple-500/30 shadow-2xl">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 text-lg">
                📱
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-purple-300">Add to Home Screen</div>
                <div className="text-[10px] text-muted-foreground">
                  For true fullscreen (no status bar) → tap your browser menu → "Add to Home Screen"
                </div>
              </div>
              <button
                onClick={() => {
                  try { localStorage.setItem('neet-fullscreen-hint-dismissed', '1'); } catch {}
                  setFullscreenHintDismissed(true);
                  setShowInstall(false);
                }}
                className="text-muted-foreground hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* === Stale-bundle pill — the page is running outdated code ===
          Offered with a one-tap Reload; dismissible if a session is in
          progress (the session state is persisted and survives reloads, so
          reloading is always safe — but the choice stays with the user). */}
      <AnimatePresence>
        {staleBundle && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-3 right-3 z-[160] max-w-md mx-auto"
          >
            <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-blue-400/40 shadow-2xl">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <RefreshCw size={16} className="text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-blue-200">Update ready</div>
                <div className="text-[10px] text-muted-foreground">
                  A newer version of the app is live — reload to get the latest fixes
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold active:scale-95"
              >
                Reload
              </button>
              <button
                onClick={() => setStaleBundle(false)}
                className="text-muted-foreground hover:text-white p-1"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
