'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Check } from 'lucide-react';
import { vibrate } from '@/lib/utils';

const TARGET_TABS = ['home', 'study', 'syllabus', 'history', 'tests', 'stats'] as const;
type TargetTab = typeof TARGET_TABS[number];

interface Props {
  onClose: () => void;
}

/**
 * TutorialOnboarding — full-screen overlay that teaches the user to long-press
 * a tab in the bottom nav to discover quick actions + the ? tutorial button.
 *
 * Design:
 * - Covers the screen EXCEPT the bottom nav area (so tabs remain tappable)
 * - Picks a random tab and points at it with a 👆 hand animation
 * - The hand position is measured from the ACTUAL DOM element of the target
 *   tab button (via querySelector), so it's always perfectly aligned
 * - A pulsing ring highlights the target tab
 * - The overlay CANNOT be dismissed by clicking elsewhere — only by:
 *   (a) Tapping "I understood", OR
 *   (b) Actually long-pressing the target tab (detected via a mutation
 *       observer / interval that checks if the long-press overlay appeared)
 * - A circular progress timer shows when the user is pressing the target tab
 */
export function TutorialOnboarding({ onClose }: Props) {
  // Pick a random target tab on mount
  const [targetTab] = useState<TargetTab>(() => {
    return TARGET_TABS[Math.floor(Math.random() * TARGET_TABS.length)];
  });

  // Hand position — measured from the actual DOM element
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  const [pressProgress, setPressProgress] = useState(0); // 0-100, long-press progress
  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // === Measure the target tab's actual DOM position ===
  const measureTabPosition = useCallback(() => {
    // The bottom nav buttons have aria-label attributes matching the tab label.
    // We find the button whose aria-label matches the target tab's label.
    const tabLabels: Record<TargetTab, string> = {
      home: 'Home',
      study: 'Study',
      syllabus: 'Syllabus',
      history: 'History',
      tests: 'Tests',
      stats: 'Stats',
    };
    const targetLabel = tabLabels[targetTab];
    // Find the nav button with this label
    const buttons = document.querySelectorAll('nav button[aria-label]');
    for (const btn of buttons) {
      if (btn.getAttribute('aria-label') === targetLabel) {
        const rect = btn.getBoundingClientRect();
        setHandPos({
          x: rect.left + rect.width / 2,
          y: rect.top, // top of the button (hand points down from above)
        });
        return;
      }
    }
    // Fallback: if not found, retry in 200ms
    setTimeout(measureTabPosition, 200);
  }, [targetTab]);

  // Measure on mount + on resize/orientation change
  useEffect(() => {
    measureTabPosition();
    window.addEventListener('resize', measureTabPosition);
    window.addEventListener('orientationchange', measureTabPosition);
    return () => {
      window.removeEventListener('resize', measureTabPosition);
      window.removeEventListener('orientationchange', measureTabPosition);
    };
  }, [measureTabPosition]);

  // === Detect long-press on the target tab ===
  // We listen for pointerdown on the target tab button + track press duration.
  useEffect(() => {
    const tabLabels: Record<TargetTab, string> = {
      home: 'Home', study: 'Study', syllabus: 'Syllabus',
      history: 'History', tests: 'Tests', stats: 'Stats',
    };
    const targetLabel = tabLabels[targetTab];

    const findTargetButton = (): HTMLElement | null => {
      const buttons = document.querySelectorAll('nav button[aria-label]');
      for (const btn of buttons) {
        if (btn.getAttribute('aria-label') === targetLabel) return btn as HTMLElement;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      const btn = findTargetButton();
      if (!btn || e.target !== btn && !btn.contains(e.target as Node)) return;
      // User pressed the target tab — start tracking long-press progress
      pressStartRef.current = Date.now();
      vibrate(8);
      const updateProgress = () => {
        if (pressStartRef.current === null) return;
        const elapsed = Date.now() - pressStartRef.current;
        const progress = Math.min(100, (elapsed / 500) * 100); // 500ms = full
        setPressProgress(progress);
        if (progress >= 100) {
          // Long-press complete! Dismiss the tutorial.
          vibrate([10, 30, 10]);
          onClose();
          pressStartRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    const onPointerUp = () => {
      if (pressStartRef.current !== null) {
        pressStartRef.current = null;
        setPressProgress(0);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      }
    };

    // Use document-level capture so we catch the event even though the nav
    // is rendered outside this component's React tree
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetTab, onClose]);

  // === Also detect if the long-press overlay appeared (user successfully long-pressed) ===
  // This is a backup detection method — if the TabLongPressOverlay appears,
  // it means the user successfully long-pressed a tab. We only dismiss if the
  // overlay is for the CORRECT tab (checked via the `tab` prop on the overlay).
  // Actually, we can't easily read the prop from the DOM, so we use a simpler
  // approach: the pointerdown handler above already checks if the correct tab
  // was pressed. This observer is a fallback that dismisses if ANY overlay
  // appears (meaning the user figured out how to long-press — good enough).
  // REMOVED: The MutationObserver was dismissing the tutorial even when the
  // user long-pressed the WRONG tab. The pointerdown handler above is the
  // primary detection method and correctly checks the target tab.
  // (Kept as a no-op to avoid breaking the effect cleanup pattern.)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{
        // Cover everything EXCEPT the bottom nav (bottom 80px + safe area).
        // This lets the user actually tap/long-press the nav buttons.
        // NO onClick handler — the overlay can't be dismissed by tapping.
        background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.92) 100%)',
        // Leave the bottom nav area transparent + tappable
        maskImage: 'linear-gradient(180deg, black 0%, black calc(100% - 100px), transparent calc(100% - 100px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, black 0%, black calc(100% - 100px), transparent calc(100% - 100px), transparent 100%)',
      }}
    >
      {/* === Hand pointing at the target tab === */}
      {handPos && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: handPos.x,
            top: handPos.y - 70, // 70px above the tab button
            transform: 'translateX(-50%)',
          }}
        >
          {/* Bouncing hand */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            className="text-5xl"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(168,85,247,0.6))' }}
          >
            👆
          </motion.div>
          {/* Long-press progress ring (shows when user is pressing) */}
          {pressProgress > 0 && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
              <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="13" fill="none" stroke="#a855f7" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(pressProgress / 100) * 81.68} 81.68`}
                  style={{ transition: 'stroke-dasharray 0.05s linear' }}
                />
              </svg>
            </div>
          )}
        </motion.div>
      )}

      {/* === Pulsing ring around the target tab === */}
      {handPos && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: handPos.x,
            top: handPos.y + 20, // center of the tab button
            transform: 'translate(-50%, -50%)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.2, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-12 h-12 rounded-full border-2 border-purple-400"
          />
        </motion.div>
      )}

      {/* === Center content === */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm pointer-events-auto"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-5xl mb-4"
          >
            🎓
          </motion.div>
          <h2 className="text-lg font-bold text-white mb-2">Tutorial Mode On!</h2>
          <p className="text-sm text-white/70 mb-3 leading-snug">
            <strong className="text-purple-300">Long-press any tab</strong> in the bottom nav
            to discover its quick actions + the <HelpCircle size={12} className="inline text-teal-400" /> tutorial button.
          </p>
          <p className="text-xs text-white/50 mb-4">
            Try long-pressing the <strong className="text-purple-300 capitalize">{targetTab}</strong> tab below 👇
            <br />
            <span className="text-[10px] text-white/40">(Hold for 0.5 seconds)</span>
          </p>
          <button
            onClick={() => { vibrate(10); onClose(); }}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition active:scale-95"
          >
            I understood
          </button>
          <p className="text-[10px] text-white/40 mt-3">
            You can turn tutorials off anytime with the Tutorial toggle in Settings.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
