'use client';

import { useEffect, useState } from 'react';

interface Props {
  value: number;
  /** Duration in ms (default 800). */
  duration?: number;
  className?: string;
  /** Format function (e.g. for "1h 24m"). */
  format?: (n: number) => string;
}

/**
 * AnimatedCounter — smoothly counts up to the target value.
 * Uses requestAnimationFrame with cubic ease-out.
 */
export function AnimatedCounter({ value, duration = 800, className, format }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const startVal = display;
    const delta = value - startVal;

    if (delta === 0) return;

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplay(Math.round(startVal + delta * eased));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span className={className}>
      {format ? format(display) : display}
    </span>
  );
}
