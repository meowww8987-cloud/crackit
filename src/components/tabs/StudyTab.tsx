'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Sparkles, X, Check, ChevronRight,
  Flame, Eye, EyeOff, RefreshCw, Play,
  BookOpen, FileText, Zap, RotateCcw,
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
import { generateSmartPlan } from '@/lib/smartPlan';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, shortDate, formatHM, todayKey, addDays, vibrate } from '@/lib/utils';
import { TargetCard } from '@/components/study/TargetCard';
import { AddTargetSheet } from '@/components/study/AddTargetSheet';
import { DetailSheet } from '@/components/study/DetailSheet';
import { DoubtSheet } from '@/components/doubts/DoubtSheet';

const EMPTY_TARGETS: Target[] = [];
const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;

// LocalStorage keys for collapse state persistence
const COLLAPSE_KEY_PREFIX = 'neet-collapse-';

export function StudyTab() {
  const todayKeyStr = todayKey();
  const todayTargets = useTargets((s) => s.byDate[todayKeyStr] || EMPTY_TARGETS);
  const reorderToday = useTargets((s) => s.reorderToday);
  const addTarget = useTargets((s) => s.addTarget);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [detailTarget, setDetailTarget] = useState<Target | null>(null);
  const [showDoubts, setShowDoubts] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Floating widget visibility
  const widgetHidden = useSession((s) => s.widgetHidden);
  const setWidgetHidden = useSession((s) => s.setWidgetHidden);
  const activeSession = useSession((s) => s.active);

  // === SECTION 10: Reactive selectors (replacing all getState() calls) ===
  const allSessions = useHistory((s) => s.sessions);
  const allDoubts = useDoubts((s) => s.doubts);
  const pendingDoubts = allDoubts.filter((d) => d.status === 'pending').length;
  const lastDoubtSubject = allDoubts.length > 0
    ? [...allDoubts].sort((a, b) => b.createdAt - a.createdAt)[0]?.subject
    : null;

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

  // Live ticking for active session
  const activeFocusSession = useSession((s) => s.active);
  const activePractice = usePractice((s) => s.activePractice);
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    if (!activeFocusSession && !activePractice) return;
    const i = setInterval(() => setLiveTick((t) => t + 1), 1000);
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

  // === Smart Plan state ===
  const showSmartPlan = mounted && (sortedTargets.length === 0 || showSuggestions);
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
    const defaultMinutes = activity === 'DPP' ? 30 : activity === 'Notes' ? 25 : activity === 'Revision' ? 20 : 45;
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
      {/* ============ SECTION 1: HEADER ROW ============ */}
      <HeaderRow
        streak={streak}
        studySecToday={studySecToday}
        doneCount={todayStats.doneCount}
        totalCount={sortedTargets.length}
        progressPct={progressPct}
        widgetHidden={widgetHidden}
        setWidgetHidden={setWidgetHidden}
        activeSession={!!activeSession}
        onToggleSuggestions={() => setShowSuggestions((s) => !s)}
        mounted={mounted}
      />

      {/* ============ SECTION 2: PROGRESS CARD ============ */}
      <ProgressCard
        progressPct={progressPct}
        studySecToday={studySecToday}
        goalSec={goalSec}
        dailyGoal={dailyGoal}
        liveFocus={liveFocus}
        livePractice={livePractice}
        savedStudySec={todayStats.studySec}
        activeSubject={activeSubject}
        mounted={mounted}
      />

      {/* ============ SECTION 3: SMART PLAN (always accessible) ============ */}
      {showSmartPlan && (
        <SmartPlan
          onAcceptAll={() => setShowSuggestions(false)}
          onDismiss={() => setShowSuggestions(false)}
          forceShow={showSuggestions}
        />
      )}

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

      {/* ============ SECTION 6: EMPTY STATE ============ */}
      {mounted && emptyStateType && emptyStateType !== 'all-done' && (
        <EmptyState
          type={emptyStateType}
          yesterdayStats={yesterdayStats}
          onSmartPlan={() => setShowSuggestions(true)}
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
   SECTION 1: HEADER ROW
   Streak flame + date + eye button on row 1
   One-line summary on row 2
   ========================================================================= */
function HeaderRow({
  streak, studySecToday, doneCount, totalCount, progressPct,
  widgetHidden, setWidgetHidden, activeSession, onToggleSuggestions, mounted,
}: {
  streak: number;
  studySecToday: number;
  doneCount: number;
  totalCount: number;
  progressPct: number;
  widgetHidden: boolean;
  setWidgetHidden: (v: boolean) => void;
  activeSession: boolean;
  onToggleSuggestions: () => void;
  mounted: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        {/* Streak flame */}
        <div className="flex items-center gap-1.5 min-w-0">
          {mounted && streak >= 2 ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30"
              title={`${streak}-day streak — keep it up!`}
            >
              <Flame size={12} className="text-orange-400" />
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-300 tabular">{streak}</span>
            </motion.div>
          ) : (
            <div suppressHydrationWarning className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              {shortDate()}
            </div>
          )}
        </div>

        {/* Date (when streak showing) */}
        {mounted && streak >= 2 && (
          <div className="text-[11px] tabular" suppressHydrationWarning style={{ color: 'var(--muted-foreground)' }}>
            {shortDate()}
          </div>
        )}

        {/* Right: Suggestions + Eye */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleSuggestions}
            className="w-8 h-8 rounded-lg glass flex items-center justify-center hover:bg-foreground/10 transition active:scale-95"
            aria-label="Toggle smart plan suggestions"
            title="Smart suggestions"
          >
            <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
          </button>
          <button
            onClick={() => { vibrate(10); setWidgetHidden(!widgetHidden); }}
            className={cn(
              'w-8 h-8 rounded-lg glass flex items-center justify-center hover:bg-foreground/10 transition active:scale-95',
              !activeSession && 'opacity-40'
            )}
            aria-label={widgetHidden ? 'Show floating widget' : 'Hide floating widget'}
            title={widgetHidden ? 'Show widget' : 'Hide widget'}
            disabled={!activeSession}
          >
            {widgetHidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Row 2: One-line summary */}
      <div className="text-[11px] tabular flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{formatHM(studySecToday)}</span>
        <span>studied ·</span>
        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{doneCount}</span>
        <span>/{totalCount} done ·</span>
        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{progressPct}%</span>
        <span>of goal</span>
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 2: PROGRESS CARD
   Circular ring + pace indicator + breakdown
   ========================================================================= */
function ProgressCard({
  progressPct, studySecToday, goalSec, dailyGoal,
  liveFocus, livePractice, savedStudySec, activeSubject, mounted,
}: {
  progressPct: number;
  studySecToday: number;
  goalSec: number;
  dailyGoal: number;
  liveFocus: number;
  livePractice: number;
  savedStudySec: number;
  activeSubject: Subject | null;
  mounted: boolean;
}) {
  const remainingSec = Math.max(0, goalSec - studySecToday);
  const ringColor = activeSubject ? subjectColor(activeSubject).hex : '#14b8a6';
  const ringColor2 = activeSubject ? subjectColor(activeSubject).hex : '#22c55e';

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
  const paceLabel = paceStatus === 'ahead' ? '🔥 ahead of pace' : paceStatus === 'behind' ? '⏰ behind pace' : '✓ on pace';

  const isComplete = progressPct >= 100;

  return (
    <motion.div
      initial={false}
      className="glass rounded-2xl p-3 relative overflow-hidden"
    >
      <div className="flex items-center gap-3">
        {/* Circular ring */}
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="6" />
            <motion.circle
              cx="32" cy="32" r="26" fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset: 163.36 - (163.36 * progressPct) / 100 }}
              transition={{ type: 'spring', stiffness: 60, damping: 20, mass: 1 }}
              style={{
                strokeDasharray: 163.36,
                filter: `drop-shadow(0 0 6px ${ringColor}80)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={Math.floor(progressPct / 5)}  // group by 5% increments to reduce pop frequency
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="text-sm font-bold tabular"
              style={{
                background: isComplete
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
          </div>
          {isComplete && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -top-1 -right-1 text-xs"
              style={{ filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.6))' }}
            >
              🏆
            </motion.div>
          )}
        </div>

        {/* Stats + breakdown */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
              {formatHM(studySecToday)}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              studied
            </span>
            <span className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
              · {formatHM(remainingSec)} to go
            </span>
          </div>

          {/* Pace pill */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular"
              style={{ background: `${paceColor}20`, color: paceColor, border: `1px solid ${paceColor}30` }}
            >
              {paceLabel}
            </span>
            <span className="text-[9px] tabular" style={{ color: 'var(--muted-foreground)' }}>
              goal {dailyGoal}h
            </span>
          </div>

          {/* Breakdown chips */}
          <div className="flex items-center gap-1 flex-wrap">
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
        </div>
      </div>

      {/* Completion glow */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: 'radial-gradient(ellipse at 50% 100%, rgba(34,197,94,0.15) 0%, transparent 70%)',
            }}
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
   SECTION 3: SMART PLAN
   Always accessible, per-card accept, refresh, total time
   ========================================================================= */
function SmartPlan({ onAcceptAll, onDismiss, forceShow }: { onAcceptAll: () => void; onDismiss: () => void; forceShow: boolean }) {
  const addTarget = useTargets((s) => s.addTarget);
  const [dismissed, setDismissed] = useState(false);
  const [regenKey, setRegenKey] = useState(0);
  const sessions = useHistory((s) => s.sessions);
  const syllabus = useSyllabus();
  const todayKeyStr = todayKey();
  const todayTargets = useTargets((s) => s.byDate[todayKeyStr] || EMPTY_TARGETS);

  const suggestions = useMemo(() => {
    const excludeTopics = todayTargets.map((t) => t.topic);
    return generateSmartPlan(
      sessions, syllabus.lectures, syllabus.chapters, syllabus.subjects, excludeTopics
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, syllabus.lectures, syllabus.chapters, syllabus.subjects, todayTargets, regenKey]);

  const totalTime = suggestions.reduce((a, s) => a + s.expectedMinutes, 0);
  const subjectCount = new Set(suggestions.map((s) => s.subject)).size;

  if (dismissed && !forceShow) return null;

  const handleAcceptOne = (idx: number) => {
    const s = suggestions[idx];
    addTarget({ ...s, date: todayKeyStr });
    vibrate(12);
  };

  const handleAcceptAll = () => {
    suggestions.forEach((s) => addTarget({ ...s, date: todayKeyStr }));
    vibrate(15);
    onAcceptAll();
  };

  const handleRefresh = () => {
    vibrate(8);
    setRegenKey((k) => k + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-2xl p-3 border border-teal-400/20"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Suggested for today</span>
        <button onClick={handleRefresh} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition" aria-label="Regenerate suggestions" title="Regenerate">
          <RefreshCw size={12} className="text-muted-foreground" />
        </button>
        <button onClick={() => { setDismissed(true); onDismiss(); }} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition" aria-label="Dismiss">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-1.5 mb-3">
        {suggestions.length === 0 && (
          <div className="text-[11px] italic py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
            No suggestions available — add some lectures to your syllabus first.
          </div>
        )}
        {suggestions.map((s, i) => {
          const c = subjectColor(s.subject);
          return (
            <motion.div
              key={`${regenKey}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-foreground/5 transition group"
              style={{ background: `${c.hex}15` }}
            >
              <div className="w-1 h-8 rounded-full shrink-0" style={{ background: c.hex }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: 'var(--foreground)' }}>{s.topic}</div>
                <div className="text-[9px] flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                  <span style={{ color: c.hex }}>{s.subject}</span>
                  <span>·</span>
                  <span>{s.activity}</span>
                  <span>·</span>
                  <span className="tabular">{s.expectedMinutes}m</span>
                </div>
                <div className="text-[9px] italic mt-0.5 text-teal-600/80 dark:text-teal-600 dark:text-teal-400/70 truncate">{s.reason}</div>
              </div>
              <button
                onClick={() => handleAcceptOne(i)}
                className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-500/15 hover:bg-teal-500/30 text-teal-600 dark:text-teal-400 transition active:scale-90 shrink-0"
                aria-label={`Accept ${s.topic}`}
                title="Add this target"
              >
                <Check size={13} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Footer: total + accept all */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>
            Total <span className="font-bold" style={{ color: 'var(--foreground)' }}>{Math.floor(totalTime / 60)}h {totalTime % 60}m</span>
            <span className="mx-1">·</span>
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>{subjectCount}</span> subject{subjectCount === 1 ? '' : 's'}
          </span>
          <button
            onClick={handleAcceptAll}
            className="ml-auto text-[11px] font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition flex items-center gap-1"
            style={{ background: 'linear-gradient(90deg, #0d9488, #16a34a)', color: '#fff' }}
          >
            <Check size={12} />
            Accept all
          </button>
        </div>
      )}
    </motion.div>
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
  type, yesterdayStats, onSmartPlan, onAddManual,
}: {
  type: 'first-time' | 'returning';
  yesterdayStats: { studySec: number; doneCount: number; totalCount: number };
  onSmartPlan: () => void;
  onAddManual: () => void;
}) {
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
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
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

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onSmartPlan}
          className="w-full font-semibold py-2.5 rounded-xl text-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          style={{ background: 'linear-gradient(90deg, #0d9488, #16a34a)', color: '#fff' }}
        >
          <Sparkles size={14} />
          {isFirstTime ? 'Use Smart Plan' : 'Smart Plan from yesterday'}
        </button>
        <button
          onClick={onAddManual}
          className="w-full font-semibold py-2.5 rounded-xl text-sm border border-border hover:bg-foreground/5 transition flex items-center justify-center gap-1.5"
          style={{ color: 'var(--foreground)' }}
        >
          <Plus size={14} />
          Add new target
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
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-6 text-center space-y-3"
      style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(20,184,166,0.05))' }}
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
    { type: 'Lecture',  label: 'Lecture',  icon: BookOpen, color: '#3b82f6' },
    { type: 'DPP',      label: 'DPP',      icon: FileText, color: '#f97316' },
    { type: 'Notes',    label: 'Notes',    icon: FileText, color: '#22c55e' },
    { type: 'Revision', label: 'Revision', icon: RotateCcw, color: '#a855f7' },
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
                backdropFilter: 'blur(16px)',
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
                      <div className="text-[10px] text-muted-foreground">{opt.type === 'DPP' ? '30 min' : opt.type === 'Notes' ? '25 min' : opt.type === 'Revision' ? '20 min' : '45 min'}</div>
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
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
