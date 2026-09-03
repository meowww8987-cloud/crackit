'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Star } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import { classifySleep, verdictColor } from '@/lib/sleepHealth';
import { formatHM } from '@/lib/utils';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';
import { SleepAnalysisSheet } from './SleepAnalysisSheet';

interface SleepHistorySheetProps {
 open: boolean;
 onClose: () => void;
}

/**
 * SleepHistorySheet — scrollable list of all past sleep entries.
 *
 * VISUAL IDENTITY: distinct from Test History sheet.
 * - Dark indigo/night-sky theme (Test History uses default glass)
 * - Moon icon header (Test History uses Trophy)
 * - Indigo accent color throughout
 * - "Sleep History" title with indigo glow
 * - Night-sky gradient header with twinkling stars
 * - Each entry has indigo border + sleep-type emoji
 */
export function SleepHistorySheet({ open, onClose }: SleepHistorySheetProps) {
 const history = useSleep((s) => s.history);
 const [showAnalysis, setShowAnalysis] = useState(false);
 const [analysisTab, setAnalysisTab] = useState<'weekly' | 'monthly'>('weekly');
 // === HEAT FIX: Gate animations when tab hidden ===
 const isVisible = useVisibility();
 const reduceMotion = useReducedMotion();
 const animate = isVisible && !reduceMotion;

 // Group by date
 const grouped = useMemo(() => {
 const map: Record<string, typeof history> = {};
 for (const e of history) {
 if (!map[e.date]) map[e.date] = [];
 map[e.date].push(e);
 }
 return map;
 }, [history]);

 const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

 return (
 <AnimatePresence>
 {open && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[100] flex items-end justify-center"
 onClick={onClose}
 >
 <div className="absolute inset-0 bg-black/90" />
 <motion.div
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', stiffness: 400, damping: 35 }}
 onClick={(e) => e.stopPropagation()}
 className="relative w-full max-w-md max-h-[88vh] overflow-y-auto force-dark-ui"
 style={{
 background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1235 40%, #0a0e27 100%)',
 borderTopLeftRadius: 24,
 borderTopRightRadius: 24,
 border: '1px solid rgba(99,102,241,0.3)',
 borderBottom: 'none',
 }}
 >
 {/* === Night-sky header === */}
 <div
 className="relative p-5 pb-4 overflow-hidden"
 style={{
 background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 50%, rgba(168,85,247,0.08) 100%)',
 borderBottom: '1px solid rgba(99,102,241,0.2)',
 }}
 >
 {/* Twinkling stars */}
 {Array.from({ length: 10 }).map((_, i) => (
 <motion.div
 key={i}
 className="absolute rounded-full bg-white"
 style={{
 left: `${10 + (i * 8) % 80}%`,
 top: `${15 + (i * 11) % 50}%`,
 width: 1 + (i % 3),
 height: 1 + (i % 3),
 }}
 animate={{ opacity: [0.2, 0.8, 0.2] }}
 transition={{ duration: 2 + (i % 3), repeat: animate ? Infinity : 0, delay: i * 0.3 }}
 />
 ))}

 <div className="relative flex items-center justify-between mb-3">
 <div className="w-10 h-1 rounded-full" />
 <button
 onClick={onClose}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover: hover: transition"
 aria-label="Close"
 >
 <X size={16} />
 </button>
 </div>

 <div className="relative flex items-center gap-3">
 <motion.div
 animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
 transition={{ duration: 4, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
 className="text-4xl"
 style={{ filter: 'drop-shadow(0 0 20px rgba(165,180,252,0.6))' }}
 >
 🌙
 </motion.div>
 <div>
 <h2 className="text-lg font-bold ">Sleep History</h2>
 <p className="text-[11px] text-indigo-200/60">{history.length} entries logged</p>
 </div>
 </div>
 </div>

 <div className="p-4 space-y-3">
 {/* Quick analysis buttons */}
 <div className="flex gap-2">
 <button
 onClick={() => { setAnalysisTab('weekly'); setShowAnalysis(true); }}
 className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-200 text-xs font-semibold active:scale-95 transition border border-indigo-500/30"
 >
 📊 Weekly Report
 </button>
 <button
 onClick={() => { setAnalysisTab('monthly'); setShowAnalysis(true); }}
 className="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-200 text-xs font-semibold active:scale-95 transition border border-purple-500/30"
 >
 📈 Monthly Report
 </button>
 </div>

 {/* === Sleep entries grouped by date === */}
 {history.length === 0 ? (
 <div className="text-center py-12">
 <Moon size={40} className="text-indigo-300/30 mx-auto mb-3" />
 <p className="text-indigo-200/50 text-sm">No sleep entries yet.</p>
 <p className="text-indigo-200/30 text-[10px] mt-1">Tap the NEET logo on Home to start sleep mode.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {dates.map((date) => {
 const entries = grouped[date];
 const d = new Date(date + 'T00:00:00');
 return (
 <div key={date}>
 <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-200/40 mb-1.5 px-1">
 {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
 </div>
 <div className="space-y-1.5">
 {entries.map((entry) => {
 const dur = entry.durationSec || 0;
 const analysis = classifySleep(entry.bedTime, dur);
 const bedDate = new Date(entry.bedTime);
 const wakeDate = entry.wakeTime ? new Date(entry.wakeTime) : null;
 return (
 <div
 key={entry.id}
 className="rounded-xl p-2.5 flex items-center gap-3 select-none"
 style={{
 background: 'rgba(99,102,241,0.08)',
 border: '1px solid rgba(99,102,241,0.15)',
 borderLeft: `3px solid ${verdictColor(analysis.verdict)}`,
 }}
 >
 <div className="text-2xl shrink-0">{analysis.emoji}</div>
 <div className="flex-1 min-w-0">
 <div className="text-xs font-semibold truncate">{analysis.label}</div>
 <div className="text-[10px] text-indigo-200/50">
 {bedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
 {wakeDate && (
 <> → {wakeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
 )}
 </div>
 </div>
 <div className="text-right shrink-0">
 <div className="text-sm font-bold tabular text-indigo-300">{formatHM(dur)}</div>
 {entry.quality != null && (
 <div className="flex items-center gap-0.5 justify-end mt-0.5">
 {[1, 2, 3, 4, 5].map((s) => (
 <Star
 key={s}
 size={8}
 className={s <= entry.quality! ? 'text-amber-400 fill-amber-400' : ''}
 />
 ))}
 </div>
 )}
 </div>
 <div
 className="text-sm font-bold tabular shrink-0 w-7 text-center"
 style={{ color: verdictColor(analysis.verdict) }}
 >
 {analysis.score}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}

 <p className="text-[9px] text-indigo-200/30 text-center pt-2">
 🌙 Sleep History · Tap "Weekly Report" or "Monthly Report" above for detailed analysis
 </p>
 </div>
 </motion.div>
 </motion.div>
 )}

 {/* Sleep Analysis Sheet (opened from quick buttons) */}
 <SleepAnalysisSheet
 open={showAnalysis}
 onClose={() => setShowAnalysis(false)}
 initialTab={analysisTab}
 />
 </AnimatePresence>
 );
}
