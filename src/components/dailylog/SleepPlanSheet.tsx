'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sunrise, Sun, Coffee, BookOpen, Bed } from 'lucide-react';

interface SleepPlanSheetProps {
 open: boolean;
 onClose: () => void;
}

/**
 * SleepPlanSheet — shows the recommended sleep plan for NEET aspirants.
 *
 * Designed for long-term sustainable study (10-12 months of NEET prep):
 * - Fixed bedtime window 10:30–11:00 PM (sleep by 11 PM)
 * - Fixed wake window 5:30–6:00 AM (7–7.5h sleep)
 * - Optional 20-min power nap 2:00–2:30 PM (not after 3 PM)
 * - Pre-sleep wind-down 30 min before bed (no screens)
 * - Post-wake sunlight + water within 10 min
 *
 * Backed by sleep science: consistent timing > duration alone; late naps
 * destroy night sleep; morning sunlight anchors circadian rhythm.
 */
export function SleepPlanSheet({ open, onClose }: SleepPlanSheetProps) {
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
 <div className="absolute inset-0 bg-black/85" />
 <motion.div
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', stiffness: 400, damping: 35 }}
 onClick={(e) => e.stopPropagation()}
 className="relative w-full max-w-md max-h-[88vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8"
 >
 <div className="w-10 h-1 rounded-full mx-auto mb-4" />
 <button
 onClick={onClose}
 className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center hover: hover: transition"
 aria-label="Close"
 >
 <X size={16} />
 </button>

 {/* Header */}
 <div className="text-center mb-5">
 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
 <Moon size={28} className="text-indigo-300" />
 </div>
 <h2 className="text-lg font-bold">Sleep Plan for NEET</h2>
 <p className="text-[11px] mt-0.5">Sustainable rhythm · 7-7.5h night sleep</p>
 </div>

 {/* === Daily schedule timeline === */}
 <h3 className="text-xs font-bold uppercase tracking-wide mb-2">Recommended Daily Schedule</h3>
 <div className="space-y-2 mb-5">
 <ScheduleRow
 time="5:30 AM"
 title="Wake Up"
 desc="Open curtains → sunlight within 10 min · drink 1 glass water"
 icon={<Sunrise size={14} className="text-amber-400" />}
 accent="#f59e0b"
 />
 <ScheduleRow
 time="6:00 AM"
 title="Morning Study Block"
 desc="Hardest subject first (brain is freshest) · 90 min focus"
 icon={<BookOpen size={14} className="text-teal-400" />}
 accent="#14b8a6"
 />
 <ScheduleRow
 time="2:00 PM"
 title="Power Nap (optional)"
 desc="20 min max · before 3 PM only · longer naps destroy night sleep"
 icon={<Bed size={14} className="text-indigo-400" />}
 accent="#6366f1"
 />
 <ScheduleRow
 time="10:00 PM"
 title="Wind Down"
 desc="Stop screens · dim lights · light reading / relaxing music"
 icon={<Coffee size={14} className="text-orange-400" />}
 accent="#f97316"
 />
 <ScheduleRow
 time="10:30 PM"
 title="Bedtime"
 desc="Lights out · cool dark room · no phone in bed"
 icon={<Moon size={14} className="text-indigo-300" />}
 accent="#818cf8"
 />
 </div>

 {/* === The 4 rules === */}
 <h3 className="text-xs font-bold uppercase tracking-wide mb-2">The 4 Rules</h3>
 <div className="space-y-2 mb-5">
 <RuleCard
 num="1"
 title="Fixed wake time, every day"
 body="Wake at 5:30 AM even on weekends. This anchors your circadian rhythm more than bedtime does. Within 2 weeks, you'll naturally get sleepy at 10:30 PM."
 />
 <RuleCard
 num="2"
 title="No screens 30 min before bed"
 body="Blue light suppresses melatonin. Read a physical book or listen to calm music instead. Phone goes on the desk, not the bed."
 />
 <RuleCard
 num="3"
 title="Naps only 2-3 PM, max 20 min"
 body="Naps after 3 PM steal from night sleep. Set an alarm — sleeping 30+ min enters deep sleep and you wake groggy (sleep inertia)."
 />
 <RuleCard
 num="4"
 title="Caffeine cutoff 2 PM"
 body="Coffee/tea after 2 PM stays in your system till 10 PM. If you need caffeine to survive afternoon study, your night sleep is already broken."
 />
 </div>

 {/* === Why this works === */}
 <div className="rounded-xl p-3 bg-indigo-500/10 border border-indigo-500/20 mb-4">
 <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-300 mb-1.5">Why 7-7.5h?</h3>
 <p className="text-[11px] leading-relaxed">
 NEET aspirants need <strong>memory consolidation</strong> — which happens during REM + deep sleep.
 Less than 6h cuts REM by 40% (you forget what you studied). More than 9h causes sleep inertia + reduces study hours.
 7-7.5h is the sweet spot for memory + energy + study time.
 </p>
 </div>

 <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20">
 <h3 className="text-xs font-bold uppercase tracking-wide text-amber-300 mb-1.5">⚠ Late Night Trap</h3>
 <p className="text-[11px] leading-relaxed">
 Studying till 2 AM feels productive but you retain 60% less (tired brain doesn't form memories).
 The 2 hours after 11 PM are worth <strong>less than 1 hour of morning study</strong>.
 Sleep on time — the morning version of you learns faster.
 </p>
 </div>

 <p className="text-[9px] text-center mt-4">
 Based on sleep science · AIMS NEET prep guidelines · Tap outside to close
 </p>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
}

function ScheduleRow({
 time,
 title,
 desc,
 icon,
 accent,
}: {
 time: string;
 title: string;
 desc: string;
 icon: React.ReactNode;
 accent: string;
}) {
 return (
 <div
 className="glass rounded-xl p-2.5 flex items-center gap-3"
 style={{ borderLeft: `3px solid ${accent}` }}
 >
 <div className="text-[10px] font-bold tabular w-16 shrink-0" style={{ color: accent }}>
 {time}
 </div>
 <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}22` }}>
 {icon}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-xs font-semibold">{title}</div>
 <div className="text-[10px] leading-tight">{desc}</div>
 </div>
 </div>
 );
}

function RuleCard({ num, title, body }: { num: string; title: string; body: string }) {
 return (
 <div className="glass rounded-xl p-3 flex gap-3">
 <div className="w-6 h-6 rounded-full bg-indigo-500/25 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
 {num}
 </div>
 <div className="flex-1">
 <div className="text-xs font-semibold mb-0.5">{title}</div>
 <div className="text-[10px] leading-relaxed">{body}</div>
 </div>
 </div>
 );
}
