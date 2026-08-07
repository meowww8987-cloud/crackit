'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NumberMorph — animated number that rolls like an odometer when it changes.
 *
 * Each digit rolls up (or down) to the new value with a slot-machine effect.
 * Used for streak counts, session counts, marks, etc. — anywhere a number
 * updates and you want the change to feel tactile.
 *
 * For simple count-up-on-mount animations, use <CountUp> instead.
 * <NumberMorph> is for numbers that CHANGE during the session.
 */

interface Props {
  value: number;
  className?: string;
  /** Duration of the roll in ms. Default 600. */
  duration?: number;
  /** Pad with leading zeros to this many digits. Default 0 (no padding). */
  pad?: number;
}

export function NumberMorph({ value, className = '', duration = 600, pad = 0 }: Props) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value === prevValueRef.current) return;
    // Animate from previous to new value
    const start = prevValueRef.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);
      if (t < 1) requestAnimationFrame(animate);
      else prevValueRef.current = value;
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  const str = pad > 0 ? String(displayValue).padStart(pad, '0') : String(displayValue);
  const prevStr = pad > 0 ? String(prevValueRef.current).padStart(pad, '0') : String(prevValueRef.current);

  return (
    <span className={`tabular inline-flex ${className}`}>
      {str.split('').map((digit, i) => {
        const prevDigit = prevStr[i] || '0';
        const isDifferent = digit !== prevDigit;
        return (
          <span key={i} className="relative inline-block overflow-hidden" style={{ minWidth: '0.6em' }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={isDifferent ? `${digit}-${i}` : `static-${i}`}
                initial={isDifferent ? { y: '100%', opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-100%', opacity: 0 }}
                transition={{ duration: duration / 1000, ease: 'easeOut' }}
                className="inline-block"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
