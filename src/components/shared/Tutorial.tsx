'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

export interface TutorialStep {
  /** Unique id for this step — used to track if it's been seen */
  id: string;
  /** Big title */
  title: string;
  /** Body text */
  body: string;
  /** Optional emoji/icon shown big at top */
  emoji?: string;
  /** Optional highlight selector — not used for positioning (mobile-first), just visual */
  highlight?: string;
}

interface Props {
  /** Tutorial key — e.g. 'study-tab', 'tests-tab'. Stored in localStorage as `tutorial-seen-${key}`. */
  tutorialKey: string;
  /** Steps to show */
  steps: TutorialStep[];
  /** Called when user finishes or skips */
  onComplete: () => void;
  /** Child element to wrap — optional. If provided, tutorial overlays on top of it. */
  children?: ReactNode;
}

const STORAGE_PREFIX = 'neet-tutorial-seen-';

/**
 * Tutorial — reusable coach-mark overlay.
 *
 * Behavior:
 *  - Checks localStorage for `neet-tutorial-seen-${tutorialKey}`. If present, renders children only.
 *  - If not seen, shows full-screen overlay with steps.
 *  - User can navigate Next/Prev through steps, or Skip.
 *  - On completing last step (or Skip), marks as seen in localStorage + calls onComplete.
 *
 * Usage:
 *   <Tutorial tutorialKey="study-tab" steps={STUDY_STEPS} onComplete={() => {}}>
 *     <StudyTab />
 *   </Tutorial>
 *
 * Or without children (just overlay):
 *   {showTutorial && <Tutorial tutorialKey="x" steps={X} onComplete={() => setShow(false)} />}
 *
 * To reset all tutorials: Settings → "Reset Tutorial" clears all `neet-tutorial-seen-*` keys.
 */
export function Tutorial({ tutorialKey, steps, onComplete, children }: Props) {
  const [show, setShow] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(`${STORAGE_PREFIX}${tutorialKey}`);
    if (!seen) setShow(true);
  }, [tutorialKey]);

  const markSeen = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${tutorialKey}`, '1');
    }
    setShow(false);
    onComplete();
  };

  const handleNext = () => {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else markSeen();
  };

  const handlePrev = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };

  const handleSkip = () => markSeen();

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  return (
    <>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center px-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            onClick={handleSkip}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm glass-strong rounded-3xl p-6 pb-4"
            >
              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="absolute top-3 right-3 text-[10px] text-white/40 hover:text-white/70"
              >
                Skip
              </button>

              {/* Progress dots */}
              <div className="flex gap-1.5 justify-center mb-4">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all ${
                      i === stepIdx ? 'w-6 bg-teal-400' : i < stepIdx ? 'w-2 bg-teal-500/50' : 'w-2 bg-white/15'
                    }`}
                  />
                ))}
              </div>

              {/* Step content */}
              <div className="text-center">
                {step.emoji && (
                  <motion.div
                    key={`emoji-${stepIdx}`}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="text-5xl mb-3"
                  >
                    {step.emoji}
                  </motion.div>
                )}
                <h2 className="text-lg font-bold mb-2">{step.title}</h2>
                <p className="text-sm text-white/60 leading-relaxed mb-6">{step.body}</p>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                {stepIdx > 0 && (
                  <button
                    onClick={handlePrev}
                    className="w-10 h-10 rounded-xl bg-white/5 text-white/60 flex items-center justify-center"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  {isLast ? (
                    <><Check size={14} /> Got it</>
                  ) : (
                    <>Next <ChevronRight size={14} /></>
                  )}
                </button>
              </div>

              {/* Step counter */}
              <div className="text-[10px] text-white/30 text-center mt-3">
                {stepIdx + 1} of {steps.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Reset all seen tutorials — called from Settings → "Replay Tutorial".
 * Clears all `neet-tutorial-seen-*` keys from localStorage.
 */
export function resetAllTutorials() {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
  for (const k of keys) localStorage.removeItem(k);
}

/**
 * Check if a tutorial has been seen (without showing it).
 */
export function isTutorialSeen(tutorialKey: string): boolean {
  if (typeof window === 'undefined') return true;
  return !!localStorage.getItem(`${STORAGE_PREFIX}${tutorialKey}`);
}
