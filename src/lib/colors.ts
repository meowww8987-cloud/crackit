// Subject color tokens — single source of truth.
// Palette chosen so all 4 NEET subjects sit on DIFFERENT hue families for
// maximum differentiation at a glance:
//   Physics   → blue    (#3b82f6)  — electric / motion
//   Chemistry → purple  (#a855f7)  — alchemy / reactions
//   Botany    → green   (#22c55e)  — plants
//   Zoology   → rose    (#f43f5e)  — biology / blood
//   General   → slate   (#64748b)  — neutral
// Hues are ~220°, ~275°, ~140°, ~350° — spread evenly across the color wheel
// so no two subjects can be confused even at small chip sizes.
import type { Subject } from './types';

export const SUBJECT_COLORS: Record<Subject, { hex: string; rgb: string; tailwind: string; glow: string }> = {
  Physics:   { hex: '#3b82f6', rgb: '59, 130, 246',   tailwind: 'blue',    glow: 'rgba(59,130,246,0.45)' },
  Chemistry: { hex: '#a855f7', rgb: '168, 85, 247',   tailwind: 'purple',  glow: 'rgba(168,85,247,0.45)' },
  Botany:    { hex: '#22c55e', rgb: '34, 197, 94',    tailwind: 'green',   glow: 'rgba(34,197,94,0.45)' },
  Zoology:   { hex: '#f43f5e', rgb: '244, 63, 94',    tailwind: 'rose',    glow: 'rgba(244,63,94,0.45)' },
  General:   { hex: '#64748b', rgb: '100, 116, 139',  tailwind: 'slate',   glow: 'rgba(100,116,139,0.45)' },
};

export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology', 'General'];

export const STATE_COLORS = {
  studying: { hex: '#22c55e', rgb: '34, 197, 94',   glow: 'rgba(34,197,94,0.5)' },
  paused:   { hex: '#f59e0b', rgb: '245, 158, 11',  glow: 'rgba(245,158,11,0.5)' },
  wasting:  { hex: '#ef4444', rgb: '239, 68, 68',   glow: 'rgba(239,68,68,0.5)' },
  done:     { hex: '#6b7280', rgb: '107, 114, 128', glow: 'rgba(107,114,128,0.3)' },
};

export function subjectColor(s: Subject) {
  return SUBJECT_COLORS[s] || SUBJECT_COLORS.General;
}
