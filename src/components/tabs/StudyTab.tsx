'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Target as TargetIcon, Sparkles, X, Check, GripVertical, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { useTargets } from '@/lib/store/targets';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { usePractice } from '@/lib/store/practice';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { generateSmartPlan } from '@/lib/smartPlan';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, shortDate, formatHM, todayKey, isToday, addDays, vibrate } from '@/lib/utils';
import { TargetCard } from '@/components/study/TargetCard';
import { AddTargetSheet } from '@/components/study/AddTargetSheet';
import { DetailSheet } from '@/components/study/DetailSheet';
import { LiquidProgress } from '@/components/shared/LiquidProgress';
import { WaveformProgress } from '@/components/shared/WaveformProgress';
import { DoubtSheet } from '@/components/doubts/DoubtSheet';
import { useDoubts } from '@/lib/store/doubts';

const EMPTY_TARGETS: Target[] = [];

export function StudyTab() {
 const todayKeyStr = todayKey();
 const todayTargets = useTargets((s) => s.byDate[todayKeyStr] || EMPTY_TARGETS);
 const reorderToday = useTargets((s) => s.reorderToday);
 const [showAdd, setShowAdd] = useState(false);
 const [editingTarget, setEditingTarget] = useState<Target | null>(null);
 const [detailTarget, setDetailTarget] = useState<Target | null>(null);
 const [showDoubts, setShowDoubts] = useState(false);
 const pendingDoubts = useDoubts((s) => s.getPendingCount());
 // Floating widget visibility — eye button in Study tab header
 const widgetHidden = useSession((s) => s.widgetHidden);
 const setWidgetHidden = useSession((s) => s.setWidgetHidden);
 const activeSession = useSession((s) => s.active);

 const sortedTargets = useMemo(
 () => [...todayTargets].sort((a, b) => a.order - b.order),
 [todayTargets]
 );

 // Group by SUBJECT first, then CHAPTER within each subject
 const subjectGroups = useMemo(() => {
 const subjMap = new Map<Subject, {
 subject: Subject;
 chapters: Map<string, { chapter: string; items: Target[] }>;
 }>();

 for (const t of sortedTargets) {
 if (!subjMap.has(t.subject)) {
 subjMap.set(t.subject, { subject: t.subject, chapters: new Map() });
 }
 const subj = subjMap.get(t.subject)!;
 if (!subj.chapters.has(t.chapter)) {
 subj.chapters.set(t.chapter, { chapter: t.chapter, items: [] });
 }
 subj.chapters.get(t.chapter)!.items.push(t);
 }

 return Array.from(subjMap.values());
 }, [sortedTargets]);

 const doneCount = sortedTargets.filter((t) => t.done).length;
 const expectedTotalMin = sortedTargets.reduce((acc, t) => acc + t.expectedMinutes, 0);
 // Saved today study seconds + LIVE time from any running focus session or
 // practice session. Practice time IS study time — it must show in the ring
 // immediately, not just after End.
 const savedStudySecToday = useHistory((s) => s.getTodayStudySeconds());
 const activeFocusSession = useSession((s) => s.active);
 const activePractice = usePractice((s) => s.activePractice);
 // 1s re-render tick while a live session is running.
 const [, setLiveTick] = useState(0);
 useEffect(() => {
 if (!activeFocusSession && !activePractice) return;
 const i = setInterval(() => setLiveTick((t) => t + 1), 1000);
 return () => clearInterval(i);
 }, [activeFocusSession, activePractice]);
 const liveFocus = (activeFocusSession && (activeFocusSession as any).date === todayKey()) ? getLiveStudySeconds(activeFocusSession) : 0;
 const livePractice = activePractice
 ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
 : 0;
 const studySecToday = savedStudySecToday + liveFocus + livePractice;
 const dailyGoal = useSettings((s) => s.dailyGoalHours);
 const goalSec = dailyGoal * 3600;
 const progressPct = goalSec > 0 ? Math.min(100, Math.round((studySecToday / goalSec) * 100)) : 0;

 // Past 6 days overview
 const pastDays = useMemo(() => {
 const result = [];
 for (let i = 1; i <= 6; i++) {
 const d = addDays(new Date(), -i);
 const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 const list = useTargets.getState().byDate[key] || [];
 if (list.length === 0) continue;
 const done = list.filter((t) => t.done).length;
 const sessions = useHistory.getState().getSessionsForDate(key);
 const studySec = sessions.reduce((a, s) => a + s.studySeconds, 0);
 const wastedSec = sessions.reduce((a, s) => a + s.wastedSeconds, 0);
 result.push({ date: d, key, done, total: list.length, studySec, wastedSec });
 }
 return result;
 }, [todayTargets]);

 const hasSmartPlan = sortedTargets.length === 0;

 // Prevent hydration mismatch: only show SmartPlan after client mount
 const [mounted, setMounted] = useState(false);
 useEffect(() => {
 const t = setTimeout(() => setMounted(true), 0);
 return () => clearTimeout(t);
 }, []);

 return (
 <div className="pt-2 pb-4 space-y-4">
 {/* Compact header */}
 <div className="flex items-center justify-between text-sm">
 <div  suppressHydrationWarning>{shortDate()}</div>
 <div className="flex items-center gap-2">
 <span className="font-semibold" style={{ color: "var(--foreground)" }}>Study</span>
 <span className=" tabular" suppressHydrationWarning>
 {formatHM(studySecToday)} / {Math.floor(expectedTotalMin / 60)}h {expectedTotalMin % 60}m
 </span>
 </div>
 <div className="flex items-center gap-2">
 <div className=" tabular" suppressHydrationWarning>
 Done <span className=" font-semibold">{doneCount}</span>/{sortedTargets.length}
 </div>
 {/* Eye button — toggle floating widget visibility (only on Study tab) */}
 {activeSession && (
 <button
 onClick={() => { vibrate(10); setWidgetHidden(!widgetHidden); }}
 className="w-8 h-8 rounded-lg glass flex items-center justify-center hover: transition active:scale-95"
 aria-label={widgetHidden ? 'Show floating widget' : 'Hide floating widget'}
 title={widgetHidden ? 'Show widget' : 'Hide widget'}
 >
 {widgetHidden ? <EyeOff size={15} /> : <Eye size={15} />}
 </button>
 )}
 </div>
 </div>

 {/* Today's Progress Card — compact, waveform inline */}
 <div className="glass rounded-2xl p-3">
 <div className="flex items-center gap-3">
 {/* Waveform — inline, fills remaining space */}
 <div className="flex-1 min-w-0">
 <WaveformProgress
 pct={progressPct}
 color="#14b8a6"
 color2="#22c55e"
 height="h-6"
 />
 </div>
 {/* Percentage + time — right side, compact */}
 <div className="text-right shrink-0">
 <motion.span
 key={progressPct}
 initial={{ scale: 0.9, opacity: 0.5 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ type: 'spring', stiffness: 200, damping: 15 }}
 className="text-lg font-bold tabular block"
 style={{
 background: progressPct >= 100
 ? 'linear-gradient(135deg, #22c55e, #16a34a)'
 : 'linear-gradient(135deg, #14b8a6, #22c55e)',
 WebkitBackgroundClip: 'text',
 WebkitTextFillColor: 'transparent',
 backgroundClip: 'text',
 }}
 suppressHydrationWarning
 >
 {progressPct}%
 </motion.span>
 <span className="text-[10px] tabular" suppressHydrationWarning style={{ color: "var(--muted-foreground)" }}>
 {formatHM(studySecToday)}/{dailyGoal}h
 </span>
 </div>
 </div>
 </div>

 {/* Smart Plan prompt */}
 {hasSmartPlan && mounted && <SmartPlan />}

 {/* Target cards — grouped by SUBJECT, then CHAPTER within each subject.
 Gated behind `mounted` because subjectGroups derives from persisted
 targets store (empty on server, populated on client after hydration).
 Rendering without the gate shifts the position of every element
 after this point → hydration mismatch. */}
 {mounted && subjectGroups.length > 0 && (
 <div className="space-y-4">
 {subjectGroups.map((subjGroup) => {
 const color = subjectColor(subjGroup.subject);
 const allItems = Array.from(subjGroup.chapters.values()).flatMap(ch => ch.items);
 const subjDone = allItems.filter((t) => t.done).length;
 const subjExpected = allItems.reduce((a, t) => a + t.expectedMinutes, 0);
 const subjStudied = allItems.reduce((a, t) => {
 const secs = useHistory.getState().getSessionsForTargetToday(t.id).reduce((x, s) => x + s.studySeconds, 0);
 return a + secs;
 }, 0);
 const subjPct = subjExpected > 0 ? Math.min(100, Math.round((subjStudied / 60 / subjExpected) * 100)) : 0;

 return (
 <div
 key={subjGroup.subject}
 className="card-solid rounded-2xl p-3 space-y-3"
 style={{
 // Subject color shows via the strong colored border (50% opacity)
 // + a child .card-tint overlay (below) — base stays solid dark
 // for text readability.
 borderColor: `${color.hex}80`,
 }}
 >
 {/* Subject color tint overlay */}
 <div
 className="card-tint"
 style={{
 background: `linear-gradient(180deg, ${color.hex}26, ${color.hex}12)`,
 }}
 />
 {/* Content wrapper — sits above the .card-tint overlay */}
 <div className="relative space-y-3">
 {/* Subject header */}
 <div className="flex items-center gap-2 px-1">
 <div className="w-4 h-4 rounded" style={{ background: color.hex }} />
 <span className="text-sm font-bold uppercase tracking-wide" style={{ color: color.hex }}>
 {subjGroup.subject}
 </span>
 <span className="text-xs ml-auto tabular">
 {subjDone}/{allItems.length} done · {formatHM(subjStudied)}
 </span>
 </div>
 {/* Subject progress bar */}
 <div className="h-1 rounded-full overflow-hidden">
 <div
 className="h-full rounded-full transition-all duration-500"
 style={{ width: `${subjPct}%`, background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)` }}
 />
 </div>

 {/* Chapter sub-groups within this subject */}
 {Array.from(subjGroup.chapters.values()).map((chGroup) => {
 const chDone = chGroup.items.filter((t) => t.done).length;
 const isMulti = chGroup.items.length > 1;
 return (
 <div key={chGroup.chapter} className="space-y-2">
 {/* Chapter sub-header — shows "N cards" badge when this
 chapter has multiple targets (sister cards) */}
 <div className="flex items-center gap-1.5 px-1 pt-1">
 <div className="w-1 h-3 rounded-full" style={{ background: `${color.hex}80` }} />
 <span className="text-[11px] font-semibold truncate">{chGroup.chapter}</span>
 {isMulti && (
 <span
 className="text-[8px] font-bold px-1.5 py-0.5 rounded-full tabular"
 style={{ background: `${color.hex}20`, color: color.hex }}
 >
 {chGroup.items.length} cards
 </span>
 )}
 <span className="text-[9px] tabular ml-auto">
 {chDone}/{chGroup.items.length} done
 </span>
 </div>

 {/* Reorder within this chapter */}
 <Reorder.Group axis="y" values={chGroup.items} onReorder={(newOrder) => {
 const reorderedIds = newOrder.map(t => t.id);
 const fullList = [...sortedTargets];
 const result: Target[] = [];
 let groupIdx = 0;
 for (const t of fullList) {
 if (reorderedIds.includes(t.id)) {
 result.push(newOrder[groupIdx]);
 groupIdx++;
 } else {
 result.push(t);
 }
 }
 reorderToday(result);
 }} className="space-y-2" layoutScroll as="div">
 {chGroup.items.map((t, idx) => (
 <TargetCard
 key={t.id}
 target={t}
 onOpenDetail={() => setDetailTarget(t)}
 onEdit={() => { setEditingTarget(t); setShowAdd(true); }}
 indexInChapter={idx + 1}
 chapterTotal={chGroup.items.length}
 hasSiblings={chGroup.items.length > 1}
 />
 ))}
 </Reorder.Group>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Empty state — also gated because it depends on sortedTargets.length
 which is 0 on server but may be >0 on client (inverted conditional). */}
 {mounted && sortedTargets.length === 0 && !hasSmartPlan && (
 <div className="glass rounded-2xl p-8 text-center">
 <TargetIcon size={40} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
 <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No targets yet. Tap + to add your first study target.</p>
 </div>
 )}

 {/* Add button */}
 <button
 onClick={() => { setEditingTarget(null); setShowAdd(true); }}
 className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 hover: hover: transition active:scale-[0.98]"
 >
 <Plus size={18} />
 <span className="font-semibold">Add Target</span>
 </button>

 {/* Past 6 days — gated because pastDays derives from persisted sessions
 store (empty on server, populated on client). This was the actual
 source of the hydration error: when pastDays populated on the client,
 a <div className="space-y-2"> appeared between the Add button and the
 Doubt button, shifting the Doubt button's position. */}
 {mounted && pastDays.length > 0 && (
 <div className="space-y-2">
 <h3 className="text-xs font-bold uppercase tracking-wide px-1">Past 6 Days</h3>
 <div className="space-y-1.5">
 {pastDays.map((d) => (
 <div key={d.key} className="glass rounded-xl p-3 flex items-center gap-3">
 <div className="text-center min-w-[42px]">
 <div className="text-[10px] uppercase">
 {d.date.toLocaleDateString('en-US', { weekday: 'short' })}
 </div>
 <div className="text-lg font-bold tabular" style={{ color: "var(--foreground)" }}>{d.date.getDate()}</div>
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-xs ">
 <span className=" font-semibold tabular">{d.done}</span>/{d.total} done
 </div>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-xs tabular" style={{ color: "#16a34a" }}>▶ {formatHM(d.studySec)}</span>
 {d.wastedSec > 0 && (
 <span className="text-xs tabular" style={{ color: "#dc2626" }}>⚠ {formatHM(d.wastedSec)}</span>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Sheets */}
 {showAdd && (
 <AddTargetSheet
 editing={editingTarget}
 onClose={() => { setShowAdd(false); setEditingTarget(null); }}
 />
 )}
 {detailTarget && (
 <DetailSheet
 target={detailTarget}
 onClose={() => setDetailTarget(null)}
 onEdit={() => { setEditingTarget(detailTarget); setDetailTarget(null); setShowAdd(true); }}
 />
 )}

 {/* Floating Doubt Button */}
 <button
 onClick={() => { setShowDoubts(true); vibrate(10); }}
 className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-xl flex items-center justify-center active:scale-90 transition"
 aria-label="Doubt Tracker"
 >
 <HelpCircle size={22} />
 {/* Badge count is gated behind `mounted` to prevent SSR hydration
 mismatch — pendingDoubts is 0 on server but may be >0 on client
 after Zustand rehydrates from localStorage. */}
 {mounted && pendingDoubts > 0 && (
 <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
 {pendingDoubts}
 </span>
 )}
 </button>

 <AnimatePresence>
 {showDoubts && <DoubtSheet key="doubts" onClose={() => setShowDoubts(false)} />}
 </AnimatePresence>
 </div>
 );
}

// ===== Smart Plan =====
function SmartPlan() {
 const addTarget = useTargets((s) => s.addTarget);
 const [dismissed, setDismissed] = useState(false);
 const sessions = useHistory((s) => s.sessions);
 const syllabus = useSyllabus();
 const todayKeyStr = todayKey();
 const todayTargets = useTargets((s) => s.byDate[todayKeyStr] || EMPTY_TARGETS);

 const suggestions = useMemo(() => {
 const excludeTopics = todayTargets.map((t) => t.topic);
 return generateSmartPlan(
 sessions,
 syllabus.lectures,
 syllabus.chapters,
 syllabus.subjects,
 excludeTopics
 );
 }, [sessions, syllabus.lectures, syllabus.chapters, syllabus.subjects, todayTargets]);

 if (dismissed) return null;

 const acceptAll = () => {
 suggestions.forEach((s) => addTarget(s));
 setDismissed(true);
 vibrate(15);
 };

 return (
 <div className="glass rounded-2xl p-4 border border-teal-400/20">
 <div className="flex items-center gap-2 mb-3">
 <Sparkles size={16} className="text-teal-400" />
 <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Smart Plan for today</span>
 <button onClick={() => setDismissed(true)} className="ml-auto hover:">
 <X size={16} />
 </button>
 </div>
 <div className="space-y-2 mb-3">
 {suggestions.map((s, i) => {
 const c = subjectColor(s.subject);
 return (
 <div key={i} className="flex items-center gap-2 p-2 rounded-lg ">
 <div className="w-2 h-8 rounded" style={{ background: c.hex }} />
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium truncate">{s.topic}</div>
 <div className="text-[10px] ">
 {s.subject} · {s.activity} · {s.expectedMinutes}m
 </div>
 </div>
 <span className="text-[10px] text-teal-400/70 italic">{s.reason}</span>
 </div>
 );
 })}
 </div>
 <button
 onClick={acceptAll}
 className="w-full font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(90deg, #0d9488, #16a34a)", color: "#ffffff" }}
 >
 <Check size={16} />
 Accept all suggestions
 </button>
 </div>
 );
}
