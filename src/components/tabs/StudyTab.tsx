'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, Target as TargetIcon, Sparkles, X, Check, GripVertical, HelpCircle } from 'lucide-react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { useTargets } from '@/lib/store/targets';
import { useSession } from '@/lib/store/session';
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
  const studySecToday = useHistory((s) => s.getTodayStudySeconds());
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
        <div className="text-white/50" suppressHydrationWarning>{shortDate()}</div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Study</span>
          <span className="text-white/40 tabular" suppressHydrationWarning>
            {formatHM(studySecToday)} / {Math.floor(expectedTotalMin / 60)}h {expectedTotalMin % 60}m
          </span>
        </div>
        <div className="text-white/50 tabular" suppressHydrationWarning>
          Done <span className="text-white font-semibold">{doneCount}</span>/{sortedTargets.length}
        </div>
      </div>

      {/* Today's Progress Card */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <TargetIcon size={16} className="text-teal-400" />
            <span className="text-sm font-semibold">Today's Progress</span>
          </div>
          <span className="text-2xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent" suppressHydrationWarning>
            {progressPct}%
          </span>
        </div>
        <LiquidProgress
          pct={progressPct}
          color="#14b8a6"
          color2="#22c55e"
          height="h-3"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-white/50">
          <span className="tabular" suppressHydrationWarning>{formatHM(studySecToday)} studied</span>
          <span className="tabular" suppressHydrationWarning>Goal: {dailyGoal}h</span>
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
                  <span className="text-xs text-white/70 ml-auto tabular">
                    {subjDone}/{allItems.length} done · {formatHM(subjStudied)}
                  </span>
                </div>
                {/* Subject progress bar */}
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${subjPct}%`, background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)` }}
                  />
                </div>

                {/* Chapter sub-groups within this subject */}
                {Array.from(subjGroup.chapters.values()).map((chGroup) => {
                  const chDone = chGroup.items.filter((t) => t.done).length;
                  return (
                    <div key={chGroup.chapter} className="space-y-2">
                      {/* Chapter sub-header */}
                      <div className="flex items-center gap-1.5 px-1 pt-1">
                        <div className="w-1 h-3 rounded-full" style={{ background: `${color.hex}80` }} />
                        <span className="text-[11px] font-semibold text-white/80">{chGroup.chapter}</span>
                        <span className="text-[9px] text-white/60 tabular ml-auto">
                          {chDone}/{chGroup.items.length}
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
                      }} className="space-y-2" layout>
                        {chGroup.items.map((t) => (
                          <TargetCard
                            key={t.id}
                            target={t}
                            onOpenDetail={() => setDetailTarget(t)}
                            onEdit={() => { setEditingTarget(t); setShowAdd(true); }}
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
          <TargetIcon size={40} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No targets yet. Tap + to add your first study target.</p>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => { setEditingTarget(null); setShowAdd(true); }}
        className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-white/80 hover:text-white hover:bg-white/10 transition active:scale-[0.98]"
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
          <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 px-1">Past 6 Days</h3>
          <div className="space-y-1.5">
            {pastDays.map((d) => (
              <div key={d.key} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className="text-center min-w-[42px]">
                  <div className="text-[10px] text-white/40 uppercase">
                    {d.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-lg font-bold tabular">{d.date.getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/50">
                    <span className="text-white/80 font-semibold tabular">{d.done}</span>/{d.total} done
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-green-400 tabular">▶ {formatHM(d.studySec)}</span>
                    {d.wastedSec > 0 && (
                      <span className="text-xs text-red-400 tabular">⚠ {formatHM(d.wastedSec)}</span>
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
        className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-xl flex items-center justify-center active:scale-90 transition"
        aria-label="Doubt Tracker"
      >
        <HelpCircle size={22} />
        {/* Badge count is gated behind `mounted` to prevent SSR hydration
            mismatch — pendingDoubts is 0 on server but may be >0 on client
            after Zustand rehydrates from localStorage. */}
        {mounted && pendingDoubts > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
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
        <span className="text-sm font-semibold">Smart Plan for today</span>
        <button onClick={() => setDismissed(true)} className="ml-auto text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2 mb-3">
        {suggestions.map((s, i) => {
          const c = subjectColor(s.subject);
          return (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
              <div className="w-2 h-8 rounded" style={{ background: c.hex }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.topic}</div>
                <div className="text-[10px] text-white/40">
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
        className="w-full bg-gradient-to-r from-teal-500 to-green-500 text-black font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
      >
        <Check size={16} />
        Accept all suggestions
      </button>
    </div>
  );
}
