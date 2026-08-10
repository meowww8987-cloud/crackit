'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, BookOpen, GraduationCap, History, FileText, BarChart3, Settings as SettingsIcon, Eye, EyeOff, PlayCircle, Brain, ChevronRight, Plus, Sigma, HelpCircle, Target, Trophy, ClipboardList, TrendingUp } from 'lucide-react';
import { useNav, type TabKey, TAB_ORDER } from '@/lib/store/nav';
import { useSession } from '@/lib/store/session';
import { cn, vibrate, todayKey } from '@/lib/utils';
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
import { BuildSyllabusSheet } from '@/components/syllabus/BuildSyllabusSheet';
import { FormulaVault } from '@/components/syllabus/FormulaVault';
import { WeeklyGoalCard } from '@/components/home/WeeklyGoalCard';
import { useDragState } from '@/lib/store/dragState';
import { useTargets } from '@/lib/store/targets';
import { useSyllabus as useSyllabusStore } from '@/lib/store/syllabus';
import { useHistory } from '@/lib/store/history';
import { PWARegister } from '@/components/pwa/PWARegister';
import { ToastContainer, pushToast } from '@/components/shared/Toast';
import { ProgressTimeline } from '@/components/timeline/ProgressTimeline';
import { ConfettiCanvas, triggerConfetti } from '@/components/shared/Effects';
import { GradientMesh } from '@/components/shared/GradientMesh';
import { Scene3D } from '@/components/shared/Scene3D';
import { Splash3D } from '@/components/shared/Splash3D';
import { SplashScreen } from '@/components/shared/SplashScreen';
import { DailySummaryCard } from '@/components/home/DailySummaryCard';
import { PaperTestCompanion } from '@/components/tests/PaperTestCompanion';
import { PaperTestPicker } from '@/components/tests/PaperTestPicker';
import { TutorialManager } from '@/components/shared/TutorialManager';
import { configureSounds } from '@/lib/sounds';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { usePartnerSync } from '@/hooks/usePartnerSync';
import { SleepLockScreen } from '@/components/dailylog/SleepLockScreen';
import { TabLongPressOverlay } from '@/components/shared/TabLongPressOverlay';
import { TabInfoSheet, type TabKey as InfoTabKey } from '@/components/shared/TabInfoSheet';
import { TutorialOnboarding } from '@/components/shared/TutorialOnboarding';

// Global state for showing the active recall challenge (avoids prop drilling)
let _showRecallChallenge: () => void = () => {};
export function triggerRecallChallenge() { _showRecallChallenge(); }

// Global state for showing the progress timeline
let _showTimeline: () => void = () => {};
export function triggerTimeline() { _showTimeline(); }

// Global state for showing the tutorial onboarding overlay
let _showTutorialOnboarding: () => void = () => {};
export function triggerTutorialOnboarding() { _showTutorialOnboarding(); }

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
  // New: unified long-press overlay for ALL tabs (home, study, syllabus, history, tests, stats)
  const [longPressTab, setLongPressTab] = useState<InfoTabKey | null>(null);
  // Tutorial info sheet — shown when user taps the ? button in the long-press overlay
  const [infoTab, setInfoTab] = useState<InfoTabKey | null>(null);
  // Tutorial onboarding overlay — shown when user turns ON tutorial toggle
  const [showTutorialOnboarding, setShowTutorialOnboarding] = useState(false);
  const [showBuildSheet, setShowBuildSheet] = useState(false);
  const [showFormulaVault, setShowFormulaVault] = useState(false);
  const [showWeeklyGoals, setShowWeeklyGoals] = useState(false);
  const [showTestHistory, setShowTestHistory] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showPaperTestPicker, setShowPaperTestPicker] = useState(false);
  const [activePaperTestId, setActivePaperTestId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  // === Drag-from-Syllabus-to-Study state ===
  const draggedLectureId = useDragState((s) => s.draggedLectureId);
  const isOverStudyTab = useDragState((s) => s.isOverStudyTab);
  const setOverStudyTab = useDragState((s) => s.setOverStudyTab);
  const endDrag = useDragState((s) => s.endDrag);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTarget = useRef<HTMLElement | null>(null);
  const studyTabLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous tab for directional page transitions
  const prevTabRef = useRef<TabKey | null>(null);

  // === Handle drop on Study tab (drag from Syllabus) ===
  const handleDropOnStudyTab = useCallback(() => {
    if (!draggedLectureId || !isOverStudyTab) {
      endDrag();
      return;
    }
    // Find the lecture + chapter + subject from the syllabus
    const lectures = useSyllabusStore.getState().lectures;
    const chapters = useSyllabusStore.getState().chapters;
    const subjects = useSyllabusStore.getState().subjects;
    const lec = lectures.find((l) => l.id === draggedLectureId);
    if (lec) {
      const ch = chapters.find((c) => c.id === lec.chapterId);
      const subj = subjects.find((s) => s.id === ch?.subjectId);
      if (ch && subj) {
        // Create a target with learned expected time
        import('@/lib/learnedTime').then(({ getLearnedExpectedMinutes }) => {
          const expectedMin = getLearnedExpectedMinutes(subj.name as any, 'Lecture');
          useTargets.getState().addTarget({
            date: todayKey(),
            subject: subj.name as any,
            activity: 'Lecture',
            chapter: ch.name,
            lecture: `L${lec.lecNo}`,
            topic: lec.topic,
            expectedMinutes: expectedMin,
            lectureId: lec.id,
            chapterId: ch.id,
          });
          vibrate([10, 30, 10]);
          // Switch to Study tab so user sees the new target
          setTab('study');
        });
      }
    }
    endDrag();
  }, [draggedLectureId, isOverStudyTab, endDrag]);

  // Register the recall + tutorial triggers
  useEffect(() => {
    _showRecallChallenge = () => setShowRecall(true);
    _showTimeline = () => setShowTimeline(true);
    _showTutorialOnboarding = () => setShowTutorialOnboarding(true);

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

  // === True fullscreen (v2.7.2 style — aggressive, works reliably) ===
  // Hides the status bar (mobile tower, date, battery) + browser chrome.
  // Re-enters fullscreen automatically when the user returns from the
  // notification panel (which exits fullscreen).
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
      try { window.scrollTo(0, 1); } catch {}
    };

    enterFullscreen();

    const onVisibilityChange = () => {
      if (!document.hidden && !document.fullscreenElement) enterFullscreen();
    };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!document.fullscreenElement) enterFullscreen();
      }, 300);
    };
    const onTouchEnd = () => {
      if (!document.fullscreenElement) enterFullscreen();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('touchend', onTouchEnd);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
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
        try {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } catch {}
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
      {/* === Random Splash Screen — picks one of 5 animations on each launch === */}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

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

      {/* Top bar removed — the green NEET logo in the top-left corner was
          redundant with the Home tab's header. Removed per user request. */}

      {/* Main scroll area — touch-driven nav */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStartNav}
        onTouchMove={onTouchMoveNav}
        onTouchEnd={onTouchEndNav}
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-area relative z-10"
        style={{
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          // Top padding: just the safe-area-inset-top (status bar / notch).
          // The old 52px was reserving space for the removed TopBar — now gone.
          paddingTop: 'env(safe-area-inset-top, 0px)',
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
                  // ALL tabs except 'settings' are long-pressable → shows the overlay
                  const isLongPressable = tab.key !== 'settings';
                  const longPressHandler = isLongPressable ? () => {
                    studyTabLongPress.current = setTimeout(() => {
                      // If tutorial onboarding is active, dismiss it (the user
                      // successfully long-pressed a tab — that's the goal).
                      // Then show the overlay for this tab.
                      if (showTutorialOnboarding) {
                        setShowTutorialOnboarding(false);
                      }
                      // Show the full-screen overlay for this tab
                      setLongPressTab(tab.key as InfoTabKey);
                      vibrate(20);
                    }, 500);
                  } : undefined;
                  const clearLongPress = isLongPressable ? () => {
                    if (studyTabLongPress.current) {
                      clearTimeout(studyTabLongPress.current);
                      studyTabLongPress.current = null;
                    }
                  } : undefined;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        if (draggedLectureId) {
                          // If dragging, clicking the Study tab = drop
                          if (tab.key === 'study') handleDropOnStudyTab();
                          else endDrag();
                          return;
                        }
                        if (activeTab !== tab.key) {
                          setTab(tab.key);
                          vibrate(8);
                          import('@/lib/sounds').then(({ playSound }) => playSound('tap'));
                        }
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onPointerDown={longPressHandler}
                      onPointerUp={(e) => {
                        clearLongPress?.();
                        // Handle drag-drop on Study tab
                        if (draggedLectureId && tab.key === 'study') {
                          handleDropOnStudyTab();
                        }
                      }}
                      onPointerEnter={() => {
                        if (draggedLectureId && tab.key === 'study') {
                          setOverStudyTab(true);
                          vibrate(8);
                        }
                      }}
                      onPointerLeave={() => {
                        if (draggedLectureId && tab.key === 'study') {
                          setOverStudyTab(false);
                        }
                      }}
                      onPointerCancel={clearLongPress}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl transition-all',
                        'min-w-[42px] h-12 px-1.5',
                        isActive ? 'text-adaptive' : 'text-adaptive-muted hover:text-adaptive',
                        // Highlight Study tab when dragging a lecture from Syllabus
                        draggedLectureId && tab.key === 'study' && 'bg-teal-500/20 ring-2 ring-teal-400/50 scale-110',
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

      {/* === Unified long-press overlay for ALL tabs (except settings) ===
          Shows full-screen with top 50% / bottom 50% actions + ? tutorial button.
          Each tab has different actions:
            home:    no actions (tutorial only)
            study:   Free Study (top) + Daily Recall (bottom)
            syllabus: Build Syllabus (top) + Formula Vault (bottom)
            history: no actions (tutorial only)
            tests:   Paper Test (single, full screen)
            stats:   no actions (tutorial only) */}
      <AnimatePresence>
        {longPressTab && (
          <TabLongPressOverlay
            tab={longPressTab}
            topAction={
              longPressTab === 'study' ? {
                icon: PlayCircle, label: 'Free Study', description: 'Start a focus session without a target',
                color: '#14b8a6', onClick: () => { setLongPressTab(null); setShowFreeStudy(true); },
              } : longPressTab === 'syllabus' ? {
                icon: Plus, label: 'Build Syllabus', description: 'Add subjects, chapters, lectures',
                color: '#14b8a6', onClick: () => { setLongPressTab(null); setShowBuildSheet(true); },
              } : longPressTab === 'tests' ? {
                icon: ClipboardList, label: 'CBT Mode', description: 'Computer-based test simulation with timer',
                color: '#a855f7', onClick: () => { setLongPressTab(null); setShowPaperTestPicker(true); },
              } : longPressTab === 'home' ? {
                icon: Target, label: 'Weekly Goals', description: 'Set + track your weekly study goals',
                color: '#14b8a6', onClick: () => { setLongPressTab(null); setShowWeeklyGoals(true); },
              } : longPressTab === 'history' ? {
                icon: Trophy, label: 'Test History', description: 'View all past tests + detailed analysis',
                color: '#f59e0b', onClick: () => { setLongPressTab(null); setShowTestHistory(true); },
              } : longPressTab === 'stats' ? {
                icon: TrendingUp, label: 'Weekly Report', description: 'What you accomplished this week',
                color: '#14b8a6', onClick: () => { setLongPressTab(null); setShowWeeklyReport(true); },
              } : null
            }
            bottomAction={
              longPressTab === 'study' ? {
                icon: Brain, label: 'Daily Recall', description: 'Test your memory of recent topics',
                color: '#a855f7', onClick: () => { setLongPressTab(null); setShowRecall(true); },
              } : longPressTab === 'syllabus' ? {
                icon: Sigma, label: 'Formula Vault', description: 'Store + review important formulas',
                color: '#a855f7', onClick: () => { setLongPressTab(null); setShowFormulaVault(true); },
              } : longPressTab === 'tests' ? {
                icon: FileText, label: 'Practice Mode', description: 'Practice questions without exam pressure',
                color: '#3b82f6', onClick: () => { setLongPressTab(null); setShowPaperTestPicker(true); },
              } : longPressTab === 'stats' ? {
                icon: BarChart3, label: 'Monthly Report', description: 'Your full month progression + graphs',
                color: '#a855f7', onClick: () => { setLongPressTab(null); setShowWeeklyReport(true); },
              } : null
            }
            onTutorial={() => { setInfoTab(longPressTab); setLongPressTab(null); }}
            onClose={() => setLongPressTab(null)}
          />
        )}
      </AnimatePresence>

      {/* === Tab info sheet — shown when ? button tapped in the long-press overlay === */}
      <AnimatePresence>
        {infoTab && (
          <TabInfoSheet tab={infoTab} onClose={() => setInfoTab(null)} />
        )}
      </AnimatePresence>

      {/* Build Syllabus sheet — triggered from Syllabus tab long-press */}
      {showBuildSheet && (
        <BuildSyllabusSheet
          onClose={() => setShowBuildSheet(false)}
          showToast={(msg, sub) => pushToast(msg, sub, 'success')}
        />
      )}

      {/* Formula Vault — triggered from Syllabus tab long-press */}
      <AnimatePresence>
        {showFormulaVault && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center"
            onClick={() => setShowFormulaVault(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-strong rounded-t-3xl max-h-[88vh] flex flex-col"
            >
              <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass-strong rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Formula Vault</h2>
                  <button onClick={() => setShowFormulaVault(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">✕</button>
                </div>
              </div>
              <div className="overflow-y-auto scroll-area px-5 py-5">
                <FormulaVault />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Weekly Goals sheet — triggered from Home tab long-press === */}
      <AnimatePresence>
        {showWeeklyGoals && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center"
            onClick={() => setShowWeeklyGoals(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-strong rounded-t-3xl max-h-[88vh] flex flex-col"
            >
              <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass-strong rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Weekly Goals</h2>
                  <button onClick={() => setShowWeeklyGoals(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">✕</button>
                </div>
              </div>
              <div className="overflow-y-auto scroll-area px-5 py-5">
                <WeeklyGoalCard />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Test History sheet — triggered from History tab long-press === */}
      <AnimatePresence>
        {showTestHistory && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center"
            onClick={() => setShowTestHistory(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-strong rounded-t-3xl max-h-[88vh] flex flex-col"
            >
              <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass-strong rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Test History</h2>
                  <button onClick={() => setShowTestHistory(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">✕</button>
                </div>
              </div>
              <div className="overflow-y-auto scroll-area px-5 py-5">
                <TestHistoryInline onClose={() => setShowTestHistory(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Weekly/Monthly Report sheet — triggered from Stats tab long-press === */}
      <AnimatePresence>
        {showWeeklyReport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center"
            onClick={() => setShowWeeklyReport(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-strong rounded-t-3xl max-h-[88vh] flex flex-col"
            >
              <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass-strong rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Progression Report</h2>
                  <button onClick={() => setShowWeeklyReport(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">✕</button>
                </div>
              </div>
              <div className="overflow-y-auto scroll-area px-5 py-5">
                <WeeklyReportInline />
              </div>
            </motion.div>
          </motion.div>
        )}
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

      {/* === Sleep Lock Screen — full-screen immersive sleep mode.
          When activeSleep is non-null, this covers the ENTIRE app with
          a bluish night scene. Double-tap + solve a math problem to
          wake up and unlock the app. === */}
      <SleepLockScreen />

      {/* === Tutorial Onboarding — shown when user turns ON the Tutorial toggle.
          Teaches the user to long-press tabs. Covers everything EXCEPT the
          bottom nav so the user can actually long-press tabs. Only dismissable
          via "I understood" or actually long-pressing the target tab. === */}
      <AnimatePresence>
        {showTutorialOnboarding && (
          <TutorialOnboarding onClose={() => setShowTutorialOnboarding(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// TopBar removed — the green "N" logo + "NEET 2027" text in the top-left
// corner was redundant with the Home tab's own header (which has the full
// NEET logo + title). Removed per user request to keep the UI clean.

// enterFullscreen() removed — requestFullscreen() triggers a browser-native
// "To exit full screen, press Esc" banner that ruins UX. App is fullscreen
// via CSS (viewport-fit: cover + overscroll-none).


// === Test History Inline — shows all past tests with scores + analysis ===
function TestHistoryInline({ onClose }: { onClose: () => void }) {
  const [tests, setTests] = useState<any[]>([]);
  useEffect(() => {
    import('@/lib/store/tests').then(({ useTests }) => {
      setTests(useTests.getState().tests);
    });
  }, []);
  if (tests.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy size={32} className="text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/50">No tests logged yet.</p>
        <p className="text-[10px] text-white/40 mt-1">Long-press the Tests tab to add a test.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {tests.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((t: any) => (
        <div key={t.id} className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{t.name || `${t.subject || 'Test'}`}</span>
            <span className="text-xs tabular font-bold text-teal-400">{t.totalMarks ?? '—'}/{t.maxMarks ?? 720}</span>
          </div>
          <div className="text-[10px] text-white/40">{t.date} · {t.source}</div>
        </div>
      ))}
    </div>
  );
}

// === Weekly Report Inline — shows weekly + monthly progression with graph ===
function WeeklyReportInline() {
  const sessions = useHistory((s) => s.sessions);
  // Build last 7 days study hours
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const sec = sessions.filter((s) => s.date === key).reduce((a, s) => a + s.studySeconds, 0);
    return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), hours: sec / 3600 };
  });
  const maxH = Math.max(...last7.map(d => d.hours), 1);
  const totalH = last7.reduce((a, d) => a + d.hours, 0);

  // Build last 4 weeks
  const last4Weeks = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (3 - i) * 7);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const sec = sessions.filter((s) => {
      const sDate = new Date(s.endedAt);
      return sDate >= weekStart && sDate < weekEnd;
    }).reduce((a, s) => a + s.studySeconds, 0);
    return { label: `W${i+1}`, hours: sec / 3600 };
  });
  const maxWeekH = Math.max(...last4Weeks.map(d => d.hours), 1);

  // Sessions this week count
  const weekAgo = Date.now() - 7 * 86400000;
  const sessionsThisWeek = sessions.filter((s) => s.endedAt >= weekAgo).length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass rounded-xl p-2.5">
          <div className="text-[9px] uppercase text-white/40 font-semibold">This Week</div>
          <div className="text-lg font-bold tabular text-teal-400">{totalH.toFixed(1)}h</div>
        </div>
        <div className="glass rounded-xl p-2.5">
          <div className="text-[9px] uppercase text-white/40 font-semibold">Daily Avg</div>
          <div className="text-lg font-bold tabular text-purple-400">{(totalH/7).toFixed(1)}h</div>
        </div>
        <div className="glass rounded-xl p-2.5">
          <div className="text-[9px] uppercase text-white/40 font-semibold">Sessions</div>
          <div className="text-lg font-bold tabular text-amber-400">{sessionsThisWeek}</div>
        </div>
      </div>

      {/* Daily bar chart */}
      <div>
        <div className="text-xs font-bold text-white/70 mb-2">Daily Study (Last 7 Days)</div>
        <div className="flex items-end justify-between gap-1.5 h-24">
          {last7.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[8px] text-white/40 tabular">{d.hours > 0 ? d.hours.toFixed(1) : ''}</div>
              <div className="w-full flex-1 flex items-end">
                <div className="w-full rounded-t bg-gradient-to-t from-teal-500 to-green-400 transition-all"
                  style={{ height: `${(d.hours / maxH) * 100}%`, minHeight: d.hours > 0 ? '4px' : '2px', opacity: d.hours > 0 ? 1 : 0.2 }} />
              </div>
              <div className="text-[8px] text-white/50 font-semibold">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly bar chart */}
      <div>
        <div className="text-xs font-bold text-white/70 mb-2">Weekly Progression (Last 4 Weeks)</div>
        <div className="flex items-end justify-between gap-2 h-24">
          {last4Weeks.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[8px] text-white/40 tabular">{d.hours > 0 ? d.hours.toFixed(1) + 'h' : ''}</div>
              <div className="w-full flex-1 flex items-end">
                <div className="w-full rounded-t bg-gradient-to-t from-purple-500 to-pink-400 transition-all"
                  style={{ height: `${(d.hours / maxWeekH) * 100}%`, minHeight: d.hours > 0 ? '4px' : '2px', opacity: d.hours > 0 ? 1 : 0.2 }} />
              </div>
              <div className="text-[8px] text-white/50 font-semibold">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
