'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
  style?: React.CSSProperties;
  /** When true, the count-up replays whenever `value` changes (default: only on mount). */
  animateOnChange?: boolean;
  /** When true, plays a soft tick sound during the count. Default false. */
  tickSound?: boolean;
}

/**
 * CountUp — animates a number from 0 (or previous value) to `value`.
 *
 * - On mount: counts from 0 → value (one-shot intro animation)
 * - If `animateOnChange` is true: re-counts whenever value changes
 * - If `tickSound` is true: plays soft ticks during the count
 *
 * For odometer/slot-machine style digit rolls, use <NumberMorph> instead.
 */
export function CountUp({
  value,
  duration = 800,
  format,
  className,
  style,
  animateOnChange = false,
  tickSound = false,
}: Props) {
  const [display, setDisplay] = useState(0);
  const lastTickRef = useRef(0);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Fix #3: Only animate from 0 on first mount (when animateOnChange is false).
    // On subsequent re-renders with the same value, skip the animation entirely.
    if (!animateOnChange && hasAnimatedRef.current && display === value) return;

    const startVal = animateOnChange ? display : (hasAnimatedRef.current ? display : 0);
    if (value === startVal) return;
    const start = performance.now();
    const delta = value - startVal;

    if (delta === 0) return;
    hasAnimatedRef.current = true;

    // Lazy-load sound only if requested (avoids importing on every CountUp)
    let playTick: (() => void) | null = null;
    if (tickSound) {
      import('@/lib/sounds').then(({ playSound }) => {
        playTick = () => playSound('tick');
      });
    }

    let frame: number;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(startVal + delta * eased);
      setDisplay(current);

      // Play tick sound at ~10Hz during animation
      if (playTick && now - lastTickRef.current > 100) {
        playTick();
        lastTickRef.current = now;
      }

      if (t < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, animateOnChange, tickSound]);

  return (
    <span className={className} style={style}>
      {format ? format(display) : display}
    </span>
  );
}
