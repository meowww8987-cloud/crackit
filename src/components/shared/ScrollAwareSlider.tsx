'use client';

import { useRef, useEffect, type ReactNode } from 'react';

/**
 * ScrollAwareSlider — wrapper that prevents accidental slider changes when
 * the user is trying to scroll the page vertically.
 *
 * PROBLEM:
 *   When a user swipes up/down to scroll the page, sometimes their finger
 *   moves slightly diagonally. If that swipe starts on top of a range slider,
 *   the browser interprets it as a slider drag and instantly changes the value.
 *   One accidental swipe can change "Daily Goal" from 6h to 2h.
 *
 * SOLUTION:
 *   Wrap the slider in this component. On pointerdown we capture the start
 *   position but DON'T commit to dragging yet. On pointermove we measure the
 *   movement angle. If it's mostly vertical (>60° from horizontal) we cancel
 *   the drag and let the page scroll. If mostly horizontal (<30°) we let the
 *   native slider drag proceed. Between 30-60° we keep tracking.
 *
 * USAGE:
 *   <ScrollAwareSlider>
 *     <input type="range" min={1} max={12} ... />
 *   </ScrollAwareSlider>
 *
 * The wrapper is `touch-action: none` ONLY on horizontal swipes — vertical
 * swipes pass through to the page. This is done via setPointerCapture + a
 * movement threshold, not via CSS (which would block all scrolling).
 *
 * NOTE: This component is transparent — no visual change. It only intercepts
 * pointer events to decide whether to let the slider drag or pass the gesture
 * to the page as a scroll.
 */
export function ScrollAwareSlider({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const decidedRef = useRef<'none' | 'slider' | 'scroll'>('none');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const findSlider = (): HTMLInputElement | null => {
      return el.querySelector('input[type="range"]');
    };

    const onPointerDown = (e: PointerEvent) => {
      // Record start position. Don't decide yet — wait for movement.
      startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      decidedRef.current = 'none';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!startRef.current || decidedRef.current !== 'none') return;

      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      const totalDist = dx + dy;

      // Need at least 8px of movement to decide (avoid jitter on tap)
      if (totalDist < 8) return;

      // Compute angle from horizontal (0° = pure horizontal, 90° = pure vertical)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      if (angle > 60) {
        // Mostly vertical → user is scrolling. Cancel the slider drag.
        decidedRef.current = 'scroll';
        // Release pointer capture so the page can scroll
        const slider = findSlider();
        if (slider) {
          try {
            // Blur the slider so it stops tracking pointer
            slider.blur();
            // Re-enable touch-action so the page scrolls
            slider.style.touchAction = 'pan-y';
          } catch {}
        }
        // Also try to release pointer capture on the wrapper
        try { el.releasePointerCapture(e.pointerId); } catch {}
      } else if (angle < 30) {
        // Mostly horizontal → user is dragging the slider. Let it proceed.
        decidedRef.current = 'slider';
        const slider = findSlider();
        if (slider) {
          // Disable touch-action so the slider gets the pointer events
          slider.style.touchAction = 'none';
        }
      }
      // 30-60° = ambiguous, keep tracking until clearer movement
    };

    const onPointerUp = () => {
      startRef.current = null;
      decidedRef.current = 'none';
      // Reset touch-action to default (let next gesture decide fresh)
      const slider = findSlider();
      if (slider) {
        slider.style.touchAction = '';
      }
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className="scroll-aware-slider" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
}
