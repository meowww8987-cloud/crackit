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
    };
    resize();
    window.addEventListener('resize', resize);

    // ---- Scene rebuild helper ----
    const rebuildScene = () => {
      const key = computeSceneKey();
      if (key === currentSceneKeyRef.current && sceneRef.current.length > 0) return;
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
        // For hybrid, use theme palette to color each subject type
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

      // For hybrid mode, we need to pass theme-aware colors for each subject.
      // buildScene uses SUBJECT_COLORS internally for hybrid — so we override
      // the spawn colors by post-processing if theme !== 'dark'.
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

    // Check for scene/theme changes every 500ms (cheap, doesn't block rAF)
    const sceneCheckInterval = setInterval(rebuildScene, 500);

    // ---- Render loop ----
    const baseTime = Date.now();
    let lastFrameTime = baseTime;
    let frame = 0;
    let running = true;

    const render = () => {
      if (!running) return;
      const now = Date.now();
      const time = (now - baseTime) / 1000;
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000); // cap dt at 100ms
      lastFrameTime = now;

      // Subject color for boost (theme-aware so boost matches the recolored scene)
      const boostColor = subjectRef.current
        ? getSubjectColorThemed(subjectRef.current, themeRef.current)
        : null;

      const themePalette = getThemePalette(themeRef.current);

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

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(sceneCheckInterval);
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
