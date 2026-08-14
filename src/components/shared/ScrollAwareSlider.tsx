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
 * SOLUTION (combines Option A + Option C):
 *   Wrap the slider in this component. On pointerdown we capture the start
 *   position but DON'T commit to dragging yet. On pointermove we measure the
 *   movement angle:
 *     - angle > 60° (mostly vertical) → user is scrolling. Cancel the slider
 *       drag, blur the slider, let the page scroll freely.
 *     - angle < 30° (mostly horizontal) → user is dragging the slider. Lock
 *       the page scroll (touch-action: none) so the slider gets ALL pointer
 *       events — no vertical movement leaks through.
 *     - 30-60° = ambiguous, keep tracking.
 *
 * Option C addition: once the slider is being dragged, we set touch-action
 * to 'none' on the wrapper so the page CANNOT scroll vertically even if the
 * finger moves diagonally during the drag. This prevents the "slider jumps
 * around while page also scrolls" double-action bug.
 *
 * USAGE:
 *   <ScrollAwareSlider>
 *     <input type="range" min={1} max={12} ... />
 *   </ScrollAwareSlider>
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
      // Reset wrapper touch-action to default (let gesture decide)
      el.style.touchAction = 'pan-y';
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
        const slider = findSlider();
        if (slider) {
          try {
            slider.blur();
            slider.style.touchAction = 'pan-y';
          } catch {}
        }
        // Wrapper allows vertical scroll
        el.style.touchAction = 'pan-y';
        try { el.releasePointerCapture(e.pointerId); } catch {}
      } else if (angle < 30) {
        // Mostly horizontal → user is dragging the slider.
        // OPTION C: Lock ALL scrolling (touch-action: none) so vertical
        // movement doesn't leak through and cause double-action.
        decidedRef.current = 'slider';
        const slider = findSlider();
        if (slider) {
          slider.style.touchAction = 'none';
        }
        // Also lock the wrapper — prevents page scroll during slider drag
        el.style.touchAction = 'none';
        // Capture pointer so we get all subsequent move events
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
      // 30-60° = ambiguous, keep tracking until clearer movement
    };

    const onPointerUp = (e: PointerEvent) => {
      startRef.current = null;
      decidedRef.current = 'none';
      // Reset touch-action to default (let next gesture decide fresh)
      const slider = findSlider();
      if (slider) {
        slider.style.touchAction = '';
      }
      el.style.touchAction = 'pan-y';
      try { el.releasePointerCapture(e.pointerId); } catch {}
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
