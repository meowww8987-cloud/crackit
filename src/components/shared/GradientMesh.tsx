'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { getThemePalette, type Theme3DPalette } from '@/lib/scene3d';
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
 *  - Theme-aware: each theme has its own bg color + blob palette so the
 *    background looks native to the theme (dark = pure black bg + vivid colors,
 *    light = pure white bg + soft colors, rose = pink-tinted bg + shades of pink, etc.)
 */
export function GradientMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSubject = useSession((s) => s.active?.subject ?? null);
  const appTheme = useSettings((s) => s.appTheme);

  // Only render on client (prevents hydration mismatch with window access)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Keep latest subject/theme in refs so we don't re-run the canvas effect on every
  // session change (which would tear down + recreate the rAF loop).
  const subjectRef = useRef<Subject | null>(activeSubject);
  const themeRef = useRef(appTheme);
  useEffect(() => {
    subjectRef.current = activeSubject;
    themeRef.current = appTheme;
  }, [activeSubject, appTheme]);

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

    // Time-of-day shift: morning/evening/night subtly biases the palette
    // (warmer in morning/evening, cooler at night) without losing identity.
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isEvening = hour >= 17 && hour < 21;
    const isNight = hour >= 21 || hour < 5;
    // Warm tint applied to all blobs during morning/evening
    const warmBoost = isMorning || isEvening;

    // Default NEET subject colors (used as base when theme doesn't override)
    const DEFAULT_SUBJECT_COLORS: Record<Subject, [number, number, number]> = {
      Physics:   warmBoost ? [70, 140, 240] : [59, 130, 246],
      Chemistry: warmBoost ? [180, 100, 230] : [168, 85, 247],
      Botany:    [34, 197, 94],
      Zoology:   warmBoost ? [240, 90, 90] : [239, 68, 68],
      General:   isNight ? [120, 130, 180] : [168, 85, 247],
    };

    // Helper: get the theme-aware blob color for a given subject
    const getColorFor = (subject: Subject): [number, number, number] => {
      const palette: Theme3DPalette = getThemePalette(themeRef.current);
      const themed = palette.subjectColors[subject];
      if (themed) return themed.rgb;
      return DEFAULT_SUBJECT_COLORS[subject];
    };

    // Build the blob list. Colors are looked up fresh each frame so theme
    // changes are reflected immediately without rebuilding the blobs.
    const blobs = [
      // Slow background layer (large, dim)
      { x: 0.18, y: 0.28, r: 0.62, subject: 'Physics' as Subject,     baseOpacity: 0.16, speed: 0.5,  phase: 0 },
      { x: 0.82, y: 0.72, r: 0.68, subject: 'Chemistry' as Subject,   baseOpacity: 0.14, speed: 0.5,  phase: 2.2 },
      // Medium layer
      { x: 0.52, y: 0.18, r: 0.42, subject: 'General' as Subject,     baseOpacity: 0.10, speed: 1.0,  phase: 4.1 },
      { x: 0.30, y: 0.82, r: 0.46, subject: 'Physics' as Subject,     baseOpacity: 0.10, speed: 1.2,  phase: 1.3 },
      // Fast foreground layer (small, brighter)
      { x: 0.72, y: 0.42, r: 0.32, subject: 'Botany' as Subject,      baseOpacity: 0.12, speed: 1.8,  phase: 3.5 },
    ];

    let frame = 0;
    const baseTime = Date.now();
    let running = true;

    const render = () => {
      if (!running) return;
      const time = (Date.now() - baseTime) / 1000;

      const palette = getThemePalette(themeRef.current);
      // Base fill — theme-aware (pure black for dark, pure white for light, etc.)
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, w, h);

      // Subject boost: brighten the blob(s) matching the active subject
      const activeColor = subjectRef.current ? getColorFor(subjectRef.current) : null;

      // Light themes (light/warm/rose) use softer opacity; dark themes full
      const isLightTheme = themeRef.current === 'light' || themeRef.current === 'warm' || themeRef.current === 'rose';
      const themeOpacityScale = isLightTheme ? 0.65 : 1;

      for (const blob of blobs) {
        // Parallax drift — sine waves at the blob's speed tier
        const driftX = Math.sin(time * 0.15 * blob.speed + blob.phase) * (80 * blob.speed);
        const driftY = Math.cos(time * 0.12 * blob.speed + blob.phase) * (60 * blob.speed);
        const cx = blob.x * w + driftX;
        const cy = blob.y * h + driftY;
        const radius = (blob.r * Math.max(w, h)) + Math.sin(time * 0.2 * blob.speed + blob.phase) * 30;

        const blobColor = getColorFor(blob.subject);

        // Boost opacity if this blob matches the active subject
        const isMatch = activeColor && blobColor[0] === activeColor[0] && blobColor[1] === activeColor[1];
        const opacityMultiplier = isMatch ? 1.8 : 1;
        const opacity = blob.baseOpacity * opacityMultiplier * themeOpacityScale;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0,   `rgba(${blobColor[0]}, ${blobColor[1]}, ${blobColor[2]}, ${opacity})`);
        grad.addColorStop(0.5, `rgba(${blobColor[0]}, ${blobColor[1]}, ${blobColor[2]}, ${opacity * 0.4})`);
        grad.addColorStop(1,   `rgba(${blobColor[0]}, ${blobColor[1]}, ${blobColor[2]}, 0)`);

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
