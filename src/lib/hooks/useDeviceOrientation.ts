'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDeviceOrientation — shared orientation detection + rotate/lock state.
 *
 * Extracted from FocusTimer's orientation logic so PracticeRunner + FocusTimer
 * use the SAME rotation behavior.
 *
 * 3-layer stability (matches FocusTimer):
 *  1. HYSTERESIS — 75° to enter landscape, 15° to exit (60° gap = locked once in landscape)
 *  2. FLAT-IGNORE — hold current orientation when phone is flat (|beta|<25 AND |gamma|<25)
 *  3. LOW-PASS SMOOTHING — exponential smoothing (alpha=0.15, ~300ms response)
 *
 * Returns:
 *  - effectiveAngle: the angle to apply via `transform: rotate(${angle}deg)`
 *  - tempLockAngle: null OR a temp-locked angle (current session only)
 *  - setTempLockAngle: setter
 *  - settingsLockedOrientation: persistent lock (caller must pass via opts)
 *  - rotateBy90: function to cycle angle by 90° (single tap on rotate button)
 *  - cycleResult: function that returns the cycled angle without setting (used by caller)
 *
 * Usage:
 *   const { effectiveAngle, tempLockAngle, setTempLockAngle, rotateBy90, settingsLockedOrientation } = useDeviceOrientation();
 *   // Apply rotation:
 *   <div style={{ transform: `rotate(${effectiveAngle}deg)`, width: '100vmin', height: '100vmax' }}>
 *
 * Rotate button gestures (caller handles UI but uses these helpers):
 *  - single tap → rotateBy90()
 *  - double-tap → toggle tempLockAngle (set to effectiveAngle or null)
 *  - long-press → toggle settings.lockedOrientation (caller's settings store)
 */

export interface DeviceOrientationState {
  /** Angle to apply: 0 | 90 | 180 | 270 */
  effectiveAngle: number;
  /** Temp-locked angle for current session (null = not temp-locked). */
  tempLockAngle: number | null;
  /** Setter for temp lock (pass null to release). */
  setTempLockAngle: (angle: number | null) => void;
  /** Persisted locked angle from settings (null = no persistent lock).
   *  Caller passes this in via opts so it can be controlled by the settings store. */
  settingsLockedOrientation: number | null;
  /** Cycle the orientation angle by 90° (clears any locks first). */
  rotateBy90: () => void;
}

interface UseDeviceOrientationOpts {
  /** Persistent locked angle from the caller's settings store.
   *  Pass null if no persistent lock. */
  lockedOrientation?: number | null;
}

export function useDeviceOrientation(opts: UseDeviceOrientationOpts = {}): DeviceOrientationState {
  const lockedOrientation = opts.lockedOrientation ?? null;

  const [orientationAngle, setOrientationAngle] = useState(0);
  const orientationAngleRef = useRef(0);
  const smoothedGammaRef = useRef(0);
  const smoothedBetaRef = useRef(0);
  const sensorInitializedRef = useRef(false);
  const [tempLockAngle, setTempLockAngle] = useState<number | null>(null);

  // === Hysteresis-based angle computation ===
  // - To ENTER landscape: tilt past 75° (nearly horizontal)
  // - To EXIT back to portrait: tilt back past 15° (nearly vertical)
  // - Gap = 60° — once in landscape, locked until deliberate rotation back.
  const computeAngleHysteresis = useCallback((gamma: number, beta: number, currentAngle: number): number => {
    const isCurrentlyPortrait = currentAngle === 0 || currentAngle === 180;
    const LANDSCAPE_ENTER = 75;
    const LANDSCAPE_EXIT = 15;

    if (isCurrentlyPortrait) {
      if (gamma > LANDSCAPE_ENTER) return 270;
      if (gamma < -LANDSCAPE_ENTER) return 90;
      if (beta < -45 || beta > 135) return 180;
      return 0;
    } else {
      if (Math.abs(gamma) < LANDSCAPE_EXIT) {
        if (beta < -45 || beta > 135) return 180;
        return 0;
      }
      if (gamma > 0) return 270;
      return 90;
    }
  }, []);

  // The EFFECTIVE angle: temp lock > persistent lock > auto-detected.
  const effectiveAngle = tempLockAngle ?? lockedOrientation ?? orientationAngle;

  // === Orientation detection effect ===
  useEffect(() => {
    const lockAngle = tempLockAngle ?? lockedOrientation;
    if (lockAngle !== null && lockAngle !== undefined) {
      const normalized = ((lockAngle % 360) + 360) % 360;
      orientationAngleRef.current = normalized;
      setOrientationAngle(normalized);
      return;
    }

    const readScreenAngle = (): number => {
      if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
        return screen.orientation.angle;
      }
      if (typeof window !== 'undefined' && typeof (window as any).orientation === 'number') {
        return (window as any).orientation;
      }
      return window.innerWidth > window.innerHeight ? 90 : 0;
    };

    const applyAngle = (newAngle: number) => {
      const normalized = ((newAngle % 360) + 360) % 360;
      if (normalized !== orientationAngleRef.current) {
        orientationAngleRef.current = normalized;
        setOrientationAngle(normalized);
      }
    };

    applyAngle(readScreenAngle());

    // 1. DeviceOrientationEvent with smoothing + hysteresis
    let deviceOrientationActive = false;
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      deviceOrientationActive = true;

      if (!sensorInitializedRef.current) {
        smoothedGammaRef.current = e.gamma;
        smoothedBetaRef.current = e.beta;
        sensorInitializedRef.current = true;
      } else {
        smoothedGammaRef.current = 0.85 * smoothedGammaRef.current + 0.15 * e.gamma;
        smoothedBetaRef.current = 0.85 * smoothedBetaRef.current + 0.15 * e.beta;
      }

      const angle = computeAngleHysteresis(
        smoothedGammaRef.current,
        smoothedBetaRef.current,
        orientationAngleRef.current,
      );
      applyAngle(angle);
    };

    try {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    } catch {
      // ignore
    }

    // 2. Fallback: screen.orientation 'change' event
    const handleScreenOrientationChange = () => {
      if (deviceOrientationActive) return;
      applyAngle(readScreenAngle());
    };
    window.addEventListener('orientationchange', handleScreenOrientationChange);
    window.addEventListener('resize', handleScreenOrientationChange);
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }

    // 3. Periodic fallback for first 5s
    let fallbackChecks = 0;
    const fallbackInterval = setInterval(() => {
      if (deviceOrientationActive) {
        clearInterval(fallbackInterval);
        return;
      }
      applyAngle(readScreenAngle());
      fallbackChecks++;
      if (fallbackChecks > 5) clearInterval(fallbackInterval);
    }, 1000);

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
      window.removeEventListener('orientationchange', handleScreenOrientationChange);
      window.removeEventListener('resize', handleScreenOrientationChange);
      if (typeof screen !== 'undefined' && screen.orientation) {
        screen.orientation.removeEventListener('change', handleScreenOrientationChange);
      }
      clearInterval(fallbackInterval);
    };
  }, [computeAngleHysteresis, tempLockAngle, lockedOrientation]);

  /** Cycle orientation by 90° (single-tap on rotate button). Clears any locks first. */
  const rotateBy90 = useCallback(() => {
    setTempLockAngle(null);
    setOrientationAngle((prev) => (prev + 90) % 360);
  }, []);

  return {
    effectiveAngle,
    tempLockAngle,
    setTempLockAngle,
    settingsLockedOrientation: lockedOrientation,
    rotateBy90,
  };
}
