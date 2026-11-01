'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useSession, getLiveStudySeconds, getLiveWastedSeconds } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { subjectColor } from '@/lib/colors';
import { cn, formatClock, vibrate } from '@/lib/utils';

/**
 * HiddenWidgetChip — compact status pill shown when the floating widget is
 * HIDDEN but a session is running.
 *
 * === WHY THIS EXISTS ===
 * Previously, hiding the floating widget made it vanish completely: there was
 * no on-screen trace that a session was still running, and the only way back
 * was the small eye icon in the Study tab header (easy to miss, and the icon
 * was inverted — showed EyeOff when hidden). Users reported the widget
 * "disappeared from the study page" and "unhide not working".
 *
 * Now: whenever the widget is hidden + a session is active, this chip stays
 * visible on EVERY tab (subject color dot + live clock + eye icon).
 * Tap anywhere on the chip to restore the floating widget.
 */
export function HiddenWidgetChip() {
  const { active, widgetHidden, setWidgetHidden, setFocusOpen } = useSession();
  const haptics = useSettings((s) => s.haptics);
  const [, setTick] = useState(0);

  // Live clock — 1s interval, skipped when tab hidden (saves CPU)
  useEffect(() => {
    const i = setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(i);
  }, []);

  // Nothing to show: no session, or the widget is already visible
  if (!active || !widgetHidden) return null;

  const color = subjectColor(active.subject);
  const studySec = getLiveStudySeconds(active);
  const wastedSec = getLiveWastedSeconds(active);
  const isPaused = active.paused;
  const isWasting = active.wasting;
  const displaySec = isWasting ? wastedSec : studySec;
  const dotColor = isPaused ? '#f59e0b' : isWasting ? '#ef4444' : color.hex;
  const borderColor = isPaused
    ? 'rgba(245,158,11,0.45)'
    : isWasting
    ? 'rgba(239,68,68,0.45)'
    : `${color.hex}66`;

  const restore = () => {
    if (haptics) vibrate(10);
    // Make sure no stale fullscreen timer is covering the app
    setFocusOpen(false);
    setWidgetHidden(false);
  };

  return (
    <motion.button
      data-session-widget-chip
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={restore}
      className="fixed left-1/2 -translate-x-1/2 z-[9997] flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full shadow-xl active:scale-95 transition select-none"
      style={{
        bottom: '88px', // sits just above the bottom nav bar (74px)
        border: `1.5px solid ${borderColor}`,
        background: 'var(--card)',
        backdropFilter: 'blur(10px)',
      }}
      aria-label={`Show timer widget — ${active.subject} session ${isPaused ? 'paused' : isWasting ? 'wasting time' : 'running'}`}
      title="Session running — tap to show the timer widget"
    >
      {/* Status dot — pulses with the session state */}
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', !isPaused && (isWasting ? 'pulse-fast' : 'pulse-slow'))}
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      {/* Subject name in its color */}
      <span className="text-[10px] font-bold max-w-[90px] truncate" style={{ color: color.hex }}>
        {active.subject}
      </span>
      {/* Live clock — study time (or waste time while distracted) */}
      <span className="text-[10px] font-bold text-white tabular">{formatClock(displaySec)}</span>
      {/* Unhide affordance */}
      <Eye size={11} className="text-foreground/60 shrink-0" />
    </motion.button>
  );
}
