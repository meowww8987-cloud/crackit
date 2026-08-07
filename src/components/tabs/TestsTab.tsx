'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trophy, Layers, Clock, Play, Pause, CheckCircle } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { SmartEmptyState } from '@/components/shared/SmartEmptyState';
import { TestInsightsPanel } from '@/components/tests/TestInsightsPanel';
import { PaperTestHistory } from '@/components/tests/PaperTestHistory';
import { getFullRankPrediction } from '@/lib/neetRankData';
import type { Test, CoachingSource } from '@/lib/types';
import { cn, diffDays, todayKey, vibrate } from '@/lib/utils';
import { AddTestSheet } from '@/components/tests/AddTestSheet';
import { TestDetailSheet } from '@/components/tests/TestDetailSheet';
import { TabInfoButton } from '@/components/shared/TabInfoButton';

type FilterKey = 'upcoming' | 'past' | 'all';

// Color accent per coaching source — gives visual identity at a glance
const COACHING_COLORS: Record<CoachingSource, string> = {
  'Self': '#64748b',
  'Allen': '#ef4444',
  'Aakash': '#3b82f6',
  'PW (Physics Wallah)': '#f59e0b',
  'Vibrant': '#a855f7',
  'Motion': '#10b981',
  'Narayana': '#ec4899',
  'Sri Chaitanya': '#06b6d4',
  'Career Point': '#8b5cf6',
  'Resonance': '#f97316',
  'Other': '#6b7280',
};

export function TestsTab() {
  const tests = useTests((s) => s.tests);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [filter, setFilter] = useState<FilterKey>('upcoming');

  const filtered = useMemo(() => {
    const today = todayKey();
    let list = [...tests];
    if (filter === 'upcoming') list = list.filter((t) => diffDays(today, t.date) >= 0);
    else if (filter === 'past') list = list.filter((t) => diffDays(today, t.date) < 0);
    return list.sort((a, b) => {
      if (filter === 'past') return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });
  }, [tests, filter]);

  return (
    <div className="pt-2 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText size={20} className="text-teal-400" />
          Tests
        </h1>
        <button
          onClick={() => { setShowAdd(true); vibrate(10); }}
          className="bg-teal-500 text-black px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Insights panel (badges + leaderboard + behavior patterns + comparison) */}
      {tests.length > 0 && <TestInsightsPanel />}

      {/* Paper test history — past paper tests with mini-summaries */}
      {tests.length > 0 && <PaperTestHistory onOpenTest={(t) => setSelectedTest(t)} />}

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['upcoming', 'past', 'all'] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); vibrate(6); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition',
              filter === f ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && tests.length === 0 && (
        <SmartEmptyState tab="tests" onAction={() => { setShowAdd(true); vibrate(10); }} />
      )}
      {filtered.length === 0 && tests.length > 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <FileText size={40} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No {filter} tests.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((test) => {
          const days = diffDays(todayKey(), test.date);
          const isUpcoming = days >= 0;
          const syllabusCount = test.syllabus?.chapterIds.length ?? 0;
          const coachingColor = COACHING_COLORS[test.coachingSource || 'Self'];
          const rankInfo = test.totalMarks !== undefined ? getFullRankPrediction(test.totalMarks) : null;
          const timerState = test.timerState || 'not_started';

          return (
            <motion.button
              key={test.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              onClick={() => { setSelectedTest(test); vibrate(8); }}
              className="w-full card-solid rounded-2xl p-3 flex items-center gap-3 text-left hover:bg-white/[0.04] transition active:scale-[0.98]"
            >
              {/* Date block */}
              <div className="text-center min-w-[44px] shrink-0">
                <div className="text-[9px] text-white/50 uppercase">
                  {new Date(test.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </div>
                <div className="text-xl font-bold tabular text-white">
                  {new Date(test.date + 'T00:00:00').getDate()}
                </div>
              </div>

              {/* Vertical divider */}
              <div className="w-px h-12 bg-white/10 shrink-0" />

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Badges row */}
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">
                    {test.type}
                  </span>
                  {test.coachingSource && test.coachingSource !== 'Self' && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${coachingColor}25`, color: coachingColor }}
                    >
                      {test.coachingSource}
                    </span>
                  )}
                  {syllabusCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-0.5">
                      <Layers size={8} /> {syllabusCount}
                    </span>
                  )}
                  {test.hasAnalytics && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                      <Trophy size={8} /> Analytics
                    </span>
                  )}
                  {/* Timer state badge */}
                  {timerState === 'running' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/30 text-green-300 flex items-center gap-0.5 pulse-slow">
                      <Play size={8} fill="currentColor" /> Live
                    </span>
                  )}
                  {timerState === 'paused' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 flex items-center gap-0.5">
                      <Pause size={8} fill="currentColor" /> Paused
                    </span>
                  )}
                  {timerState === 'completed' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70 flex items-center gap-0.5">
                      <CheckCircle size={8} /> Done
                    </span>
                  )}
                </div>

                {/* Test name */}
                <div className="text-sm font-semibold truncate text-white">{test.name}</div>

                {/* Date/days + duration */}
                <div className="text-[10px] text-white/50 flex items-center gap-1.5">
                  {isUpcoming ? (
                    days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`
                  ) : (
                    `${Math.abs(days)} days ago`
                  )}
                  {test.duration && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} />
                        {Math.floor(test.duration / 60) > 0
                          ? `${Math.floor(test.duration / 60)}h ${test.duration % 60}m`
                          : `${test.duration}m`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: score or readiness */}
              <div className="text-right shrink-0">
                {isUpcoming ? (
                  <>
                    <div className="text-lg font-bold tabular text-teal-400">
                      {test.totalMarks !== undefined ? Math.round((test.totalMarks / 720) * 100) : 0}%
                    </div>
                    <div className="text-[9px] text-white/40">readiness</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold tabular text-green-400">
                      {test.totalMarks !== undefined ? test.totalMarks : '—'}
                    </div>
                    <div className="text-[9px] text-white/40">/720</div>
                  </>
                )}
                {rankInfo && !isUpcoming && (
                  <div className="text-[9px] mt-0.5 tabular" style={{ color: rankInfo.color }}>
                    ~{rankInfo.rank > 999 ? `${(rankInfo.rank / 1000).toFixed(1)}k` : rankInfo.rank} rank
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {showAdd && <AddTestSheet onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {selectedTest && (
          <TestDetailSheet
            test={useTests.getState().tests.find((t) => t.id === selectedTest.id) || selectedTest}
            onClose={() => setSelectedTest(null)}
          />
        )}
      </AnimatePresence>

      {/* Tab info + hidden features button (bottom-right) */}
      <TabInfoButton tab="tests" />
    </div>
  );
}
