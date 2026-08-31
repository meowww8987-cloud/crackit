'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Moon, Sunrise, X, Bed } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import { useSettings } from '@/lib/store/settings';
import { cn, formatHM, vibrate } from '@/lib/utils';

/**
 * SleepBanner — persistent banner shown at the top of the Home tab.
 *
 * Two modes:
 * 1. AWAKE (no active sleep): a compact "Going to sleep?" pill button.
 * Tap → starts sleep mode (fires persistent browser notification).
 *
 * 2. SLEEPING (active sleep): a full-width indigo banner with:
 * - 😴 icon + "Sleeping since 11:30 PM"
 * - Live ticking duration (e.g. "6h 42m")
 * - "Slide to wake up →" drag slider — user drags right to confirm
 * wake-up. On complete, calls wakeUp() and shows a quality picker.
 * - Small ✕ to cancel (if sleep was started by mistake)
 *
 * The banner stays visible while sleeping — it does NOT auto-dismiss.
 * This mimics a phone's notification panel entry that "always stays"
 * until the user interacts with it.
 */
export function SleepBanner() {
 const activeSleep = useSleep((s) => s.activeSleep);
 const startSleep = useSleep((s) => s.startSleep);
 const wakeUp = useSleep((s) => s.wakeUp);
 const cancelSleep = useSleep((s) => s.cancelSleep);
 const haptics = useSettings((s) => s.haptics);

 // Live ticking duration
 const [, setTick] = useState(0);
 useEffect(() => {
 if (!activeSleep) return;
 const i = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 1000);
 return () => clearInterval(i);
 }, [activeSleep]);

 // Drag-to-wake slider state
 const [dragX, setDragX] = useState(0);
 const [showQualityPicker, setShowQualityPicker] = useState(false);
 const DRAG_THRESHOLD = 180; // px — full slider width

 const handleDragEnd = (_: any, info: PanInfo) => {
 if (info.offset.x >= DRAG_THRESHOLD) {
 // Wake up confirmed — show quality picker
 if (haptics) vibrate([10, 30, 10, 30, 50]);
 setShowQualityPicker(true);
 setDragX(0);
 } else {
 // Snap back
 if (haptics) vibrate(8);
 setDragX(0);
 }
 };

 // === Mode 1: AWAKE — compact "Going to sleep?" button ===
 if (!activeSleep) {
 return (
 <button
 onClick={() => {
 if (haptics) vibrate(12);
 // Request notification permission if not granted
 if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
 Notification.requestPermission();
 }
 startSleep();
 }}
 className="w-full glass rounded-2xl p-3 flex items-center gap-3 border border-indigo-500/20 hover:bg-white/[0.07] transition active:scale-[0.99]"
 >
 <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
 <Bed size={18} className="text-indigo-400" />
 </div>
 <div className="flex-1 text-left">
 <div className="text-sm font-semibold text-indigo-300">Going to sleep?</div>
 <div className="text-[10px] text-t-muted">Tap to start sleep mode · stays in notifications</div>
 </div>
 <Moon size={16} className="text-indigo-400/60" />
 </button>
 );
 }

 // === Mode 2: SLEEPING — full banner with live timer + drag-to-wake ===
 const bedTime = new Date(activeSleep.bedTime);
 const bedTimeStr = bedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
 const elapsedSec = Math.floor((Date.now() - activeSleep.bedTime) / 1000);

 return (
 <>
 <motion.div
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 className="rounded-2xl overflow-hidden border border-indigo-500/40"
 style={{
 background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.10))',
 boxShadow: '0 4px 20px -4px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.10)',
 }}
 >
 {/* Top row: 😴 icon + sleeping since + duration + cancel */}
 <div className="p-3 flex items-center gap-3">
 <motion.div
 animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
 transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
 className="w-10 h-10 rounded-full bg-indigo-500/25 flex items-center justify-center shrink-0 text-xl"
 >
 😴
 </motion.div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-bold text-indigo-100">Sleeping</div>
 <div className="text-[10px] text-indigo-300/70">
 Since {bedTimeStr}
 </div>
 </div>
 {/* Live duration */}
 <div className="text-right shrink-0">
 <div className="text-lg font-bold tabular text-indigo-100 leading-none">
 {formatHM(elapsedSec)}
 </div>
 <div className="text-[9px] text-indigo-300/60 mt-0.5">elapsed</div>
 </div>
 {/* Cancel (if started by mistake) */}
 <button
 onClick={() => {
 if (haptics) vibrate(8);
 cancelSleep();
 }}
 className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-300/60 hover: hover: transition shrink-0"
 aria-label="Cancel sleep"
 title="Cancel (started by mistake)"
 >
 <X size={14} />
 </button>
 </div>

 {/* Drag-to-wake slider */}
 <div className="px-3 pb-3">
 <div className="relative h-12 rounded-xl bg-indigo-950/40 border border-indigo-500/20 overflow-hidden">
 {/* Background hint text */}
 <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-indigo-300/50 pointer-events-none">
 Slide to wake up →
 </div>
 {/* Draggable knob */}
 <motion.div
 drag="x"
 dragConstraints={{ left: 0, right: DRAG_THRESHOLD }}
 dragElastic={0.1}
 dragMomentum={false}
 onDrag={(_, info) => setDragX(info.offset.x)}
 onDragEnd={handleDragEnd}
 animate={{ x: dragX }}
 transition={{ type: 'spring', stiffness: 500, damping: 35 }}
 className="absolute left-1 top-1 bottom-1 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
 style={{ boxShadow: '0 2px 12px rgba(245,158,11,0.4)' }}
 >
 <Sunrise size={18}  />
 </motion.div>
 {/* Progress fill behind knob */}
 <motion.div
 className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500/20 to-orange-500/30"
 animate={{ width: dragX + 44 }}
 transition={{ duration: 0 }}
 style={{ pointerEvents: 'none' }}
 />
 </div>
 </div>
 </motion.div>

 {/* === Quality picker sheet — shown after drag-to-wake === */}
 <AnimatePresence>
 {showQualityPicker && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[100] flex items-end justify-center"
 onClick={() => setShowQualityPicker(false)}
 >
 <div className="absolute inset-0 bg-black/85" />
 <motion.div
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', stiffness: 400, damping: 35 }}
 onClick={(e) => e.stopPropagation()}
 className="relative w-full max-w-md glass-strong rounded-t-3xl p-6 pb-8"
 >
 <div className="w-10 h-1 rounded-full mx-auto mb-4" />
 <div className="text-center mb-5">
 <div className="text-4xl mb-2">☀️</div>
 <h2 className="text-lg font-bold">Good morning!</h2>
 <p className="text-xs text-t-muted mt-1">
 You slept <strong className="text-indigo-300">{formatHM(elapsedSec)}</strong>
 </p>
 </div>
 <div className="mb-5">
 <div className="text-xs font-semibold text-t-secondary mb-2 text-center">How was your sleep?</div>
 <div className="flex gap-2 justify-center">
 {[
 { q: 1, emoji: '😣', label: 'Terrible' },
 { q: 2, emoji: '😕', label: 'Poor' },
 { q: 3, emoji: '😐', label: 'Okay' },
 { q: 4, emoji: '😊', label: 'Good' },
 { q: 5, emoji: '😍', label: 'Great' },
 ].map((opt) => (
 <button
 key={opt.q}
 onClick={() => {
 if (haptics) vibrate(15);
 wakeUp(opt.q);
 setShowQualityPicker(false);
 }}
 className="flex-1 py-3 rounded-xl hover: transition flex flex-col items-center gap-1"
 >
 <span className="text-2xl">{opt.emoji}</span>
 <span className="text-[9px] text-t-muted">{opt.label}</span>
 </button>
 ))}
 </div>
 </div>
 <button
 onClick={() => {
 if (haptics) vibrate(10);
 wakeUp();
 setShowQualityPicker(false);
 }}
 className="w-full py-3 rounded-xl text-t-secondary text-sm font-medium"
 >
 Skip
 </button>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 );
}
