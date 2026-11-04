'use client';

import { memo } from 'react';

interface Props {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FlipTimer — renders each digit/colon of the timer string.
 *
 * === #2 Digit cards (flip-clock style) ===
 * Each digit sits in a subtle dark rounded card with a thin border, giving
 * the timer a tangible, premium flip-clock feel. The card background is very
 * subtle (rgba white 4%) so it doesn't compete with the digit color.
 *
 * === #4 Colon pulse ===
 * The ':' separator gently pulses every second (opacity + scale) making the
 * timer feel "alive". Implemented via the .colon-pulse CSS animation.
 */
export const FlipTimer = memo(function FlipTimer({ value, className, style }: Props) {
  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', gap: '0.04em' }}>
      {value.split('').map((char, i) => {
        const isDigit = /\d/.test(char);
        const isColon = char === ':';

        if (!isDigit) {
          // Colon (or any non-digit separator) — pulses every second
          return (
            <span
              key={i}
              className={isColon ? 'colon-pulse' : undefined}
              style={{
                display: 'inline-block',
                width: '0.4em',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              {char}
            </span>
          );
        }

        // === #2 Digit card — subtle dark rounded background per digit ===
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: '0.65em',
              textAlign: 'center',
              perspective: '200px',
            }}
          >
            <span
              key={`${i}-${char}`}
              style={{
                display: 'inline-block',
                transformStyle: 'preserve-3d',
                animation: 'digit-flip 0.35s ease-in-out',
                // === #2 Digit card styling ===
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '0.12em',
                padding: '0.02em 0.04em',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {char}
            </span>
          </span>
        );
      })}
    </div>
  );
});
