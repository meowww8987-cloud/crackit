'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  title?: string;
}

export function RippleButton({ children, onClick, className, style, disabled, title }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const btn = btnRef.current;
    if (!btn) return;

    // Create ripple
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);

    onClick?.(e);
  }, [onClick]);

  return (
    <button
      ref={btnRef}
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      className={cn('ripple-btn', className)}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}
