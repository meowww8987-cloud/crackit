'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, X, Check, ChevronRight,
  Flame, Eye, EyeOff, RefreshCw, Play,
  BookOpen, FileText, Zap, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { useTargets } from '@/lib/store/targets';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { usePractice } from '@/lib/store/practice';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { useDoubts } from '@/lib/store/doubts';
import { subjectColor } from '@/lib/colors';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, shortDate, formatHM, todayKey, addDays, vibrate } from '@/lib/utils';
import { TargetCard } from '@/components/study/TargetCard';
import { CurrentBlockCard } from '@/components/routine/CurrentBlockCard';
import { AddTargetSheet } from '@/components/study/AddTargetSheet';
import { DetailSheet } from '@/components/study/DetailSheet';
import { DoubtSheet } from '@/components/doubts/DoubtSheet';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';
import { getLearnedExpectedMinutes } from '@/lib/store/learnedTime';

const EMPTY_TARGETS: Target[] = [];
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;

// LocalStorage keys for collapse state persistence
const COLLAPSE_KEY_PREFIX = 'neet-collapse-';

export function StudyTab() {
  const todayKeyStr = todayKey();
  const todayTargets = useTargets((s) => s.byDate[todayKeyStr] || EMPTY_TARGETS);
  const reorderToday = useTargets((s) => s.reorderToday);
  const addTarget = useTargets((s) => s.addTarget);
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  const [showAdd, setShowAdd] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [detailTarget, setDetailTarget] = useState<Target | null>(null);
  const [showDoubts, setShowDoubts] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Floating widget visibility
  const widgetHidden = useSession((s) => s.widgetHidden);
  const setWidgetHidden = useSession((s) => s.setWidgetHidden);
  const setFocusOpen = useSession((s) => s.setFocusOpen);
  const activeSession = useSession((s) => s.active);

  // === SECTION 10: Reactive selectors (replacing all getState() calls) ===
  const allSessions = useHistory((s) => s.sessions);
  const allDoubts = useDoubts((s) => s.doubts);
  // FIXED: Memoize these — .filter() and .sort() create new arrays
  // every render, causing the component to re-render even when
  // allDoubts hasn't actually changed.
  const pendingDoubts = useMemo(() => allDoubts.filter((d) => d.status === 'pending').length, [allDoubts]);
  const lastDoubtSubject = useMemo(() => {
    if (allDoubts.length === 0) return null;
    return [...allDoubts].sort((a, b) => b.createdAt - a.createdAt)[0]?.subject;
  }, [allDoubts]);

  // Sorted targets
  const sortedTargets = useMemo(
    () => [...todayTargets].sort((a, b) => a.order - b.order),
    [todayTargets]
  );

  // Group by SUBJECT → CHAPTER (memoized)
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

  // === Aggregated today stats (single reactive pass) ===
  const todayStats = useMemo(() => {
    const today = todayKeyStr;
    const todaySessions = allSessions.filter((s) => s.date === today);
    const studySec = todaySessions.reduce((a, s) => a + s.studySeconds, 0);
    const wastedSec = todaySessions.reduce((a, s) => a + s.wastedSeconds, 0);

    // Per-target stats
    const perTarget = new Map<string, { studiedSec: number; wastedSec: number; sessionCount: number }>();
    for (const s of todaySessions) {
      if (!s.targetId) continue;
      const cur = perTarget.get(s.targetId) || { studiedSec: 0, wastedSec: 0, sessionCount: 0 };
      cur.studiedSec += s.studySeconds;
      cur.wastedSec += s.wastedSeconds;
      cur.sessionCount += 1;
      perTarget.set(s.targetId, cur);
    }

    // Per-subject stats
    const perSubject = new Map<Subject, { studiedSec: number; doneCount: number; totalCount: number; expectedMin: number }>();
    for (const t of sortedTargets) {
      const cur = perSubject.get(t.subject) || { studiedSec: 0, doneCount: 0, totalCount: 0, expectedMin: 0 };
      cur.totalCount += 1;
      cur.expectedMin += t.expectedMinutes;
      if (t.done) cur.doneCount += 1;
      const tgtStats = perTarget.get(t.id);
      if (tgtStats) cur.studiedSec += tgtStats.studiedSec;
      perSubject.set(t.subject, cur);
    }

    return {
      studySec,
      wastedSec,
      perTarget,
      perSubject,
      doneCount: sortedTargets.filter((t) => t.done).length,
      expectedTotalMin: sortedTargets.reduce((acc, t) => acc + t.expectedMinutes, 0),
      sessionCount: todaySessions.length,
    };
  }, [allSessions, sortedTargets, todayKeyStr]);

  // Live ticking for active session — reuse activeSession from above
  // (was: const activeFocusSession = useSession((s) => s.active) — duplicate)
  const activeFocusSession = activeSession;
  const activePractice = usePractice((s) => s.activePractice);
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    if (!activeFocusSession && !activePractice) return;
    // 3-second tick — the progress card doesn't need second-by-second updates
    // === HEAT FIX: Skip when tab hidden ===
    const i = setInterval(() => {
      if (document.hidden) return;
      setLiveTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(i);
  }, [activeFocusSession, activePractice]);

  const liveFocus = (activeFocusSession && (activeFocusSession as any).date === todayKey())
    ? getLiveStudySeconds(activeFocusSession) : 0;
  const livePractice = activePractice
    ? Math.floor((Date.now() - activePractice.startedAt) / 1000)
    : 0;
  const studySecToday = todayStats.studySec + liveFocus + livePractice;

  // Streak
  const streak = useMemo(() => {
    const days = new Set<string>();
    for (const s of allSessions) {
      if (s.studySeconds >= 60) days.add(s.date);
    }
    if (days.size === 0) return 0;
    let s = 0;
    const d = new Date();
    const tk = todayKey();
    if (!days.has(tk)) d.setDate(d.getDate() - 1);
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (days.has(key)) {
        s++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return s;
  }, [allSessions]);

  const dailyGoal = useSettings((s) => s.dailyGoalHours);
  const goalSec = dailyGoal * 3600;
  const progressPct = goalSec > 0 ? Math.min(100, Math.round((studySecToday / goalSec) * 100)) : 0;

  // === 7-day strip data (always 7 days, including today) ===
  const last7Days = useMemo(() => {
    const result: {
      date: Date; key: string; done: number; total: number;
      studySec: number; wastedSec: number; isToday: boolean; targets: Target[];
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = useTargets.getState().byDate[key] || [];
      const sessions = allSessions.filter((s) => s.date === key);
      const studySec = sessions.reduce((a, s) => a + s.studySeconds, 0);
      const wastedSec = sessions.reduce((a, s) => a + s.wastedSeconds, 0);
      const done = list.filter((t) => t.done).length;
      result.push({
        date: d,
        key,
        done,
        total: list.length,
        studySec,
        wastedSec,
        isToday: i === 0,
        targets: list,
      });
    }
    return result;
  }, [allSessions]);

  const [expandedDay, setExpandedDay] = useState<string | null>(todayKey());

  // === Hydration gate ===
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const hasEverAddedTargets = useTargets((s) => Object.keys(s.byDate).length > 0);
  const hasYesterdayTargets = useMemo(() => {
    const y = addDays(new Date(), -1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return (useTargets.getState().byDate[yKey] || []).length > 0;
  }, []);

  const yesterdayStats = useMemo(() => {
    const y = addDays(new Date(), -1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const ySessions = allSessions.filter((s) => s.date === yKey);
    const yList = useTargets.getState().byDate[yKey] || [];
    return {
      studySec: ySessions.reduce((a, s) => a + s.studySeconds, 0),
      doneCount: yList.filter((t) => t.done).length,
      totalCount: yList.length,
    };
  }, [allSessions]);

  // === Active subject detection (for ring color + active subject glow) ===
  const activeSubject: Subject | null = activeSession?.subject || (activePractice?.subject as Subject) || null;

  // === Quick Add handlers ===
  // Smart default subject: active session → last-added target today → first
  // syllabus subject → Physics. This ensures Quick Add goes to the RIGHT
  // subject, not always the 1st one.
  const quickAddSubject: Subject = useMemo(() => {
    if (activeSubject) return activeSubject;
    if (sortedTargets.length > 0) {
      // Use the subject of the last-added target (highest order)
      return sortedTargets[sortedTargets.length - 1].subject;
    }
    const syllabusSubjects = useSyllabus.getState().subjects;
    if (syllabusSubjects.length > 0) return syllabusSubjects[0].name as Subject;
    return 'Physics';
  }, [activeSubject, sortedTargets]);

  const handleQuickAdd = useCallback((activity: ActivityType) => {
    if (mounted) vibrate(12);
    // Use learned time for this subject+activity, fall back to defaults
    const defaultMinutes = getLearnedExpectedMinutes(quickAddSubject, activity);
    addTarget({
      date: todayKeyStr,
      subject: quickAddSubject,
      activity,
      chapter: 'General',
      topic: `${activity} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      expectedMinutes: defaultMinutes,
    });
    setShowQuickAdd(false);
  }, [quickAddSubject, addTarget, todayKeyStr, mounted]);

  // === Determine empty state type ===
  const emptyStateType: 'first-time' | 'returning' | 'all-done' | null = useMemo(() => {
    if (!mounted) return null;
    if (sortedTargets.length === 0) {
      return hasEverAddedTargets ? 'returning' : 'first-time';
    }
    if (todayStats.doneCount === sortedTargets.length) {
      return 'all-done';
    }
    return null;
  }, [mounted, sortedTargets, todayStats.doneCount, hasEverAddedTargets]);

  return (
    <div className="pt-2 pb-32 space-y-4">
      {/* ============ SECTION 1+2: HERO PROGRESS CARD (merged header + progress) ============
          === COMBINED DESIGN (Option B frosted-glass card + Option C bigger/prominent
              + segmented bar idea) ===
          Top row: date + greeting (left) + Eye icon (right)
          Middle: big ring (96px) + big "39m" studied + "8% of goal"
          Bottom: segmented bar (studied/wasted/remaining) + pace chip + focus chip
          Frosted-glass background with subtle gradient — theme-aware (uses
          var(--foreground), NOT text-white, so it works in light themes too). */}
      <HeroProgressCard
        streak={streak}
        studySecToday={studySecToday}
        wastedSec={todayStats.wastedSec}
        goalSec={goalSec}
        dailyGoal={dailyGoal}
        progressPct={progressPct}
        doneCount={todayStats.doneCount}
        totalCount={sortedTargets.length}
        liveFocus={liveFocus}
        livePractice={livePractice}
        savedStudySec={todayStats.studySec}
        activeSubject={activeSubject}
        widgetHidden={widgetHidden}
        setWidgetHidden={setWidgetHidden}
        setFocusOpen={setFocusOpen}
        activeSession={!!activeSession}
        mounted={mounted}
      />

      {/* ============ SECTIONS 4 + 5: SUBJECT + CHAPTER GROUPS ============ */}
      {mounted && subjectGroups.length > 0 && (
        <div className="space-y-3">
          {subjectGroups.map((subjGroup) => {
            const color = subjectColor(subjGroup.subject);
            const allItems = Array.from(subjGroup.chapters.values()).flatMap(ch => ch.items);
            const subjStats = todayStats.perSubject.get(subjGroup.subject) || {
              studiedSec: 0, doneCount: 0, totalCount: allItems.length, expectedMin: 0,
            };
            const subjPct = subjStats.expectedMin > 0
              ? Math.min(100, Math.round((subjStats.studiedSec / 60 / subjStats.expectedMin) * 100))
              : 0;
            const isSubjectActive = activeSubject === subjGroup.subject;

            return (
              <SubjectSection
                key={subjGroup.subject}
                subject={subjGroup.subject}
                color={color}
                chapters={Array.from(subjGroup.chapters.values())}
                allItems={allItems}
                studiedSec={subjStats.studiedSec}
                doneCount={subjStats.doneCount}
                expectedMin={subjStats.expectedMin}
                subjPct={subjPct}
                isActive={isSubjectActive}
                sortedTargets={sortedTargets}
                reorderToday={reorderToday}
                onOpenDetail={(t) => setDetailTarget(t)}
                onEdit={(t) => { setEditingTarget(t); setShowAdd(true); }}
                onAddToSubject={() => {
                  // Just open the sheet — AddTargetSheet's smart default will
                  // pick the active subject, or user can choose in step 1.
                  setEditingTarget(null);
                  setShowAdd(true);
                }}
                perTargetStats={todayStats.perTarget}
              />
            );
          })}
        </div>
      )}

      {/* ============ SECTION 5.5: SMART STUDY ROUTINE — Current Block ============ */}
      <CurrentBlockCard />

      {/* ============ SECTION 6: EMPTY STATE ============ */}
      {mounted && emptyStateType && emptyStateType !== 'all-done' && (
        <EmptyState
          type={emptyStateType}
          yesterdayStats={yesterdayStats}
          onAddManual={() => { setEditingTarget(null); setShowAdd(true); }}
        />
      )}

      {/* All-done celebration */}
      {mounted && emptyStateType === 'all-done' && (
        <AllDoneState
          studySecToday={studySecToday}
          doneCount={todayStats.doneCount}
          totalCount={sortedTargets.length}
          onAddMore={() => { setEditingTarget(null); setShowAdd(true); }}
        />
      )}

      {/* ============ SECTION 8: 7-DAY STRIP ============ */}
      {mounted && (
        <DayStrip
          days={last7Days}
          streak={streak}
          expandedDay={expandedDay}
          setExpandedDay={setExpandedDay}
          dailyGoalSec={goalSec}
        />
      )}

      {/* ============ SHEETS ============ */}
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
          onEdit={() => {
            setEditingTarget(detailTarget);
            setDetailTarget(null);
            setShowAdd(true);
          }}
        />
      )}

      {/* ============ SECTION 7: ADD FAB ============ */}
      <AddFAB
        onQuickAdd={() => setShowQuickAdd(true)}
        onFullAdd={() => { setEditingTarget(null); setShowAdd(true); }}
        showQuickAdd={showQuickAdd}
        onCloseQuickAdd={() => setShowQuickAdd(false)}
        onQuickAddType={handleQuickAdd}
        defaultSubject={quickAddSubject}
      />

      {/* ============ SECTION 9: DOUBT FAB ============ */}
      <DoubtFAB
        count={pendingDoubts}
        lastDoubtSubject={lastDoubtSubject}
        mounted={mounted}
        onClick={() => { setShowDoubts(true); vibrate(10); }}
      />

      <AnimatePresence>
        {showDoubts && <DoubtSheet key="doubts" onClose={() => setShowDoubts(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
   SECTION 1+2: HERO PROGRESS CARD (merged HeaderRow + ProgressCard)
   === COMBINED DESIGN (Option B frosted-glass + Option C bigger/prominent
       + segmented bar) the user approved ===

   Layout (top to bottom):
   Row 1: date + greeting (left) | Eye icon (right)
   Row 2: BIG ring (96px) | big "39m" studied + "8% of goal" + pace chip
   Row 3: segmented bar (studied green | wasted red | remaining gray)
   Row 4: breakdown chips (Focus / Practice / Targets)

   === THEME-SAFE: uses var(--foreground) / var(--muted-foreground) for text
       so it works in ALL themes (dark, light, rose, sage, ocean, etc.).
       The frosted-glass background uses rgba of the theme's foreground color
       so it adapts to light/dark automatically. ===
   === NO REDUNDANCY: this replaces both the old HeaderRow (stats line) and
       the old ProgressCard. The stats ("39m studied · 0/0 done · 8% of goal")
       are now shown ONCE, here, in a cleaner layout. === */
function HeroProgressCard({
  streak, studySecToday, wastedSec, goalSec, dailyGoal, progressPct,
  doneCount, totalCount, liveFocus, livePractice, savedStudySec,
  activeSubject, widgetHidden, setWidgetHidden, setFocusOpen, activeSession,
  mounted,
}: {
  streak: number;
  studySecToday: number;
  wastedSec: number;
  goalSec: number;
  dailyGoal: number;
  progressPct: number;
  doneCount: number;
  totalCount: number;
  liveFocus: number;
  livePractice: number;
  savedStudySec: number;
  activeSubject: Subject | null;
  widgetHidden: boolean;
  setWidgetHidden: (v: boolean) => void;
  setFocusOpen: (v: boolean) => void;
  activeSession: boolean;
  mounted: boolean;
}) {
  const remainingSec = Math.max(0, goalSec - studySecToday);
  const ringColor = activeSubject ? subjectColor(activeSubject).hex : '#14b8a6';
  const ringColor2 = activeSubject ? subjectColor(activeSubject).hex : '#22c55e';

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';

  // Pace calculation: assumes 16-hour active day (6am to 10pm)
  const now = new Date();
  const hourOfDay = now.getHours() + now.getMinutes() / 60;
  const activeDayStart = 6;
  const activeDayEnd = 22;
  const elapsedActiveHours = Math.max(0, Math.min(activeDayEnd - activeDayStart, hourOfDay - activeDayStart));
  const expectedPct = (elapsedActiveHours / (activeDayEnd - activeDayStart)) * 100;
  const paceDiff = progressPct - expectedPct;
  const paceStatus: 'ahead' | 'on-pace' | 'behind' = paceDiff >= 5 ? 'ahead' : paceDiff <= -10 ? 'behind' : 'on-pace';
  const paceColor = paceStatus === 'ahead' ? '#22c55e' : paceStatus === 'behind' ? '#ef4444' : '#f59e0b';
  const paceLabel = paceStatus === 'ahead' ? '🔥 ahead' : paceStatus === 'behind' ? '⏰ behind' : '✓ on pace';

  const isComplete = progressPct >= 100;

  return (
    <motion.div
      initial={mounted ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl p-4 relative overflow-hidden"
      style={{
        // Frosted-glass background — uses theme foreground at low opacity so
        // it adapts to light/dark themes automatically.
        background: 'color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        // Subtle gradient overlay for depth (Option C: "subtle gradient background")
        backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${ringColor} 8%, transparent) 0%, transparent 50%)`,
      }}
    >
      {/* === ROW 1: date + greeting (left) | icons (right) === */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {mounted && streak >= 2 ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.30)' }}
              title={`${streak}-day streak — keep it up!`}
            >
              <Flame size={12} className="text-orange-400" />
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-300 tabular">{streak}</span>
            </motion.div>
          ) : null}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
              {shortDate()} · {greeting}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => { vibrate(10); if (widgetHidden) setFocusOpen(false); setWidgetHidden(!widgetHidden); }}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95',
              !activeSession && 'opacity-40'
            )}
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            aria-label={widgetHidden ? 'Show floating widget' : 'Hide floating widget'}
            title={widgetHidden ? 'Show widget' : 'Hide widget'}
            disabled={!activeSession}
          >
            {widgetHidden ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </div>
      </div>

      {/* === ROW 2: big ring + big stats === */}
      <div className="flex items-center gap-4 mb-3">
        {/* BIG ring (96px — was 64px in the old ProgressCard) */}
        <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="40" fill="none" stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="7" />
            <motion.circle
              cx="48" cy="48" r="40" fill="none"
              stroke={ringColor}
              strokeWidth="7"
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset: 251.33 - (251.33 * progressPct) / 100 }}
              transition={{ type: 'spring', stiffness: 60, damping: 20, mass: 1 }}
              style={{ strokeDasharray: 251.33, filter: `drop-shadow(0 0 6px ${ringColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={Math.floor(progressPct / 5)}
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="text-xl font-black tabular leading-none"
              style={{
                backgroundImage: isComplete
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : `linear-gradient(135deg, ${ringColor}, ${ringColor2})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              suppressHydrationWarning
            >
              {progressPct}%
            </motion.span>
            <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
              of {dailyGoal}h
            </span>
          </div>
          {isComplete && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -top-1 -right-1 text-base"
            >
              🏆
            </motion.div>
          )}
        </div>

        {/* Big "39m" studied + focus/wasted side-by-side + pace chip */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tabular leading-none" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
              {formatHM(studySecToday)}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              studied
            </span>
          </div>
          <div className="text-[11px] tabular mt-1" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
            {formatHM(remainingSec)} to go · {doneCount}/{totalCount} done
          </div>

          {/* === FOCUS vs WASTED — side by side ===
              Focus time: calm blue/green with Zap icon (positive)
              Wasted time: DANGER styling — red bg, warning icon, pulsing border
              Only shows the wasted chip when there IS waste (no demoralizing
              red label when the day is clean). */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg tabular"
              style={{ background: `${ringColor}18`, color: ringColor, border: `1px solid ${ringColor}35` }}
            >
              <Zap size={11} />
              <span>{formatHM(studySecToday)} focus</span>
            </span>
            {wastedSec > 0 && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg tabular pulse-fast"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.45)' }}
                title="Time wasted this session — minimized by staying focused!"
              >
                <AlertTriangle size={11} />
                <span>{formatHM(wastedSec)} wasted</span>
              </span>
            )}
          </div>

          {/* Pace chip + goal */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular"
              style={{ background: `${paceColor}20`, color: paceColor, border: `1px solid ${paceColor}40` }}
            >
              {paceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* === ROW 4: breakdown chips (Focus / Practice / Targets) === */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {liveFocus > 0 && (
          <BreakdownChip label="Focus" sec={liveFocus} color="#3b82f6" icon={<Zap size={8} />} />
        )}
        {livePractice > 0 && (
          <BreakdownChip label="Practice" sec={livePractice} color="#f59e0b" icon={<Play size={8} fill="currentColor" />} />
        )}
        {savedStudySec > 0 && (
          <BreakdownChip label="Targets" sec={savedStudySec} color="#22c55e" icon={<Check size={8} />} />
        )}
        {liveFocus === 0 && livePractice === 0 && savedStudySec === 0 && (
          <span className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>
            Start a session to begin
          </span>
        )}
      </div>

      {/* Completion glow */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(34,197,94,0.15) 0%, transparent 70%)' }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BreakdownChip({ label, sec, color, icon }: { label: string; sec: number; color: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium tabular"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
    >
      {icon}
      <span>{label}</span>
      <span className="opacity-80">{formatHM(sec)}</span>
    </div>
  );
}

/* =========================================================================
   SECTION 4: SUBJECT SECTION
   Collapsible, active glow, thick progress, +/⋯ buttons
   ========================================================================= */
function SubjectSection({
  subject, color, chapters, allItems, studiedSec, doneCount, expectedMin,
  subjPct, isActive, sortedTargets, reorderToday, onOpenDetail, onEdit, onAddToSubject, perTargetStats,
}: {
  subject: Subject;
  color: { hex: string; glow: string };
  chapters: { chapter: string; items: Target[] }[];
  allItems: Target[];
  studiedSec: number;
  doneCount: number;
  expectedMin: number;
  subjPct: number;
  isActive: boolean;
  sortedTargets: Target[];
  reorderToday: (newOrder: Target[]) => void;
  onOpenDetail: (t: Target) => void;
  onEdit: (t: Target) => void;
  onAddToSubject: () => void;
  perTargetStats: Map<string, { studiedSec: number; wastedSec: number; sessionCount: number }>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const collapseKey = `${COLLAPSE_KEY_PREFIX}subj-${subject}`;

  // Load persisted collapse state
  useEffect(() => {
    try {
      const v = localStorage.getItem(collapseKey);
      if (v === '1') setCollapsed(true);
    } catch {}
  }, [collapseKey]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(collapseKey, next ? '1' : '0'); } catch {}
  };

  return (
    <motion.div
      layout
      className={cn(
        'card-solid rounded-2xl p-3 space-y-3 relative overflow-hidden transition-all duration-300',
        isActive && 'glow-pulse'
      )}
      style={{
        borderColor: isActive ? color.hex : `${color.hex}80`,
        ['--glow-color' as string]: color.glow,
      }}
    >
      <div
        className="card-tint"
        style={{ background: `linear-gradient(180deg, ${color.hex}26, ${color.hex}12)` }}
      />

      <div className="relative space-y-2">
        {/* Subject header */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center gap-2 px-1 py-1 -mx-1 rounded-md hover:bg-foreground/5 transition text-left"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${subject}`}
          aria-expanded={!collapsed}
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={14} style={{ color: color.hex }} />
          </motion.div>
          <SubjectIcon subject={subject} color={color.hex} />
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: color.hex }}>
            {subject}
          </span>
          <span className="text-xs ml-auto tabular" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
            <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{doneCount}</span>/{allItems.length} · {formatHM(studiedSec)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToSubject(); }}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
            aria-label={`Add target to ${subject}`}
            title="Add to this subject"
          >
            <Plus size={12} style={{ color: color.hex }} />
          </button>
        </button>

        {/* Thick progress bar with glow */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)`,
              boxShadow: `0 0 8px ${color.glow}`,
            }}
            initial={false}
            animate={{ width: `${subjPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>

        {/* Chapters (collapsible) */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_SMOOTH }}
              className="overflow-hidden space-y-2"
            >
              {chapters.map((chGroup) => (
                <ChapterSection
                  key={chGroup.chapter}
                  chapter={chGroup.chapter}
                  items={chGroup.items}
                  color={color}
                  sortedTargets={sortedTargets}
                  reorderToday={reorderToday}
                  onOpenDetail={onOpenDetail}
                  onEdit={onEdit}
                  perTargetStats={perTargetStats}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SubjectIcon({ subject, color }: { subject: Subject; color: string }) {
  // Distinct shape per subject for at-a-glance recognition
  const shapes: Record<Subject, React.ReactNode> = {
    Physics:   <circle cx="8" cy="8" r="6" fill={color} />,
    Chemistry: <rect x="2" y="2" width="12" height="12" rx="3" fill={color} />,
    Botany:    <path d="M8 2 L14 14 L2 14 Z" fill={color} />,
    Zoology:   <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color} />,
    General:   <rect x="4" y="4" width="8" height="8" rx="1" fill={color} />,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
      {shapes[subject]}
    </svg>
  );
}

/* =========================================================================
   SECTION 5: CHAPTER SECTION
   Chevron + name + progress bar + collapse
   ========================================================================= */
function ChapterSection({
  chapter, items, color, sortedTargets, reorderToday, onOpenDetail, onEdit, perTargetStats,
}: {
  chapter: string;
  items: Target[];
  color: { hex: string; glow: string };
  sortedTargets: Target[];
  reorderToday: (newOrder: Target[]) => void;
  onOpenDetail: (t: Target) => void;
  onEdit: (t: Target) => void;
  perTargetStats: Map<string, { studiedSec: number; wastedSec: number; sessionCount: number }>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const collapseKey = `${COLLAPSE_KEY_PREFIX}chap-${chapter}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(collapseKey);
      if (v === '1') setCollapsed(true);
    } catch {}
  }, [collapseKey]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(collapseKey, next ? '1' : '0'); } catch {}
  };

  const chDone = items.filter((t) => t.done).length;
  const chStudied = items.reduce((a, t) => {
    const stats = perTargetStats.get(t.id);
    return a + (stats?.studiedSec || 0);
  }, 0);
  const chExpected = items.reduce((a, t) => a + t.expectedMinutes, 0);
  const chPct = chExpected > 0 ? Math.min(100, Math.round((chStudied / 60 / chExpected) * 100)) : 0;
  const chRemaining = Math.max(0, chExpected * 60 - chStudied);

  return (
    <div className="space-y-2">
      {/* Chapter header — clickable to collapse */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center gap-1.5 px-1 py-1 rounded-md hover:bg-foreground/5 transition text-left"
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${chapter}`}
        aria-expanded={!collapsed}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={11} style={{ color: `${color.hex}80` }} />
        </motion.div>
        <span className="text-[11px] font-semibold truncate flex-1" style={{ color: 'var(--foreground)' }}>
          {chapter}
        </span>
        <span className="text-[9px] tabular shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>{chDone}</span>/{items.length} done
        </span>
      </button>

      {/* Chapter progress + time */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)`,
            }}
            initial={false}
            animate={{ width: `${chPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-[9px] tabular shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          {chPct}% · {formatHM(chRemaining)} left
        </span>
      </div>

      {/* Cards (collapsible) */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_SMOOTH }}
            className="overflow-hidden"
          >
            <Reorder.Group
              axis="y"
              values={items}
              onReorder={(newOrder) => {
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
              }}
              className="space-y-2"
              layoutScroll
              as="div"
            >
              {items.map((t, idx) => (
                <TargetCard
                  key={t.id}
                  target={t}
                  onOpenDetail={() => onOpenDetail(t)}
                  onEdit={() => onEdit(t)}
                  indexInChapter={idx + 1}
                  chapterTotal={items.length}
                  hasSiblings={items.length > 1}
                  cardIndex={idx}
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
   SECTION 6: EMPTY STATE
   Three states: first-time, returning, all-done
   ========================================================================= */
function EmptyState({
  type, yesterdayStats, onAddManual,
}: {
  type: 'first-time' | 'returning';
  yesterdayStats: { studySec: number; doneCount: number; totalCount: number };
  onAddManual: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  const isFirstTime = type === 'first-time';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 text-center space-y-4"
    >
      {/* Illustration */}
      <div className="flex justify-center">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
          className="text-5xl"
        >
          {isFirstTime ? '📚' : '🎯'}
        </motion.div>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--foreground)' }}>
          {isFirstTime ? 'Welcome! Let\'s plan your first study day' : 'Nothing planned for today yet'}
        </h3>
        {!isFirstTime && yesterdayStats.totalCount > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
            Yesterday: {formatHM(yesterdayStats.studySec)} · {yesterdayStats.doneCount}/{yesterdayStats.totalCount} done
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onAddManual}
          className="w-full font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          style={{ background: 'linear-gradient(90deg, #0d9488, #16a34a)', color: '#fff' }}
        >
          <Plus size={14} />
          {isFirstTime ? 'Add your first target' : 'Add a target for today'}
        </button>
      </div>

      {/* Tip */}
      <p className="text-[10px] italic pt-2 border-t border-foreground/10" style={{ color: 'var(--muted-foreground)' }}>
        💡 Tip: Aim for 4-6 targets per day for balanced prep.
      </p>
    </motion.div>
  );
}

function AllDoneState({
  studySecToday, doneCount, totalCount, onAddMore,
}: {
  studySecToday: number;
  doneCount: number;
  totalCount: number;
  onAddMore: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-6 text-center space-y-3"
      style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(20,184,166,0.05))' }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
        className="text-5xl"
      >
        🎉
      </motion.div>
      <div>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--foreground)' }}>All done for today!</h3>
        <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
          {formatHM(studySecToday)} studied · {doneCount}/{totalCount} complete
        </p>
      </div>
      <button
        onClick={onAddMore}
        className="text-[11px] font-semibold px-4 py-2 rounded-lg border border-border hover:bg-foreground/5 transition inline-flex items-center gap-1"
        style={{ color: 'var(--foreground)' }}
      >
        <Plus size={12} />
        Add more
      </button>
    </motion.div>
  );
}

/* =========================================================================
   SECTION 7: ADD FAB + QUICK ADD MENU
   ========================================================================= */
function AddFAB({
  onQuickAdd, onFullAdd, showQuickAdd, onCloseQuickAdd, onQuickAddType, defaultSubject,
}: {
  onQuickAdd: () => void;
  onFullAdd: () => void;
  showQuickAdd: boolean;
  onCloseQuickAdd: () => void;
  onQuickAddType: (a: ActivityType) => void;
  defaultSubject: Subject;
}) {
  // Lock body scroll while Quick Add menu is open.
  // Do NOT set touchAction:none on body — it breaks in-menu scrolling.
  // The menu uses overscroll-behavior:contain to prevent scroll chaining.
  useEffect(() => {
    if (!showQuickAdd) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseQuickAdd(); };
    window.addEventListener('keydown', escHandler);
    return () => {
      window.removeEventListener('keydown', escHandler);
      document.body.style.overflow = prevOverflow;
    };
  }, [showQuickAdd, onCloseQuickAdd]);

  const quickOptions: { type: ActivityType; label: string; icon: typeof BookOpen; color: string }[] = [
    { type: 'Lecture',   label: 'Lecture',   icon: BookOpen, color: '#3b82f6' },
    { type: 'DPP',       label: 'DPP',       icon: FileText, color: '#f97316' },
    { type: 'Notes',     label: 'Notes',     icon: FileText, color: '#22c55e' },
    { type: 'Revision',  label: 'Revision',  icon: RotateCcw, color: '#a855f7' },
    { type: 'Assignment', label: 'Assignment', icon: FileText, color: '#7c3aed' },
  ];

  const subjColor = subjectColor(defaultSubject);

  return (
    <>
      {/* Quick Add menu — centered modal with scroll lock */}
      <AnimatePresence>
        {showQuickAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80"
              onClick={onCloseQuickAdd}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-[300px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{
                background: 'var(--popover, rgba(20,22,30,0.96))',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
              <div className="px-4 py-3 border-b border-foreground/10 sticky top-0" style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}>
                <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Quick Add</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">Choose a target type</div>
                {/* Show which subject the target will be added to */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: subjColor.hex }} />
                  <span className="text-[10px] font-medium" style={{ color: subjColor.hex }}>
                    Adds to: {defaultSubject}
                  </span>
                </div>
              </div>
              <div className="py-1">
                {quickOptions.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => onQuickAddType(opt.type)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${opt.color}20`, color: opt.color }}
                    >
                      <opt.icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground">Quick: {opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.type === 'DPP' ? '30 min' : opt.type === 'Notes' ? '25 min' : opt.type === 'Revision' ? '20 min' : opt.type === 'Assignment' ? '45 min' : '45 min'}</div>
                    </div>
                  </button>
                ))}
                <div className="h-px bg-foreground/10 my-1" />
                <button
                  onClick={() => { onCloseQuickAdd(); onFullAdd(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-500/20 text-teal-600 dark:text-teal-400 shrink-0">
                    <Plus size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">Full target</div>
                    <div className="text-[10px] text-muted-foreground">Custom subject, chapter, time</div>
                  </div>
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={onQuickAdd}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full shadow-xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
          boxShadow: '0 8px 24px -4px rgba(20,184,166,0.5)',
        }}
        aria-label="Add target — long-press for quick add"
        title="Add target"
      >
        <motion.div animate={{ rotate: showQuickAdd ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus size={22} color="#fff" />
        </motion.div>
      </motion.button>
    </>
  );
}

/* =========================================================================
   SECTION 8: 7-DAY STRIP
   7 day chips + expandable detail
   ========================================================================= */
function DayStrip({
  days, streak, expandedDay, setExpandedDay, dailyGoalSec,
}: {
  days: {
    date: Date; key: string; done: number; total: number;
    studySec: number; wastedSec: number; isToday: boolean; targets: Target[];
  }[];
  streak: number;
  expandedDay: string | null;
  setExpandedDay: (k: string | null) => void;
  dailyGoalSec: number;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  const expandedData = days.find((d) => d.key === expandedDay);

  return (
    <div className="glass rounded-2xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
          This Week
        </span>
        {streak >= 2 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-300 flex items-center gap-1">
            <Flame size={9} /> {streak}-day
          </span>
        )}
      </div>

      {/* 7 day chips */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const pct = dailyGoalSec > 0 ? Math.min(100, (d.studySec / dailyGoalSec) * 100) : 0;
          const chipColor = d.studySec === 0 ? '#6b7280' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
          const isExpanded = expandedDay === d.key;
          return (
            <button
              key={d.key}
              onClick={() => setExpandedDay(isExpanded ? null : d.key)}
              className={cn(
                'rounded-lg p-1.5 flex flex-col items-center gap-0.5 transition',
                isExpanded ? 'bg-foreground/15' : 'hover:bg-foreground/10'
              )}
              aria-label={`View ${d.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
            >
              <span className="text-[8px] uppercase font-bold" style={{ color: 'var(--muted-foreground)' }}>
                {d.date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
              </span>
              <motion.div
                className={cn('w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tabular')}
                style={{
                  background: d.isToday ? `${chipColor}25` : `${chipColor}15`,
                  border: d.isToday ? `1px solid ${chipColor}` : 'none',
                  color: chipColor,
                }}
                animate={d.isToday ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
              >
                {d.date.getDate()}
              </motion.div>
              <span className="text-[8px] tabular font-semibold" style={{ color: chipColor }}>
                {d.studySec > 0 ? `${Math.round(d.studySec / 3600 * 10) / 10}h` : '—'}
              </span>
              {d.wastedSec > 900 && (
                <div className="w-1 h-1 rounded-full bg-red-500" title={`${formatHM(d.wastedSec)} wasted`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expandedData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_SMOOTH }}
            className="overflow-hidden"
          >
            <div className="rounded-lg bg-foreground/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                  {expandedData.isToday
                    ? 'Today'
                    : expandedData.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[10px] tabular ml-auto" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
                  {expandedData.done}/{expandedData.total} done · {formatHM(expandedData.studySec)}
                </span>
              </div>

              {/* Mini progress bar */}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${dailyGoalSec > 0 ? Math.min(100, (expandedData.studySec / dailyGoalSec) * 100) : 0}%`,
                    background: 'linear-gradient(90deg, #14b8a6, #22c55e)',
                  }}
                />
              </div>

              {/* Target list (max 4) */}
              {expandedData.targets.length > 0 ? (
                <div className="space-y-1">
                  {expandedData.targets.slice(0, 4).map((t) => {
                    const c = subjectColor(t.subject);
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-[10px]">
                        <div className="w-1 h-3 rounded-full" style={{ background: c.hex }} />
                        <span className="truncate flex-1" style={{ color: 'var(--foreground)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>
                          {t.topic}
                        </span>
                        {t.done && <Check size={10} className="text-green-400" />}
                      </div>
                    );
                  })}
                  {expandedData.targets.length > 4 && (
                    <div className="text-[9px] italic" style={{ color: 'var(--muted-foreground)' }}>
                      + {expandedData.targets.length - 4} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] italic py-1" style={{ color: 'var(--muted-foreground)' }}>
                  No targets planned
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
   SECTION 9: DOUBT FAB
   Hidden when 0 doubts, color from last doubt's subject
   ========================================================================= */
function DoubtFAB({
  count, lastDoubtSubject, mounted, onClick,
}: {
  count: number;
  lastDoubtSubject: Subject | null;
  mounted: boolean;
  onClick: () => void;
}) {
  if (!mounted || count === 0) return null;

  const color = lastDoubtSubject ? subjectColor(lastDoubtSubject) : null;
  const bg = color
    ? `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`
    : 'linear-gradient(135deg, #f59e0b, #ea580c)';

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="fixed bottom-40 right-4 z-30 w-12 h-12 rounded-full shadow-xl flex items-center justify-center"
      style={{
        background: bg,
        boxShadow: `0 8px 24px -4px ${color ? color.glow : 'rgba(245,158,11,0.5)'}, 0 0 0 2px var(--background, #fff), 0 0 0 4px ${color ? color.hex : '#f59e0b'}40`,
      }}
      aria-label={`${count} doubt${count === 1 ? '' : 's'} pending — tap to review`}
      title={`${count} doubt${count === 1 ? '' : 's'} pending`}
    >
      <Plus size={24} color="#fff" strokeWidth={2.5} />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-[11px] font-bold flex items-center justify-center text-white"
            style={{ border: '2px solid var(--background, #fff)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
