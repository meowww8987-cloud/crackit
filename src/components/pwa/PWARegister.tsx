'use client';

import { useEffect, useState } from 'react';
import { Download, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

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
          .register('/sw.js?v=43')
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
                <div className="text-[10px] text-white/50">
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
                className="text-white/40 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Fullscreen hint — shown when the app is NOT installed (running in
          a browser tab) and the user hasn't dismissed it. Encourages the user
          to "Add to Home Screen" for true fullscreen. === */}
      <AnimatePresence>
        {!isFullscreenMode && !installPrompt && (() => {
          // Only show this hint if there's no beforeinstallprompt (iOS Safari
          // doesn't support it — those users need manual instructions).
          const dismissed = typeof window !== 'undefined' && localStorage.getItem('neet-fullscreen-hint-dismissed');
          if (dismissed) return null;
          return (
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
                  <div className="text-[10px] text-white/50">
                    For true fullscreen (no status bar) → tap your browser menu → "Add to Home Screen"
                  </div>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('neet-fullscreen-hint-dismissed', '1');
                    setShowInstall(false);
                  }}
                  className="text-white/40 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
