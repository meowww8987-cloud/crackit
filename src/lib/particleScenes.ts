/**
 * Particle Scene System — 2D animated backgrounds for each NEET subject.
 *
 * Each subject gets a unique ambient animation with tap interaction:
 *  - Physics    → Shooting Stars (twinkling stars + occasional streaks)
 *  - Chemistry  → Molecular Bonds (atoms drift, bond when close, orbit, break)
 *  - Botany     → Falling Petals (petals drift down, sway, tap for wind gust)
 *  - Zoology    → DNA Helix Drift (slow vertical DNA strands, tap to brighten)
 *  - General    → Magnetic Field (particles follow finger on touch+hold)
 *
 * Unlike the 3D scene system, these are pure 2D canvas animations — no
 * perspective projection, no z-sorting. Just particles moving on a flat plane.
 *
 * Interaction is via pointer events (tap, double-tap, drag) that the Scene3D
 * component forwards to handleParticlePointer().
 */

export type ParticleSceneType =
  | 'shooting-stars'
  | 'molecular-bonds'
  | 'boiling-bubbles'
  | 'electron-cloud'
  | 'crystal-lattice'
  | 'falling-petals'
  | 'dna-drift'
  | 'magnetic-field';

export const PARTICLE_SCENE_TYPES: ParticleSceneType[] = [
  'shooting-stars', 'molecular-bonds', 'boiling-bubbles', 'electron-cloud',
  'crystal-lattice', 'falling-petals', 'dna-drift', 'magnetic-field',
];

export function isParticleScene(type: string): boolean {
  return PARTICLE_SCENE_TYPES.includes(type as ParticleSceneType);
}

// Only types that have been fully implemented (build + render + interaction).
// Others fall back to their 3D equivalent in Scene3D.tsx.
const IMPLEMENTED: ParticleSceneType[] = ['shooting-stars'];

export function isParticleSceneImplemented(type: string): boolean {
  return IMPLEMENTED.includes(type as ParticleSceneType);
}

/** Map unimplemented particle types to their 3D fallback equivalents. */
export function particleFallback3D(type: string): string {
  const map: Record<string, string> = {
    'shooting-stars': 'atoms',
    'molecular-bonds': 'molecules',
    'falling-petals': 'cells',
    'dna-drift': 'dna',
    'magnetic-field': 'hybrid',
  };
  return map[type] || 'hybrid';
}

// ===== Shared types =====

interface Star {
  x: number; y: number; size: number; phase: number; duration: number;
}
interface ShootingStar {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
}

export interface ParticleState {
  type: ParticleSceneType;
  width: number;
  height: number;
  // Shooting Stars
  stars?: Star[];
  shootingStars?: ShootingStar[];
  nextSpawnAt?: number;
  lastTapTime?: number;
  // Pointer state (for magnetic field etc.)
  pointerX?: number;
  pointerY?: number;
  pointerActive?: boolean;
}

// ===== Builder =====

export function buildParticleScene(
  type: ParticleSceneType,
  width: number,
  height: number,
): ParticleState {
  const state: ParticleState = { type, width, height };

  if (type === 'shooting-stars') {
    initShootingStars(state);
  }
  // Other types will be added as we implement them

  return state;
}

function initShootingStars(state: ParticleState) {
  const count = 60 + Math.floor(Math.random() * 20);
  state.stars = Array.from({ length: count }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height * 0.75,
    size: 0.5 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
    duration: 2 + Math.random() * 3,
  }));
  state.shootingStars = [];
  state.nextSpawnAt = 5 + Math.random() * 10;
  state.lastTapTime = 0;
}

// ===== Renderer =====

export function renderParticleFrame(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  ctx.clearRect(0, 0, state.width, state.height);

  if (state.type === 'shooting-stars') {
    renderShootingStars(ctx, state, time, dt, electronRgb);
  }
  // Other types will be added as we implement them
}

// ===== Shooting Stars renderer =====

function renderShootingStars(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  const [er, eg, eb] = electronRgb;
  const { width, height } = state;

  // Draw twinkling stars
  for (const star of state.stars!) {
    const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time / star.duration + star.phase));
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${twinkle * 0.7})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Auto-spawn shooting stars every 30-60s
  if (time >= (state.nextSpawnAt || 0)) {
    spawnShootingStar(state, Math.random() * width * 0.6, Math.random() * height * 0.3);
    state.nextSpawnAt = time + 30 + Math.random() * 30;
  }

  // Update + draw shooting stars
  const alive: ShootingStar[] = [];
  for (const ss of state.shootingStars!) {
    ss.x += ss.vx * dt;
    ss.y += ss.vy * dt;
    ss.life += dt;

    // Remove if dead or off-screen
    if (ss.life >= ss.maxLife) continue;
    if (ss.x < -100 || ss.x > width + 100 || ss.y > height + 100) continue;
    alive.push(ss);

    // Draw trail (gradient line from current position backward)
    const lifeFrac = 1 - ss.life / ss.maxLife;
    const trailX = ss.x - ss.vx * 0.08;
    const trailY = ss.y - ss.vy * 0.08;
    const grad = ctx.createLinearGradient(ss.x, ss.y, trailX, trailY);
    grad.addColorStop(0, `rgba(${er}, ${eg}, ${eb}, ${lifeFrac})`);
    grad.addColorStop(1, `rgba(${er}, ${eg}, ${eb}, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(trailX, trailY);
    ctx.stroke();

    // Bright head
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${lifeFrac})`;
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  state.shootingStars = alive;
}

function spawnShootingStar(state: ParticleState, x: number, y: number, angle?: number) {
  const a = angle ?? (Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 3);
  const speed = 300 + Math.random() * 200;
  state.shootingStars!.push({
    x, y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    life: 0,
    maxLife: 1.5,
  });
}

// ===== Pointer interaction =====

export function handleParticlePointer(
  state: ParticleState,
  x: number,
  y: number,
  isDoubleTap: boolean,
  time: number,
) {
  if (state.type === 'shooting-stars') {
    if (isDoubleTap) {
      // 3 shooting stars in fan pattern (spread ±30°)
      for (let i = -1; i <= 1; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 6;
        spawnShootingStar(state, x, y, angle);
      }
    } else {
      // Single shooting star, random direction
      spawnShootingStar(state, x, y);
    }
  }
  // Other types will be added as we implement them
}

// ===== Resize handler =====

export function resizeParticleScene(state: ParticleState, width: number, height: number) {
  state.width = width;
  state.height = height;
  // For shooting stars, regenerate star positions for new dimensions
  if (state.type === 'shooting-stars' && state.stars) {
    state.stars = state.stars.map(s => ({
      ...s,
      x: s.x / state.width * width,
      y: s.y / state.height * height,
    }));
  }
}
