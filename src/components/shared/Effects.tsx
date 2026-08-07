'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/lib/store/settings';

// ===== Confetti Canvas =====
let _triggerConfetti: (intensity: 'small' | 'medium' | 'big' | 'fireworks') => void = () => {};
export function triggerConfetti(intensity: 'small' | 'medium' | 'big' | 'fireworks' = 'small') {
  _triggerConfetti(intensity);
}

// ===== Particle Burst (localized at a point) =====
let _triggerBurst: (x: number, y: number, color?: string) => void = () => {};
/**
 * Trigger a localized particle burst at screen coordinates (x, y).
 * Used for tap-point celebrations — e.g. marking a target done bursts
 * particles in the subject's color from where the user tapped.
 *
 * Falls back to confetti if burst canvas not mounted.
 */
export function triggerParticleBurst(x: number, y: number, color?: string) {
  _triggerBurst(x, y, color);
}

// ===== Sound Effects =====
let _playSound: (type: 'chime' | 'success' | 'celebration' | 'achievement') => void = () => {};
export function playSound(type: 'chime' | 'success' | 'celebration' | 'achievement' = 'chime') {
  _playSound(type);
}

// ===== Combined effect trigger =====
export function triggerEffect(
  confetti?: 'small' | 'medium' | 'big' | 'fireworks',
  sound?: 'chime' | 'success' | 'celebration' | 'achievement'
) {
  if (confetti) triggerConfetti(confetti);
  if (sound) playSound(sound);
}

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const confettiEnabled = useSettings((s) => s.confettiEnabled);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const soundVolume = useSettings((s) => s.soundVolume);

  // Sound player
  useEffect(() => {
    _playSound = (type) => {
      if (!soundEnabled) return;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = ctx.currentTime;

        const playTone = (freq: number, start: number, duration: number, gain: number = 0.1) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gainNode.gain.setValueAtTime(0, now + start);
          gainNode.gain.linearRampToValueAtTime(gain * (soundVolume / 100), now + start + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
          osc.start(now + start);
          osc.stop(now + start + duration);
        };

        switch (type) {
          case 'chime':
            playTone(523.25, 0, 0.3); // C5
            break;
          case 'success':
            playTone(523.25, 0, 0.15); // C5
            playTone(659.25, 0.1, 0.15); // E5
            playTone(783.99, 0.2, 0.3); // G5
            break;
          case 'celebration':
            playTone(523.25, 0, 0.1);
            playTone(659.25, 0.08, 0.1);
            playTone(783.99, 0.16, 0.1);
            playTone(1046.5, 0.24, 0.4); // C6
            break;
          case 'achievement':
            playTone(659.25, 0, 0.15); // E5
            playTone(783.99, 0.12, 0.15); // G5
            playTone(1046.5, 0.24, 0.15); // C6
            playTone(1318.5, 0.36, 0.5); // E6
            break;
        }
        setTimeout(() => ctx.close(), 1000);
      } catch {}
    };
  }, [soundEnabled, soundVolume]);

  // Confetti trigger
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#22c55e', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#ec4899'];

    _triggerConfetti = (intensity) => {
      if (!confettiEnabled) return;
      const counts = { small: 20, medium: 40, big: 80, fireworks: 150 };
      const count = counts[intensity];

      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: intensity === 'fireworks' ? canvas.width / 2 + (Math.random() - 0.5) * 200 : Math.random() * canvas.width,
          y: intensity === 'fireworks' ? canvas.height / 2 : -20,
          vx: (Math.random() - 0.5) * (intensity === 'fireworks' ? 12 : 6),
          vy: intensity === 'fireworks' ? (Math.random() - 0.5) * 12 : Math.random() * 3 + 2,
          gravity: 0.15,
          size: Math.random() * 6 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          life: 1,
          decay: 0.008 + Math.random() * 0.005,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
        });
      }
      if (!animFrameRef.current) animate();
    };

    // Localized particle burst — used for tap-point celebrations.
    // Spawns ~18 small particles in the given color (or random colors) that
    // fly outward with physics (gravity + air resistance) from (x, y).
    _triggerBurst = (x, y, color) => {
      if (!confettiEnabled) return;
      const burstColor = color || colors[Math.floor(Math.random() * colors.length)];
      const count = 18;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 3 + Math.random() * 5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5, // slight upward bias
          gravity: 0.18,
          size: Math.random() * 4 + 3,
          color: Math.random() < 0.7 ? burstColor : colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          life: 1,
          decay: 0.018 + Math.random() * 0.008,
          shape: 'circle',
        });
      }
      if (!animFrameRef.current) animate();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.life -= p.decay;

        if (p.life <= 0 || p.y > canvas.height + 50) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      if (particlesRef.current.length > 0) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
      }
    };

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [confettiEnabled]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9997] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
