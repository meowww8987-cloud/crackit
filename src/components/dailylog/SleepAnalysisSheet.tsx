'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, TrendingUp, Sparkles, CheckCircle2, AlertTriangle, Target, Trophy, Frown, Star, Clock, Bed } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import { useHistory } from '@/lib/store/history';
import {
 buildSleepInsightReport,
 buildStudySleepCorrelation,
 verdictLabel,
 verdictColor,
 formatHour,
 formatSleepDuration,
 type SleepInsightReport,
} from '@/lib/sleepHealth';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';

interface SleepAnalysisSheetProps {
 open: boolean;
 onClose: () => void;
 /** Initial tab — 'weekly' or 'monthly'. */
 initialTab?: 'weekly' | 'monthly';
}

/**
 * SleepAnalysisSheet — sleep health report with Weekly + Monthly tabs.
 *
 * VISUAL IDENTITY: distinct from study Weekly/Monthly Report.
 * - Dark indigo/night-sky theme (not teal/purple like study reports)
 * - Moon icon header (not chart icon)
 * - Indigo accent color throughout
 * - "Sleep Analysis" title (not "Weekly Report")
 * - Night-sky gradient header background
 * - Different card style (rounded with indigo borders, not teal)
 */
export function SleepAnalysisSheet({ open, onClose, initialTab = 'weekly' }: SleepAnalysisSheetProps) {
 const history = useSleep((s) => s.history);
 const [tab, setTab] = useState<'weekly' | 'monthly'>(initialTab);
 // === HEAT FIX: Gate animations when tab hidden ===
 const isVisible = useVisibility();
 const reduceMotion = useReducedMotion();
 const animate = isVisible && !reduceMotion;

 const weeklyReport = useMemo(() => buildSleepInsightReport(history, 7), [history]);
 const monthlyReport = useMemo(() => buildSleepInsightReport(history, 30), [history]);
 const report = tab === 'weekly' ? weeklyReport : monthlyReport;
 const studySessions = useHistory((s) => s.sessions);
 const correlation = useMemo(() => {
 const days = tab === 'weekly' ? 7 : 30;
 return buildStudySleepCorrelation(history, studySessions, days);
 }, [history, studySessions, tab]);

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
 className="relative w-full max-w-md max-h-[90vh] overflow-y-auto force-dark-ui"
 style={{
 background: 'linear-gradient(180deg, #0f0a1e 0%, #1a1235 40%, #0a0e27 100%)',
 borderTopLeftRadius: 24,
 borderTopRightRadius: 24,
 border: '1px solid rgba(99,102,241,0.3)',
 borderBottom: 'none',
 }}
 >
 {/* === Night-sky header (distinct from study reports) === */}
 <div
 className="relative p-5 pb-4 overflow-hidden"
 style={{
 background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 50%, rgba(168,85,247,0.08) 100%)',
 borderBottom: '1px solid rgba(99,102,241,0.2)',
 }}
 >
 {/* Twinkling stars in header */}
 {Array.from({ length: 12 }).map((_, i) => (
 <motion.div
 key={i}
 className="absolute rounded-full bg-white"
 style={{
 left: `${10 + (i * 7) % 80}%`,
 top: `${15 + (i * 13) % 60}%`,
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
 <h2 className="text-lg font-bold ">Sleep Analysis</h2>
 <p className="text-[11px] text-indigo-200/60">Health report · advantages · improvements</p>
 </div>
 </div>
 </div>

 <div className="p-4 space-y-3">
 {/* === Tab switcher — indigo theme (distinct from study report's teal) === */}
 <div className="flex gap-1 p-1 rounded-xl bg-indigo-950/50 border border-indigo-500/20">
 {(['weekly', 'monthly'] as const).map((t) => (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
 tab === t
 ? 'bg-indigo-500/40 text-indigo-100 shadow-lg'
 : 'text-indigo-300/50'
 }`}
 style={tab === t ? { boxShadow: '0 2px 8px rgba(99,102,241,0.3)' } : {}}
 >
 {t === 'weekly' ? '📅 Last 7 Days' : '📊 Last 30 Days'}
 </button>
 ))}
 </div>

 {/* === Health Score Card — indigo theme === */}
 <div
 className="rounded-2xl p-4 border relative overflow-hidden"
 style={{
 background: `linear-gradient(135deg, ${verdictColor(report.verdict)}22, rgba(99,102,241,0.08))`,
 borderColor: `${verdictColor(report.verdict)}50`,
 }}
 >
 <div className="flex items-center justify-between mb-2">
 <div>
 <div className="text-[10px] uppercase tracking-wide text-indigo-200/60 font-semibold">Sleep Health Score</div>
 <div className="text-4xl font-bold tabular" style={{ color: verdictColor(report.verdict) }}>
 {report.healthScore}
 <span className="text-base font-normal">/100</span>
 </div>
 </div>
 <div className="text-right">
 <div className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${verdictColor(report.verdict)}22`, color: verdictColor(report.verdict) }}>
 {verdictLabel(report.verdict)}
 </div>
 <div className="text-[9px] text-indigo-200/40 mt-1">{report.periodLabel}</div>
 </div>
 </div>
 <div className="h-2 rounded-full bg-black/40 overflow-hidden">
 <motion.div
 initial={{ width: 0 }}
 animate={{ width: `${report.healthScore}%` }}
 transition={{ duration: 0.8, ease: 'easeOut' }}
 className="h-full rounded-full"
 style={{ background: verdictColor(report.verdict) }}
 />
 </div>
 <div className="flex justify-between mt-3 text-[10px] text-indigo-200/50">
 <span>{report.nightsAnalyzed} nights · {report.napsAnalyzed} naps</span>
 <span>{report.totalHours.toFixed(1)}h total</span>
 </div>
 </div>

 {/* === Stats grid — indigo theme === */}
 <div className="grid grid-cols-2 gap-2">
 <SleepStatTile icon={<Clock size={14} />} label="Avg Duration" value={report.avgNightHours > 0 ? `${report.avgNightHours.toFixed(1)}h` : '—'} hint="target 7-9h" />
 <SleepStatTile icon={<Bed size={14} />} label="Avg Bedtime" value={report.avgBedtime > 0 ? formatHour(report.avgBedtime) : '—'} hint="ideal 10-11:30 PM" />
 <SleepStatTile icon={<TrendingUp size={14} />} label="Consistency" value={`${report.bedtimeConsistency}%`} hint="bedtime regularity" />
 <SleepStatTile icon={<Star size={14} />} label="Avg Quality" value={report.avgQuality > 0 ? `${report.avgQuality.toFixed(1)}/5` : '—'} hint="your rating" />
 </div>

 {/* === Best + Worst night === */}
 {report.bestNight && report.worstNight && report.bestNight.date !== report.worstNight.date && (
 <div className="grid grid-cols-2 gap-2">
 <NightHighlight icon={<Trophy size={12} />} label="Best Night" entry={report.bestNight} color="#22c55e" />
 <NightHighlight icon={<Frown size={12} />} label="Worst Night" entry={report.worstNight} color="#ef4444" />
 </div>
 )}

 {/* === Advantages === */}
 <SleepSection icon={<CheckCircle2 size={12} />} title="What's Going Well" color="#22c55e" items={report.advantages} />

 {/* === Disadvantages === */}
 <SleepSection icon={<AlertTriangle size={12} />} title="What Needs Work" color="#f59e0b" items={report.disadvantages} />

 {/* === Improvements === */}
 <SleepSection icon={<Target size={12} />} title="What to Improve" color="#818cf8" items={report.improvements} />

 {/* === Study Impact (Study-Sleep Correlation) === */}
 {correlation && correlation.insights.length > 0 && (
 <div className="mb-3">
 <h3 className="text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color: '#C9A961' }}>
 📊 Study Impact on Sleep
 </h3>
 <div className="space-y-1.5">
 {correlation.insights.map((item, i) => (
 <div
 key={i}
 className="rounded-xl p-2.5 text-xs flex items-start gap-2"
 style={{
 background: 'rgba(201, 169, 97, 0.08)',
 borderLeft: '2px solid rgba(201, 169, 97, 0.4)',
 }}
 >
 <span style={{ color: '#C9A961' }} className="mt-0.5">•</span>
 <span className="flex-1 text-indigo-100/80">{item}</span>
 </div>
 ))}
 </div>
 {/* Mini comparison stats */}
 {correlation.lateStudyNights > 0 && correlation.earlyNights > 0 && (
 <div className="grid grid-cols-2 gap-2 mt-2">
 <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
 <div className="text-[9px] text-red-300/60 uppercase">Late Study Nights</div>
 <div className="text-sm font-bold text-red-300 tabular">{correlation.lateStudyNights}</div>
 <div className="text-[9px] ">
 {correlation.lateStudyQuality > 0 ? `Q: ${correlation.lateStudyQuality.toFixed(1)}/5` : 'No ratings'} · {correlation.lateStudyDuration.toFixed(1)}h
 </div>
 </div>
 <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(34, 197, 94, 0.08)' }}>
 <div className="text-[9px] text-green-300/60 uppercase">Early Nights</div>
 <div className="text-sm font-bold text-green-300 tabular">{correlation.earlyNights}</div>
 <div className="text-[9px] ">
 {correlation.earlyQuality > 0 ? `Q: ${correlation.earlyQuality.toFixed(1)}/5` : 'No ratings'} · {correlation.earlyDuration.toFixed(1)}h
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 <p className="text-[9px] text-indigo-200/30 text-center pt-2">
 🌙 Sleep Analysis · Tap outside to close
 </p>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
}

function SleepStatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
 return (
 <div
 className="rounded-xl p-2.5"
 style={{
 background: 'rgba(99,102,241,0.08)',
 border: '1px solid rgba(99,102,241,0.15)',
 }}
 >
 <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-indigo-200/50 font-semibold mb-1">
 {icon} {label}
 </div>
 <div className="text-base font-bold tabular ">{value}</div>
 <div className="text-[9px] text-indigo-200/40 mt-0.5">{hint}</div>
 </div>
 );
}

function NightHighlight({
 icon,
 label,
 entry,
 color,
}: {
 icon: React.ReactNode;
 label: string;
 entry: import('@/lib/sleepHealth').SleepNightEntry;
 color: string;
}) {
 const d = new Date(entry.bedTime);
 return (
 <div
 className="rounded-xl p-2.5"
 style={{
 background: 'rgba(99,102,241,0.08)',
 border: `1px solid rgba(99,102,241,0.15)`,
 borderLeft: `3px solid ${color}`,
 }}
 >
 <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color }}>
 {icon} {label}
 </div>
 <div className="text-xs font-semibold ">
 {entry.emoji} {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
 </div>
 <div className="text-[10px] text-indigo-200/50">
 {formatSleepDuration(entry.durationSec)} · score {entry.score}
 </div>
 </div>
 );
}

function SleepSection({
 icon,
 title,
 color,
 items,
}: {
 icon: React.ReactNode;
 title: string;
 color: string;
 items: string[];
}) {
 return (
 <div>
 <h3 className="text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color }}>
 {icon} {title}
 </h3>
 <div className="space-y-1.5">
 {items.map((item, i) => (
 <div
 key={i}
 className="rounded-xl p-2.5 text-xs flex items-start gap-2"
 style={{
 background: `${color}0D`,
 borderLeft: `2px solid ${color}66`,
 }}
 >
 <span style={{ color }} className="mt-0.5">•</span>
 <span className="flex-1 text-indigo-100/80">{item}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
