'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Zap, X, Bed, Sunrise } from 'lucide-react';
import { useDailyLog } from '@/lib/store/dailyLog';
import { useSleep } from '@/lib/store/sleep';
import { cn, formatHM, vibrate, dateKey, addDays } from '@/lib/utils';

interface Props { onClose: () => void; }

export function SleepLogSheet({ onClose }: Props) {
 const logToday = useDailyLog((s) => s.logToday);
 const [sleepHours, setSleepHours] = useState(7);
 const [energyLevel, setEnergyLevel] = useState(3);

 // Real sleep data from the new sleep store
 const sleepHistory = useSleep((s) => s.history);
 const avgHours = useSleep((s) => s.getAverageHours(7));

 // Build last 7 days view
 const last7Days = Array.from({ length: 7 }, (_, i) => {
 const d = addDays(new Date(), -(6 - i));
 const key = dateKey(d);
 const entries = sleepHistory.filter((e) => e.date === key);
 const totalSec = entries.reduce((sum, e) => sum + (e.durationSec || 0), 0);
 return {
 key,
 label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
 date: d.getDate(),
 hours: totalSec / 3600,
 entries,
 };
 });
 const maxHours = Math.max(...last7Days.map((d) => d.hours), 8);

 const handleSave = () => { vibrate([10, 30, 10]); logToday(sleepHours, energyLevel); onClose(); };

 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
 <div className="absolute inset-0 bg-black/85" />
 <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
 transition={{ type: 'spring', stiffness: 400, damping: 35 }} onClick={(e) => e.stopPropagation()}
 className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col">
 <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid var(--border)' }}>
 <div className="w-10 h-1 rounded-full mx-auto mb-3" />
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2"><Moon size={18} className="text-indigo-400" /><h2 className="text-lg font-bold">Sleep & Energy</h2></div>
 <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center "><X size={16} /></button>
 </div>
 </div>
 <div className="overflow-y-auto scroll-area px-5 py-5 space-y-6">
 {/* === Real sleep tracking summary === */}
 {sleepHistory.length > 0 && (
 <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4">
 <div className="flex items-center justify-between mb-3">
 <div>
 <div className="text-[10px] uppercase tracking-wide text-indigo-300/60 font-semibold">7-day average</div>
 <div className="text-2xl font-bold tabular text-indigo-300">{avgHours.toFixed(1)}h</div>
 </div>
 <div className="text-right">
 <div className="text-[10px] uppercase tracking-wide text-indigo-300/60 font-semibold">Tracked</div>
 <div className="text-2xl font-bold tabular text-indigo-300">{sleepHistory.length}</div>
 <div className="text-[9px] text-indigo-300/50">nights</div>
 </div>
 </div>
 {/* Last 7 days bar chart */}
 <div className="flex items-end justify-between gap-1.5 h-20 mt-2">
 {last7Days.map((d) => (
 <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
 <div className="text-[8px] tabular">{d.hours > 0 ? d.hours.toFixed(1) : '—'}</div>
 <div className="w-full flex-1 flex items-end">
 <div
 className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-purple-400 transition-all"
 style={{
 height: `${(d.hours / maxHours) * 100}%`,
 minHeight: d.hours > 0 ? '4px' : '2px',
 opacity: d.hours > 0 ? 1 : 0.2,
 }}
 />
 </div>
 <div className="text-[8px] font-semibold">{d.label}</div>
 </div>
 ))}
 </div>
 <p className="text-[10px] text-indigo-300/60 mt-2 text-center">
 Use the banner at the top of Home to track sleep automatically.
 </p>
 </div>
 )}

 {/* === Manual log (energy level only — sleep is auto-tracked now) === */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <label className="text-xs font-semibold flex items-center gap-1.5"><Zap size={12} /> Energy Level (now)</label>
 <span className="text-sm font-bold" style={{ color: energyLevel >= 4 ? '#22c55e' : energyLevel >= 3 ? '#f59e0b' : '#ef4444' }}>
 {['', 'Exhausted', 'Tired', 'Okay', 'Good', 'Energized'][energyLevel]}
 </span>
 </div>
 <div className="flex gap-2">
 {[1, 2, 3, 4, 5].map((lvl) => (
 <button key={lvl} onClick={() => { setEnergyLevel(lvl); vibrate(6); }}
 className="flex-1 py-4 rounded-xl flex flex-col items-center gap-1 transition"
 style={{
 background: energyLevel === lvl ? (lvl >= 4 ? 'rgba(34,197,94,0.2)' : lvl >= 3 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)',
 border: energyLevel === lvl ? `1.5px solid ${lvl >= 4 ? '#22c55e' : lvl >= 3 ? '#f59e0b' : '#ef4444'}` : '1px solid transparent',
 }}>
 <span className="text-lg">{'⚡'.repeat(lvl)}</span><span className="text-[8px] ">{lvl}</span>
 </button>
 ))}
 </div>
 </div>
 <div>
 <div className="flex items-center justify-between mb-3">
 <label className="text-xs font-semibold flex items-center gap-1.5"><Moon size={12} /> Manual sleep hours (backup)</label>
 <span className="text-2xl font-bold tabular text-indigo-400">{sleepHours}h</span>
 </div>
 <div className="flex gap-1.5">
 {[3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
 <button key={h} onClick={() => { setSleepHours(h); vibrate(6); }}
 className={cn('flex-1 py-2.5 rounded-lg text-xs font-bold transition', sleepHours === h ? 'bg-indigo-500 ' : ' ')}>{h}</button>
 ))}
 </div>
 </div>
 </div>
 <div className="sticky bottom-0 z-10 px-5 py-3 glass" style={{ borderTop: '1px solid var(--border)' }}>
 <button onClick={handleSave} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 font-bold text-sm active:scale-[0.98]">Save Log</button>
 </div>
 </motion.div>
 </motion.div>
 );
}
