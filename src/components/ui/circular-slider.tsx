'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Current value. */
  value: number;
  /** Minimum value (mapped to angle 0°). */
  min: number;
  /** Maximum value (mapped to angle 360° — full circle). */
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
  /** Optional canvas size override. When stacking multiple CircularSliders
   *  concentrically, ALL rings must share the same canvas size + center so
   *  they're perfectly concentric. Pass the OUTER ring's canvas size here
   *  for every ring. If omitted, canvas = (radius + padding) * 2 as before. */
  canvasSize?: number;
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
 * CIRCUMFERENCE of a full circle (360°).
 *
 * Geometry:
 *  - Full 360° circle (no gap, no chopped arcs — clean look).
 *  - Start angle = -90° (top / 12 o'clock in SVG coords).
 *  - Sweeping clockwise increases the value.
 *  - Track = a full `<circle>` element (always complete).
 *  - Value fill = a `<path>` arc from start to current angle (or a full
 *    circle when value === max).
 *
 * Interaction:
 *  - pointerdown anywhere near the ring begins dragging
 *  - pointermove updates the value based on the angle from center to pointer
 *  - pointerup ends the drag and fires onCommit
 *  - Touch supported via pointer events
 *
 * Concentric stacking:
 *  - The SVG's onPointerDown checks if the pointer is near THIS ring's radius
 *    (within ±strokeWidth/2 + 10). If not, it returns early so the event
 *    passes through to any ring layered below.
 *
 * Accessibility:
 *  - role="slider" + ArrowLeft/Right (step -/+) + Home/End (min/max).
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
  canvasSize,
  disabled = false,
  ariaLabel,
  onChange,
  onCommit,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Full circle: sweep = 360°, start at top (-90° in SVG coords where 0° = right).
  const SWEEP_DEG = 360;
  const START_DEG = -90; // 12 o'clock

  // Canvas size + center. When canvasSize is provided (concentric stacking),
  // use it directly so all rings share the same center. Otherwise compute
  // from this ring's own radius (standalone usage).
  const padding = strokeWidth / 2 + 8;
  const size = canvasSize ?? (radius + padding) * 2;
  const cx = size / 2;
  const cy = size / 2;

  const pct = (value - min) / (max - min);
  const valueAngleDeg = START_DEG + pct * SWEEP_DEG;

  // Convert an angle (degrees, SVG convention: 0° = right, 90° = down) to a point.
  const angleToPoint = useCallback((deg: number, r: number = radius) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }, [cx, cy, radius]);

  // Convert a pointer position (clientX/Y) to a stepped, clamped value.
  const pointerToValue = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return value;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    // Angle from center to pointer (atan2 returns radians, -π to π).
    // In SVG coords (+y down), atan2(dy, dx) gives degrees where 0° = right,
    // 90° = down, -90° = up. This is what we want.
    const deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
    // Normalize so START_DEG (-90°, i.e. top) = 0% of sweep.
    let offset = deg - START_DEG;
    // Wrap to [0, 360)
    offset = ((offset % 360) + 360) % 360;
    const ratio = offset / SWEEP_DEG;
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [cx, cy, size, min, max, step, value]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Only respond if the pointer is near THIS ring's radius — prevents
    // hijacking clicks meant for a ring layered below in concentric setups.
    // Tolerance is tight (strokeWidth/2 + 4) so two stacked rings with a
    // 35px gap between them have non-overlapping grab zones.
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      const tolerance = strokeWidth / 2 + 4;
      if (Math.abs(dist - radius) > tolerance) {
        return; // Not near this ring — pass through
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

  // === SVG geometry ===
  // Track = full circle (use <circle> element — always clean, no arc math).
  // Value fill = arc path from START_DEG to valueAngleDeg.
  //   - If pct >= 0.999 (value === max), draw a full circle instead (SVG can't
  //     draw a 360° arc with a single A command — it needs two 180° arcs or a
  //     <circle>).
  //   - If pct <= 0, draw nothing.
  //   - Otherwise, draw an arc. largeArcFlag = 1 if the arc spans > 180°.

  const startPoint = angleToPoint(START_DEG);
  const valueEnd = angleToPoint(valueAngleDeg);
  const valueSweepDeg = pct * SWEEP_DEG;
  const valueLargeArc = valueSweepDeg > 180 ? 1 : 0;

  // Build the value arc path. When the arc is a full circle (pct >= 0.999),
  // use two semicircle arcs to avoid the SVG "can't draw 360° with one A" issue.
  let valuePath: string;
  let useFullCircle = false;
  if (pct <= 0) {
    valuePath = '';
  } else if (pct >= 0.999) {
    // Full circle — draw as two 180° arcs
    const mid = angleToPoint(START_DEG + 180);
    valuePath = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 1 1 ${mid.x} ${mid.y} A ${radius} ${radius} 0 1 1 ${startPoint.x} ${startPoint.y}`;
    useFullCircle = true;
  } else {
    valuePath = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${valueLargeArc} 1 ${valueEnd.x} ${valueEnd.y}`;
  }

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
        onKeyDown={handleKeyDown}
        className={cn('outline-none cursor-pointer', dragging && 'cursor-grabbing')}
        // pointer-events: none on the SVG ROOT so the empty center area
        // doesn't capture events. Only the hit-zone <circle> inside (which
        // has pointer-events: stroke + the pointer handlers) captures
        // events — and only on its own stroke. This lets clicks on the
        // outer ring pass THROUGH the inner ring's empty SVG to reach the
        // outer ring's hit-zone below. Critical for concentric stacking.
        style={{ touchAction: 'none' as const, pointerEvents: 'none' }}
      >
        {/* Transparent wider hit-zone — a full circle so the user can grab
            anywhere near the ring. strokeWidth + 8 keeps the grab zone tight
            enough that two stacked rings don't collide.
            POINTER EVENTS LIVE HERE (not on the SVG root) because the SVG
            root has pointer-events: none to let clicks pass through empty
            space in concentric setups. */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="transparent"
          strokeWidth={strokeWidth + 8}
          style={{ pointerEvents: 'stroke', cursor: dragging ? 'grabbing' : 'pointer' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {/* Track — full circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--ring-track, rgba(255,255,255,0.10))"
          strokeWidth={strokeWidth}
          style={{ pointerEvents: 'none' }}
        />
        {/* Value fill — arc path (or full circle when value === max) */}
        {valuePath && !useFullCircle && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {useFullCircle && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Thumb — wider transparent hit circle + visible colored circle.
            Hit zone reduced from +6 to +3 so two stacked rings' thumbs don't
            collide when both arcs end in the same quadrant.
            POINTER EVENTS also live here so the user can grab the thumb
            directly (the SVG root has pointer-events: none). */}
        <circle
          cx={thumb.x}
          cy={thumb.y}
          r={thumbRadius + 3}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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
