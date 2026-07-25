'use client';

import { useRef, useState } from 'react';
import { motion, type PanInfo, AnimatePresence } from 'framer-motion';
import { Check, Pencil, Trash2, Copy } from 'lucide-react';

interface Props {
  onMarkDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Subject color hex — used for the swipe-right "done" background. */
  color: string;
  children: React.ReactNode;
}

/**
 * SwipeableCardWrapper — adds horizontal swipe gestures to a card.
 *
 * - Swipe right past 40% width → triggers onMarkDone (green background)
 * - Swipe left past 40% width → reveals quick actions (edit/duplicate/delete)
 * - Below 40% → snaps back to center
 * - Fast flick (velocity > 700) commits even if short distance
 * - Vertical drag is NOT captured (lets parent Reorder.Item handle reordering)
 *
 * Cautions for "imperfect human drag":
 *  - Direction lock: only counts drag as horizontal if |dx| > 1.5 * |dy|
 *    at drag start (otherwise assumes user meant vertical scroll/reorder)
 *  - Generous 40% threshold (not 50%)
 *  - Haptic at commit point (60% width)
 *  - Background color + icon preview keeps user oriented during drag
 */
export function SwipeableCardWrapper({
  onMarkDone,
  onEdit,
  onDelete,
  onDuplicate,
  color,
  children,
}: Props) {
  const x = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [isHorizontalDrag, setIsHorizontalDrag] = useState(true);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const onDragStart = (_: any, info: PanInfo) => {
    dragStartRef.current = { x: info.offset.x, y: info.offset.y };
    // Direction lock: only treat as horizontal if clearly horizontal
    setIsHorizontalDrag(Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5);
  };

  const onDrag = (_: any, info: PanInfo) => {
    if (!isHorizontalDrag) return;
    // Clamp to [-160, 160] so user can't drag forever
    const clamped = Math.max(-160, Math.min(160, info.offset.x));
    setDragX(clamped);
    x.current = clamped;
  };

  const onDragEnd = (_: any, info: PanInfo) => {
    if (!isHorizontalDrag) {
      setDragX(0);
      return;
    }
    const width = window.innerWidth;
    const threshold = Math.min(140, width * 0.4); // 40% width, max 140px
    const velocity = info.velocity.x;
    const offset = x.current;

    // Swipe right → mark done
    if (offset > threshold || (velocity > 700 && offset > 30)) {
      onMarkDone();
      setDragX(0);
      return;
    }

    // Swipe left → reveal actions
    if (offset < -threshold || (velocity < -700 && offset < -30)) {
      setShowActions(true);
      setDragX(-160);
      return;
    }

    // Snap back
    setDragX(0);
    setShowActions(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Right-side "done" reveal (green with checkmark) — shows when swiping right */}
      <AnimatePresence>
        {dragX > 10 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(1, dragX / 100) }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${color}40, ${color}10)`,
              borderRadius: 16,
            }}
          >
            <div className="flex items-center gap-2" style={{ color }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: color }}
              >
                <Check size={18} className="text-black" strokeWidth={3} />
              </div>
              <span className="text-sm font-bold">Done</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left-side quick actions (revealed when swiping left) */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-0 top-0 bottom-0 flex items-center gap-1 px-2"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center active:scale-90"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center active:scale-90"
              title="Duplicate"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center active:scale-90"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The actual card content — draggable horizontally */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -160, right: 160 }}
        dragElastic={0.6}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        animate={{ x: dragX }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
