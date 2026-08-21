'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

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

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    _pushToast = (toast) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { ...toast, id }]);
      // Auto-dismiss after 3s
      setTimeout(() => remove(id), 3000);
    };
    return () => { _pushToast = () => {}; };
  }, [remove]);

  const typeColor = {
    success: { border: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    info: { border: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
    error: { border: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };

  return (
    <div className="fixed top-14 left-0 right-0 z-[300] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const c = typeColor[t.type || 'success'];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => remove(t.id)}
              className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5 max-w-sm w-full shadow-2xl pointer-events-auto cursor-pointer"
              style={{ borderLeft: `3px solid ${c.border}`, background: c.bg }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white">{t.message}</div>
                {t.sub && <div className="text-[10px] text-white/50 whitespace-pre-line leading-relaxed">{t.sub}</div>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                className="text-white/30 hover:text-white shrink-0"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
