'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Play, ChevronRight, Settings } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { diffDays, todayKey, formatHM, cn } from '@/lib/utils';
import { PaperTestSetupSheet } from '@/components/tests/PaperTestSetupSheet';
import type { PaperTestConfig } from '@/lib/types';

interface Props {
  onClose: () => void;
  onSelectTest: (testId: string) => void;
}

/**
 * PaperTestPicker — bottom sheet shown when user long-presses the Tests tab.
 *
 * Lists upcoming tests (today + future) so the user can pick which test to
 * take on paper. If a test already has paperTest state in progress, shows
 * "Resume" instead of "Start" (skips setup).
 *
 * For new tests: tap test → PaperTestSetupSheet (customize Q count, duration,
 * extra time) → onStart(config) → onSelectTest(testId) launches companion.
 */
export function PaperTestPicker({ onClose, onSelectTest }: Props) {
  const tests = useTests((s) => s.tests);
  const [setupFor, setSetupFor] = useState<{ id: string; name: string } | null>(null);

  const upcoming = tests
    .filter((t) => {
      const days = diffDays(todayKey(), t.date);
      return days >= -1;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const inProgress = tests.filter((t) => t.paperTest && !t.paperTest.ended);

  const handleSelect = (testId: string, testName: string, hasProgress: boolean) => {
    if (hasProgress) {
      // Resume — skip setup, go straight to companion
      onSelectTest(testId);
    } else {
      // New test — show setup sheet
      setSetupFor({ id: testId, name: testName });
    }
  };

  const handleStartFromSetup = (config: PaperTestConfig) => {
    if (!setupFor) return;
    // Initialize the paper test with the custom config
    useTests.getState().initPaperTest(setupFor.id, config);
    onSelectTest(setupFor.id);
  };

  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    const days = diffDays(todayKey(), date);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // If setup sheet is open, render it on top
  if (setupFor) {
    return (
      <PaperTestSetupSheet
        testName={setupFor.name}
        onClose={() => setSetupFor(null)}
        onStart={handleStartFromSetup}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8 max-h-[80vh] flex flex-col"
      >
        <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText size={18} className="text-teal-400" />
              Paper Test Mode
            </h2>
            <p className="text-[10px] text-white/40 mt-0.5">
              Long-press Tests tab to start · fully customizable
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto scroll-area flex-1 space-y-2">
          {/* In-progress tests first */}
          {inProgress.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-400 mb-1.5">
                In Progress
              </div>
              {inProgress.map((t) => {
                const pt = t.paperTest!;
                const answered = pt.questions.filter(q => q.answer).length;
                const elapsed = Math.floor((Date.now() - pt.startedAt) / 1000) - pt.pausedSec;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id, t.name, true)}
                    className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-left active:scale-[0.98] transition mb-1.5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Play size={16} className="text-amber-400" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-white">{t.name}</div>
                      <div className="text-[10px] text-white/50">
                        {answered}/{pt.questions.length} answered · {formatHM(elapsed)} elapsed
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-amber-400" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Upcoming tests */}
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-1.5">
            Upcoming Tests
          </div>

          {upcoming.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center">
              <FileText size={32} className="text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/50 mb-2">No upcoming tests.</p>
              <p className="text-[10px] text-white/40">
                Add a test first, then long-press Tests tab to start paper mode.
              </p>
            </div>
          ) : (
            upcoming.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id, t.name, !!t.paperTest)}
                className={cn(
                  'w-full p-3 rounded-xl flex items-center gap-3 text-left active:scale-[0.98] transition',
                  t.paperTest ? 'bg-white/[0.03] border border-white/5' : 'glass'
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                  {t.paperTest
                    ? <Play size={16} className="text-teal-400" fill="currentColor" />
                    : <Settings size={16} className="text-teal-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-white">{t.name}</div>
                  <div className="text-[10px] text-white/50">
                    {formatDate(t.date)} · {t.type}
                    {t.coachingSource && t.coachingSource !== 'Self' && ` · ${t.coachingSource}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] text-teal-400 font-bold uppercase">
                    {t.paperTest ? 'Resume' : 'Setup & Start'}
                  </div>
                  <ChevronRight size={14} className="text-white/30" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/40 text-center">
          Customize: question count · duration · extra time · marking scheme · sections
        </div>
      </motion.div>
    </motion.div>
  );
}

