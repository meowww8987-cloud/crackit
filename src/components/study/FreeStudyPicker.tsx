'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSession } from '@/lib/store/session';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject } from '@/lib/types';
import { vibrate } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function FreeStudyPicker({ onClose }: Props) {
  const startSession = useSession((s) => s.startSession);

  const handlePick = (subject: Subject) => {
    vibrate(15);
    startSession({
      targetId: null,
      subject,
      chapter: 'Free Study',
      topic: `Free Study — ${subject}`,
      mode: 'free',
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass rounded-3xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">Free Study</h2>
            <p className="text-xs text-muted-foreground">Pick a subject and start studying</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {SUBJECTS.map((s) => {
            const c = subjectColor(s);
            return (
              <motion.button
                key={s}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePick(s)}
                className="w-full p-3 rounded-xl flex items-center gap-3 transition"
                style={{ background: `${c.hex}15`, border: `1px solid ${c.hex}40` }}
              >
                <div className="w-3 h-8 rounded" style={{ background: c.hex }} />
                <span className="font-semibold text-sm" style={{ color: c.hex }}>{s}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">→</span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center mt-4">
          No target pressure — study freely and track your time.
        </p>
      </motion.div>
    </motion.div>
  );
}
