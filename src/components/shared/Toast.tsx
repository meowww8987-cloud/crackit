'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, CheckCircle, Info, AlertCircle } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  sub?: string;
  type?: 'success' | 'info' | 'error';
}

let _pushToast: (toast: Omit<Toast, 'id'>) => void = () => {};

export function pushToast(message: string, sub?: string, type: 'success' | 'info' | 'error' = 'success') {
  _pushToast({ message, sub, type });
}

/** Maximum number of toasts visible at once — older ones are dropped so the
 *  screen never fills up with a stack of bubbles. */
const MAX_VISIBLE = 3;

/** Auto-dismiss timing per type — errors stay longer because they need action. */
const DISMISS_MS: Record<string, number> = {
  success: 3000,
  info: 3500,
  error: 5000,
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  useEffect(() => {
    _pushToast = (toast) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => {
        // Drop oldest if we'd exceed MAX_VISIBLE — prevents screen flooding.
        const next = [...prev, { ...toast, id }];
        return next.slice(-MAX_VISIBLE);
      });
      const ms = DISMISS_MS[toast.type || 'success'] || 3000;
      timers.current[id] = setTimeout(() => remove(id), ms);
    };
    return () => {
      _pushToast = () => {};
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, [remove]);

  // Per-type styling — SOLID backgrounds with good contrast in all themes.
  // Previous design used 10%-opacity tints which were nearly invisible in
  // light mode (dark text on near-white = washed out).
  const typeConfig = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-white',
      bg: 'bg-green-600',
      ring: 'ring-green-700/20',
    },
    info: {
      icon: Info,
      iconColor: 'text-white',
      bg: 'bg-teal-600',
      ring: 'ring-teal-700/20',
    },
    error: {
      icon: AlertCircle,
      iconColor: 'text-white',
      bg: 'bg-red-600',
      ring: 'ring-red-700/20',
    },
  };

  // Swipe-to-dismiss handler — lets mobile users flick the toast away.
  const handleDragEnd = (id: string, info: PanInfo) => {
    // Dismiss if dragged >40px horizontally or >30px up.
    if (Math.abs(info.offset.x) > 40 || info.offset.y < -30) {
      remove(id);
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-[300] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{
        top: 'max(env(safe-area-inset-top, 0px), 0.5rem)',
        // On mobile, toasts appear below the status bar / notch.
        // On desktop, they sit neatly at the top.
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const c = typeConfig[t.type || 'success'];
          const Icon = c.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 120, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => handleDragEnd(t.id, info)}
              onClick={() => remove(t.id)}
              className={`pointer-events-auto cursor-pointer ${c.bg} ${c.ring} ring-1 rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-full shadow-lg`}
            >
              {/* Icon — white on solid color background for maximum contrast */}
              <Icon size={18} className={`shrink-0 ${c.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white leading-tight">{t.message}</div>
                {t.sub && (
                  <div className="text-xs text-white/85 mt-0.5 leading-snug">{t.sub}</div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                className="shrink-0 text-white/70 hover:text-white transition p-1 -mr-1"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
