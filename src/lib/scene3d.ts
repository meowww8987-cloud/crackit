/**
 * NEET 3D Background Scenes — pure Canvas 2D + manual 3D projection.
 *
 * No Three.js dependency. All 3D shapes are built from points in 3D space,
 * projected to 2D each frame, and drawn back-to-front (painter's algorithm).
 *
 * Scenes are subject-aware:
 *  - Physics        → atoms (Bohr model with orbiting electrons)
 *  - Chemistry      → molecules (organic vs physical based on chapter name)
 *  - Botany         → plant cells (ellipsoids with chloroplasts)
 *  - Zoology        → DNA helix
 *  - General/no session → hybrid mix
 *
 * Each scene uses NEET subject colors:
 *  Physics=teal #14b8a6, Chem=green #22c55e, Botany=emerald #10b981, Zoology=red #ef4444
 */

// ===== 3D Math =====

export interface Vec3 { x: number; y: number; z: number; }

export function vec3(x: number, y: number, z: number): Vec3 { return { x, y, z }; }

/** Rotate a point around the Y axis (yaw). */
function rotateY(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

/** Rotate a point around the X axis (pitch). */
function rotateX(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

/** Rotate around Z (roll) — used for tilted orbital planes. */
function rotateZ(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/**
 * Project a 3D point to 2D screen coordinates using weak perspective.
 * `focal` is the camera's focal length (higher = less perspective distortion).
 * Points farther from camera (higher z) appear smaller and closer to vanishing point.
 * Returns the original z so callers can sort by depth if needed.
 */
function project(p: Vec3, focal: number, cx: number, cy: number): { x: number; y: number; scale: number; z: number } {
  const depth = focal + p.z;
  if (depth <= 1) return { x: cx, y: cy, scale: 0, z: p.z }; // behind camera
  const scale = focal / depth;
  return { x: cx + p.x * scale, y: cy + p.y * scale, scale, z: p.z };
}

// ===== Scene types =====

export type SceneType = 'atoms' | 'dna' | 'molecules' | 'cells' | 'hybrid'
  | 'shooting-stars' | 'molecular-bonds' | 'boiling-bubbles' | 'electron-cloud' | 'crystal-lattice'
  | 'falling-petals' | 'dna-drift' | 'magnetic-field';

export interface SceneObject {
  /** Center position in world space. */
  position: Vec3;
  /** Per-object rotation (yaw, pitch, roll) in radians. */
  rotation: Vec3;
  /** Rotation velocity (rad/sec) for each axis. */
  rotVel: Vec3;
  /** Drift velocity in world units/sec. */
  drift: Vec3;
  /** Subject color (hex like #14b8a6) — used for fill + glow. */
  color: string;
  /** Subject color RGB triple for alpha mixing. */
  rgb: [number, number, number];
  /** Opacity multiplier 0-1. */
  opacity: number;
  /** Type-specific geometry payload. */
  geom: AtomGeom | DnaGeom | MoleculeGeom | CellGeom;
  kind: 'atom' | 'dna' | 'molecule' | 'cell';
}

interface AtomGeom {
  nucleusRadius: number;
  orbits: { radius: number; tilt: Vec3; electronPhase: number; electronSpeed: number; electronRadius: number }[];
}

interface DnaGeom {
  height: number;
  radius: number;
  turns: number;
  steps: number;
}

interface MoleculeGeom {
  atoms: { pos: Vec3; radius: number; color: string; rgb: [number, number, number] }[];
  bonds: [number, number][];
}

interface CellGeom {
  radius: number;
  organelles: { pos: Vec3; radius: number; color: string }[];
}

// ===== Scene factories =====

const SUBJECT_COLORS: Record<string, { hex: string; rgb: [number, number, number] }> = {
  Physics:   { hex: '#3b82f6', rgb: [59, 130, 246] },   // blue
  Chemistry: { hex: '#a855f7', rgb: [168, 85, 247] },   // purple
  Botany:    { hex: '#22c55e', rgb: [34, 197, 94] },    // green
  Zoology:   { hex: '#f43f5e', rgb: [244, 63, 94] },    // rose
  General:   { hex: '#64748b', rgb: [100, 116, 139] },  // slate
};

// ===== Theme-aware 3D palettes =====
// Each theme defines its own canvas background, electron dot color, and
// per-subject color overrides so the 3D scene looks native to each theme.
//
// Design goals:
//  - Dark themes (dark/ocean/forest/gold): vivid subject colors on dark bg
//  - Light theme: softened subject colors on pure white bg + DARK electrons (white dots invisible on white!)
//  - Warm theme: warm amber/sepia palette on cream bg
//  - Rose theme: ALL shades of pink palette (distinct from light mode) on pink-tinted bg

export type Theme3DName = 'dark' | 'light' | 'warm' | 'ocean' | 'forest' | 'rose' | 'gold' | 'sage';

export interface Theme3DPalette {
  /** Canvas fill (used as the base layer below the 3D objects). */
  background: string;
  /** RGB for electron dots / highlight points (white on dark themes, dark on light themes). */
  electronRgb: [number, number, number];
  /** Subject color overrides — if a subject isn't here, fall back to SUBJECT_COLORS. */
  subjectColors: Record<string, { hex: string; rgb: [number, number, number] }>;
  /** Multiplier applied to all object opacities (lower for light themes). */
  opacityMul: number;
}

const THEME_PALETTES: Record<Theme3DName, Theme3DPalette> = {
  dark: {
    background: '#0a0b10',
    electronRgb: [255, 255, 255],
    subjectColors: SUBJECT_COLORS,
    opacityMul: 1.0,
  },
  ocean: {
    background: '#0c1929',
    electronRgb: [186, 230, 253],
    subjectColors: {
      Physics:   { hex: '#38bdf8', rgb: [56, 189, 248] },   // sky blue
      Chemistry: { hex: '#06b6d4', rgb: [6, 182, 212] },    // cyan
      Botany:    { hex: '#14b8a6', rgb: [20, 184, 166] },   // teal
      Zoology:   { hex: '#0ea5e9', rgb: [14, 165, 233] },   // ocean blue
      General:   { hex: '#67e8f9', rgb: [103, 232, 249] },  // light cyan
    },
    opacityMul: 1.0,
  },
  forest: {
    background: '#0a1410',
    electronRgb: [220, 252, 220],
    subjectColors: {
      Physics:   { hex: '#84cc16', rgb: [132, 204, 22] },   // lime
      Chemistry: { hex: '#22c55e', rgb: [34, 197, 94] },    // green
      Botany:    { hex: '#16a34a', rgb: [22, 163, 74] },    // forest green
      Zoology:   { hex: '#65a30d', rgb: [101, 163, 13] },   // olive
      General:   { hex: '#4ade80', rgb: [74, 222, 128] },   // light green
    },
    opacityMul: 1.0,
  },
  gold: {
    background: '#0a0805',
    electronRgb: [253, 224, 71],
    subjectColors: {
      Physics:   { hex: '#fbbf24', rgb: [251, 191, 36] },   // amber
      Chemistry: { hex: '#f59e0b', rgb: [245, 158, 11] },   // dark amber
      Botany:    { hex: '#facc15', rgb: [250, 204, 21] },   // yellow
      Zoology:   { hex: '#eab308', rgb: [234, 179, 8] },    // gold
      General:   { hex: '#fde68a', rgb: [253, 230, 138] },  // light gold
    },
    opacityMul: 1.0,
  },
  light: {
    background: '#ffffff',
    electronRgb: [55, 65, 81],  // dark slate (white dots invisible on white)
    subjectColors: {
      Physics:   { hex: '#5b8dbf', rgb: [91, 141, 191] },   // soft blue
      Chemistry: { hex: '#8b6bb1', rgb: [139, 107, 177] },  // soft purple
      Botany:    { hex: '#5ba86b', rgb: [91, 168, 107] },   // soft green
      Zoology:   { hex: '#c26666', rgb: [194, 102, 102] },  // soft red
      General:   { hex: '#7a8a99', rgb: [122, 138, 153] },  // soft slate
    },
    opacityMul: 0.75,  // softer on white
  },
  warm: {
    background: '#faf3e8',
    electronRgb: [90, 60, 30],
    subjectColors: {
      Physics:   { hex: '#6b85a8', rgb: [107, 133, 168] },  // dusty blue
      Chemistry: { hex: '#9b7ba1', rgb: [155, 123, 161] },  // warm plum
      Botany:    { hex: '#7ba87b', rgb: [123, 168, 123] },  // sage
      Zoology:   { hex: '#c26b5f', rgb: [194, 107, 95] },   // terracotta
      General:   { hex: '#9c8b7a', rgb: [156, 139, 122] },  // warm taupe
    },
    opacityMul: 0.75,
  },
  rose: {
    background: '#FFD6E8',  // Pink Lace — clearly pink, NOT white-ish
    electronRgb: [139, 47, 76],  // Dark Rose — matches primary text (rosy pink, not berry)
    // 5 shades of pink — cohesive monochrome palette
    subjectColors: {
      Physics:   { hex: '#D4738A', rgb: [212, 115, 138] },   // Rose Pink
      Chemistry: { hex: '#9F6B8E', rgb: [159, 107, 142] },   // Mauve
      Botany:    { hex: '#F08C8C', rgb: [240, 140, 140] },   // Salmon Pink
      Zoology:   { hex: '#B22E5C', rgb: [178, 46, 92] },     // Raspberry Rose
      General:   { hex: '#D4A5A5', rgb: [212, 165, 165] },   // Blush
    },
    opacityMul: 1.0,  // full strength — pinks visible against pink bg
  },
  sage: {
    background: '#E8EBE4',  // Warm Mist — soft warm off-white with green undertone
    electronRgb: [45, 58, 46],  // Deep Forest — matches primary text
    // Muted, desaturated earth tones — eye-comfort palette
    subjectColors: {
      Physics:   { hex: '#6B8CAE', rgb: [107, 140, 174] },   // Soft Slate
      Chemistry: { hex: '#9B8BA8', rgb: [155, 139, 168] },   // Dusty Lilac
      Botany:    { hex: '#7A9B76', rgb: [122, 155, 118] },   // Sage Green
      Zoology:   { hex: '#C2856B', rgb: [194, 133, 107] },   // Warm Clay
      General:   { hex: '#8A9583', rgb: [138, 149, 131] },   // Stone Gray
    },
    opacityMul: 0.85,  // slightly softer for eye comfort
  },
};

/** Get the 3D palette for the current app theme. */
export function getThemePalette(theme: string): Theme3DPalette {
  return THEME_PALETTES[theme as Theme3DName] ?? THEME_PALETTES.dark;
}

/** Get the theme-aware subject color (falls back to default SUBJECT_COLORS). */
export function getSubjectColorThemed(subject: string | null, theme: string) {
  if (!subject) return getThemePalette(theme).subjectColors.General ?? SUBJECT_COLORS.General;
  const palette = getThemePalette(theme);
  return palette.subjectColors[subject] ?? SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.General;
}

function rand(min: number, max: number): number { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** Create a single atom (Bohr model) — nucleus + 2-3 orbital rings with electrons. */
function makeAtom(color: string, rgb: [number, number, number]): AtomGeom {
  const orbitCount = 2 + Math.floor(Math.random() * 2); // 2-3 orbits
  const orbits = Array.from({ length: orbitCount }, (_, i) => ({
    radius: 18 + i * 14,
    tilt: { x: rand(-1.2, 1.2), y: rand(-1.2, 1.2), z: rand(-1.2, 1.2) },
    electronPhase: rand(0, Math.PI * 2),
    electronSpeed: rand(1.5, 3.5) * (Math.random() < 0.5 ? 1 : -1),
    electronRadius: 3,
  }));
  return { nucleusRadius: 8, orbits };
}

/** Create an organic molecule — benzene ring (6 carbons) or methane or ethanol. */
function makeOrganicMolecule(): MoleculeGeom {
  const variants: (() => MoleculeGeom)[] = [
    // Benzene ring — 6 carbons in hexagon + 3 double-bond H
    () => {
      const atoms: MoleculeGeom['atoms'] = [];
      const r = 16;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        atoms.push({ pos: vec3(Math.cos(a) * r, Math.sin(a) * r, 0), radius: 6, color: '#374151', rgb: [55, 65, 81] });
      }
      const bonds: [number, number][] = [];
      for (let i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6]);
      return { atoms, bonds };
    },
    // Methane CH4 — central C + 4 H tetrahedral
    () => {
      const atoms: MoleculeGeom['atoms'] = [
        { pos: vec3(0, 0, 0), radius: 7, color: '#374151', rgb: [55, 65, 81] },
        { pos: vec3(12, 12, 12), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
        { pos: vec3(-12, -12, 12), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
        { pos: vec3(-12, 12, -12), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
        { pos: vec3(12, -12, -12), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
      ];
      const bonds: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4]];
      return { atoms, bonds };
    },
    // Water H2O — bent
    () => {
      const atoms: MoleculeGeom['atoms'] = [
        { pos: vec3(0, 0, 0), radius: 7, color: '#ef4444', rgb: [239, 68, 68] },
        { pos: vec3(-12, 8, 0), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
        { pos: vec3(12, 8, 0), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
      ];
      const bonds: [number, number][] = [[0, 1], [0, 2]];
      return { atoms, bonds };
    },
    // Glucose ring (simplified hexagon)
    () => {
      const atoms: MoleculeGeom['atoms'] = [];
      const r = 14;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const isO = i === 0;
        atoms.push({
          pos: vec3(Math.cos(a) * r, Math.sin(a) * r, 0),
          radius: 5,
          color: isO ? '#ef4444' : '#374151',
          rgb: isO ? [239, 68, 68] : [55, 65, 81],
        });
      }
      const bonds: [number, number][] = [];
      for (let i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6]);
      return { atoms, bonds };
    },
  ];
  return pick(variants)();
}

/** Create a physical-chemistry molecule — diatomic or simple ionic. */
function makePhysicalMolecule(): MoleculeGeom {
  const variants: (() => MoleculeGeom)[] = [
    // H2 — diatomic
    () => ({
      atoms: [
        { pos: vec3(-6, 0, 0), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
        { pos: vec3(6, 0, 0), radius: 4, color: '#e5e7eb', rgb: [229, 231, 235] },
      ],
      bonds: [[0, 1]] as [number, number][],
    }),
    // O2 — diatomic
    () => ({
      atoms: [
        { pos: vec3(-7, 0, 0), radius: 6, color: '#ef4444', rgb: [239, 68, 68] },
        { pos: vec3(7, 0, 0), radius: 6, color: '#ef4444', rgb: [239, 68, 68] },
      ],
      bonds: [[0, 1]] as [number, number][],
    }),
    // NaCl — ionic
    () => ({
      atoms: [
        { pos: vec3(-8, 0, 0), radius: 7, color: '#a855f7', rgb: [168, 85, 247] }, // Na
        { pos: vec3(8, 0, 0), radius: 7, color: '#22c55e', rgb: [34, 197, 94] },   // Cl
      ],
      bonds: [] as [number, number][],
    }),
    // CO2 — linear triatomic
    () => ({
      atoms: [
        { pos: vec3(-12, 0, 0), radius: 5, color: '#374151', rgb: [55, 65, 81] },
        { pos: vec3(0, 0, 0), radius: 6, color: '#ef4444', rgb: [239, 68, 68] },
        { pos: vec3(12, 0, 0), radius: 5, color: '#374151', rgb: [55, 65, 81] },
      ],
      bonds: [[0, 1], [1, 2]] as [number, number][],
    }),
  ];
  return pick(variants)();
}

/** Create a plant cell — ellipsoid body + chloroplasts + nucleus. */
function makeCell(): CellGeom {
  const organelleColors = ['#15803d', '#166534', '#22c55e'];
  const organelles = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
    pos: vec3(rand(-12, 12), rand(-12, 12), rand(-4, 4)),
    radius: rand(2, 4),
    color: pick(organelleColors),
  }));
  // Nucleus — central, larger, darker
  organelles.push({ pos: vec3(0, 0, 0), radius: 5, color: '#86efac' });
  return { radius: 20, organelles };
}

// ===== Scene builder =====

export interface Scene3DOptions {
  type: SceneType;
  /** Number of objects to spawn — scales with device tier. */
  objectCount: number;
  /** Subject color override (used when type is fixed by user). */
  subjectColor?: { hex: string; rgb: [number, number, number] };
}

/**
 * Build a fresh scene with the requested object count.
 * Called once on mount + whenever the scene type changes.
 */
export function buildScene(opts: Scene3DOptions): SceneObject[] {
  const { type, objectCount, subjectColor } = opts;
  const objects: SceneObject[] = [];
  const color = subjectColor ?? SUBJECT_COLORS.General;

  const spawn = (kind: SceneObject['kind'], color: { hex: string; rgb: [number, number, number] }, opacity: number) => {
    const obj: SceneObject = {
      position: vec3(rand(-250, 250), rand(-400, 400), rand(-200, 100)),
      rotation: vec3(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2)),
      rotVel: vec3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.15, 0.15)),
      drift: vec3(rand(-8, 8), rand(-12, 4), rand(-4, 4)),
      color: color.hex,
      rgb: color.rgb,
      opacity,
      kind,
      geom: {} as any, // filled per-kind below
    };
    if (kind === 'atom') obj.geom = makeAtom(color.hex, color.rgb);
    else if (kind === 'dna') obj.geom = { height: 120, radius: 18, turns: 2, steps: 24 } as DnaGeom;
    else if (kind === 'molecule') obj.geom = makeOrganicMolecule();
    else if (kind === 'cell') obj.geom = makeCell();
    objects.push(obj);
  };

  if (type === 'atoms') {
    for (let i = 0; i < objectCount; i++) spawn('atom', color, 0.22);
  } else if (type === 'dna') {
    for (let i = 0; i < Math.max(2, Math.floor(objectCount / 4)); i++) spawn('dna', color, 0.20);
  } else if (type === 'molecules') {
    for (let i = 0; i < objectCount; i++) spawn('molecule', color, 0.22);
  } else if (type === 'cells') {
    for (let i = 0; i < objectCount; i++) spawn('cell', color, 0.20);
  } else if (type === 'hybrid') {
    // Mix: 30% atoms, 20% DNA, 25% molecules, 25% cells
    const atomsN = Math.floor(objectCount * 0.30);
    const dnaN = Math.max(2, Math.floor(objectCount * 0.20));
    const molN = Math.floor(objectCount * 0.25);
    const cellN = objectCount - atomsN - dnaN - molN;
    for (let i = 0; i < atomsN; i++) spawn('atom', SUBJECT_COLORS.Physics, 0.18);
    for (let i = 0; i < dnaN; i++) spawn('dna', SUBJECT_COLORS.Zoology, 0.16);
    for (let i = 0; i < molN; i++) spawn('molecule', SUBJECT_COLORS.Chemistry, 0.18);
    for (let i = 0; i < cellN; i++) spawn('cell', SUBJECT_COLORS.Botany, 0.18);
  }

  return objects;
}

// ===== Renderer =====

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  objects: SceneObject[];
  time: number;       // seconds since start
  dt: number;         // seconds since last frame
  boostColor?: { hex: string; rgb: [number, number, number] } | null;
  /** Theme palette — when provided, electron dots + opacity adapt to theme. */
  themePalette?: Theme3DPalette | null;
}

/**
 * Render one frame. Mutates `objects` in place (applies rotation + drift).
 * Uses painter's algorithm: sort by z, draw back-to-front.
 */
export function renderFrame(opts: RenderOptions): void {
  const { ctx, width, height, objects, time, dt, boostColor, themePalette } = opts;
  const cx = width / 2;
  const cy = height / 2;
  const focal = 500;

  // Clear with transparent (canvas overlays the aurora below)
  ctx.clearRect(0, 0, width, height);

  // Electron color — white on dark themes, dark on light themes (theme-aware)
  const electronRgb = themePalette?.electronRgb ?? [255, 255, 255];
  // Opacity multiplier — softer on light themes
  const themeOpacityMul = themePalette?.opacityMul ?? 1;

  // Update transforms
  for (const obj of objects) {
    obj.rotation.x += obj.rotVel.x * dt;
    obj.rotation.y += obj.rotVel.y * dt;
    obj.rotation.z += obj.rotVel.z * dt;
    obj.position.x += obj.drift.x * dt;
    obj.position.y += obj.drift.y * dt;
    obj.position.z += obj.drift.z * dt;

    // Wrap around screen bounds (with margin)
    const margin = 300;
    if (obj.position.x > width / 2 + margin) obj.position.x = -width / 2 - margin;
    if (obj.position.x < -width / 2 - margin) obj.position.x = width / 2 + margin;
    if (obj.position.y > height / 2 + margin) obj.position.y = -height / 2 - margin;
    if (obj.position.y < -height / 2 - margin) obj.position.y = height / 2 + margin;
    if (obj.position.z > 100) obj.position.z = -200;
    if (obj.position.z < -200) obj.position.z = 100;
  }

  // Build draw list with per-object z for sorting
  interface DrawItem { obj: SceneObject; z: number; }
  const drawList: DrawItem[] = objects.map((obj) => ({ obj, z: obj.position.z }));
  drawList.sort((a, b) => b.z - a.z); // far first

  // Draw each object
  for (const { obj } of drawList) {
    const isBoosted = boostColor && boostColor.hex === obj.color;
    const opacityMul = (isBoosted ? 2.0 : 1) * themeOpacityMul;
    const baseOpacity = obj.opacity * opacityMul;

    if (obj.kind === 'atom') drawAtom(ctx, obj, focal, cx, cy, time, baseOpacity, electronRgb);
    else if (obj.kind === 'dna') drawDna(ctx, obj, focal, cx, cy, time, baseOpacity, electronRgb);
    else if (obj.kind === 'molecule') drawMolecule(ctx, obj, focal, cx, cy, time, baseOpacity, electronRgb);
    else if (obj.kind === 'cell') drawCell(ctx, obj, focal, cx, cy, time, baseOpacity, electronRgb);
  }
}

// ----- Per-shape renderers -----

function drawAtom(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  focal: number, cx: number, cy: number, time: number, baseOpacity: number,
  electronRgb: [number, number, number] = [255, 255, 255],
): void {
  const g = obj.geom as AtomGeom;
  const [r, gn, b] = obj.rgb;
  const [er, eg, eb] = electronRgb;

  // Draw orbits first (back layer)
  for (const orbit of g.orbits) {
    const points: { x: number; y: number; scale: number }[] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      let p = vec3(Math.cos(a) * orbit.radius, Math.sin(a) * orbit.radius, 0);
      p = rotateX(p, orbit.tilt.x);
      p = rotateY(p, orbit.tilt.y);
      p = rotateZ(p, orbit.tilt.z);
      p = rotateX(p, obj.rotation.x);
      p = rotateY(p, obj.rotation.y);
      p = rotateZ(p, obj.rotation.z);
      const world = { x: p.x + obj.position.x, y: p.y + obj.position.y, z: p.z + obj.position.z };
      points.push(project(world, focal, cx, cy));
    }
    ctx.strokeStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Electron on this orbit
    const ea = orbit.electronPhase + time * orbit.electronSpeed;
    let ep = vec3(Math.cos(ea) * orbit.radius, Math.sin(ea) * orbit.radius, 0);
    ep = rotateX(ep, orbit.tilt.x);
    ep = rotateY(ep, orbit.tilt.y);
    ep = rotateZ(ep, orbit.tilt.z);
    ep = rotateX(ep, obj.rotation.x);
    ep = rotateY(ep, obj.rotation.y);
    ep = rotateZ(ep, obj.rotation.z);
    const ew = { x: ep.x + obj.position.x, y: ep.y + obj.position.y, z: ep.z + obj.position.z };
    const ep2 = project(ew, focal, cx, cy);
    const eRadius = Math.max(0.5, orbit.electronRadius * ep2.scale);
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${baseOpacity * 0.9})`;
    ctx.beginPath();
    ctx.arc(ep2.x, ep2.y, eRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nucleus (front)
  const nucWorld = obj.position;
  const nuc = project(nucWorld, focal, cx, cy);
  const nucRadius = Math.max(1, g.nucleusRadius * nuc.scale);
  // Glow
  const grad = ctx.createRadialGradient(nuc.x, nuc.y, 0, nuc.x, nuc.y, nucRadius * 3);
  grad.addColorStop(0, `rgba(${r}, ${gn}, ${b}, ${baseOpacity})`);
  grad.addColorStop(0.5, `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.3})`);
  grad.addColorStop(1, `rgba(${r}, ${gn}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(nuc.x, nuc.y, nucRadius * 3, 0, Math.PI * 2);
  ctx.fill();
  // Solid center
  ctx.fillStyle = `rgba(${r}, ${gn}, ${b}, ${Math.min(1, baseOpacity * 1.5)})`;
  ctx.beginPath();
  ctx.arc(nuc.x, nuc.y, nucRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawDna(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  focal: number, cx: number, cy: number, time: number, baseOpacity: number,
  electronRgb: [number, number, number] = [255, 255, 255],
): void {
  const g = obj.geom as DnaGeom;
  const [r, gn, b] = obj.rgb;
  const [er, eg, eb] = electronRgb;
  const strand2Offset = Math.PI; // second strand is 180° out of phase

  // Generate points on both strands
  const steps = g.steps;
  const strand1: { x: number; y: number; scale: number }[] = [];
  const strand2: { x: number; y: number; scale: number }[] = [];
  const rungs: [{ x: number; y: number; scale: number }, { x: number; y: number; scale: number }][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const yLocal = (t - 0.5) * g.height;
    const angle = t * g.turns * Math.PI * 2 + obj.rotation.y;

    let p1 = vec3(Math.cos(angle) * g.radius, yLocal, Math.sin(angle) * g.radius);
    let p2 = vec3(Math.cos(angle + strand2Offset) * g.radius, yLocal, Math.sin(angle + strand2Offset) * g.radius);

    // Apply object rotation
    p1 = rotateX(p1, obj.rotation.x); p1 = rotateZ(p1, obj.rotation.z);
    p2 = rotateX(p2, obj.rotation.x); p2 = rotateZ(p2, obj.rotation.z);

    const w1 = { x: p1.x + obj.position.x, y: p1.y + obj.position.y, z: p1.z + obj.position.z };
    const w2 = { x: p2.x + obj.position.x, y: p2.y + obj.position.y, z: p2.z + obj.position.z };
    const s1 = project(w1, focal, cx, cy);
    const s2 = project(w2, focal, cx, cy);
    strand1.push(s1);
    strand2.push(s2);
    if (i % 2 === 0) rungs.push([s1, s2]);
  }

  // Draw rungs first (back)
  ctx.lineWidth = 1.5;
  for (const [a, b2] of rungs) {
    ctx.strokeStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();
  }

  // Draw strands
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity})`;
  ctx.beginPath();
  for (let i = 0; i < strand1.length; i++) {
    if (i === 0) ctx.moveTo(strand1[i].x, strand1[i].y);
    else ctx.lineTo(strand1[i].x, strand1[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.8})`;
  ctx.beginPath();
  for (let i = 0; i < strand2.length; i++) {
    if (i === 0) ctx.moveTo(strand2[i].x, strand2[i].y);
    else ctx.lineTo(strand2[i].x, strand2[i].y);
  }
  ctx.stroke();

  // Draw nucleotide dots at each strand point
  for (let i = 0; i < strand1.length; i++) {
    const s1 = strand1[i];
    const s2 = strand2[i];
    const dotR = Math.max(0.5, 2 * s1.scale);
    ctx.fillStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 1.2})`;
    ctx.beginPath();
    ctx.arc(s1.x, s1.y, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${er}, ${eg}, ${eb}, ${baseOpacity * 0.8})`;
    ctx.beginPath();
    ctx.arc(s2.x, s2.y, dotR * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMolecule(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  focal: number, cx: number, cy: number, time: number, baseOpacity: number,
  electronRgb: [number, number, number] = [255, 255, 255],
): void {
  const g = obj.geom as MoleculeGeom;

  // Project all atoms
  const projected = g.atoms.map((a) => {
    let p = { ...a.pos };
    p = rotateX(p, obj.rotation.x);
    p = rotateY(p, obj.rotation.y);
    p = rotateZ(p, obj.rotation.z);
    const world = { x: p.x + obj.position.x, y: p.y + obj.position.y, z: p.z + obj.position.z };
    return { ...project(world, focal, cx, cy), atom: a };
  });

  // Draw bonds first
  ctx.lineWidth = 2;
  for (const [i, j] of g.bonds) {
    const a = projected[i];
    const b = projected[j];
    if (!a || !b) continue;
    const [br, bg, bb] = a.atom.rgb;
    ctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${baseOpacity * 0.6})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Draw atoms back-to-front within the molecule
  const sorted = [...projected].sort((a, b) => b.z - a.z);
  for (const p of sorted) {
    const radius = Math.max(1, p.atom.radius * p.scale);
    const [r, gn, b] = p.atom.rgb;
    // Glow
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2);
    grad.addColorStop(0, `rgba(${r}, ${gn}, ${b}, ${baseOpacity})`);
    grad.addColorStop(1, `rgba(${r}, ${gn}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    // Solid
    ctx.fillStyle = `rgba(${r}, ${gn}, ${b}, ${Math.min(1, baseOpacity * 1.5)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  focal: number, cx: number, cy: number, time: number, baseOpacity: number,
  electronRgb: [number, number, number] = [255, 255, 255],
): void {
  const g = obj.geom as CellGeom;
  const [r, gn, b] = obj.rgb;

  // Cell membrane — projected as an ellipse (we treat it as a sphere for projection simplicity)
  const center = project(obj.position, focal, cx, cy);
  const membraneRadius = Math.max(2, g.radius * center.scale);

  // Glow
  const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, membraneRadius * 1.5);
  grad.addColorStop(0, `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.4})`);
  grad.addColorStop(1, `rgba(${r}, ${gn}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center.x, center.y, membraneRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Membrane ring
  ctx.strokeStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(center.x, center.y, membraneRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner translucent fill
  ctx.fillStyle = `rgba(${r}, ${gn}, ${b}, ${baseOpacity * 0.15})`;
  ctx.beginPath();
  ctx.arc(center.x, center.y, membraneRadius, 0, Math.PI * 2);
  ctx.fill();

  // Organelles
  for (const org of g.organelles) {
    let p = { ...org.pos };
    p = rotateX(p, obj.rotation.x);
    p = rotateY(p, obj.rotation.y);
    p = rotateZ(p, obj.rotation.z);
    const world = { x: p.x + obj.position.x, y: p.y + obj.position.y, z: p.z + obj.position.z };
    const proj = project(world, focal, cx, cy);
    const oRadius = Math.max(0.5, org.radius * proj.scale);
    // Parse organelle color hex to rgb
    const hex = org.color.replace('#', '');
    const or = parseInt(hex.slice(0, 2), 16);
    const og = parseInt(hex.slice(2, 4), 16);
    const ob = parseInt(hex.slice(4, 6), 16);
    ctx.fillStyle = `rgba(${or}, ${og}, ${ob}, ${baseOpacity * 1.2})`;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, oRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Subject detection =====

/**
 * Map (subject, chapter) → recommended 3D scene type.
 * Used when the user has selected "auto" mode in settings.
 */
export function detectSceneType(subject: string | null, chapter: string | null): SceneType {
  if (!subject || subject === 'General') return 'magnetic-field';

  if (subject === 'Physics') return 'shooting-stars';
  if (subject === 'Botany') return 'falling-petals';
  if (subject === 'Zoology') return 'dna-drift';
  if (subject === 'Chemistry') return 'boiling-bubbles';

  return 'magnetic-field';
}

/** Get the NEET subject color for a subject name. */
export function getSubjectColor(subject: string | null) {
  if (!subject) return SUBJECT_COLORS.General;
  return SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.General;
}

// ===== Device tier detection =====

export type DeviceTier = 'low' | 'mid' | 'high';

/**
 * Detect device performance tier to scale object count.
 *  - low  : <4 cores OR <4GB RAM → 12 objects (foreground only)
 *  - mid  : 4-6 cores OR 4-6GB RAM → 25 objects
 *  - high : 6+ cores OR 6+GB RAM → 40 objects
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'high'; // SSR — assume high, will recompute on client
  const cores = (navigator as any).hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4; // GB
  if (cores < 4 || memory < 4) return 'low';
  if (cores < 6 || memory < 6) return 'mid';
  return 'high';
}

export function objectCountForTier(tier: DeviceTier): number {
  switch (tier) {
    case 'low': return 12;
    case 'mid': return 25;
    case 'high': return 40;
  }
}
