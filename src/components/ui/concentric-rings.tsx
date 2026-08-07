'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RingConfig {
  /** Current value. */
  value: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step size. */
  step: number;
  /** Radius in px. */
  radius: number;
  /** Stroke width in px. */
  strokeWidth: number;
  /** Arc / thumb color. */
  color: string;
  /** ARIA label. */
  ariaLabel: string;
  /** Called on every drag move. */
  onChange: (v: number) => void;
}

interface Props {
  outer: RingConfig;
  inner: RingConfig;
  /** Optional center label node. */
  centerLabel?: React.ReactNode;
  className?: string;
}

/**
 * ConcentricRings — TWO radial sliders in a SINGLE SVG.
 *
 * Why one SVG instead of two stacked components?
 *   Stacking two separately-rendered CircularSliders creates a pointer-event
 *   layering nightmare: the upper ring's wrapper div / SVG intercepts clicks
 *   over the lower ring, even with pointer-events: none (because of quirks
 *   in how browsers handle pointer-events on transparent SVG strokes).
 *
 *   By putting BOTH rings in ONE SVG, there's only one hit target. The
 *   onPointerDown handler does manual hit-testing: compute the distance
 *   from the center to the click, then decide which ring is closer.
 *   This is 100% reliable — no CSS pointer-events tricks needed.
 *
 * Geometry:
 *   - Full 360° circles (no gap, no chopped arcs).
 *   - Start angle = -90° (12 o'clock). Sweep clockwise → value increases.
 *   - Track = full <circle>. Value fill = <path> arc (or <circle> at max).
 *
 * Interaction:
 *   - pointerdown anywhere on the SVG → hit-test: which ring is the click
 *     closest to? If within tolerance of that ring's radius, start dragging
 *     THAT ring.
 *   - pointermove → update the active ring's value based on angle.
 *   - pointerup → stop dragging.
 */
export function ConcentricRings({ outer, inner, centerLabel, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingRing, setDraggingRing] = useState<'outer' | 'inner' | null>(null);

  // Canvas size = outer ring's diameter + padding
  const STROKE_MAX = Math.max(outer.strokeWidth, inner.strokeWidth);
  const padding = STROKE_MAX / 2 + 10;
  const size = (outer.radius + padding) * 2;
  const cx = size / 2;
  const cy = size / 2;
  const START_DEG = -90; // 12 o'clock (SVG: 0° = right, -90° = up)

  // === Geometry helpers ===
  const angleToPoint = useCallback((deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }, [cx, cy]);

  const pointerToValue = useCallback((clientX: number, clientY: number, ring: RingConfig): number => {
    const svg = svgRef.current;
    if (!svg) return ring.value;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
    let offset = deg - START_DEG;
    offset = ((offset % 360) + 360) % 360;
    const ratio = offset / 360;
    const raw = ring.min + ratio * (ring.max - ring.min);
    const stepped = Math.round(raw / ring.step) * ring.step;
    return Math.max(ring.min, Math.min(ring.max, stepped));
  }, [cx, cy, size, START_DEG]);

  // === Hit-test: which ring did the user click? ===
  // Returns 'outer' | 'inner' | null based on distance from center.
  const hitTest = useCallback((clientX: number, clientY: number): 'outer' | 'inner' | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);

    // Check outer ring first (it's bigger). Tolerance = strokeWidth/2 + 8.
    const outerTol = outer.strokeWidth / 2 + 8;
    if (Math.abs(dist - outer.radius) <= outerTol) return 'outer';

    // Check inner ring.
    const innerTol = inner.strokeWidth / 2 + 8;
    if (Math.abs(dist - inner.radius) <= innerTol) return 'inner';

    return null;
  }, [cx, cy, size, outer.radius, outer.strokeWidth, inner.radius, inner.strokeWidth]);

  // === Pointer handlers ===
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const ring = hitTest(e.clientX, e.clientY);
    if (!ring) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDraggingRing(ring);
    const cfg = ring === 'outer' ? outer : inner;
    const v = pointerToValue(e.clientX, e.clientY, cfg);
    if (v !== cfg.value) cfg.onChange(v);
  }, [hitTest, pointerToValue, outer, inner]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRing) return;
    e.preventDefault();
    const cfg = draggingRing === 'outer' ? outer : inner;
    const v = pointerToValue(e.clientX, e.clientY, cfg);
    if (v !== cfg.value) cfg.onChange(v);
  }, [draggingRing, outer, inner, pointerToValue]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRing) return;
    e.preventDefault();
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDraggingRing(null);
  }, [draggingRing]);

  // Cleanup
  useEffect(() => {
    if (!draggingRing) return;
    const cleanup = () => setDraggingRing(null);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    return () => {
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
  }, [draggingRing]);

  // === Render a single ring (track + value arc + thumb) ===
  const renderRing = (cfg: RingConfig, isOuter: boolean) => {
    const pct = (cfg.value - cfg.min) / (cfg.max - cfg.min);
    const valueAngle = START_DEG + pct * 360;
    const startPoint = angleToPoint(START_DEG, cfg.radius);
    const valueEnd = angleToPoint(valueAngle, cfg.radius);
    const largeArc = pct * 360 > 180 ? 1 : 0;
    const isFull = pct >= 0.999;
    const isEmpty = pct <= 0;
    const thumb = angleToPoint(valueAngle, cfg.radius);
    const thumbR = cfg.strokeWidth / 2 + 4;
    const isActive = draggingRing === (isOuter ? 'outer' : 'inner');

    return (
      <g key={isOuter ? 'outer' : 'inner'}>
        {/* Track — full circle */}
        <circle
          cx={cx} cy={cy} r={cfg.radius}
          fill="none"
          stroke="var(--ring-track, rgba(255,255,255,0.10))"
          strokeWidth={cfg.strokeWidth}
        />
        {/* Value fill */}
        {isEmpty ? null : isFull ? (
          <circle
            cx={cx} cy={cy} r={cfg.radius}
            fill="none" stroke={cfg.color} strokeWidth={cfg.strokeWidth}
          />
        ) : (
          <path
            d={`M ${startPoint.x} ${startPoint.y} A ${cfg.radius} ${cfg.radius} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`}
            fill="none" stroke={cfg.color} strokeWidth={cfg.strokeWidth} strokeLinecap="round"
          />
        )}
        {/* Thumb */}
        <circle
          cx={thumb.x} cy={thumb.y} r={thumbR}
          fill={cfg.color}
          stroke="var(--card-bg, #fff)"
          strokeWidth={3}
          style={{
            filter: isActive ? `drop-shadow(0 2px 8px ${cfg.color}80)` : 'none',
            transition: isActive ? 'none' : 'all 0.15s ease',
          }}
        />
      </g>
    );
  };

  return (
    <div
      className={cn('relative inline-block select-none', className)}
      style={{ width: size, height: size, touchAction: 'none' }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="group"
        aria-label="Pomodoro cycle sliders"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="outline-none cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        {renderRing(outer, true)}
        {renderRing(inner, false)}
      </svg>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
