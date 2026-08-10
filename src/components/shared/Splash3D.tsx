'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Splash3D — full-screen 3D splash shown on first app mount.
 *
 * Visual: rotating Bohr-model atom (3 orbital rings + electrons) drawn on
 * canvas, with the "NEET 2027" title above and a live countdown below.
 *
 * Theme: matches the app — solid dark navy background, teal/green subject
 * colors (Physics blue + Botany green for variety), animated aurora behind.
 *
 * Lifecycle:
 *  - Renders on mount
 *  - Shows for ~1.8s
 *  - Fades out (300ms opacity transition via AnimatePresence)
 *  - Caller sets `onDone` to remove from DOM
 */
export function Splash3D({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState(true);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  // Compute NEET 2027 countdown once on mount
  useEffect(() => {
    const exam = new Date('2027-05-02T00:00:00');
    const now = new Date();
    const days = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86400000));
    setDaysLeft(days);
  }, []);

  // Atom animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;

    // 3 orbital rings — Physics blue, Chemistry purple, Botany green
    const orbits = [
      { radius: 80, tilt: 0,            color: [59, 130, 246],  speed: 1.6, phase: 0,             electronR: 5 },
      { radius: 60, tilt: Math.PI / 3,  color: [168, 85, 247],  speed: 2.2, phase: Math.PI * 0.5, electronR: 4 },
      { radius: 40, tilt: -Math.PI / 3, color: [34, 197, 94],   speed: 3.0, phase: Math.PI,       electronR: 3.5 },
    ];

    let raf = 0;
    const start = Date.now();

    const draw = () => {
      const t = (Date.now() - start) / 1000;
      ctx.clearRect(0, 0, size, size);

      // Draw orbital rings as projected ellipses (faked 3D rotation)
      for (const orbit of orbits) {
        const tiltY = Math.sin(t * 0.5) * 0.3; // slow wobble of the whole atom
        const ringRotation = t * 0.3;
        const yScale = Math.abs(Math.sin(orbit.tilt + tiltY));

        // Draw the ring (ellipse outline)
        ctx.strokeStyle = `rgba(${orbit.color[0]}, ${orbit.color[1]}, ${orbit.color[2]}, 0.35)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbit.radius, orbit.radius * yScale, ringRotation, 0, Math.PI * 2);
        ctx.stroke();

        // Electron position on the ring
        const eAngle = orbit.phase + t * orbit.speed;
        const exLocal = Math.cos(eAngle) * orbit.radius;
        const eyLocal = Math.sin(eAngle) * orbit.radius * yScale;
        // Rotate by ring rotation
        const cosR = Math.cos(ringRotation);
        const sinR = Math.sin(ringRotation);
        const ex = cx + exLocal * cosR - eyLocal * sinR;
        const ey = cy + exLocal * sinR + eyLocal * cosR;

        // Electron glow
        const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, orbit.electronR * 4);
        glow.addColorStop(0, `rgba(${orbit.color[0]}, ${orbit.color[1]}, ${orbit.color[2]}, 0.8)`);
        glow.addColorStop(0.4, `rgba(${orbit.color[0]}, ${orbit.color[1]}, ${orbit.color[2]}, 0.25)`);
        glow.addColorStop(1, `rgba(${orbit.color[0]}, ${orbit.color[1]}, ${orbit.color[2]}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ex, ey, orbit.electronR * 4, 0, Math.PI * 2);
        ctx.fill();

        // Electron solid
        ctx.fillStyle = `rgba(255, 255, 255, 0.95)`;
        ctx.beginPath();
        ctx.arc(ex, ey, orbit.electronR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nucleus — central glow + solid
      const nucPulse = 1 + Math.sin(t * 2) * 0.1;
      const nucGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * nucPulse);
      nucGlow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      nucGlow.addColorStop(0.3, 'rgba(20, 184, 166, 0.4)');
      nucGlow.addColorStop(1, 'rgba(20, 184, 166, 0)');
      ctx.fillStyle = nucGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 30 * nucPulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(raf);
  }, []);

  // Fade out after 1.8s, then call onDone after the exit animation
  useEffect(() => {
    const t1 = setTimeout(() => setShow(false), 1800);
    const t2 = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center force-dark-ui"
          style={{
            background:
              'radial-gradient(ellipse at center, #0a0b15 0%, #050608 80%)',
          }}
        >
          {/* Subtle aurora glow behind atom */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.10) 0%, rgba(168,85,247,0.08) 30%, transparent 60%)',
            }}
          />

          {/* Atom canvas */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            <canvas ref={canvasRef} />
          </motion.div>

          {/* Logo mark — small NEET atom logo above the title for brand identity */}
          <motion.img
            src="/logo.svg"
            alt="NEET 2027"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-12 h-12 -mb-2"
          />

          {/* Title */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center mt-2"
          >
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-300 via-teal-300 to-purple-300 bg-clip-text text-transparent">
              NEET 2027
            </h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-1">
              Study Tracker
            </p>
          </motion.div>

          {/* Countdown */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="text-center mt-6"
          >
            {daysLeft !== null && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                  NEET 2027 in
                </div>
                <div className="text-5xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
                  {daysLeft}
                </div>
                <div className="text-xs text-white/50 mt-1">days · May 2, 2027</div>
              </>
            )}
          </motion.div>

          {/* Loading indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="absolute bottom-12 flex flex-col items-center gap-2"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-teal-400"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
            <div className="text-[9px] text-white/30 uppercase tracking-wider">
              Loading your study universe
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
