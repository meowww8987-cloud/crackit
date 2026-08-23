'use client';

import { useState, useMemo } from 'react';
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
 * Features:
 *  - Day picker (last 7 days) — defaults to the day user tapped
 *  - Bed time picker (time input)
 *  - Wake time picker (time input) — auto-next-day if earlier than bed time
 *  - Quick presets: "10 PM → 6 AM", "11 PM → 7 AM", "12 AM → 8 AM"
 *  - Quality rating (1-5 stars, optional)
 *  - Live duration preview ("7h 30m")
 *  - Save button (disabled if invalid)
 *
 * THEME COMPLIANCE: all colors use CSS variables.
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

  // === State ===
  const [selectedDate, setSelectedDate] = useState(defaultDate || dateKey(new Date()));
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

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
    // If wake is earlier than bed, it's next day
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    const durMin = wakeMin - bedMin;
    const h = Math.floor(durMin / 60);
    const m = durMin % 60;
    return { h, m, totalMin: durMin };
  }, [bedTime, wakeTime]);

  // === Compute actual timestamps for saving ===
  const computeTimestamps = () => {
    const [bh, bm] = bedTime.split(':').map(Number);
    const [wh, wm] = wakeTime.split(':').map(Number);
    // selectedDate is the WAKE date
    const wakeDate = new Date(selectedDate + 'T00:00:00');
    wakeDate.setHours(wh, wm, 0, 0);
    // Bed time is the PREVIOUS day (if bed time is PM) or same day (if bed time is AM)
    const bedDate = new Date(wakeDate);
    if (bh >= 12) {
      // PM bed time → previous day
      bedDate.setDate(bedDate.getDate() - 1);
    }
    bedDate.setHours(bh, bm, 0, 0);
    return { bedTime: bedDate.getTime(), wakeTime: wakeDate.getTime() };
  };

  const isValid = durationPreview.totalMin > 0 && durationPreview.totalMin < 24 * 60;

  const handleSave = () => {
    if (!isValid) return;
    const { bedTime: bt, wakeTime: wt } = computeTimestamps();
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
    }, 800);
  };

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setBedTime(preset.bed);
    setWakeTime(preset.wake);
    vibrate(8);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-end justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
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

            {/* Day picker */}
            <div className="mb-4">
              <label className="text-[9px] uppercase tracking-wide font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>
                Which night?
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {last7Days.map((day) => {
                  const isSelected = day.key === selectedDate;
                  return (
                    <button
                      key={day.key}
                      onClick={() => { setSelectedDate(day.key); vibrate(8); }}
                      className={cn(
                        "shrink-0 rounded-xl px-3 py-2 text-center transition min-w-[60px]"
                      )}
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
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className="rounded-xl px-3 py-2 text-left transition active:scale-[0.98]"
                    style={{
                      background: bedTime === preset.bed && wakeTime === preset.wake
                        ? 'rgba(99,102,241,0.12)'
                        : 'var(--muted)',
                      border: bedTime === preset.bed && wakeTime === preset.wake
                        ? '1px solid rgba(99,102,241,0.4)'
                        : '1px solid var(--border)',
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
                ))}
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
                  onChange={(e) => setBedTime(e.target.value)}
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
                  onChange={(e) => setWakeTime(e.target.value)}
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
                    className="transition active:scale-90"
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

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isValid || saved}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2",
                !isValid && "opacity-50 cursor-not-allowed"
              )}
              style={{
                background: saved
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                boxShadow: isValid && !saved ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
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
