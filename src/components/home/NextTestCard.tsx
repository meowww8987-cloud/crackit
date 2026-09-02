'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, Plus, Flame, Zap, Droplet, Wind } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { useNav } from '@/lib/store/nav';
import { subjectColor } from '@/lib/colors';
import { computeTestReadiness, getTestToday } from '@/lib/testReadiness';
import { getChaptersForSubject } from '@/lib/neetSyllabus';
import { pushToast } from '@/components/shared/Toast';
import type { Test, Subject } from '@/lib/types';
import { cn, diffDays, todayKey, vibrate } from '@/lib/utils';
import { useVisibility, useReducedMotion } from '@/lib/hooks/useVisibility';

const MOTIVATIONAL_QUOTES = [
  'You\'ve prepared for this. Trust your work.',
  'Calm mind. Steady hand. One question at a time.',
  'The exam tests consistency, not perfection.',
  'Breathe. Read. Answer. Repeat.',
  'Your future self is watching. Make them proud.',
  'Every hour you studied is in your muscles now.',
];

/**
 * Smart "Next Test" card for the Home tab. Collapsed by default showing only
 * the test name + days away + overall readiness %. Tap to expand for
 * per-subject readiness breakdown + critical gaps with "Add as targets" CTA.
 *
 * If today IS a test day, this component returns null so the TestDayMode
 * card can render in its place (TestDayMode is a separate component).
 */
export function NextTestCard() {
  const tests = useTests((s) => s.tests);
  const syllabus = useSyllabus();
  const addTarget = useTargets((s) => s.addTarget);
  const setTab = useNav((s) => s.setTab);
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  const [expanded, setExpanded] = useState(false);

  const nextTest = useMemo(() => {
    const today = todayKey();
    return (
      tests
        .filter((t) => diffDays(today, t.date) >= 0)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null
    );
  }, [tests]);

  // Don't render if today is a test day — TestDayMode handles that
  const todayTest = useMemo(() => getTestToday(tests), [tests]);
  if (todayTest) return null;
  if (!nextTest) return null;

  const readiness = useMemo(
    () =>
      computeTestReadiness(
        nextTest,
        syllabus.chapters,
        syllabus.lectures,
        syllabus.subjects,
      ),
    [nextTest, syllabus.chapters, syllabus.lectures, syllabus.subjects],
  );

  const days = diffDays(todayKey(), nextTest.date);

  const handleAddGapAsTargets = () => {
    vibrate(15);
    let added = 0;
    for (const gap of readiness.criticalGaps) {
      // Find or auto-create the user-syllabus chapter matching this NEET chapter
      let subjectEntity = syllabus.subjects.find((s) => s.name === gap.subject);
      if (!subjectEntity) {
        syllabus.addSubject(gap.subject);
        subjectEntity = useSyllabus.getState().subjects.find((s) => s.name === gap.subject);
      }
      if (!subjectEntity) continue;

      let userCh = syllabus.chapters.find(
        (c) => c.subjectId === subjectEntity!.id && c.name === gap.chapterName,
      );
      if (!userCh) {
        userCh = useSyllabus.getState().chapters.find(
          (c) => c.subjectId === subjectEntity!.id && c.name === gap.chapterName,
        );
        if (!userCh) {
          const newId = syllabus.addChapter(subjectEntity.id, gap.chapterName);
          addTarget({
            date: todayKey(),
            subject: gap.subject,
            activity: 'Revision',
            chapter: gap.chapterName,
            topic: `Revise: ${gap.chapterName}`,
            expectedMinutes: 60,
            chapterId: newId,
            isChapterTarget: true,
          });
          added++;
          continue;
        }
      }
      addTarget({
        date: todayKey(),
        subject: gap.subject,
        activity: 'Revision',
        chapter: gap.chapterName,
        topic: `Revise: ${gap.chapterName}`,
        expectedMinutes: 60,
        chapterId: userCh.id,
        isChapterTarget: true,
      });
      added++;
    }
    if (added > 0) {
      pushToast(
        `${added} revision target${added === 1 ? '' : 's'} added`,
        'Tap Study tab to start',
        'success',
      );
      setTab('study');
    }
  };

  return (
    <motion.div
      layout
      className="glass rounded-2xl overflow-hidden border border-teal-500/15"
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => { vibrate(8); setExpanded(!expanded); }}
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-foreground/[0.04] transition"
      >
        <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Next Test</div>
          <div className="text-sm font-semibold truncate">{nextTest.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {nextTest.type} ·{' '}
            {days === 0
              ? 'Today'
              : days === 1
              ? 'Tomorrow'
              : `${days} days away`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold tabular text-teal-400">
            {readiness.overallPct}%
          </div>
          <div className="text-[9px] text-muted-foreground">ready</div>
        </div>
        <ChevronDown
          size={16}
          className={cn('text-muted-foreground/60 transition-transform shrink-0', expanded && 'rotate-180')}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
              {/* Per-subject readiness bars */}
              {readiness.subjects.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Subject Readiness
                  </div>
                  {readiness.subjects.map((sr) => {
                    const c = subjectColor(sr.subject);
                    return (
                      <div key={sr.subject} className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-semibold w-14 shrink-0"
                          style={{ color: c.hex }}
                        >
                          {sr.subject.slice(0, 4)}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-foreground/5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: c.hex }}
                            initial={{ width: 0 }}
                            animate={{ width: `${sr.pct}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <span className="text-[10px] tabular text-muted-foreground w-14 text-right">
                          {sr.done}/{sr.total}
                        </span>
                        <span
                          className="text-[10px] tabular font-bold w-8 text-right"
                          style={{ color: c.hex }}
                        >
                          {sr.pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Critical gaps */}
              {readiness.criticalGaps.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-1.5 flex items-center gap-1">
                    ⚠ Critical Gaps · {readiness.criticalGaps.length} high-weight chapters unfinished
                  </div>
                  <div className="space-y-1">
                    {readiness.criticalGaps.slice(0, 4).map((gap) => {
                      const c = subjectColor(gap.subject);
                      return (
                        <div
                          key={gap.neetChapterId}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className="text-[9px] px-1 py-0.5 rounded font-bold"
                            style={{ background: `${c.hex}25`, color: c.hex }}
                          >
                            {gap.subject.slice(0, 3)}
                          </span>
                          <span className="text-muted-foreground truncate flex-1">
                            {gap.chapterName}
                          </span>
                          <span className="text-[9px] text-amber-400 font-bold shrink-0">
                            ⭐{gap.weightage}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleAddGapAsTargets}
                    className="w-full mt-2 py-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                  >
                    <Plus size={12} /> Add {readiness.criticalGaps.length} as revision targets
                  </button>
                </div>
              )}

              {readiness.criticalGaps.length === 0 && readiness.overallPct >= 80 && (
                <div className="text-center py-2 text-xs text-green-400">
                  ✓ All high-weight chapters covered. You're test-ready!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Test Day Mode — replaces the regular Home layout when today is a test day.
 * Shows: time until test start, last 3 test average, motivational quote,
 * hydration/breath reminders. Compact, calming, distraction-free.
 */
export function TestDayMode() {
  const tests = useTests((s) => s.tests);
  const setTab = useNav((s) => s.setTab);

  const todayInfo = useMemo(() => getTestToday(tests), [tests]);
  if (!todayInfo) return null;

  const { test, hoursUntilStart, hasStarted } = todayInfo;

  // Last 3 tests average
  const pastTests = useMemo(
    () =>
      tests
        .filter((t) => t.totalMarks !== undefined && t.date < todayKey())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
    [tests],
  );
  const avgScore =
    pastTests.length > 0
      ? Math.round(
          pastTests.reduce((a, t) => a + (t.totalMarks ?? 0), 0) / pastTests.length,
        )
      : null;

  // Pick a deterministic quote for the day (so it doesn't change on every render)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const quote = MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="rounded-2xl p-5 mb-4 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(20,184,166,0.18), rgba(34,197,94,0.10) 60%, rgba(0,0,0,0))',
        border: '1px solid rgba(20,184,166,0.3)',
      }}
    >
      {/* Background pulse */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.05, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-teal-500/20 blur-2xl pointer-events-none"
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Flame size={18} className="text-teal-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
            Test Day
          </span>
        </div>

        {/* Test name + countdown */}
        <h2 className="text-xl font-bold mb-1">{test.name}</h2>
        <div className="text-xs text-muted-foreground mb-4">{test.type}</div>

        {!hasStarted ? (
          <div className="mb-4">
            <div className="text-[10px] text-muted-foreground mb-1">Test starts in</div>
            <div className="text-4xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
              {hoursUntilStart > 1
                ? `${Math.floor(hoursUntilStart)}h ${Math.round((hoursUntilStart % 1) * 60)}m`
                : `${Math.round(hoursUntilStart * 60)}m`}
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-teal-500/15 text-center">
            <div className="text-sm font-bold text-teal-300">Test in progress</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Log your result afterwards from the Tests tab
            </div>
          </div>
        )}

        {/* Avg score */}
        {avgScore !== null && (
          <div className="glass rounded-xl p-3 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground">Last 3 tests avg</div>
              <div className="text-xl font-bold tabular text-teal-400">{avgScore}<span className="text-xs text-muted-foreground">/720</span></div>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              Today's goal:<br />
              <span className="text-green-400 font-bold">beat {avgScore}</span>
            </div>
          </div>
        )}

        {/* Motivational quote */}
        <div className="glass rounded-xl p-3 mb-3 text-center">
          <div className="text-xs italic text-foreground">"{quote}"</div>
        </div>

        {/* Reminders row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-2 flex flex-col items-center gap-0.5">
            <Droplet size={14} className="text-blue-400" />
            <span className="text-[9px] text-muted-foreground">Hydrate</span>
          </div>
          <div className="glass rounded-xl p-2 flex flex-col items-center gap-0.5">
            <Wind size={14} className="text-teal-400" />
            <span className="text-[9px] text-muted-foreground">Breathe</span>
          </div>
          <div className="glass rounded-xl p-2 flex flex-col items-center gap-0.5">
            <Zap size={14} className="text-amber-400" />
            <span className="text-[9px] text-muted-foreground">Focus</span>
          </div>
        </div>

        <button
          onClick={() => { vibrate(8); setTab('tests'); }}
          className="w-full mt-3 py-2.5 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-bold active:scale-95 transition"
        >
          Open Tests →
        </button>
      </div>
    </motion.div>
  );
}
