'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { useMounted } from '@/lib/hooks/useMounted';
import {
  buildScene,
  renderFrame,
  detectSceneType,
  getSubjectColor,
  getSubjectColorThemed,
  getThemePalette,
  detectDeviceTier,
  objectCountForTier,
  type SceneObject,
  type SceneType,
  type DeviceTier,
} from '@/lib/scene3d';
import {
  isParticleScene,
  isParticleSceneImplemented,
  particleFallback3D,
  buildParticleScene,
  renderParticleFrame,
  handleParticlePointer,
  resizeParticleScene,
  updateParticlePointer,
  type ParticleState,
} from '@/lib/particleScenes';

/**
 * 3D animated background — pure Canvas 2D + manual 3D projection.
 *
 * Behavior:
 *  - Reads `bg3DMode` from settings: 'auto' | 'atoms' | 'dna' | 'molecules' | 'cells' | 'hybrid' | 'off'
 *  - In 'auto' mode, scene type is detected from the active session's subject + chapter
 *    (Physics→atoms, Zoology→dna, Botany→cells, Chemistry→molecules/atoms by chapter)
 *  - Subject color from NEET palette (Physics=teal, Chem=green, Botany=emerald, Zoology=red)
 *  - Subject-aware brightness boost: objects matching the active subject's color glow 2x
 *  - Device tier detection: scales object count (12 / 25 / 40) based on CPU cores + RAM
 *  - Respects prefers-reduced-motion (renders single static frame)
 *  - Pauses rAF when tab is hidden
 *  - Returns null when bg3DMode === 'off' (aurora still visible underneath)
 *  - THEME-AWARE: each theme has its own palette (dark=vivid, light=soft, rose=pink shades, etc.)
 *
 * Implementation note: the canvas mount effect runs ONCE on mount (deps: [mounted]).
 * Scene rebuilds happen via a 500ms interval that checks for subject/mode/theme changes
 * and rebuilds the in-memory object list without tearing down the rAF loop.
 */
export function Scene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mounted = useMounted();
  const bg3DMode = useSettings((s) => s.bg3DMode);
  const appTheme = useSettings((s) => s.appTheme);
  const activeSubject = useSession((s) => s.active?.subject ?? null);
  const activeChapter = useSession((s) => s.active?.chapter ?? null);

  // Refs to access latest values inside the rAF loop without re-running effect
  const modeRef = useRef(bg3DMode);
  const themeRef = useRef(appTheme);
  const subjectRef = useRef(activeSubject);
  const chapterRef = useRef(activeChapter);
  useEffect(() => {
    modeRef.current = bg3DMode;
    themeRef.current = appTheme;
    subjectRef.current = activeSubject;
    chapterRef.current = activeChapter;
  });

  // Hold the current scene + a key so we can rebuild on subject/mode/theme change
  // without re-running the canvas mount effect.
  const sceneRef = useRef<SceneObject[]>([]);
  const currentSceneKeyRef = useRef<string>('');
  const particleSceneRef = useRef<ParticleState | null>(null);

  // Compute a stable key — when this changes, rebuild the scene.
  const computeSceneKey = (): string => {
    const mode = modeRef.current;
    const theme = themeRef.current;
    if (mode === 'off') return 'off';
    if (mode === 'auto') {
      const t = detectSceneType(subjectRef.current, chapterRef.current);
      const c = getSubjectColorThemed(subjectRef.current, theme);
      return `auto:${t}:${c.hex}:${theme}`;
    }
    const subjForMode =
      mode === 'atoms' ? 'Physics'
      : mode === 'molecules' ? 'Chemistry'
      : mode === 'cells' ? 'Botany'
      : mode === 'dna' ? 'Zoology'
      : 'General';
    const c = getSubjectColorThemed(subjForMode, theme);
    return `${mode}:${c.hex}:${theme}`;
  };

  useEffect(() => {
    if (!mounted) return;
    if (modeRef.current === 'off') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---- Setup ----
    const tier: DeviceTier = detectDeviceTier();
    const objCount = objectCountForTier(tier);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let w = window.innerWidth;
    let h = window.innerHeight;
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
      // Resize particle scene if active
      if (particleSceneRef.current) {
        resizeParticleScene(particleSceneRef.current, w, h);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // ---- Scene rebuild helper ----
    const rebuildScene = () => {
      const key = computeSceneKey();
      if (key === currentSceneKeyRef.current && (sceneRef.current.length > 0 || particleSceneRef.current)) return;
      currentSceneKeyRef.current = key;

      const mode = modeRef.current;
      const theme = themeRef.current;
      let type: SceneType;
      let subjectColor;

      if (mode === 'auto') {
        type = detectSceneType(subjectRef.current, chapterRef.current);
        subjectColor = getSubjectColorThemed(subjectRef.current, theme);
      } else if (mode === 'hybrid') {
        type = 'hybrid';
        const palette = getThemePalette(theme);
        subjectColor = palette.subjectColors.General ?? getSubjectColor('General');
      } else {
        type = mode as SceneType;
        const subjForMode =
          mode === 'atoms' ? 'Physics'
          : mode === 'molecules' ? 'Chemistry'
          : mode === 'cells' ? 'Botany'
          : mode === 'dna' ? 'Zoology'
          : 'General';
        subjectColor = getSubjectColorThemed(subjForMode, theme);
      }

      // === Particle scene (new 2D animations) ===
      // Only build if the type is a particle scene AND it's been implemented.
      // Unimplemented particle types fall back to their 3D equivalent.
      if (isParticleScene(type) && isParticleSceneImplemented(type)) {
        sceneRef.current = [];
        particleSceneRef.current = buildParticleScene(type, w, h);
        return;
      }
      if (isParticleScene(type) && !isParticleSceneImplemented(type)) {
        // Fallback to 3D equivalent
        type = particleFallback3D(type) as SceneType;
      }
      // === 3D scene (original atoms/DNA/molecules/cells/hybrid) ===
      particleSceneRef.current = null;

      sceneRef.current = buildScene({ type, objectCount: objCount, subjectColor });

      // For hybrid + non-dark theme: recolor each object based on its kind → theme palette
      if (type === 'hybrid' && theme !== 'dark') {
        const palette = getThemePalette(theme);
        const kindToSubject: Record<string, string> = {
          atom: 'Physics',
          dna: 'Zoology',
          molecule: 'Chemistry',
          cell: 'Botany',
        };
        for (const obj of sceneRef.current) {
          const subj = kindToSubject[obj.kind];
          const c = palette.subjectColors[subj] ?? getSubjectColor(subj);
          obj.color = c.hex;
          obj.rgb = c.rgb;
        }
      }
    };
    rebuildScene();

    // Check for scene/theme changes every 2s (was 500ms — reduced for battery)
    // Only runs when document is visible
    const sceneCheckInterval = setInterval(() => {
      if (!document.hidden) rebuildScene();
    }, 2000);

    // ---- Render loop ----
    const baseTime = Date.now();
    let lastFrameTime = baseTime;
    let frame = 0;
    let running = true;
    let rafId: number | null = null;
    let isScrolling = false;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    // Detect scrolling — pause 3D during scroll for smooth performance
    const handleScroll = () => {
      isScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      // Resume 200ms after scrolling stops
      scrollTimeout = setTimeout(() => { isScrolling = false; }, 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    const render = () => {
      if (!running) return;
      // PAUSE rendering when tab is hidden OR user is scrolling — saves GPU
      if (document.hidden || isScrolling) {
        rafId = requestAnimationFrame(render);
        return;
      }
      const now = Date.now();
      const time = (now - baseTime) / 1000;
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000); // cap dt at 100ms
      lastFrameTime = now;

      const themePalette = getThemePalette(themeRef.current);

      // === Particle scene rendering (new 2D animations) ===
      if (particleSceneRef.current) {
        renderParticleFrame(ctx, particleSceneRef.current, time, dt, themePalette.electronRgb);
      } else {
        // === 3D scene rendering (original atoms/DNA/molecules/cells) ===
        const boostColor = subjectRef.current
          ? getSubjectColorThemed(subjectRef.current, themeRef.current)
          : null;

        renderFrame({
          ctx,
          width: w,
          height: h,
          objects: sceneRef.current,
          time,
          dt,
          boostColor,
          themePalette,
        });
      }

      if (!prefersReducedMotion) {
        frame = requestAnimationFrame(render);
      }
    };
    render();

    // Pause when tab is hidden
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (frame) cancelAnimationFrame(frame);
      } else if (!prefersReducedMotion) {
        running = true;
        lastFrameTime = Date.now();
        render();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ---- Pointer interaction (tap / double-tap / hold for particle scenes) ----
    // Listens on document. If the tap target is NOT inside a card/button/nav
    // (i.e. it hit the background), forwards the tap to the particle scene.
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    const DOUBLE_TAP_MS = 350;
    const DOUBLE_TAP_DIST = 50;

    // Check if a pointer event hit the background (not a card/button/etc.)
    const isBackgroundTap = (target: HTMLElement | null): boolean => {
      if (!target) return false;
      return !target.closest('button, a, input, textarea, select, nav, [role="button"], .glass, .glass-strong, .card-solid, [data-interactive]');
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!particleSceneRef.current) return;
      if (!isBackgroundTap(e.target as HTMLElement | null)) return;

      // Set pointer active for magnetic field (continuous touch)
      updateParticlePointer(particleSceneRef.current, e.clientX, e.clientY, true);

      // Detect single vs double tap
      const now = Date.now();
      const dist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
      const isDoubleTap = (now - lastTapTime < DOUBLE_TAP_MS) && (dist < DOUBLE_TAP_DIST);

      handleParticlePointer(
        particleSceneRef.current,
        e.clientX, e.clientY,
        isDoubleTap,
        (Date.now() - baseTime) / 1000,
      );

      lastTapTime = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!particleSceneRef.current) return;
      // Only update if pointer was previously active (from pointerdown on background)
      if (particleSceneRef.current.pointerActive) {
        updateParticlePointer(particleSceneRef.current, e.clientX, e.clientY, true);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!particleSceneRef.current) return;
      updateParticlePointer(particleSceneRef.current, 0, 0, false);
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      clearInterval(sceneCheckInterval);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mounted]);

  if (!mounted) return null;
  if (bg3DMode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}
