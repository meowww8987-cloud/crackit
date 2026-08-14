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
const IMPLEMENTED: ParticleSceneType[] = ['shooting-stars', 'molecular-bonds', 'boiling-bubbles', 'electron-cloud', 'crystal-lattice'];

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
interface MoleculeAtom {
  x: number; y: number; vx: number; vy: number; radius: number;
}
interface Bubble {
  x: number; y: number; vx: number; vy: number; radius: number; wobblePhase: number; wobbleSpeed: number;
}
interface Pop {
  x: number; y: number; radius: number; maxRadius: number; life: number; maxLife: number;
}
interface ElectronAtom {
  x: number; y: number;
  electrons: { angle: number; radius: number; speed: number; size: number; phase: number }[];
  excited: number; // 0 = normal, 1 = fully excited
}
interface CrystalNode {
  x: number; y: number; targetX: number; targetY: number; settled: boolean;
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
  // Molecular Bonds
  moleculeAtoms?: MoleculeAtom[];
  moleculeFlash?: number;
  // Boiling Bubbles
  bubbles?: Bubble[];
  pops?: Pop[];
  // Electron Cloud
  electronAtoms?: ElectronAtom[];
  electronFlash?: number;
  // Crystal Lattice
  crystalNodes?: CrystalNode[];
  crystalFlash?: number;
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
  } else if (type === 'molecular-bonds') {
    initMolecularBonds(state);
  } else if (type === 'boiling-bubbles') {
    initBoilingBubbles(state);
  } else if (type === 'electron-cloud') {
    initElectronCloud(state);
  } else if (type === 'crystal-lattice') {
    initCrystalLattice(state);
  }

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
  } else if (state.type === 'molecular-bonds') {
    renderMolecularBonds(ctx, state, time, dt, electronRgb);
  } else if (state.type === 'boiling-bubbles') {
    renderBoilingBubbles(ctx, state, time, dt, electronRgb);
  } else if (state.type === 'electron-cloud') {
    renderElectronCloud(ctx, state, time, dt, electronRgb);
  } else if (state.type === 'crystal-lattice') {
    renderCrystalLattice(ctx, state, time, dt, electronRgb);
  }
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

// ===== Molecular Bonds renderer =====

function initMolecularBonds(state: ParticleState) {
  const count = 15 + Math.floor(Math.random() * 5);
  state.moleculeAtoms = Array.from({ length: count }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
    radius: 4 + Math.random() * 4,
  }));
  state.moleculeFlash = 0;
}

function renderMolecularBonds(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  const [er, eg, eb] = electronRgb;
  const { width, height } = state;
  const atoms = state.moleculeAtoms!;
  const BOND_DIST = 90;

  // Update atom positions
  for (const a of atoms) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    // Bounce off edges
    if (a.x < 0) { a.x = 0; a.vx = Math.abs(a.vx); }
    if (a.x > width) { a.x = width; a.vx = -Math.abs(a.vx); }
    if (a.y < 0) { a.y = 0; a.vy = Math.abs(a.vy); }
    if (a.y > height) { a.y = height; a.vy = -Math.abs(a.vy); }
    // Slight drag
    a.vx *= 0.998;
    a.vy *= 0.998;
  }

  // Draw bonds + apply gentle attraction (check all pairs)
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const dx = atoms[j].x - atoms[i].x;
      const dy = atoms[j].y - atoms[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist < BOND_DIST && dist > 0) {
        const bondStrength = 1 - dist / BOND_DIST;
        const opacity = bondStrength * 0.4;
        ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${opacity})`;
        ctx.lineWidth = 1 + bondStrength;
        ctx.beginPath();
        ctx.moveTo(atoms[i].x, atoms[i].y);
        ctx.lineTo(atoms[j].x, atoms[j].y);
        ctx.stroke();

        // Gentle attraction when bonded (stronger when closer)
        const force = 3 * bondStrength * dt;
        atoms[i].vx += (dx / dist) * force;
        atoms[i].vy += (dy / dist) * force;
        atoms[j].vx -= (dx / dist) * force;
        atoms[j].vy -= (dy / dist) * force;
      }
    }
  }

  // Draw atoms (glow + solid)
  for (const a of atoms) {
    // Glow
    const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.radius * 3);
    grad.addColorStop(0, `rgba(${er}, ${eg}, ${eb}, 0.35)`);
    grad.addColorStop(1, `rgba(${er}, ${eg}, ${eb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Solid atom
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, 0.7)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flash effect (from double-tap "reaction")
  if (state.moleculeFlash && state.moleculeFlash > 0) {
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${state.moleculeFlash * 0.12})`;
    ctx.fillRect(0, 0, width, height);
    state.moleculeFlash -= dt * 2;
    if (state.moleculeFlash < 0) state.moleculeFlash = 0;
  }
}

// ===== Boiling Bubbles renderer =====

function initBoilingBubbles(state: ParticleState) {
  const count = 18;
  state.bubbles = Array.from({ length: count }, () => spawnBubble(state.width, state.height));
  state.pops = [];
}

function spawnBubble(width: number, height: number, startX?: number, startY?: number): Bubble {
  return {
    x: startX ?? Math.random() * width,
    y: startY ?? height + 20,
    vx: (Math.random() - 0.5) * 10,
    vy: -(20 + Math.random() * 40), // upward
    radius: 4 + Math.random() * 12,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed: 1 + Math.random() * 2,
  };
}

function renderBoilingBubbles(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  const [er, eg, eb] = electronRgb;
  const { width, height } = state;
  const bubbles = state.bubbles!;
  const pops = state.pops!;

  // Update + draw bubbles
  const alive: Bubble[] = [];
  for (const b of bubbles) {
    b.x += b.vx * dt + Math.sin(time * b.wobbleSpeed + b.wobblePhase) * 0.5;
    b.y += b.vy * dt;

    // If bubble reaches top → pop + respawn at bottom
    if (b.y < -b.radius * 2) {
      pops.push({
        x: b.x, y: 0,
        radius: b.radius,
        maxRadius: b.radius * 2.5,
        life: 0, maxLife: 0.4,
      });
      // Respawn at bottom
      alive.push(spawnBubble(width, height));
      continue;
    }
    alive.push(b);

    // Draw bubble (transparent fill + thin border + highlight)
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, 0.06)`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, 0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Small highlight (top-left of bubble)
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, 0.15)`;
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  state.bubbles = alive;

  // Update + draw pops (expanding circles)
  const alivePops: Pop[] = [];
  for (const p of pops) {
    p.life += dt;
    if (p.life >= p.maxLife) continue;
    alivePops.push(p);

    const lifeFrac = p.life / p.maxLife;
    const r = p.radius + (p.maxRadius - p.radius) * lifeFrac;
    const opacity = (1 - lifeFrac) * 0.4;
    ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${opacity})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  state.pops = alivePops;
}

// ===== Electron Cloud renderer =====

function initElectronCloud(state: ParticleState) {
  const count = 3 + Math.floor(Math.random() * 2);
  state.electronAtoms = Array.from({ length: count }, () => createElectronAtom(state.width, state.height));
  state.electronFlash = 0;
}

function createElectronAtom(width: number, height: number, x?: number, y?: number): ElectronAtom {
  const electronCount = 10 + Math.floor(Math.random() * 6);
  return {
    x: x ?? (width * 0.2 + Math.random() * width * 0.6),
    y: y ?? (height * 0.2 + Math.random() * height * 0.6),
    electrons: Array.from({ length: electronCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 20 + Math.random() * 40,
      speed: (0.5 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : -1),
      size: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    })),
    excited: 0,
  };
}

function renderElectronCloud(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  const [er, eg, eb] = electronRgb;
  const { width, height } = state;
  const atoms = state.electronAtoms!;

  for (const atom of atoms) {
    // Decay excitement
    if (atom.excited > 0) {
      atom.excited -= dt * 0.5;
      if (atom.excited < 0) atom.excited = 0;
    }

    // Draw nucleus (glow + solid)
    const nucGlow = ctx.createRadialGradient(atom.x, atom.y, 0, atom.x, atom.y, 25);
    nucGlow.addColorStop(0, `rgba(${er}, ${eg}, ${eb}, 0.3)`);
    nucGlow.addColorStop(1, `rgba(${er}, ${eg}, ${eb}, 0)`);
    ctx.fillStyle = nucGlow;
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, 0.6)`;
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw electrons (orbiting dots with pulsing opacity)
    for (const e of atom.electrons) {
      e.angle += e.speed * dt;
      const exciteBoost = atom.excited * 30; // electrons fly outward when excited
      const r = e.radius + exciteBoost;
      const ex = atom.x + Math.cos(e.angle) * r;
      const ey = atom.y + Math.sin(e.angle) * r;
      const pulse = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2 + e.phase));
      ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${pulse})`;
      ctx.beginPath();
      ctx.arc(ex, ey, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flash from double-tap excitation
  if (state.electronFlash && state.electronFlash > 0) {
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${state.electronFlash * 0.1})`;
    ctx.fillRect(0, 0, width, height);
    state.electronFlash -= dt * 2;
    if (state.electronFlash < 0) state.electronFlash = 0;
  }
}

// ===== Crystal Lattice renderer =====

function initCrystalLattice(state: ParticleState) {
  const count = 20 + Math.floor(Math.random() * 8);
  state.crystalNodes = Array.from({ length: count }, () => createCrystalNode(state.width, state.height));
  state.crystalFlash = 0;
}

function createCrystalNode(width: number, height: number, x?: number, y?: number): CrystalNode {
  // Target = nearest grid point (60px grid)
  const sx = x ?? Math.random() * width;
  const sy = y ?? Math.random() * height;
  const gridX = Math.round(sx / 60) * 60 + 30;
  const gridY = Math.round(sy / 60) * 60 + 30;
  return {
    x: sx, y: sy,
    targetX: gridX, targetY: gridY,
    settled: false,
  };
}

function renderCrystalLattice(
  ctx: CanvasRenderingContext2D,
  state: ParticleState,
  time: number,
  dt: number,
  electronRgb: [number, number, number],
) {
  const [er, eg, eb] = electronRgb;
  const { width, height } = state;
  const nodes = state.crystalNodes!;
  const BOND_DIST = 75;

  // Move nodes toward target positions
  for (const n of nodes) {
    const dx = n.targetX - n.x;
    const dy = n.targetY - n.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      n.settled = true;
    } else {
      n.x += dx * 2 * dt;
      n.y += dy * 2 * dt;
    }
  }

  // Draw bonds between nearby settled nodes
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].settled) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      if (!nodes[j].settled) continue;
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist < BOND_DIST && dist > 0) {
        const opacity = (1 - dist / BOND_DIST) * 0.3;
        ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw nodes
  for (const n of nodes) {
    const pulse = n.settled ? 0.5 + 0.2 * Math.sin(time * 1.5 + n.targetX) : 0.3;
    // Glow
    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 12);
    grad.addColorStop(0, `rgba(${er}, ${eg}, ${eb}, ${pulse * 0.3})`);
    grad.addColorStop(1, `rgba(${er}, ${eg}, ${eb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
    ctx.fill();
    // Solid
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${pulse * 0.7})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flash from double-tap melt
  if (state.crystalFlash && state.crystalFlash > 0) {
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${state.crystalFlash * 0.1})`;
    ctx.fillRect(0, 0, width, height);
    state.crystalFlash -= dt * 2;
    if (state.crystalFlash < 0) state.crystalFlash = 0;
  }
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
  } else if (state.type === 'molecular-bonds') {
    if (isDoubleTap) {
      // Reaction: explode all atoms + flash
      for (const a of state.moleculeAtoms!) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 150;
        a.vx = Math.cos(angle) * speed;
        a.vy = Math.sin(angle) * speed;
      }
      state.moleculeFlash = 1.0;
    } else {
      // Spawn new atom at tap location
      state.moleculeAtoms!.push({
        x, y,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        radius: 4 + Math.random() * 4,
      });
      // Cap at 30 atoms (remove oldest)
      if (state.moleculeAtoms!.length > 30) {
        state.moleculeAtoms!.shift();
      }
    }
  } else if (state.type === 'boiling-bubbles') {
    if (isDoubleTap) {
      // Boil over: spawn 15 bubbles rapidly from bottom
      for (let i = 0; i < 15; i++) {
        state.bubbles!.push(spawnBubble(state.width, state.height));
      }
    } else {
      // Spawn cluster of 4 bubbles at tap location
      for (let i = 0; i < 4; i++) {
        state.bubbles!.push(spawnBubble(
          state.width, state.height,
          x + (Math.random() - 0.5) * 30,
          y + (Math.random() - 0.5) * 20,
        ));
      }
      // Pop at tap location
      state.pops!.push({
        x, y, radius: 8, maxRadius: 30, life: 0, maxLife: 0.4,
      });
    }
  } else if (state.type === 'electron-cloud') {
    if (isDoubleTap) {
      // Excite: all electrons fly outward
      for (const a of state.electronAtoms!) {
        a.excited = 1.0;
      }
      state.electronFlash = 1.0;
    } else {
      // Spawn new atom at tap
      state.electronAtoms!.push(createElectronAtom(state.width, state.height, x, y));
      if (state.electronAtoms!.length > 8) state.electronAtoms!.shift();
    }
  } else if (state.type === 'crystal-lattice') {
    if (isDoubleTap) {
      // Melt: scatter all nodes to random positions, then re-settle
      for (const n of state.crystalNodes!) {
        n.x = Math.random() * state.width;
        n.y = Math.random() * state.height;
        n.settled = false;
      }
      state.crystalFlash = 1.0;
    } else {
      // Add new node at tap (finds nearest grid point)
      state.crystalNodes!.push(createCrystalNode(state.width, state.height, x, y));
      if (state.crystalNodes!.length > 40) state.crystalNodes!.shift();
    }
  }
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
