'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion, type PanInfo } from 'framer-motion';

interface Props {
  children: ReactNode;
  onClose: () => void;
  /** Maximum height as a percentage of viewport. Default 92. */
  maxHeightPct?: number;
  /** Override the drag handle position. Default: top (drag down to dismiss). */
  className?: string;
}

/**
 * DraggableSheet — bottom sheet that follows the user's drag and dismisses
 * when dragged past a threshold. Wraps the standard sheet pattern.
 *
 * Behavior:
 *  - Renders the standard backdrop (tap to close) + sheet
 *  - Sheet has a drag handle at the top
 *  - User can drag the sheet down; sheet follows finger
 *  - If dragged > 25% of its height OR flicked with velocity > 500, dismiss
 *  - Otherwise snaps back to open position
 *
 * The drag is constrained to Y axis only (can't drag horizontally).
 * dragConstraints with elastic constraint keeps the sheet from going off-screen.
 *
 * To convert an existing sheet to draggable: replace the outer motion.div
 * with <DraggableSheet> wrapping the sheet content.
 */
export function DraggableSheet({ children, onClose, maxHeightPct = 92, className = '' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight * 0.7;
    const offset = info.offset.y;
    const velocity = info.velocity.y;

    // Dismiss if dragged past 25% of sheet height OR flicked down hard
    if (offset > sheetHeight * 0.25 || velocity > 500) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        ref={sheetRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md glass-strong rounded-t-3xl max-h-[${maxHeightPct}vh] flex flex-col ${className}`}
        style={{ maxHeight: `${maxHeightPct}vh` }}
      >
        {/* Drag handle — visual indicator that sheet is draggable.
            Uses a wider hit area + grab cursor for discoverability. */}
        <div
          className="sticky top-0 z-10 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none flex justify-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>

        {/* Sheet content — scrollable */}
        <div
          className={`overflow-y-auto scroll-area ${isDragging ? 'pointer-events-none' : ''}`}
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
