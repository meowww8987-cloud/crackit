'use client';

import { memo } from 'react';

interface Props {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

export const FlipTimer = memo(function FlipTimer({ value, className, style }: Props) {
  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center' }}>
      {value.split('').map((char, i) => {
        const isDigit = /\d/.test(char);

        if (!isDigit) {
          return (
            <span key={i} style={{ display: 'inline-block', width: '0.5em', textAlign: 'center' }}>
              {char}
            </span>
          );
        }

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
