'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sunrise, Star, Clock, Bed, Check } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import { dateKey, addDays, vibrate, cn } from '@/lib/utils';

/**
 * SleepBackfillSheet — modern UI to manually log a past sleep entry.
 *
 * Used when user forgot to mark "good night" before sleeping.
 * Opens from:
 *  - "Add" button under any unreported day in Sleep Health card
 *  - "Tap to log last night" CTA on today's not-reported state
 *
 * GLITCH FIXES (v2):
 *  - Body scroll lock when sheet is open (prevents background scroll)
 *  - Touch event isolation (prevent touchend on backdrop from closing)
 *  - Removed backdrop-blur (rendering lag on Android)
 *  - Smoother animation (lower stiffness, no overshoot)
 *  - Removed active:scale transforms (visual jumps on tap)
 *  - overscroll-contain on sheet (prevents scroll chaining)
 *  - Day picker uses touch-none (prevents vertical scroll conflict)
 *
 * LOG VALIDATION:
 *  - Won't save if user is currently sleeping (activeSleep set)
 *  - Won't save future wake times
 *  - Correctly handles AM bed times (1 AM = same day, not previous day)
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select this date (YYYY-MM-DD) when opening. Defaults to today. */
  defaultDate?: string;
}

const QUICK_PRESETS = [
  { label: 'Early Bird', bed: '22:00', wake: '06:00', emoji: '🌅' },
  { label: 'Ideal', bed: '23:00', wake: '07:00', emoji: '🌙' },
  { label: 'Late', bed: '00:00', wake: '08:00', emoji: '🌃' },
  { label: 'Power Sleep', bed: '23:30', wake: '06:30', emoji: '⚡' },
];

export function SleepBackfillSheet({ open, onClose, defaultDate }: Props) {
  const addManualSleep = useSleep((s) => s.addManualSleep);
  const activeSleep = useSleep((s) => s.activeSleep);

  // === State ===
  const [selectedDate, setSelectedDate] = useState(defaultDate || dateKey(new Date()));
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === Body scroll lock when open ===
  // Prevents background from scrolling behind the sheet (causes glitchy feel)
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  // === Reset state when sheet opens with a new defaultDate ===
  useEffect(() => {
    if (open && defaultDate) {
      setSelectedDate(defaultDate);
      setBedTime('23:00');
      setWakeTime('07:00');
      setQuality(null);
      setError(null);
      setSaved(false);
    }
  }, [open, defaultDate]);

  // === Build last 7 days for the day picker ===
  const last7Days = useMemo(() => {
    const days: { key: string; label: string; dateNum: number; month: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      days.push({
        key,
        label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateNum: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return days;
  }, []);

  // === Compute duration preview ===
  const durationPreview = useMemo(() => {
    const [bh, bm] = bedTime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    // If wake is earlier than or equal to bed, it's next day
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    const durMin = wakeMin - bedMin;
    const h = Math.floor(durMin / 60);
    const m = durMin % 60;
    return { h, m, totalMin: durMin };
  }, [bedTime, wakeTime]);

  // === Compute actual timestamps for saving ===
  // selectedDate = WAKE date (the morning you woke up)
  // bedTime = the night BEFORE (PM) or same morning (AM, for late-night sleep)
  const computeTimestamps = () => {
    const [bh, bm] = bedTime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);

    // Wake timestamp = selectedDate at wake time
    const wakeDate = new Date(selectedDate + 'T00:00:00');
    wakeDate.setHours(wh, wm, 0, 0);
    const wakeTs = wakeDate.getTime();

    // Bed timestamp:
    // - If bed time is PM (12:00-23:59): bed is the PREVIOUS day
    // - If bed time is AM (00:00-11:59): bed is the SAME day as wake
    //   (e.g. slept 1 AM → 7 AM, both on the wake date)
    const bedDate = new Date(wakeDate);
    if (bh >= 12) {
      // PM bed time → previous day
      bedDate.setDate(bedDate.getDate() - 1);
    }
    // AM bed time → same day (already correct)
    bedDate.setHours(bh, bm, 0, 0);
    const bedTs = bedDate.getTime();

    return { bedTime: bedTs, wakeTime: wakeTs };
  };

  const isValid = durationPreview.totalMin > 0 && durationPreview.totalMin < 24 * 60;

  const handleSave = () => {
    setError(null);

    // Validation 1: can't log while currently sleeping
    if (activeSleep) {
      setError('You are currently sleeping. Wake up first before logging past sleep.');
      vibrate([10, 50, 10]);
      return;
    }

    // Validation 2: can't log future wake times
    const { bedTime: bt, wakeTime: wt } = computeTimestamps();
    if (wt > Date.now()) {
      setError("Wake time is in the future. You can't log sleep that hasn't happened yet.");
      vibrate([10, 50, 10]);
      return;
    }

    // Validation 3: bed must be before wake
    if (bt >= wt) {
      setError('Bed time must be before wake time.');
      vibrate([10, 50, 10]);
      return;
    }

    // Validation 4: reasonable duration (10 min to 24 hours)
    const durSec = (wt - bt) / 1000;
    if (durSec < 600 || durSec > 24 * 3600) {
      setError('Sleep duration must be between 10 minutes and 24 hours.');
      vibrate([10, 50, 10]);
      return;
    }

    addManualSleep(bt, wt, quality ?? undefined);
    vibrate([10, 30, 10]);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      // Reset
      setBedTime('23:00');
      setWakeTime('07:00');
      setQuality(null);
      setError(null);
    }, 800);
  };

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setBedTime(preset.bed);
    setWakeTime(preset.wake);
    setError(null);
    vibrate(8);
  };

  // === Touch handlers — prevent backdrop touch from closing sheet ===
  // On mobile, touchend on the backdrop can trigger onClick which closes
  // the sheet unexpectedly. We only close if the touch started on backdrop.
  const touchStartTarget = useState<HTMLDivElement | null>(null);
  const handleBackdropTouchStart = (e: React.TouchEvent) => {
    touchStartTarget[1](e.target as HTMLDivElement);
  };
  const handleBackdropTouchEnd = (e: React.TouchEvent) => {
    // Only close if touch started AND ended on the backdrop (not the sheet)
    if (touchStartTarget[0] === e.target && e.target === e.currentTarget) {
      onClose();
    }
    touchStartTarget[1](null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-end justify-center select-none"
          style={{
            background: 'rgba(0,0,0,0.6)',
            touchAction: 'none', // prevent long-press / scroll / context menu on backdrop
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onTouchStart={handleBackdropTouchStart}
          onTouchEnd={handleBackdropTouchEnd}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-3xl p-5 pb-8"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y', // sheet itself allows vertical scroll
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="text-center mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), transparent)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                <Bed size={24} className="text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                Log Sleep
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Forgot to mark sleep? Add it here.
              </p>
            </div>

            {/* Active sleep warning */}
            {activeSleep && (
              <div
                className="rounded-xl p-2.5 mb-3 text-[11px] flex items-center gap-2"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
              >
                <Bed size={14} />
                <span>You're currently sleeping. Wake up first to log this night accurately.</span>
              </div>
            )}

            {/* Day picker */}
            <div className="mb-4">
              <label className="text-[9px] uppercase tracking-wide font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Which night?
              </label>
              <div
                className="flex gap-1.5 overflow-x-auto pb-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x' }}
              >
                {last7Days.map((day) => {
                  const isSelected = day.key === selectedDate;
                  return (
                    <button
                      key={day.key}
                      onClick={() => { setSelectedDate(day.key); setError(null); vibrate(8); }}
                      className="shrink-0 rounded-xl px-3 py-2 text-center min-w-[60px]"
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--muted)',
                        border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="text-[10px] font-bold uppercase"
                        style={{ color: isSelected ? '#818cf8' : 'var(--muted-foreground)' }}
                      >
                        {day.label}
                      </div>
                      <div
                        className="text-sm font-bold tabular"
                        style={{ color: isSelected ? '#818cf8' : 'var(--foreground)' }}
                      >
                        {day.dateNum}
                      </div>
                      <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
                        {day.month}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick presets */}
            <div className="mb-4">
              <label className="text-[9px] uppercase tracking-wide font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Quick presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PRESETS.map((preset) => {
                  const isActive = bedTime === preset.bed && wakeTime === preset.wake;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="rounded-xl px-3 py-2 text-left"
                      style={{
                        background: isActive ? 'rgba(99,102,241,0.12)' : 'var(--muted)',
                        border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{preset.emoji}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                          {preset.label}
                        </span>
                      </div>
                      <div className="text-[9px] tabular mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {preset.bed} → {preset.wake}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom time inputs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[9px] uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                  <Moon size={10} /> Bed time
                </label>
                <input
                  type="time"
                  value={bedTime}
                  onChange={(e) => { setBedTime(e.target.value); setError(null); }}
                  className="w-full p-2.5 rounded-lg text-sm font-bold tabular outline-none"
                  style={{
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                  <Sunrise size={10} /> Wake time
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => { setWakeTime(e.target.value); setError(null); }}
                  className="w-full p-2.5 rounded-lg text-sm font-bold tabular outline-none"
                  style={{
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            {/* Duration preview */}
            <div
              className="rounded-xl p-3 mb-4 flex items-center justify-between"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-1.5">
                <Clock size={14} style={{ color: '#818cf8' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  Duration
                </span>
              </div>
              <span className="text-lg font-bold tabular" style={{ color: isValid ? '#818cf8' : '#ef4444' }}>
                {durationPreview.h}h {durationPreview.m}m
              </span>
            </div>

            {/* Quality rating */}
            <div className="mb-5">
              <label className="text-[9px] uppercase tracking-wide font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Quality (optional)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      vibrate(8);
                      setQuality(quality === star ? null : star);
                    }}
                  >
                    <Star
                      size={28}
                      className={cn(
                        "transition",
                        quality !== null && star <= quality ? 'fill-amber-400' : ''
                      )}
                      style={{
                        color: quality !== null && star <= quality ? '#fbbf24' : 'var(--muted)',
                      }}
                    />
                  </button>
                ))}
                {quality !== null && (
                  <button
                    onClick={() => { setQuality(null); vibrate(8); }}
                    className="ml-auto text-[10px] font-semibold"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                className="rounded-xl p-2.5 mb-3 text-[11px] flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
              >
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isValid || saved || !!activeSleep}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2",
                (!isValid || saved || !!activeSleep) && "opacity-50"
              )}
              style={{
                background: saved
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                boxShadow: isValid && !saved && !activeSleep ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              {saved ? (
                <>
                  <Check size={16} /> Saved!
                </>
              ) : (
                <>
                  <Bed size={16} /> Log Sleep
                </>
              )}
            </button>

            <p className="text-[9px] text-center mt-3" style={{ color: 'var(--muted-foreground)' }}>
              This adds a sleep entry for the selected night · Tap outside to cancel
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
