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
  tab: TabKey;
  topAction: ActionOption | null;
  bottomAction: ActionOption | null;
  thirdAction?: ActionOption | null;
  onTutorial: () => void;
  onClose: () => void;
}

export function TabLongPressOverlay({ tab, topAction, bottomAction, thirdAction, onTutorial, onClose }: Props) {
  const singleAction = topAction && !bottomAction && !thirdAction ? topAction : null;
  const hasThree = !!(topAction && bottomAction && thirdAction);

  return (
    <motion.div
      data-tab-long-press-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[95] flex flex-col"
      style={{ background: 'var(--background, #0a0b15)' }}
      onClick={onClose}
    >
      {/* Close button — theme-aware, no blur */}
      <button
        onClick={(e) => { e.stopPropagation(); vibrate(8); onClose(); }}
        className="absolute top-[env(safe-area-inset-top,0px)] top-4 right-4 z-10 w-11 h-11 rounded-full flex items-center justify-center transition shadow-lg active:scale-90"
        style={{
          background: 'var(--foreground/10, rgba(255,255,255,0.1))',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
        }}
        aria-label="Close — back to tab"
        title="Close — back to tab"
      >
        <X size={22} strokeWidth={2.5} />
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
            <div className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>{singleAction.description}</div>
          </div>
        </button>
      ) : (
        <>
          {/* === TOP 50% — primary action === */}
          {topAction && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(10); topAction.onClick(); }}
              className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: `${topAction.color}22`, color: topAction.color }}
              >
                <topAction.icon size={36} />
              </div>
              <div className="text-center px-6">
                <div className="text-xl font-bold" style={{ color: topAction.color }}>{topAction.label}</div>
                <div className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>{topAction.description}</div>
              </div>
            </button>
          )}

          {/* === MIDDLE 33% — third action === */}
          {hasThree && thirdAction && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(10); thirdAction.onClick(); }}
              className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: `${thirdAction.color}22`, color: thirdAction.color }}
              >
                <thirdAction.icon size={36} />
              </div>
              <div className="text-center px-6">
                <div className="text-xl font-bold" style={{ color: thirdAction.color }}>{thirdAction.label}</div>
                <div className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>{thirdAction.description}</div>
              </div>
            </button>
          )}

          {/* === BOTTOM 50% — secondary action === */}
          {bottomAction && (
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(10); bottomAction.onClick(); }}
              className="relative flex-1 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: `${bottomAction.color}22`, color: bottomAction.color }}
              >
                <bottomAction.icon size={36} />
              </div>
              <div className="text-center px-6">
                <div className="text-xl font-bold" style={{ color: bottomAction.color }}>{bottomAction.label}</div>
                <div className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>{bottomAction.description}</div>
              </div>
            </button>
          )}

          {/* No actions hint */}
          {!topAction && !bottomAction && !thirdAction && (
            <div className="relative flex-1 flex flex-col items-center justify-center gap-3 px-6">
              <div className="text-4xl mb-2">👈</div>
              <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Long-press detected</div>
              <p className="text-xs text-center max-w-[260px]" style={{ color: 'var(--muted-foreground)' }}>
                This tab has no quick actions, but you can tap the ? button below to learn about its features + hidden gems.
              </p>
            </div>
          )}
        </>
      )}

      {/* === Tutorial (?) button — solid bg, no blur === */}
      <button
        onClick={(e) => { e.stopPropagation(); vibrate(10); onTutorial(); }}
        className="absolute bottom-[env(safe-area-inset-bottom,0px)] bottom-6 right-4 z-10 w-14 h-14 rounded-full flex items-center justify-center transition shadow-lg active:scale-90"
        style={{
          background: 'var(--foreground/8, rgba(255,255,255,0.05))',
          border: '1px solid var(--border)',
          color: 'var(--muted-foreground)',
        }}
        aria-label={`${tab} tab info + hidden features`}
        title={`${tab} tab info + hidden features`}
      >
        <HelpCircle size={24} />
      </button>
    </motion.div>
  );
}
