'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Current value. */
  value: number;
  /** Minimum value (mapped to angle 0°). */
  min: number;
  /** Maximum value (mapped to angle 270° — leaves a 90° gap at the bottom). */
  max: number;
  /** Step size — value is rounded to nearest multiple of step. */
  step: number;
  /** Radius of the ring (in pixels). The SVG viewBox is sized to (2 * (radius + padding)). */
  radius: number;
  /** Stroke width of the ring. */
  strokeWidth: number;
  /** Fill color (the active arc). */
  color: string;
  /** Optional label to render in the center. */
  centerLabel?: React.ReactNode;
  /** Disabled state. */
  disabled?: boolean;
  /** Aria label for accessibility. */
  ariaLabel?: string;
  /** Called with the new (stepped, clamped) value on every drag move. */
  onChange: (v: number) => void;
  /** Called once when drag ends (pointer up). Optional. */
  onCommit?: (v: number) => void;
  className?: string;
}

/**
 * CircularSlider — a radial slider where the user drags a thumb ALONG THE
 * CIRCUMFERENCE of a ring, not along a straight line.
 *
 * Geometry:
 *  - Active arc spans 270° (from -225° to +45° in standard SVG coords, leaving
 *    a 90° gap at the bottom so the start/end don't meet).
 *  - Angle 0 (start) is at the bottom-left of the gap.
 *  - Dragging clockwise from there increases the value.
 *
 * Interaction:
 *  - pointerdown anywhere on the ring or thumb begins dragging
 *  - pointermove updates the value based on the angle from the center to the
 *    pointer position (snapped to the ring's radius)
 *  - pointerup ends the drag and fires onCommit
 *  - Touch is supported via pointer events
 *
 * Accessibility:
 *  - The SVG has role="slider" and responds to ArrowLeft/ArrowRight (step -/+)
 *    and Home/End (min/max).
 */
export function CircularSlider({
  value,
  min,
  max,
  step,
  radius,
  strokeWidth,
  color,
  centerLabel,
  disabled = false,
  ariaLabel,
  onChange,
  onCommit,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Total swept angle = 270° (3π/2). Start angle = 135° from positive x-axis
  // (in SVG coords, where +y is down), so the gap is centered at the bottom.
  // Easier mental model: start at "7 o'clock", sweep clockwise to "5 o'clock".
  const SWEEP_DEG = 270;
  const START_DEG = 135;  // SVG: 0° = right, 90° = down. 135° = bottom-left.

  const padding = strokeWidth / 2 + 8;  // 8px extra for thumb overhang
  const size = (radius + padding) * 2;
  const cx = size / 2;
  const cy = size / 2;

  const pct = (value - min) / (max - min);
  const valueAngleDeg = START_DEG + pct * SWEEP_DEG;

  // Convert an angle (in degrees, SVG convention) to a point on the ring.
  const angleToPoint = useCallback((deg: number, r: number = radius) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }, [cx, cy, radius]);

  // Convert a pointer position (clientX/Y) to a value, snapped to step.
  const pointerToValue = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return value;
    const rect = svg.getBoundingClientRect();
    // Scale: bounding rect may not match SVG's intrinsic size.
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    // Angle from center to pointer, in SVG degrees (atan2 with +y down).
    const deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
    // Normalize so that START_DEG = 0% of sweep. We need to find the offset
    // within the [START_DEG, START_DEG + SWEEP_DEG) range, accounting for
    // wraparound at 360°.
    let offset = deg - START_DEG;
    // Wrap to [0, 360)
    offset = ((offset % 360) + 360) % 360;
    // If the pointer is in the bottom gap (offset > SWEEP_DEG), snap to the
    // nearest end (0 or SWEEP_DEG).
    if (offset > SWEEP_DEG) {
      // Distance from 0 (start) vs SWEEP_DEG (end)
      const distFromStart = 360 - offset;
      const distFromEnd = offset - SWEEP_DEG;
      offset = distFromStart < distFromEnd ? 0 : SWEEP_DEG;
    }
    const ratio = offset / SWEEP_DEG;
    const raw = min + ratio * (max - min);
    // Snap to step
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [cx, cy, size, min, max, step, value]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Check if the pointer is near the ring (within a tolerance band).
    // This prevents the SVG's onPointerDown from firing when the user clicks
    // the empty center of the ring — which would otherwise hijack clicks meant
    // for a ring layered below in a concentric setup.
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      // Only respond if the pointer is within ±(strokeWidth/2 + 10) of the ring radius
      const tolerance = strokeWidth / 2 + 10;
      if (Math.abs(dist - radius) > tolerance) {
        // Not near this ring — let the event pass through to any ring below
        return;
      }
    }
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const v = pointerToValue(e.clientX, e.clientY);
    if (v !== value) onChange(v);
  }, [disabled, pointerToValue, value, onChange, cx, cy, size, radius, strokeWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    e.preventDefault();
    const v = pointerToValue(e.clientX, e.clientY);
    if (v !== value) onChange(v);
  }, [dragging, disabled, pointerToValue, value, onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
    onCommit?.(value);
  }, [dragging, onCommit, value]);

  // Keyboard support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    next = Math.max(min, Math.min(max, next));
    if (next !== value) {
      onChange(next);
      onCommit?.(next);
    }
  }, [disabled, value, step, min, max, onChange, onCommit]);

  // Cleanup if component unmounts mid-drag
  useEffect(() => {
    if (!dragging) return;
    const cleanup = () => setDragging(false);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    return () => {
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
  }, [dragging]);

  // Compute SVG arc paths
  const trackStart = angleToPoint(START_DEG);
  const trackEnd = angleToPoint(START_DEG + SWEEP_DEG);
  // For the track (background), we draw a 270° arc.
  // SVG arc flag: largeArcFlag = 1 if arc > 180°, sweepFlag = 1 for clockwise.
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  // For the value arc (the colored fill), draw from start to current angle.
  const valueEnd = angleToPoint(valueAngleDeg);
  const valueLargeArc = pct * SWEEP_DEG > 180 ? 1 : 0;
  // Edge case: if value === min, draw nothing (zero-length arc is invalid).
  const valuePath = pct <= 0
    ? ''
    : `M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${valueLargeArc} 1 ${valueEnd.x} ${valueEnd.y}`;

  // Thumb position
  const thumb = angleToPoint(valueAngleDeg);
  const thumbRadius = strokeWidth / 2 + 4;

  return (
    <div
      className={cn('relative inline-block select-none', disabled && 'opacity-50 pointer-events-none', className)}
      style={{ width: size, height: size, touchAction: 'none' }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={cn('outline-none cursor-pointer', dragging && 'cursor-grabbing')}
        style={{ touchAction: 'none' as const }}
      >
        {/* Transparent wider hit-zone path so the user can grab anywhere near
            the ring (not just on the thin stroke). pointerEvents='stroke' means
            only clicks ON the ring path itself trigger events — the empty center
            passes through to any ring layered below. This is critical when two
            CircularSliders are stacked concentrically. */}
        <path
          d={trackPath}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth + 14}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        />
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--ring-track, rgba(255,255,255,0.10))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        {/* Value fill */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Thumb — also draggable. Slightly wider hit area via a transparent
            circle behind it. */}
        <circle
          cx={thumb.x}
          cy={thumb.y}
          r={thumbRadius + 6}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'grab' }}
        />
        <circle
          cx={thumb.x}
          cy={thumb.y}
          r={thumbRadius}
          fill={color}
          stroke="var(--card-bg, #fff)"
          strokeWidth={3}
          style={{
            pointerEvents: 'none',
            filter: dragging ? `drop-shadow(0 2px 8px ${color}80)` : 'none',
            transition: dragging ? 'none' : 'all 0.15s ease',
          }}
        />
      </svg>
      {/* Center label */}
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
