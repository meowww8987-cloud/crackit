'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown, Layers, Edit3, Clock, Play, Pause, Square } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { TestSyllabusPicker } from '@/components/tests/TestSyllabusPicker';
import { TestTimer } from '@/components/tests/TestTimer';
import { RevisionPlanGenerator } from '@/components/tests/TestInsights';
import { computeTestReadiness } from '@/lib/testReadiness';
import { getFullRankPrediction } from '@/lib/neetRankData';
import { getChaptersForSubject } from '@/lib/neetSyllabus';
import { pushToast } from '@/components/shared/Toast';
import type { Test, Subject, SubjectAnalytics } from '@/lib/types';
import { cn, vibrate, diffDays, todayKey } from '@/lib/utils';
import {
  TimeManagementChart,
  NegativeMarkingChart,
  ConfidenceAccuracyChart,
  SmartInsights,
  SillyMistakesTally,
} from '@/components/tests/AnalyticsCharts';

interface Props {
  test: Test;
  onClose: () => void;
}

const EMPTY_ANALYTICS: Record<Subject, SubjectAnalytics> = {
  Physics: { attempted: 0, correct: 0, wrong: 0, timeSpent: 0, sillyMistakes: 0, confidence: 3, marks: 0 },
  Chemistry: { attempted: 0, correct: 0, wrong: 0, timeSpent: 0, sillyMistakes: 0, confidence: 3, marks: 0 },
  Botany: { attempted: 0, correct: 0, wrong: 0, timeSpent: 0, sillyMistakes: 0, confidence: 3, marks: 0 },
  Zoology: { attempted: 0, correct: 0, wrong: 0, timeSpent: 0, sillyMistakes: 0, confidence: 3, marks: 0 },
  General: { attempted: 0, correct: 0, wrong: 0, timeSpent: 0, sillyMistakes: 0, confidence: 3, marks: 0 },
};

export function TestDetailSheet({ test, onClose }: Props) {
  const setResult = useTests((s) => s.setResult);
  const setAnalytics = useTests((s) => s.setAnalytics);
  const setSyllabus = useTests((s) => s.setSyllabus);
  const deleteTest = useTests((s) => s.deleteTest);
  const isUpcoming = diffDays(todayKey(), test.date) >= 0;

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSyllabusPicker, setShowSyllabusPicker] = useState(false);
  const [totalMarks, setTotalMarks] = useState(test.totalMarks?.toString() || '');
  const [subjectMarks, setSubjectMarks] = useState<Record<Subject, string>>({
    Physics: test.subjectMarks?.Physics?.toString() || '',
    Chemistry: test.subjectMarks?.Chemistry?.toString() || '',
    Botany: test.subjectMarks?.Botany?.toString() || '',
    Zoology: test.subjectMarks?.Zoology?.toString() || '',
    General: test.subjectMarks?.General?.toString() || '',
  });
  const [strongTopics, setStrongTopics] = useState(test.strongTopics || '');
  const [weakTopics, setWeakTopics] = useState(test.weakTopics || '');
  const [notes, setNotes] = useState(test.notes || '');
  const [analytics, setAnalyticsState] = useState<Record<Subject, SubjectAnalytics>>(
    test.analytics || { ...EMPTY_ANALYTICS }
  );

  // Resolve test's user-syllabus chapters back to NEET chapter IDs for picker initial state
  const syllabus = useSyllabus();
  const initialNeetChapterIds = useMemo(() => {
    if (!test.syllabus?.chapterIds) return [];
    const userChaptersInTest = syllabus.chapters.filter((c) =>
      test.syllabus!.chapterIds.includes(c.id),
    );
    // Build name → neet id map
    const allNeet: { id: string; name: string }[] = [];
    for (const subj of SUBJECTS.filter((s) => s !== 'General')) {
      allNeet.push(...getChaptersForSubject(subj).map((c) => ({ id: c.id, name: c.name })));
    }
    const nameToId = new Map(allNeet.map((c) => [c.name, c.id]));
    return userChaptersInTest
      .map((c) => nameToId.get(c.name))
      .filter((x): x is string => !!x);
  }, [test.syllabus, syllabus.chapters]);

  // Compute readiness for this test's syllabus scope (live)
  const readiness = useMemo(
    () => computeTestReadiness(test, syllabus.chapters, syllabus.lectures, syllabus.subjects),
    [test, syllabus.chapters, syllabus.lectures, syllabus.subjects],
  );

  const handleSaveResult = () => {
    vibrate(12);
    // Set takenAt to NOW if not already set (first time saving results).
    // This captures the time-of-day for behavior pattern detection.
    const takenAt = test.takenAt ?? Date.now();
    setResult(test.id, {
      totalMarks: totalMarks ? Number(totalMarks) : undefined,
      subjectMarks: Object.fromEntries(
        Object.entries(subjectMarks).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])
      ) as Record<Subject, number>,
      strongTopics: strongTopics || undefined,
      weakTopics: weakTopics || undefined,
      notes: notes || undefined,
      takenAt,
    });
    // Post-test syllabus sync: compute per-subject accuracy from analytics (if any)
    // and tag chapters with test history. We do this implicitly via the analytics
    // (which are saved separately) — the readiness function already reads them.
    pushToast('Result saved', `Score: ${totalMarks || '—'} / 720`, 'success');
    onClose();
  };

  const handleSaveAnalytics = () => {
    vibrate(12);
    setAnalytics(test.id, analytics);
    setShowAnalytics(false);
  };

  const handleSyllabusConfirm = (neetIds: string[]) => {
    // Resolve NEET IDs back to user-syllabus chapter IDs (auto-create if missing)
    const userChapterIds: string[] = [];
    for (const neetId of neetIds) {
      let neetChapter: { name: string; subject: Subject } | undefined;
      for (const subj of SUBJECTS.filter((s) => s !== 'General')) {
        const ch = getChaptersForSubject(subj).find((c) => c.id === neetId);
        if (ch) { neetChapter = { name: ch.name, subject: subj }; break; }
      }
      if (!neetChapter) continue;

      let subjectEntity = syllabus.subjects.find((s) => s.name === neetChapter!.subject);
      if (!subjectEntity) {
        syllabus.addSubject(neetChapter.subject);
        subjectEntity = useSyllabus.getState().subjects.find((s) => s.name === neetChapter!.subject);
      }
      if (!subjectEntity) continue;

      let userCh = syllabus.chapters.find(
        (c) => c.subjectId === subjectEntity!.id && c.name === neetChapter!.name,
      );
      if (!userCh) {
        userCh = useSyllabus.getState().chapters.find(
          (c) => c.subjectId === subjectEntity!.id && c.name === neetChapter!.name,
        );
        if (!userCh) {
          const newId = syllabus.addChapter(subjectEntity.id, neetChapter.name);
          userChapterIds.push(newId);
          continue;
        }
      }
      userChapterIds.push(userCh.id);
    }
    setSyllabus(test.id, { chapterIds: userChapterIds, lectureIds: [] });
    setShowSyllabusPicker(false);
    pushToast('Syllabus updated', `${userChapterIds.length} chapters in scope`, 'info');
  };

  const handleDelete = () => {
    if (confirm('Delete this test?')) {
      deleteTest(test.id);
      onClose();
    }
  };

  const testSubjects = SUBJECTS.filter((s) => s !== 'General');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto scroll-area"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">
                {test.type}
              </span>
              <span className="text-[10px] text-white/40">
                {new Date(test.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h2 className="text-lg font-bold">{test.name}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Syllabus Scope Card */}
        <div className="glass rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Layers size={12} className="text-teal-400" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                Syllabus Scope
              </span>
            </div>
            <button
              onClick={() => { vibrate(8); setShowSyllabusPicker(true); }}
              className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1"
            >
              <Edit3 size={10} /> Edit
            </button>
          </div>
          {readiness.subjects.length === 0 ? (
            <div className="text-xs text-white/40">
              No syllabus scope set. Tap Edit to define what this test covers.
            </div>
          ) : (
            <div className="space-y-1.5">
              {readiness.subjects.map((sr) => {
                const c = subjectColor(sr.subject);
                return (
                  <div key={sr.subject} className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold w-16 shrink-0" style={{ color: c.hex }}>
                      {sr.subject.slice(0, 4)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${sr.pct}%`, background: c.hex }}
                      />
                    </div>
                    <span className="text-[10px] tabular text-white/60 w-16 text-right">
                      {sr.done}/{sr.total}
                    </span>
                    <span className="text-[10px] tabular font-bold w-8 text-right" style={{ color: c.hex }}>
                      {sr.pct}%
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/10">
                <span className="text-[10px] text-white/50">Overall readiness</span>
                <span className="text-xs font-bold tabular text-teal-400">{readiness.overallPct}%</span>
              </div>
            </div>
          )}
        </div>

        {isUpcoming ? (
          <UpcomingView test={test} readinessPct={readiness.overallPct} />
        ) : (
          <>
            {/* Result entry */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">TOTAL MARKS (/720)</label>
                <input
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  placeholder="e.g. 580"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">SUBJECT-WISE MARKS (/180)</label>
                <div className="grid grid-cols-2 gap-2">
                  {testSubjects.map((s) => {
                    const c = subjectColor(s);
                    return (
                      <div key={s} className="flex items-center gap-2 bg-white/5 rounded-xl px-2 py-1.5">
                        <div className="w-2 h-6 rounded" style={{ background: c.hex }} />
                        <input
                          type="number"
                          value={subjectMarks[s]}
                          onChange={(e) => setSubjectMarks({ ...subjectMarks, [s]: e.target.value })}
                          placeholder={s.slice(0, 4)}
                          className="flex-1 bg-transparent text-sm focus:outline-none w-full"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">STRONG TOPICS</label>
                <textarea
                  value={strongTopics}
                  onChange={(e) => setStrongTopics(e.target.value)}
                  placeholder="Topics you felt confident about..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400/50 min-h-[60px]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">WEAK TOPICS</label>
                <textarea
                  value={weakTopics}
                  onChange={(e) => setWeakTopics(e.target.value)}
                  placeholder="Topics you struggled with..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400/50 min-h-[60px]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 mb-2 block">NOTES</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other observations..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400/50 min-h-[60px]"
                />
              </div>

              <button
                onClick={handleSaveResult}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98]"
              >
                Save Result
              </button>

              {/* Predicted Rank card — shows when totalMarks is set */}
              {test.totalMarks !== undefined && test.totalMarks > 0 && (() => {
                const rank = getFullRankPrediction(test.totalMarks);
                if (!rank) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-4 border"
                    style={{
                      background: `linear-gradient(135deg, ${rank.color}15, transparent)`,
                      borderColor: `${rank.color}40`,
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                      Predicted NEET Rank
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <div className="text-3xl font-bold tabular" style={{ color: rank.color }}>
                        ~{rank.rank > 999 ? `${(rank.rank / 1000).toFixed(1)}k` : rank.rank}
                      </div>
                      <div className="text-xs text-white/50">AIR (approx)</div>
                    </div>
                    <div className="text-xs font-semibold" style={{ color: rank.color }}>
                      {rank.assessment}
                    </div>
                    <div className="text-[10px] text-white/40 mt-1">
                      Top {rank.percentile}% · based on 2024 NEET data
                    </div>
                  </motion.div>
                );
              })()}

              {/* 7-Day Revision Plan generator */}
              <RevisionPlanGenerator test={test} />

              {/* Deep analytics toggle */}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white/70 text-sm font-semibold flex items-center justify-center gap-2"
              >
                Deep Analytics
                {test.hasAnalytics && <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">SAVED</span>}
                <ChevronDown size={14} className={cn('transition-transform', showAnalytics && 'rotate-180')} />
              </button>

              {showAnalytics && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  <p className="text-[10px] text-white/40">Per-subject deep analysis (optional)</p>
                  {testSubjects.map((s) => (
                    <SubjectAnalyticsInput
                      key={s}
                      subject={s}
                      data={analytics[s]}
                      onChange={(d) => setAnalyticsState({ ...analytics, [s]: d })}
                    />
                  ))}
                  <button
                    onClick={handleSaveAnalytics}
                    className="w-full py-2.5 rounded-xl bg-teal-500 text-black font-bold text-sm active:scale-[0.98]"
                  >
                    Save Analytics
                  </button>
                </motion.div>
              )}

              {/* Charts (if analytics saved) */}
              {test.hasAnalytics && test.analytics && (
                <div className="space-y-4 pt-2">
                  <ChartBlock title="Time Management (min per subject)"><TimeManagementChart analytics={test.analytics} /></ChartBlock>
                  <ChartBlock title="Negative Marking Pattern"><NegativeMarkingChart analytics={test.analytics} /></ChartBlock>
                  <ChartBlock title="Confidence vs Accuracy"><ConfidenceAccuracyChart analytics={test.analytics} /></ChartBlock>
                  <ChartBlock title="Smart Insights"><SmartInsights analytics={test.analytics} /></ChartBlock>
                  <ChartBlock title="Silly Mistakes Tally"><SillyMistakesTally analytics={test.analytics} /></ChartBlock>
                </div>
              )}

              <button
                onClick={handleDelete}
                className="w-full py-2.5 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm active:scale-[0.98]"
              >
                Delete Test
              </button>
            </div>
          </>
        )}
      </motion.div>

      {showSyllabusPicker && (
        <TestSyllabusPicker
          onClose={() => setShowSyllabusPicker(false)}
          onConfirm={handleSyllabusConfirm}
          initialSelected={initialNeetChapterIds}
          title={`Edit Syllabus · ${test.name}`}
          allowMultipleSubjects
        />
      )}
    </motion.div>
  );
}

function UpcomingView({ test, readinessPct }: { test: Test; readinessPct: number }) {
  const days = diffDays(todayKey(), test.date);
  const [showTimer, setShowTimer] = useState(false);
  const startTimer = useTests((s) => s.startTimer);
  const pauseTimer = useTests((s) => s.pauseTimer);
  const resumeTimer = useTests((s) => s.resumeTimer);

  // Live ticking for elapsed display
  const [, setTick] = useState(0);
  useState(() => {
    if (test.timerState !== 'running') return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  });

  if (showTimer) {
    return <TestTimer testId={test.id} onClose={() => setShowTimer(false)} />;
  }

  const elapsedSec = (test.timerElapsedSec || 0) +
    (test.timerState === 'running' && test.timerStartedAt
      ? Math.floor((Date.now() - test.timerStartedAt) / 1000)
      : 0);
  const totalSec = (test.duration || 200) * 60;
  const remainingSec = Math.max(0, totalSec - elapsedSec);

  return (
    <div className="space-y-4">
      {/* Days + readiness */}
      <div className="text-center py-2">
        <div className="text-4xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent mb-1">
          {days}
        </div>
        <div className="text-xs text-white/50 mb-4">days away</div>
        <div className="glass rounded-xl p-4 text-left">
          <div className="text-xs text-white/50 mb-1">Syllabus Readiness</div>
          <div className="text-2xl font-bold tabular text-teal-400">{readinessPct}%</div>
          <p className="text-[10px] text-white/40 mt-2">
            Based on lectures completed in the test's syllabus scope. Tap "Edit" above to adjust scope.
          </p>
        </div>
      </div>

      {/* Test Timer card */}
      <div className="glass rounded-2xl p-4 border border-teal-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-teal-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-white/60">
            Test Timer
          </span>
          {test.timerState === 'running' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/30 text-green-300 pulse-slow ml-auto">
              ● LIVE
            </span>
          )}
          {test.timerState === 'paused' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 ml-auto">
              ⏸ PAUSED
            </span>
          )}
          {test.timerState === 'completed' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60 ml-auto">
              ✓ DONE
            </span>
          )}
        </div>

        {/* Timer display */}
        <div className="text-center mb-3">
          <div className="text-[10px] text-white/40 uppercase tracking-wide">
            {test.timerState === 'not_started' ? 'Duration' :
             test.timerState === 'completed' ? 'Time taken' : 'Time remaining'}
          </div>
          <div
            className="text-3xl font-bold tabular"
            style={{
              color: test.timerState === 'running' && remainingSec < 600 ? '#ef4444'
                   : test.timerState === 'running' && remainingSec < 1800 ? '#f59e0b'
                   : '#22c55e',
            }}
          >
            {test.timerState === 'not_started'
              ? `${Math.floor((totalSec / 3600))}h ${Math.floor((totalSec % 3600) / 60)}m`
              : test.timerState === 'completed'
              ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
              : `${Math.floor(remainingSec / 3600)}:${String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0')}:${String(remainingSec % 60).padStart(2, '0')}`}
          </div>
          {test.timerState === 'running' && (
            <div className="text-[10px] text-white/40 mt-1">
              {Math.round((elapsedSec / totalSec) * 100)}% elapsed
            </div>
          )}
        </div>

        {/* Timer controls */}
        <div className="flex gap-2">
          {test.timerState === 'not_started' && (
            <button
              onClick={() => { vibrate(15); startTimer(test.id); setShowTimer(true); }}
              className="flex-1 py-2.5 rounded-xl bg-green-500 text-black font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Play size={12} fill="currentColor" /> Start Test (Full Screen)
            </button>
          )}
          {test.timerState === 'running' && (
            <>
              <button
                onClick={() => { vibrate(10); pauseTimer(test.id); }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Pause size={12} fill="currentColor" /> Pause
              </button>
              <button
                onClick={() => setShowTimer(true)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs active:scale-95"
              >
                Open Full Screen
              </button>
            </>
          )}
          {test.timerState === 'paused' && (
            <>
              <button
                onClick={() => { vibrate(15); resumeTimer(test.id); setShowTimer(true); }}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-black font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Play size={12} fill="currentColor" /> Resume
              </button>
              <button
                onClick={() => setShowTimer(true)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs active:scale-95"
              >
                Open Full Screen
              </button>
            </>
          )}
          {test.timerState === 'completed' && (
            <div className="flex-1 py-2.5 rounded-xl bg-green-500/15 text-green-400 font-bold text-xs text-center">
              ✓ Test completed — enter results below
            </div>
          )}
        </div>
        <div className="text-[10px] text-white/40 mt-2 text-center">
          Subject sections: Physics → Chemistry → Botany → Zoology (50 min each)
        </div>
      </div>
    </div>
  );
}

function SubjectAnalyticsInput({ subject, data, onChange }: { subject: Subject; data: SubjectAnalytics; onChange: (d: SubjectAnalytics) => void }) {
  const c = subjectColor(subject);
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-4 rounded" style={{ background: c.hex }} />
        <span className="text-xs font-bold" style={{ color: c.hex }}>{subject}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <NumInput label="Attempted" value={data.attempted} onChange={(v) => onChange({ ...data, attempted: v })} />
        <NumInput label="Correct" value={data.correct} onChange={(v) => onChange({ ...data, correct: v })} />
        <NumInput label="Wrong" value={data.wrong} onChange={(v) => onChange({ ...data, wrong: v })} />
        <NumInput label="Time (min)" value={data.timeSpent} onChange={(v) => onChange({ ...data, timeSpent: v })} />
        <NumInput label="Silly mistakes" value={data.sillyMistakes} onChange={(v) => onChange({ ...data, sillyMistakes: v })} />
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Confidence</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => { onChange({ ...data, confidence: d }); vibrate(6); }}
                className={cn('w-5 h-5 rounded-full text-[10px] font-bold', d <= data.confidence ? 'bg-teal-500 text-black' : 'bg-white/10 text-white/40')}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-white/40 block mb-1">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-400/50"
      />
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-3">
      <h4 className="text-xs font-bold text-white/70 mb-2">{title}</h4>
      {children}
    </div>
  );
}
