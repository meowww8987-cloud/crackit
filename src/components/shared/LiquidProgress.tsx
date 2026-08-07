'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  pct: number;
  color?: string;
  color2?: string;
  className?: string;
  height?: string;
}

export function LiquidProgress({ pct, color = '#14b8a6', color2, className, height = 'h-1.5' }: Props) {
  const c2 = color2 || color;
  const gradient = `linear-gradient(90deg, ${color}, ${c2}, ${color})`;

  return (
    <div className={cn('liquid-bar rounded-full overflow-hidden relative', height, className)}
      style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}
    >
      <motion.div
        className="liquid-fill h-full rounded-full relative liquid-shimmer"
        style={{ backgroundImage: gradient }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}
