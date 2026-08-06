'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, BookOpen, GraduationCap, History, FileText, BarChart3, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react';
import { useNav, type TabKey, TAB_ORDER } from '@/lib/store/nav';
import { useSession } from '@/lib/store/session';
import { cn, vibrate } from '@/lib/utils';
import { FocusTimer } from '@/components/timer/FocusTimer';
import { FloatingWidget } from '@/components/widget/FloatingWidget';
import { MoodPicker } from '@/components/timer/MoodPicker';
import { StudyTab } from '@/components/tabs/StudyTab';
import { HomeTab } from '@/components/tabs/HomeTab';
import { SyllabusTab } from '@/components/tabs/SyllabusTab';
import { HistoryTab } from '@/components/tabs/HistoryTab';
import { TestsTab } from '@/components/tabs/TestsTab';
import { StatsTab } from '@/components/tabs/StatsTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { ActiveRecallChallenge } from '@/components/recall/ActiveRecallChallenge';
import { FreeStudyPicker } from '@/components/study/FreeStudyPicker';
import { useHistory } from '@/lib/store/history';
import { PWARegister } from '@/components/pwa/PWARegister';
import { ToastContainer, pushToast } from '@/components/shared/Toast';
import { ProgressTimeline } from '@/components/timeline/ProgressTimeline';
import { ConfettiCanvas, triggerConfetti } from '@/components/shared/Effects';
import { GradientMesh } from '@/components/shared/GradientMesh';
import { Scene3D } from '@/components/shared/Scene3D';
import { Splash3D } from '@/components/shared/Splash3D';
import { DailySummaryCard } from '@/components/home/DailySummaryCard';
import { PaperTestCompanion } from '@/components/tests/PaperTestCompanion';
import { PaperTestPicker } from '@/components/tests/PaperTestPicker';
import { TutorialManager } from '@/components/shared/TutorialManager';
import { configureSounds } from '@/lib/sounds';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { usePartnerSync } from '@/hooks/usePartnerSync';

// Global state for showing the active recall challenge (avoids prop drilling)
let _showRecallChallenge: () => void = () => {};
export function triggerRecallChallenge() { _showRecallChallenge(); }

// Global state for showing the progress timeline
let _showTimeline: () => void = () => {};
export function triggerTimeline() { _showTimeline(); }

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'study', label: 'Study', icon: BookOpen },
  { key: 'syllabus', label: 'Syllabus', icon: GraduationCap },
  { key: 'history', label: 'History', icon: History },
  { key: 'tests', label: 'Tests', icon: FileText },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function AppShell() {
  const { activeTab, setTab, swipeToTab } = useNav();
  const { active, focusOpen, pendingMoodSession, tick } = useSession();
  const minimalMode = useSettings((s) => s.minimalMode);
  const oledBlack = useSettings((s) => s.oledBlack);
  // === Global partner sync — runs on ALL tabs so live data is always fresh ===
  usePartnerSync();
  const [navVisible, setNavVisible] = useState(true);
  const [showRecall, setShowRecall] = useState(false);
  const [showFreeStudy, setShowFreeStudy] = useState(false);
  const [showPaperTestPicker, setShowPaperTestPicker] = useState(false);
  const [activePaperTestId, setActivePaperTestId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTarget = useRef<HTMLElement | null>(null);
  const studyTabLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const testsTabLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous tab for directional page transitions
  const prevTabRef = useRef<TabKey | null>(null);

  // Register the recall trigger
  useEffect(() => {
    _showRecallChallenge = () => setShowRecall(true);
    _showTimeline = () => setShowTimeline(true);

    // Restore session on app load — auto-pause if was running
    useSession.getState().restoreSession();
  }, []);

  // Apply OLED Black + Minimal Mode on mount
  useEffect(() => {
    import('@/lib/store/settings').then(({ applyOledBlack, applyMinimalMode }) => {
      applyOledBlack(useSettings.getState().oledBlack);
      applyMinimalMode(useSettings.getState().minimalMode);
    });
  }, []);

  // Apply OLED Black when setting changes
  useEffect(() => {
    import('@/lib/store/settings').then(({ applyOledBlack }) => applyOledBlack(oledBlack));
  }, [oledBlack]);

  // Apply Minimal Mode when setting changes
  useEffect(() => {
    import('@/lib/store/settings').then(({ applyMinimalMode }) => applyMinimalMode(minimalMode));
  }, [minimalMode]);

  // === Back button prevention ===
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // On PWA / mobile, a single back press should NOT exit the app.
    // Strategy: push a dummy history state on mount, then intercept popstate.
    // First back press: show "Press back again to exit" toast, re-push state.
    // Second back press (within 2s): allow exit.
    // Push a dummy state so there's something to "go back" to
    window.history.pushState({ app: true }, '');
    let backPressedAt = 0;
    const onPopState = (e: PopStateEvent) => {
      const now = Date.now();
      if (now - backPressedAt < 2000) {
        // Second press within 2s → allow exit
        window.history.back();
        return;
      }
      // First press → prevent exit, show toast, re-push state
      backPressedAt = now;
      window.history.pushState({ app: true }, '');
      vibrate(15);
      import('@/components/shared/Toast').then(({ pushToast }) =>
        pushToast('Press back again to exit', '', 'info')
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Configure sound system from settings (and re-configure when they change)
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const soundVolume = useSettings((s) => s.soundVolume);
  useEffect(() => {
    configureSounds(soundEnabled, soundVolume);
  }, [soundEnabled, soundVolume]);

  // Animation settings — used by page transitions + tab indicator
  const reduceAnimations = useSettings((s) => s.reduceAnimations);
  const animationIntensity = useSettings((s) => s.animationIntensity);

  // Register the syllabus toast handler (connects SyllabusTab → ToastContainer)
  useEffect(() => {
    import('@/components/tabs/SyllabusTab').then(({ setSyllabusToastHandler }) => {
      setSyllabusToastHandler((msg, sub) => pushToast(msg, sub));
    });
  }, []);

  // ====== Tick loop ======
  // Single setInterval that calls tick() every second.
  // tick() reads FRESH state from store — never closes over changing timestamps.
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  // ====== Auto-detect tab switching / app backgrounding ======
  useEffect(() => {
    const markAway = () => {
      useSession.getState().markAway();
    };
    const handleReturn = () => {
      useSession.getState().handleReturn();
      // Re-enter fullscreen if focus timer was open
      if (useSession.getState().active && useSession.getState().focusOpen) {
        enterFullscreen();
      }
    };

    // visibilitychange — fires when tab is hidden/shown (desktop + mobile)
    const onVisibility = () => {
      if (document.hidden) markAway();
      else handleReturn();
    };

    // blur/focus — catches when app loses focus (mobile app switch)
    const onBlur = () => markAway();
    const onFocus = () => handleReturn();

    // pagehide/pageshow — catches mobile app backgrounding (iOS/Android)
    const onPageHide = () => markAway();
    const onPageShow = () => handleReturn();

    // freeze/resume — catches PWA going to background (Android)
    const onFreeze = () => markAway();
    const onResume = () => handleReturn();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResume);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('freeze', onFreeze);
      document.removeEventListener('resume', onResume);
    };
  }, []);

  // ====== Touch-driven nav hide/show ======
  // Uses touch movement (not scroll position) so it works even on short pages
  const touchTrackY = useRef<number | null>(null);
  const touchActive = useRef(false);

  const onTouchStartNav = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchTrackY.current = e.touches[0].clientY;
    touchActive.current = true;
    // Also handle tab swipe
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTarget.current = e.target as HTMLElement;
  };

  const onTouchMoveNav = (e: React.TouchEvent) => {
    if (!touchActive.current || touchTrackY.current === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchTrackY.current;

    // Swipe UP (finger moves up = delta negative) → hide nav
    if (delta < -15) {
      setNavVisible(false);
      touchTrackY.current = currentY;
    }
    // Swipe DOWN (finger moves down = delta positive) → show nav
    else if (delta > 15) {
      setNavVisible(true);
      touchTrackY.current = currentY;
    }
  };

  const onTouchEndNav = (e: React.TouchEvent) => {
    touchActive.current = false;
    touchTrackY.current = null;

    // Handle tab swipe
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const target = touchStartTarget.current;
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTarget.current = null;

    // Ignore if not a horizontal swipe
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    // Ignore touches on focus overlay, widget, cards, or interactive elements
    if (target?.closest('[data-focus-overlay], [data-session-widget], [data-card], button, input, textarea, [role="slider"], [role="dialog"]')) {
      return;
    }

    if (dx > 0) swipeToTab('right'); // swipe right = go to previous tab (left in order)
    else swipeToTab('left'); // swipe left = go to next tab
  };

  return (
    <div className="fixed inset-0 bg-adaptive text-adaptive overflow-hidden flex flex-col">
      {/* 3D Splash screen — shown on first mount, fades out after ~1.8s.
          Displays rotating atom + NEET 2027 countdown. */}
      {showSplash && <Splash3D onDone={() => setShowSplash(false)} />}

      {/* Aurora 2.0 — animated multi-layer gradient background with parallax
          depth + subject-aware brightness boost when a session is running. */}
      <GradientMesh />

      {/* === Adaptive Subject Glow ===
          When a session is active, adds a subtle colored tint to the entire screen
          based on the current subject (Physics=blue, Chem=purple, Botany=green, Zoology=red).
          Barely visible — like a mood light. */}
      {active && !active.paused && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
          style={{
            zIndex: 2,
            opacity: 0.04,
            background: `radial-gradient(circle at 50% 30%, ${subjectColor(active.subject).hex}, transparent 70%)`,
          }}
        />
      )}

      {/* 3D NEET scene — atoms / DNA / molecules / cells, subject-aware.
          Sits above the aurora but below the grid/noise/vignette overlays.
          Returns null when bg3DMode === 'off' (settings-controlled). */}
      <Scene3D />

      {/* Grid overlay for texture */}
      <div className="fixed inset-0 grid-bg pointer-events-none" style={{ zIndex: 1 }} />

      {/* Aurora noise + vignette overlays — layered above the canvas but below
          all content. Noise kills gradient banding; vignette focuses the eye. */}
      <div className="aurora-noise" aria-hidden />
      <div className="aurora-vignette" aria-hidden />

      {/* Top bar — sticky settings gear */}
      <div className="relative z-30">
        <TopBar />
      </div>

      {/* Main scroll area — touch-driven nav */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStartNav}
        onTouchMove={onTouchMoveNav}
        onTouchEnd={onTouchEndNav}
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-area relative z-10"
        style={{
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          paddingTop: '52px',
        }}
      >
        <div className="max-w-md mx-auto px-4 pb-6">
          {(() => {
            // Compute directional slide based on tab order
            const prevIdx = prevTabRef.current ? TAB_ORDER.indexOf(prevTabRef.current) : -1;
            const newIdx = TAB_ORDER.indexOf(activeTab);
            const direction = newIdx > prevIdx ? 1 : -1;
            return (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeTab}
                  initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, x: 30 * direction, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduceAnimations ? { opacity: 0 } : { opacity: 0, x: -30 * direction, scale: 0.98 }}
                  transition={
                    reduceAnimations
                      ? { duration: 0.12, ease: 'easeOut' }
                      : { duration: 0.22 - (animationIntensity / 100) * 0.08, ease: [0.4, 0, 0.2, 1] }
                  }
                  onAnimationStart={() => { prevTabRef.current = activeTab; }}
                >
              {activeTab === 'home' && <HomeTab />}
              {activeTab === 'study' && <StudyTab />}
              {activeTab === 'syllabus' && <SyllabusTab />}
              {activeTab === 'history' && <HistoryTab />}
              {activeTab === 'tests' && <TestsTab />}
              {activeTab === 'stats' && <StatsTab />}
              {activeTab === 'settings' && <SettingsTab />}
                </motion.div>
              </AnimatePresence>
            );
          })()}
        </div>
      </div>

      {/* Bottom nav — always rendered, slides with CSS transform (no spring bounce) */}
      <nav
        className="absolute bottom-0 left-0 right-0 z-40 safe-bottom transition-transform duration-300 ease-out"
        style={{ transform: navVisible ? 'translateY(0)' : 'translateY(120%)' }}
      >
            <div className="mx-auto max-w-md px-3 pb-2 pt-1">
              <div
                className="rounded-2xl px-1.5 py-1.5 flex items-center justify-between shadow-2xl"
                style={{
                  background: 'var(--card)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid var(--border)',
                }}
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  const isStudyTab = tab.key === 'study';
                  const isTestsTab = tab.key === 'tests';
                  const longPressHandler = isStudyTab || isTestsTab ? () => {
                    if (isStudyTab) {
                      studyTabLongPress.current = setTimeout(() => {
                        setShowFreeStudy(true);
                        vibrate(20);
                      }, 500);
                    } else {
                      testsTabLongPress.current = setTimeout(() => {
                        setShowPaperTestPicker(true);
                        vibrate(20);
                      }, 500);
                    }
                  } : undefined;
                  const clearLongPress = isStudyTab || isTestsTab ? () => {
                    if (isStudyTab && studyTabLongPress.current) {
                      clearTimeout(studyTabLongPress.current);
                      studyTabLongPress.current = null;
                    }
                    if (isTestsTab && testsTabLongPress.current) {
                      clearTimeout(testsTabLongPress.current);
                      testsTabLongPress.current = null;
                    }
                  } : undefined;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        if (activeTab !== tab.key) {
                          setTab(tab.key);
                          vibrate(8);
                          import('@/lib/sounds').then(({ playSound }) => playSound('tap'));
                        }
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onPointerDown={longPressHandler}
                      onPointerUp={clearLongPress}
                      onPointerLeave={clearLongPress}
                      onPointerCancel={clearLongPress}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl transition-all',
                        'min-w-[42px] h-12 px-1.5',
                        isActive ? 'text-adaptive' : 'text-adaptive-muted hover:text-adaptive',
                        // Hide History, Tests, Stats tabs in Minimal Mode
                        minimalMode && (tab.key === 'history' || tab.key === 'tests' || tab.key === 'stats') && 'minimal-hide'
                      )}
                      aria-label={tab.label}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="tab-indicator"
                          className="absolute inset-0 rounded-xl"
                          style={{ background: 'rgba(20, 184, 166, 0.2)' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <motion.div
                        animate={
                          reduceAnimations
                            ? {}
                            : { scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }
                        }
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        className="relative z-10"
                      >
                      <Icon
                        size={20}
                        strokeWidth={isActive ? 2.5 : 2}
                        style={{ opacity: isActive ? 1 : 0.85 }}
                      />
                      </motion.div>
                    </button>
                  );
                })}
              </div>
            </div>
      </nav>

      {/* Floating widget (when focus timer is minimized) */}
      {active && !focusOpen && !pendingMoodSession && <FloatingWidget />}

      {/* Focus timer overlay */}
      <AnimatePresence>
        {focusOpen && active && <FocusTimer key="focus" />}
      </AnimatePresence>

      {/* Mood picker */}
      <AnimatePresence>
        {pendingMoodSession && <MoodPicker key="mood" />}
      </AnimatePresence>

      {/* Active Recall Challenge */}
      <AnimatePresence>
        {showRecall && <ActiveRecallChallenge key="recall" onClose={() => setShowRecall(false)} />}
      </AnimatePresence>

      {/* Free Study Picker */}
      <AnimatePresence>
        {showFreeStudy && <FreeStudyPicker key="freestudy" onClose={() => setShowFreeStudy(false)} />}
      </AnimatePresence>

      {/* Paper Test Picker — activated by long-press on Tests tab */}
      <AnimatePresence>
        {showPaperTestPicker && (
          <PaperTestPicker
            key="paperpicker"
            onClose={() => setShowPaperTestPicker(false)}
            onSelectTest={(testId) => {
              setActivePaperTestId(testId);
              setShowPaperTestPicker(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Paper Test Companion — full-screen test timer + answer logger */}
      {activePaperTestId && (
        <PaperTestCompanion
          key="papercompanion"
          testId={activePaperTestId}
          onClose={() => setActivePaperTestId(null)}
        />
      )}

      {/* Progress Timeline */}
      <AnimatePresence>
        {showTimeline && <ProgressTimeline key="timeline" onClose={() => setShowTimeline(false)} />}
      </AnimatePresence>

      {/* PWA registration + install prompt + offline indicator */}
      <PWARegister />

      {/* Toast notifications */}
      <ToastContainer />
      <ConfettiCanvas />

      {/* Daily Summary — auto-shows at 9 PM or morning after */}
      <DailySummaryCard />

      {/* Tutorial Manager — shows coach marks when tutorialMode is ON */}
      <TutorialManager />
    </div>
  );
}

function TopBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 h-13 px-4 py-2.5 flex items-center pointer-events-none">
      <div className="flex items-center gap-1.5 pointer-events-auto">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-teal-500/20">
          N
        </div>
        <span className="text-sm font-semibold tracking-tight gradient-text">NEET 2027</span>
      </div>
    </div>
  );
}

function enterFullscreen() {
  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch {}
}
