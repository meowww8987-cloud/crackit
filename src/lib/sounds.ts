'use client';

/**
 * UI Sound Pack — synthesized via Web Audio API (no audio files needed).
 *
 * Plays subtle sounds for key UI actions. Respects the `soundEnabled` and
 * `soundVolume` settings from the settings store.
 *
 * All sounds are short (<200ms) synthesized tones — pleasant, not annoying.
 * Lazy-initializes the AudioContext on first play (browser policy requires
 * user gesture before audio).
 */

type SoundName =
  | 'tap'
  | 'done'
  | 'success'
  | 'error'
  | 'undo'
  | 'achievement'
  | 'complete'
  | 'tick'
  | 'questionWarning'  // soft beep 5s before per-question time runs out
  | 'test5min'         // double beep — 5 min before test ends
  | 'test1min'         // triple beep — 1 min before test ends
  | 'testEnd';         // long descending tone — test time over

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.5; // 0-1

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser auto-suspends after inactivity)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Configure sound system from settings. Call on app mount + when settings change. */
export function configureSounds(soundEnabled: boolean, soundVolumePct: number) {
  enabled = soundEnabled;
  volume = Math.max(0, Math.min(1, soundVolumePct / 100));
}

/**
 * Play a tone with the given frequency, duration, and type.
 * Uses a simple ADSR envelope for a pleasant, non-clicky sound.
 */
function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  startVolume = 0.3,
  delay = 0,
): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  // ADSR envelope — quick attack, exponential decay
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(startVolume * volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/**
 * Play a UI sound by name. Each sound is a short sequence of tones.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;

  switch (name) {
    case 'tap':
      // Soft click — single short high tone
      tone(880, 0.04, 'sine', 0.15);
      break;

    case 'tick':
      // Very short tick for timers / counters
      tone(1200, 0.02, 'square', 0.08);
      break;

    case 'done':
      // Pleasant two-tone rising chime
      tone(523.25, 0.08, 'sine', 0.25); // C5
      tone(659.25, 0.12, 'sine', 0.25, 0.06); // E5
      break;

    case 'success':
      // Three-tone success melody (C-E-G major triad)
      tone(523.25, 0.1, 'sine', 0.25); // C5
      tone(659.25, 0.1, 'sine', 0.25, 0.08); // E5
      tone(783.99, 0.18, 'sine', 0.3, 0.16); // G5
      break;

    case 'complete':
      // Longer 4-tone fanfare for session completion
      tone(523.25, 0.1, 'triangle', 0.25); // C5
      tone(659.25, 0.1, 'triangle', 0.25, 0.08); // E5
      tone(783.99, 0.1, 'triangle', 0.25, 0.16); // G5
      tone(1046.5, 0.25, 'triangle', 0.35, 0.24); // C6
      break;

    case 'achievement':
      // Five-tone sparkle for achievement unlocks
      tone(523.25, 0.08, 'sine', 0.2);
      tone(659.25, 0.08, 'sine', 0.2, 0.05);
      tone(783.99, 0.08, 'sine', 0.25, 0.1);
      tone(1046.5, 0.08, 'sine', 0.3, 0.15);
      tone(1318.5, 0.2, 'sine', 0.35, 0.2);
      break;

    case 'undo':
      // Descending two-tone (reverse of 'done')
      tone(659.25, 0.08, 'sine', 0.2);
      tone(523.25, 0.1, 'sine', 0.2, 0.06);
      break;

    case 'error':
      // Soft buzz — two low tones
      tone(220, 0.1, 'sawtooth', 0.18);
      tone(180, 0.15, 'sawtooth', 0.18, 0.08);
      break;

    case 'questionWarning':
      // Soft single high beep — 5s before per-question time runs out.
      // Gentle, not alarming — just a "wrap up" nudge.
      tone(880, 0.12, 'sine', 0.15);
      break;

    case 'test5min':
      // Double beep — 5 min before test ends. Medium urgency.
      tone(660, 0.15, 'sine', 0.25);
      tone(660, 0.15, 'sine', 0.25, 0.2);
      break;

    case 'test1min':
      // Triple beep — 1 min before test ends. Higher urgency.
      tone(880, 0.12, 'sine', 0.3);
      tone(880, 0.12, 'sine', 0.3, 0.15);
      tone(880, 0.12, 'sine', 0.3, 0.3);
      break;

    case 'testEnd':
      // Long descending tone — test time is over.
      // Three descending tones (C5 → A4 → F4) over ~1.2s
      tone(523.25, 0.3, 'sine', 0.35);
      tone(440, 0.3, 'sine', 0.35, 0.25);
      tone(349.23, 0.5, 'sine', 0.35, 0.5);
      break;
  }
}
