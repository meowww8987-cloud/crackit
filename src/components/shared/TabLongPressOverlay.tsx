'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle } from 'lucide-react';
import { cn, vibrate } from '@/lib/utils';
import { type TabKey } from '@/components/shared/TabInfoSheet';

interface ActionOption {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string; // hex
  onClick: () => void;
}

interface Props {
  /** Which tab triggered this overlay — used for the tutorial button. */
  tab: TabKey;
  /** Top-half action (primary). Null = no top action (tutorial-only mode). */
  topAction: ActionOption | null;
  /** Bottom-half action (secondary). Null = no bottom action. */
  bottomAction: ActionOption | null;
  /** Called when the user taps the tutorial (?) button. */
  onTutorial: () => void;
  onClose: () => void;
}

/**
 * TabLongPressOverlay — full-screen overlay shown when long-pressing a tab.
 *
 * Layout:
 *   - TOP 50%: primary action (e.g. Free Study) — big tappable area
 *   - BOTTOM 50%: secondary action (e.g. Active Recall) — big tappable area
 *   - Bottom-right corner: tutorial (?) button — shows tab info + hidden features
 *
 * If a tab has only one action (e.g. Tests → Paper Test), the single action
 * takes the full screen. If a tab has no actions (e.g. History, Stats), only
 * the tutorial button shows.
 *
 * The large 50%-area buttons are easy to tap with a thumb while holding the
 * phone one-handed. Tap anywhere outside the buttons to dismiss.
 */
export function TabLongPressOverlay({ tab, topAction, bottomAction, onTutorial, onClose }: Props) {
  // If only one action, it takes full screen (minus the tutorial corner).
  const singleAction = topAction && !bottomAction ? topAction : null;

  return (
    <motion.div
      data-tab-long-press-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex flex-col"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Close button — top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-[env(safe-area-inset-top,0px)] top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {/* === Single action takes full screen === */}
      {singleAction ? (
        <button
          onClick={(e) => { e.stopPropagation(); vibrate(10); singleAction.onClick(); }}
          className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: `${singleAction.color}22`, color: singleAction.color }}
          >
            <singleAction.icon size={36} />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold" style={{ color: singleAction.color }}>{singleAction.label}</div>
            <div className="text-xs text-white/55 mt-1 max-w-[260px]">{singleAction.description}</div>
          </div>
        </button>
      ) : (
        <>
          {/* === TOP 50% — primary action === */}
          {topAction && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(10); topAction.onClick(); }}
              className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: `${topAction.color}22`, color: topAction.color }}
              >
                <topAction.icon size={36} />
              </motion.div>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center px-6"
              >
                <div className="text-xl font-bold" style={{ color: topAction.color }}>{topAction.label}</div>
                <div className="text-xs text-white/55 mt-1 max-w-[260px]">{topAction.description}</div>
              </motion.div>
            </button>
          )}

          {/* === BOTTOM 50% — secondary action === */}
          {bottomAction && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(10); bottomAction.onClick(); }}
              className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: `${bottomAction.color}22`, color: bottomAction.color }}
              >
                <bottomAction.icon size={36} />
              </motion.div>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center px-6"
              >
                <div className="text-xl font-bold" style={{ color: bottomAction.color }}>{bottomAction.label}</div>
                <div className="text-xs text-white/55 mt-1 max-w-[260px]">{bottomAction.description}</div>
              </motion.div>
            </button>
          )}

          {/* If no actions at all (History/Stats), show a hint */}
          {!topAction && !bottomAction && (
            <div className="relative flex-1 flex flex-col items-center justify-center gap-3 px-6">
              <div className="text-4xl mb-2">👈</div>
              <div className="text-lg font-bold text-white/80">Long-press detected</div>
              <p className="text-xs text-white/50 text-center max-w-[260px]">
                This tab has no quick actions, but you can tap the ? button below to learn about its features + hidden gems.
              </p>
            </div>
          )}
        </>
      )}

      {/* === Tutorial (?) button — bottom-right corner === */}
      <button
        onClick={(e) => { e.stopPropagation(); vibrate(10); onTutorial(); }}
        className="absolute bottom-[env(safe-area-inset-bottom,0px)] bottom-6 right-4 z-10 w-14 h-14 rounded-full glass flex items-center justify-center text-t-secondary hover:text-teal-400 hover:bg-teal-500/15 transition shadow-lg active:scale-90"
        aria-label={`${tab} tab info + hidden features`}
        title={`${tab} tab info + hidden features`}
      >
        <HelpCircle size={24} />
      </button>
    </motion.div>
  );
}
