'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, Check, ChevronRight, Flame, Eye, EyeOff, Play,
  BookOpen, FileText, Zap, RotateCcw, AlertTriangle,
  Circle, Copy, Trophy, BarChart3,
} from 'lucide-react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { useTargets } from '@/lib/store/targets';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { useRoutine } from '@/lib/store/routine';
import { useNav } from '@/lib/store/nav';
import { usePractice } from '@/lib/store/practice';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { useSyllabus } from '@/lib/store/syllabus';
import { useDoubts } from '@/lib/store/doubts';
import { subjectColor } from '@/lib/colors';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, shortDate, formatHM, formatShort, todayKey, addDays, vibrate } from '@/lib/utils';
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
  const startSession = useSession((s) => s.startSession);

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

  // === Copy yesterday's targets to today (used by returning EmptyState) ===
  const copyYesterdayTargets = useCallback(() => {
    const y = addDays(new Date(), -1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const yTargets = useTargets.getState().byDate[yKey] || [];
    if (yTargets.length === 0) return;
    yTargets.forEach((t) => {
      addTarget({
        date: todayKeyStr,
        subject: t.subject,
        activity: t.activity,
        chapter: t.chapter,
        lecture: t.lecture,
        lectureId: t.lectureId,
        chapterId: t.chapterId,
        assignmentId: t.assignmentId,
        isChapterTarget: t.isChapterTarget,
        topic: t.topic,
        expectedMinutes: t.expectedMinutes,
      });
    });
    vibrate(15);
  }, [addTarget, todayKeyStr]);

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
                activeTargetId={activeSession?.targetId ?? null}
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
                onStartNext={(t) => {
                  vibrate(15);
                  startSession({
                    targetId: t.id,
                    subject: t.subject,
                    chapter: t.chapter,
                    lecture: t.lecture,
                    topic: t.topic,
                    mode: 'focus',
                    expectedMinutes: t.expectedMinutes,
                  });
                  setFocusOpen(true);
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
          onCopyYesterday={copyYesterdayTargets}
        />
      )}

      {/* All-done celebration */}
      {mounted && emptyStateType === 'all-done' && (
        <AllDoneState
          studySecToday={studySecToday}
          doneCount={todayStats.doneCount}
          totalCount={sortedTargets.length}
          streak={streak}
          progressPct={progressPct}
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
   SECTION 4: SUBJECT SECTION (REDESIGNED — Hero Card + Chapter Pills)
   === Modernization plan implemented ===
   - Subject as a Hero Card with colored halo icon + gradient tint + glow border
   - Mini 30px circular progress ring replaces the flat 1.5px bar
   - Time + done count inline ("1h 20m / 2h 30m · 3/5 done")
   - Pulsing "Studying now" chip on active subject
   - Chapter pills strip (horizontal scroll) replaces nested accordions
   - Inline expanded chapter panel for TargetCards
   - "Start next: <target>" gradient button in card footer
   - Add (+) tertiary button + long-press context menu
   ========================================================================= */
function SubjectSection({
  subject, color, chapters, allItems, studiedSec, doneCount, expectedMin,
  subjPct, isActive, activeTargetId, sortedTargets, reorderToday,
  onOpenDetail, onEdit, onAddToSubject, perTargetStats, onStartNext,
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
  activeTargetId: string | null;
  sortedTargets: Target[];
  reorderToday: (newOrder: Target[]) => void;
  onOpenDetail: (t: Target) => void;
  onEdit: (t: Target) => void;
  onAddToSubject: () => void;
  perTargetStats: Map<string, { studiedSec: number; wastedSec: number; sessionCount: number }>;
  onStartNext: (t: Target) => void;
}) {
  // === Expanded chapter index (only one chapter open at a time) ===
  // Default to the chapter containing the active target, else the first
  // chapter with an in-progress (not-done) target.
  const initialExpandedIdx = useMemo(() => {
    if (activeTargetId !== null) {
      const idx = chapters.findIndex(ch => ch.items.some(t => t.id === activeTargetId));
      if (idx >= 0) return idx;
    }
    const idx = chapters.findIndex(ch => ch.items.some(t => !t.done));
    return idx >= 0 ? idx : 0;
  }, [chapters, activeTargetId]);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(initialExpandedIdx);
  const [showCtxMenu, setShowCtxMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Persist expanded chapter across reloads (per-subject)
  const expandKey = `${COLLAPSE_KEY_PREFIX}subj-expanded-${subject}`;
  useEffect(() => {
    try {
      const v = localStorage.getItem(expandKey);
      if (v !== null) {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0 && n < chapters.length) setExpandedIdx(n);
        else if (v === '-1') setExpandedIdx(null);
      }
    } catch {}
  }, [expandKey, chapters.length]);

  const setExpanded = (idx: number | null) => {
    setExpandedIdx(idx);
    try { localStorage.setItem(expandKey, String(idx ?? -1)); } catch {}
  };

  const toggleChapter = (idx: number) => {
    vibrate(8);
    setExpanded(expandedIdx === idx ? null : idx);
  };

  // === "Start next" target — first incomplete target in this subject ===
  const nextTarget = useMemo(() => {
    for (const ch of chapters) {
      const found = ch.items.find(t => !t.done);
      if (found) return found;
    }
    return null;
  }, [chapters]);

  // === Long-press handler — opens context menu ===
  const handlePointerDown = useCallback(() => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      vibrate(15);
      setShowCtxMenu(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  // Close context menu on outside click (the listener is added on next tick
  // so it doesn't catch the same pointerup/click that opened the menu)
  useEffect(() => {
    if (!showCtxMenu) return;
    const handler = (e: MouseEvent) => {
      // Don't close if the click was inside the menu itself
      const target = e.target as HTMLElement;
      if (target.closest('[data-ctx-menu]')) return;
      setShowCtxMenu(false);
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCtxMenu(false); };
    // Delay registration by one tick so the opening pointerup/click doesn't
    // immediately fire the close handler.
    const t = setTimeout(() => {
      window.addEventListener('click', handler);
      window.addEventListener('keydown', escHandler);
      document.body.style.overflow = 'hidden';
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', escHandler);
      document.body.style.overflow = '';
    };
  }, [showCtxMenu]);

  const expectedSec = expectedMin * 60;
  const ringRadius = 15;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDash = ringCirc - (ringCirc * subjPct) / 100;

  return (
    <motion.div
      layout
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => { e.preventDefault(); setShowCtxMenu(true); }}
      className="rounded-2xl p-3 relative overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${color.hex}14 0%, ${color.hex}06 60%, transparent 100%)`,
        border: `1px solid ${isActive ? color.hex : `${color.hex}55`}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: isActive
          ? `0 0 0 1px ${color.hex}40, 0 12px 32px -8px ${color.glow}, 0 0 0 0px transparent`
          : `0 4px 12px -4px ${color.hex}20`,
      }}
    >
      {/* Active radial glow (decorative, top-right) */}
      {isActive && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-40%', right: '-10%',
            width: '60%', height: '80%',
            background: `radial-gradient(ellipse, ${color.hex}30 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative space-y-2.5">
        {/* === HEADER ROW === */}
        <div className="flex items-center gap-2.5">
          {/* Colored halo icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: `${color.hex}1f`,
              boxShadow: isActive
                ? `0 0 0 1px ${color.hex}55, 0 0 14px ${color.hex}50`
                : `0 0 0 1px ${color.hex}35`,
            }}
          >
            <SubjectIcon subject={subject} color={color.hex} size={18} />
          </div>

          {/* Subject name + meta */}
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] font-extrabold uppercase tracking-[1.4px] leading-none"
              style={{ color: color.hex }}
            >
              {subject}
            </div>
            <div
              className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap tabular-nums"
              style={{ color: 'var(--muted-foreground)' }}
              suppressHydrationWarning
            >
              <span>{formatShort(studiedSec)} / {formatShort(expectedSec)}</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span><span className="font-bold" style={{ color: 'var(--foreground)' }}>{doneCount}</span>/{allItems.length} done</span>
              {isActive && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[8.5px] font-bold uppercase tracking-[0.6px]"
                  style={{
                    background: `${color.hex}26`,
                    border: `1px solid ${color.hex}66`,
                    color: color.hex,
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: color.hex,
                      boxShadow: `0 0 5px ${color.hex}`,
                      animation: 'pulse-soft 1.6s ease-in-out infinite',
                    }}
                  />
                  Studying now
                </span>
              )}
            </div>
          </div>

          {/* Mini circular progress ring (36px) */}
          <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r={ringRadius} fill="none"
                      stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="4" />
              <motion.circle
                cx="18" cy="18" r={ringRadius} fill="none"
                stroke={color.hex} strokeWidth="4" strokeLinecap="round"
                initial={false}
                animate={{ strokeDashoffset: ringDash }}
                transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                style={{ strokeDasharray: ringCirc, filter: `drop-shadow(0 0 4px ${color.hex}90)` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold tabular-nums leading-none"
                 style={{ color: color.hex }}>
              {subjPct}%
            </div>
          </div>
        </div>

        {/* === CHAPTER PILLS STRIP === */}
        <div
          className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.subject-${subject}-pills::-webkit-scrollbar{display:none}`}</style>
          {chapters.map((chGroup, idx) => {
            const chDone = chGroup.items.filter(t => t.done).length;
            const chTotal = chGroup.items.length;
            const chStudied = chGroup.items.reduce((a, t) => {
              return a + (perTargetStats.get(t.id)?.studiedSec || 0);
            }, 0);
            const chExpectedSec = chGroup.items.reduce((a, t) => a + t.expectedMinutes, 0) * 60;
            const chPct = chExpectedSec > 0 ? Math.min(100, Math.round((chStudied / chExpectedSec) * 100)) : 0;
            const isDone = chDone === chTotal && chTotal > 0;
            const isExpanded = expandedIdx === idx;
            const hasActiveTarget = activeTargetId !== null && chGroup.items.some(t => t.id === activeTargetId);

            const pillStyle: React.CSSProperties = isExpanded
              ? {
                  background: `linear-gradient(135deg, ${color.hex}, ${color.hex}cc)`,
                  color: '#fff',
                  border: `1px solid ${color.hex}`,
                  boxShadow: `0 0 0 2px ${color.hex}30, 0 4px 10px -2px ${color.glow}`,
                }
              : isDone
              ? {
                  background: `${color.hex}12`,
                  color: color.hex,
                  border: `1px solid ${color.hex}30`,
                }
              : {
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                };

            return (
              <button
                key={chGroup.chapter}
                onClick={() => toggleChapter(idx)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95"
                style={pillStyle}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${chGroup.chapter} chapter (${chDone}/${chTotal} done)`}
                aria-expanded={isExpanded}
              >
                {/* Status indicator: dot / check / pulse */}
                {isDone ? (
                  <Check size={10} strokeWidth={3.5} style={{ color: color.hex }} />
                ) : hasActiveTarget ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: isExpanded ? '#fff' : color.hex,
                      boxShadow: `0 0 5px ${isExpanded ? '#fff' : color.hex}`,
                      animation: 'pulse-soft 1.4s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: isExpanded ? '#fff' : 'currentColor', opacity: isExpanded ? 1 : 0.5 }}
                  />
                )}
                <span className="truncate max-w-[100px]">{chGroup.chapter}</span>
                <span className="opacity-70 tabular-nums">{chDone}/{chTotal}</span>
              </button>
            );
          })}

          {/* + Add chapter pill */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddToSubject(); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shrink-0 transition active:scale-95"
            style={{
              background: 'transparent',
              color: 'var(--muted-foreground)',
              border: '1px dashed var(--border)',
            }}
            aria-label={`Add target to ${subject}`}
            title="Add to this subject"
          >
            <Plus size={10} />
            New
          </button>
        </div>

        {/* === INLINE EXPANDED CHAPTER PANEL === */}
        <AnimatePresence initial={false} mode="wait">
          {expandedIdx !== null && chapters[expandedIdx] && (
            <motion.div
              key={expandedIdx}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE_SMOOTH }}
              className="overflow-hidden"
            >
              <ExpandedChapter
                chapter={chapters[expandedIdx].chapter}
                items={chapters[expandedIdx].items}
                color={color}
                sortedTargets={sortedTargets}
                reorderToday={reorderToday}
                onOpenDetail={onOpenDetail}
                onEdit={onEdit}
                perTargetStats={perTargetStats}
                activeTargetId={activeTargetId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* === FOOTER: Start next + Add === */}
        {nextTarget ? (
          <div
            className="flex items-center gap-2 pt-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              onClick={() => onStartNext(nextTarget)}
              className="flex-1 font-bold py-2 px-3 rounded-xl text-[11px] active:scale-[0.98] transition flex items-center justify-center gap-1.5 min-w-0"
              style={{
                background: `linear-gradient(135deg, ${color.hex}, ${color.hex}dd)`,
                color: '#fff',
                boxShadow: `0 4px 12px -2px ${color.glow}`,
              }}
              aria-label={`Start focus session for next target: ${nextTarget.topic}`}
            >
              <Play size={11} fill="#fff" strokeWidth={0} className="shrink-0" />
              <span className="truncate">Start next: <span className="font-extrabold">{nextTarget.topic}</span></span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToSubject(); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90 shrink-0"
              style={{
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              aria-label={`Add another target to ${subject}`}
              title="Add to this subject"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          // All-done state for this subject
          <div
            className="flex items-center justify-center gap-1.5 pt-2 text-[11px] font-semibold"
            style={{ borderTop: '1px solid var(--border)', color: color.hex }}
          >
            <Check size={12} strokeWidth={3} />
            All {allItems.length} target{allItems.length === 1 ? '' : 's'} done
          </div>
        )}
      </div>

      {/* === LONG-PRESS CONTEXT MENU === */}
      <AnimatePresence>
        {showCtxMenu && (
          <SubjectContextMenu
            subject={subject}
            color={color}
            allItems={allItems}
            onAddToSubject={() => { setShowCtxMenu(false); onAddToSubject(); }}
            onMarkAllDone={() => {
              setShowCtxMenu(false);
              allItems.forEach(t => { if (!t.done) toggleDoneById(t.id); });
              vibrate(20);
            }}
            onCollapseAll={() => {
              setShowCtxMenu(false);
              setExpanded(null);
              vibrate(10);
            }}
            onClose={() => setShowCtxMenu(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Helper — toggle done by id (avoids passing entire targets store down)
function toggleDoneById(id: string) {
  useTargets.getState().toggleDone(id);
}

function SubjectIcon({ subject, color, size = 16 }: { subject: Subject; color: string; size?: number }) {
  // Distinct shape per subject for at-a-glance recognition
  const shapes: Record<Subject, React.ReactNode> = {
    Physics:   <circle cx="8" cy="8" r="6" fill={color} />,
    Chemistry: <rect x="2" y="2" width="12" height="12" rx="3" fill={color} />,
    Botany:    <path d="M8 2 L14 14 L2 14 Z" fill={color} />,
    Zoology:   <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color} />,
    General:   <rect x="4" y="4" width="8" height="8" rx="1" fill={color} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
      {shapes[subject]}
    </svg>
  );
}

/* === Inline expanded chapter panel ===
   Renders TargetCards inside a recessed darker panel.
   Shows chapter name + "X/Y done · Nm left" header. */
function ExpandedChapter({
  chapter, items, color, sortedTargets, reorderToday, onOpenDetail, onEdit,
  perTargetStats, activeTargetId,
}: {
  chapter: string;
  items: Target[];
  color: { hex: string; glow: string };
  sortedTargets: Target[];
  reorderToday: (newOrder: Target[]) => void;
  onOpenDetail: (t: Target) => void;
  onEdit: (t: Target) => void;
  perTargetStats: Map<string, { studiedSec: number; wastedSec: number; sessionCount: number }>;
  activeTargetId: string | null;
}) {
  const chDone = items.filter(t => t.done).length;
  const chStudied = items.reduce((a, t) => a + (perTargetStats.get(t.id)?.studiedSec || 0), 0);
  const chExpectedSec = items.reduce((a, t) => a + t.expectedMinutes, 0) * 60;
  const chRemaining = Math.max(0, chExpectedSec - chStudied);

  return (
    <div
      className="rounded-xl p-2.5 space-y-1.5"
      style={{
        background: 'color-mix(in oklch, var(--background) 50%, transparent)',
        border: `1px solid ${color.hex}25`,
      }}
    >
      {/* Chapter header */}
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <ChevronRight size={10} style={{ color: color.hex, transform: 'rotate(90deg)' }} />
        <span className="text-[10px] font-bold truncate flex-1" style={{ color: 'var(--foreground)' }}>
          {chapter}
        </span>
        <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
          <span className="font-bold" style={{ color: 'var(--foreground)' }}>{chDone}</span>/{items.length} done · {formatHM(chRemaining)} left
        </span>
      </div>

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
    </div>
  );
}

/* === Long-press context menu ===
   Shown when user long-presses the subject card.
   Options: Add target, Mark all done, Collapse all chapters */
function SubjectContextMenu({
  subject, color, allItems, onAddToSubject, onMarkAllDone, onCollapseAll, onClose,
}: {
  subject: Subject;
  color: { hex: string; glow: string };
  allItems: Target[];
  onAddToSubject: () => void;
  onMarkAllDone: () => void;
  onCollapseAll: () => void;
  onClose: () => void;
}) {
  const undoneCount = allItems.filter(t => !t.done).length;
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          data-ctx-menu
          className="w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl pointer-events-auto overflow-hidden"
          style={{
            background: 'var(--popover, rgba(20,22,30,0.98))',
            borderColor: `${color.hex}40`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--border)', background: `${color.hex}10` }}
          >
            <SubjectIcon subject={subject} color={color.hex} size={16} />
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: color.hex }}>
              {subject}
            </span>
            <button
              onClick={onClose}
              className="ml-auto w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition"
              aria-label="Close menu"
            >
              <X size={14} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={onAddToSubject}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                   style={{ background: `${color.hex}20`, color: color.hex }}>
                <Plus size={14} />
              </div>
              <div>
                <div className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Add target to {subject}</div>
                <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Open the Add target sheet</div>
              </div>
            </button>

            <button
              onClick={onMarkAllDone}
              disabled={undoneCount === 0}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left disabled:opacity-40"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                   style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>
                  {undoneCount === 0 ? 'All targets already done' : `Mark all ${undoneCount} as done`}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Bulk complete</div>
              </div>
            </button>

            <button
              onClick={onCollapseAll}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                   style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <ChevronRight size={14} style={{ transform: 'rotate(0deg)' }} />
              </div>
              <div>
                <div className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Collapse all chapters</div>
                <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Hide expanded target lists</div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* =========================================================================
   SECTION 6: EMPTY STATE (REDESIGNED)
   Two variants + onboarding checklist + yesterday summary
   - First-time: 📚 hero + 4-step onboarding checklist (tappable actions)
   - Returning: 🎯 + yesterday summary card + "Repeat yesterday" CTA
   ========================================================================= */
function EmptyState({
  type, yesterdayStats, onAddManual, onCopyYesterday,
}: {
  type: 'first-time' | 'returning';
  yesterdayStats: { studySec: number; doneCount: number; totalCount: number };
  onAddManual: () => void;
  onCopyYesterday: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  const isFirstTime = type === 'first-time';
  const setTab = useNav((s) => s.setTab);

  // === Onboarding checklist data (first-time variant) ===
  const hasTargets = useTargets((s) => Object.keys(s.byDate).length > 0);
  const hasSessions = useHistory((s) => s.sessions.length > 0);
  const hasRoutineBlocks = useRoutine((s) => s.blocks.length > 0);
  const hasSyllabusLectures = useSyllabus((s) => s.lectures.length > 0);

  const checklist = useMemo(() => [
    {
      key: 'target',
      label: 'Add a study target',
      desc: 'Plan what you\'ll study today',
      done: hasTargets,
      action: onAddManual,
    },
    {
      key: 'session',
      label: 'Start a focus session',
      desc: 'Tap ▶ on any target card',
      done: hasSessions,
      action: undefined,
    },
    {
      key: 'routine',
      label: 'Build your routine',
      desc: 'Schedule weekly study blocks',
      done: hasRoutineBlocks,
      action: () => setTab('settings'),
    },
    {
      key: 'syllabus',
      label: 'Add syllabus lectures',
      desc: 'Track chapter-by-chapter progress',
      done: hasSyllabusLectures,
      action: () => setTab('syllabus'),
    },
  ], [hasTargets, hasSessions, hasRoutineBlocks, hasSyllabusLectures, onAddManual, setTab]);

  const doneCount = checklist.filter((c) => c.done).length;
  const yPct = yesterdayStats.totalCount > 0
    ? Math.round((yesterdayStats.doneCount / yesterdayStats.totalCount) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Decorative radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-30%', left: '50%', transform: 'translateX(-50%)',
          width: '80%', height: '60%',
          background: 'radial-gradient(ellipse, rgba(20,184,166,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        {/* Illustration + title */}
        <div className="text-center mb-4">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
            className="text-5xl mb-2 inline-block"
          >
            {isFirstTime ? '📚' : '🎯'}
          </motion.div>
          <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
            {isFirstTime ? 'Welcome to CrackIt!' : 'Nothing planned today yet'}
          </h3>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {isFirstTime ? 'Let\'s set up your study system' : 'Add targets to get back on track'}
          </p>
        </div>

        {/* === FIRST-TIME: Onboarding checklist === */}
        {isFirstTime && (
          <div className="space-y-1.5 mb-4">
            {checklist.map((item, i) => (
              <motion.button
                key={item.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => { if (item.action) { vibrate(8); item.action(); } }}
                disabled={item.done}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition',
                  item.action && !item.done && 'active:scale-[0.98]',
                  item.done && 'opacity-60'
                )}
                style={{
                  background: item.done
                    ? 'rgba(34,197,94,0.06)'
                    : 'var(--muted)',
                  border: `1px solid ${item.done ? 'rgba(34,197,94,0.20)' : 'var(--border)'}`,
                }}
              >
                {item.done ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(34,197,94,0.15)' }}
                  >
                    <Check size={13} strokeWidth={3} className="text-green-500" />
                  </div>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ border: '1.5px solid var(--border)' }}
                  >
                    <Circle size={6} style={{ color: 'var(--muted-foreground)', fill: 'currentColor' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>
                    {item.label}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    {item.done ? 'Done' : item.desc}
                  </div>
                </div>
                {!item.done && item.action && (
                  <ChevronRight size={13} style={{ color: 'var(--muted-foreground)' }} />
                )}
              </motion.button>
            ))}

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                {doneCount} of 4 done
              </span>
              {checklist.map((c) => (
                <span
                  key={c.key}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{
                    background: c.done ? '#22c55e' : 'var(--border)',
                    boxShadow: c.done ? '0 0 4px rgba(34,197,94,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* === RETURNING: Yesterday summary === */}
        {!isFirstTime && yesterdayStats.totalCount > 0 && (
          <div
            className="rounded-xl p-3 mb-4"
            style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.8px]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Yesterday
              </span>
              <span className="text-[10px] tabular-nums font-semibold" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
                {formatHM(yesterdayStats.studySec)} studied
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--bar-track, rgba(255,255,255,0.08))' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #14b8a6, #22c55e)' }}
                  initial={false}
                  animate={{ width: `${yPct}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                />
              </div>
              <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
                {yesterdayStats.doneCount}/{yesterdayStats.totalCount} done
              </span>
            </div>
          </div>
        )}

        {/* === CTAs === */}
        <div className="flex flex-col gap-2">
          {!isFirstTime && yesterdayStats.totalCount > 0 ? (
            <>
              <button
                onClick={() => { vibrate(15); onCopyYesterday(); }}
                className="w-full font-bold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #0d9488, #16a34a)', color: '#fff', boxShadow: '0 4px 12px -2px rgba(20,184,166,0.45)' }}
              >
                <Copy size={14} />
                Repeat yesterday · {yesterdayStats.totalCount} target{yesterdayStats.totalCount === 1 ? '' : 's'}
              </button>
              <button
                onClick={onAddManual}
                className="w-full font-semibold py-2.5 rounded-xl text-sm border transition active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <Plus size={14} />
                Add a new target
              </button>
            </>
          ) : (
            <button
              onClick={onAddManual}
              className="w-full font-bold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #0d9488, #16a34a)', color: '#fff', boxShadow: '0 4px 12px -2px rgba(20,184,166,0.45)' }}
            >
              <Plus size={14} />
              {isFirstTime ? 'Add your first target' : 'Add a target for today'}
            </button>
          )}
        </div>

        {/* Tip */}
        <p
          className="text-[10px] italic pt-3 mt-3 text-center"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          💡 Tip: Aim for 4-6 targets per day for balanced prep.
        </p>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   ALL-DONE STATE (REDESIGNED)
   Confetti burst + today's stats + streak chip + CTAs
   ========================================================================= */
function AllDoneState({
  studySecToday, doneCount, totalCount, streak, progressPct, onAddMore,
}: {
  studySecToday: number;
  doneCount: number;
  totalCount: number;
  streak: number;
  progressPct: number;
  onAddMore: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;
  const setTab = useNav((s) => s.setTab);

  // === Confetti particles (generated once per mount) ===
  const particles = useMemo(() => {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];
    return Array.from({ length: 16 }, (_, i) => ({
      x: (Math.random() - 0.5) * 240,
      y: -(50 + Math.random() * 100),
      rotate: (Math.random() - 0.5) * 540,
      color: colors[i % colors.length],
      delay: Math.random() * 0.35,
      size: 4 + Math.random() * 5,
      round: Math.random() > 0.5,
    }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(20,184,166,0.05)), color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid rgba(34,197,94,0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Confetti burst */}
      {animate && (
        <div className="absolute inset-x-0 top-8 pointer-events-none" style={{ height: 0 }}>
          {particles.map((p, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{
                left: '50%', top: 0,
                width: p.size, height: p.size,
                background: p.color,
                borderRadius: p.round ? '50%' : '1px',
              }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
              animate={{
                x: p.x, y: p.y, rotate: p.rotate, scale: [0, 1, 0.8],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      <div className="relative">
        {/* Hero */}
        <div className="text-center mb-4">
          <motion.div
            animate={{ scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }}
            transition={{ duration: 2.2, repeat: animate ? Infinity : 0, ease: 'easeInOut' }}
            className="text-5xl mb-2 inline-block"
          >
            🎉
          </motion.div>
          <h3 className="text-base font-bold flex items-center justify-center gap-1.5" style={{ color: 'var(--foreground)' }}>
            All done for today!
            <Trophy size={15} className="text-amber-500" />
          </h3>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
            You crushed it. Every target complete.
          </p>
        </div>

        {/* Today's stats */}
        <div
          className="grid grid-cols-3 gap-2 mb-3 py-3"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="text-center">
            <div className="text-[16px] font-black tabular-nums leading-none" style={{ color: '#22c55e' }} suppressHydrationWarning>
              {formatHM(studySecToday)}
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Focused
            </div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black tabular-nums leading-none" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
              {doneCount}/{totalCount}
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Targets
            </div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black tabular-nums leading-none" style={{ color: '#14b8a6' }} suppressHydrationWarning>
              {progressPct}%
            </div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.6px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Of goal
            </div>
          </div>
        </div>

        {/* Streak chip */}
        {streak >= 2 && (
          <div className="flex justify-center mb-3">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(249,115,22,0.15)',
                border: '1px solid rgba(249,115,22,0.35)',
                color: '#f97316',
              }}
            >
              <Flame size={11} />
              {streak}-day streak — keep it alive!
            </span>
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={() => { vibrate(12); onAddMore(); }}
            className="flex-1 font-bold py-2.5 rounded-xl text-[12px] active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 4px 12px -2px rgba(34,197,94,0.45)' }}
          >
            <Plus size={13} />
            Add more targets
          </button>
          <button
            onClick={() => { vibrate(10); setTab('stats'); }}
            className="px-4 py-2.5 rounded-xl text-[12px] font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <BarChart3 size={13} />
            Stats
          </button>
        </div>
      </div>
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
