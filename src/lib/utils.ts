import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===== Time helpers =====

export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatHM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(totalSeconds)}s`;
}

export function formatShort(totalSeconds: number): string {
  // Compact: "25m" / "1h 30m" / "0m"
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatClock(totalSeconds: number): string {
  // HH:MM:SS for timer display
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== Date helpers =====

export function todayKey(): string {
  return dateKey(new Date());
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameDay(ts: number, dateStr: string): boolean {
  const d = new Date(ts);
  return dateKey(d) === dateStr;
}

export function shortDate(d: Date = new Date()): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${d.getDate()}`;
}

export function longDate(d: Date = new Date()): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${weekday}, ${month} ${d.getDate()}`;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function diffDays(a: string, b: string): number {
  // days between two YYYY-MM-DD strings
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayKey();
}

// ===== ID generator =====

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ===== Haptics =====

export function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

// ===== Mood emoji =====

export function moodEmoji(m: string | null | undefined): string {
  switch (m) {
    case 'confident': return '😊';
    case 'okay': return '🙂';
    case 'struggling': return '😰';
    case 'tired': return '😴';
    default: return '·';
  }
}

export function moodLabel(m: string): string {
  switch (m) {
    case 'confident': return 'Confident';
    case 'okay': return 'Okay';
    case 'struggling': return 'Struggling';
    case 'tired': return 'Tired';
    default: return '';
  }
}

// ===== Spaced repetition =====

export const REVISION_INTERVALS = [1, 3, 7, 21, 60]; // days

export function nextRevisionDate(stage: number, from: number = Date.now()): number {
  const intervalDays = REVISION_INTERVALS[Math.min(stage, REVISION_INTERVALS.length - 1)];
  return from + intervalDays * 86400000;
}

export function isRevisionOverdue(nextAt?: number): boolean {
  if (!nextAt) return false;
  return nextAt < Date.now();
}
