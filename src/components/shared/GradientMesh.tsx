'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/store/session';
import type { Subject } from '@/lib/types';

/**
 * Aurora 2.0 — animated multi-layer gradient background with parallax depth.
 *
 * Design goals:
 *  - Real spatial depth (not just "moving colors") via 3 parallax speed tiers
 *  - Subject-aware: brightens the blob matching the active session's subject
 *  - Subtle but visible — replaces the previous 7%-opacity blobs that were
 *    nearly invisible against the dark background
 *  - Performance: single rAF loop, paused when tab hidden, frozen when user
 *    prefers reduced motion
 *  - Theme-aware: opacity & base color adapt to dark/light
 */
export function GradientMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSubject = useSession((s) => s.active?.subject ?? null);

  // Only render on client (prevents hydration mismatch with window access)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Keep latest subject in a ref so we don't re-run the canvas effect on every
  // session change (which would tear down + recreate the rAF loop).
  const subjectRef = useRef<Subject | null>(activeSubject);
  useEffect(() => {
    subjectRef.current = activeSubject;
  }, [activeSubject]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect reduced-motion: render a single static frame, no rAF loop
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // 5 blobs in 3 parallax tiers (slow / medium / fast).
    // Slow = large, dim, far back. Fast = small, brighter, closer.
    // Colors stay in the NEET subject palette so subject-aware brightening
    // feels native.
    // Time-of-day shift: morning/evening/night subtly biases the palette
    // (warmer in morning/evening, cooler at night) without losing identity.
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isEvening = hour >= 17 && hour < 21;
    const isNight = hour >= 21 || hour < 5;
    // Warm tint applied to all blobs during morning/evening
    const warmBoost = isMorning || isEvening;

    const SUBJECT_COLORS: Record<Subject, [number, number, number]> = {
      Physics:   warmBoost ? [70, 140, 240] : [59, 130, 246],   // blue (slightly warmer in morning)
      Chemistry: warmBoost ? [180, 100, 230] : [168, 85, 247], // purple
      Botany:    [34, 197, 94],                                 // green (constant)
      Zoology:   warmBoost ? [240, 90, 90] : [239, 68, 68],     // red (warmer in evening)
      General:   isNight ? [120, 130, 180] : [168, 85, 247],    // cooler purple at night
    };

    const blobs = [
      // Slow background layer (large, dim)
      { x: 0.18, y: 0.28, r: 0.62, color: SUBJECT_COLORS.Physics,   baseOpacity: 0.16, speed: 0.5,  phase: 0 },
      { x: 0.82, y: 0.72, r: 0.68, color: SUBJECT_COLORS.Chemistry, baseOpacity: 0.14, speed: 0.5,  phase: 2.2 },
      // Medium layer
      { x: 0.52, y: 0.18, r: 0.42, color: SUBJECT_COLORS.General,   baseOpacity: 0.10, speed: 1.0,  phase: 4.1 },
      { x: 0.30, y: 0.82, r: 0.46, color: [59, 130, 246],           baseOpacity: 0.10, speed: 1.2,  phase: 1.3 },
      // Fast foreground layer (small, brighter)
      { x: 0.72, y: 0.42, r: 0.32, color: SUBJECT_COLORS.Botany,    baseOpacity: 0.12, speed: 1.8,  phase: 3.5 },
    ];

    let frame = 0;
    const baseTime = Date.now();
    let running = true;

    const render = () => {
      if (!running) return;
      const time = (Date.now() - baseTime) / 1000;

      const isDark = document.documentElement.classList.contains('dark');

      // Base fill — near-black in dark mode, near-white in light
      ctx.fillStyle = isDark ? '#0a0b10' : '#fafbfd';
      ctx.fillRect(0, 0, w, h);

      // Subject boost: brighten the blob(s) matching the active subject
      const activeColor = subjectRef.current ? SUBJECT_COLORS[subjectRef.current] : null;

      for (const blob of blobs) {
        // Parallax drift — sine waves at the blob's speed tier
        const driftX = Math.sin(time * 0.15 * blob.speed + blob.phase) * (80 * blob.speed);
        const driftY = Math.cos(time * 0.12 * blob.speed + blob.phase) * (60 * blob.speed);
        const cx = blob.x * w + driftX;
        const cy = blob.y * h + driftY;
        const radius = (blob.r * Math.max(w, h)) + Math.sin(time * 0.2 * blob.speed + blob.phase) * 30;

        // Boost opacity if this blob matches the active subject
        const isMatch = activeColor && blob.color[0] === activeColor[0] && blob.color[1] === activeColor[1];
        const opacityMultiplier = isMatch ? 1.8 : 1;
        const opacity = blob.baseOpacity * opacityMultiplier * (isDark ? 1 : 0.7);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0,   `rgba(${blob.color[0]}, ${blob.color[1]}, ${blob.color[2]}, ${opacity})`);
        grad.addColorStop(0.5, `rgba(${blob.color[0]}, ${blob.color[1]}, ${blob.color[2]}, ${opacity * 0.4})`);
        grad.addColorStop(1,   `rgba(${blob.color[0]}, ${blob.color[1]}, ${blob.color[2]}, 0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      if (!prefersReducedMotion) {
        frame = requestAnimationFrame(render);
      }
    };
    render();

    // Pause when tab is hidden — saves battery + GPU
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (frame) cancelAnimationFrame(frame);
      } else if (!prefersReducedMotion) {
        running = true;
        render();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}
