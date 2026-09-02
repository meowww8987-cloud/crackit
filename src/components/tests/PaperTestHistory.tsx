'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { History, Clock, CheckCircle, XCircle, Flag, ChevronRight } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { subjectColor } from '@/lib/colors';
import { formatHM, formatClock, diffDays, todayKey } from '@/lib/utils';
import type { Test } from '@/lib/types';

/**
 * PaperTestHistory — list of all past paper tests (ended) with mini-summaries.
 *
 * For each past paper test, shows:
 *  - Test name + date
 *  - Question count (e.g. "180 Q")
 *  - Time taken
 *  - Score (if answer key was entered): marks/720, correct/wrong/skipped
 *  - Answered / Flagged counts
 *
 * Tap → opens TestDetailSheet (existing) for full details + answer key entry.
 *
 * Shown in Tests tab above the test list when there are past paper tests.
 */
export function PaperTestHistory({ onOpenTest }: { onOpenTest: (test: Test) => void }) {
  const tests = useTests((s) => s.tests);

  // Filter to past paper tests (ended === true)
  const pastPaperTests = useMemo(
    () =>
      tests
        .filter((t) => t.paperTest?.ended)
        .sort((a, b) => (b.paperTest!.endedAt || 0) - (a.paperTest!.endedAt || 0)),
    [tests],
  );

  if (pastPaperTests.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <History size={14} className="text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Paper Test History
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">{pastPaperTests.length}</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
        {pastPaperTests.map((t, idx) => {
          const pt = t.paperTest!;
          const totalQ = pt.questions.length;
          const answered = pt.questions.filter(q => q.answer).length;
          const flagged = pt.questions.filter(q => q.flagged).length;
          const hasScore = pt.questions.some(q => q.correctAnswer !== null);
          const correct = pt.questions.filter(q => q.correctAnswer !== null && q.answer === q.correctAnswer).length;
          const wrong = pt.questions.filter(q => q.correctAnswer !== null && q.answer !== null && q.answer !== q.correctAnswer).length;
          const skipped = pt.questions.filter(q => q.correctAnswer === null || q.answer === null).length;
          const marksPerCorrect = pt.config?.marksPerCorrect ?? 4;
          const negativePerWrong = pt.config?.negativePerWrong ?? 1;
          const marks = correct * marksPerCorrect - wrong * negativePerWrong;
          const maxMarks = totalQ * marksPerCorrect;

          // Days ago
          const daysAgo = pt.endedAt ? Math.floor((Date.now() - pt.endedAt) / 86400000) : 0;

          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onOpenTest(t)}
              className="w-full p-3 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.06] border border-border transition text-left flex items-center gap-3"
            >
              {/* Score circle */}
              <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: hasScore
                    ? marks >= maxMarks * 0.6 ? 'rgba(34,197,94,0.15)' : marks >= maxMarks * 0.3 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
                    : 'rgba(255,255,255,0.05)',
                }}
              >
                {hasScore ? (
                  <div className="text-center">
                    <div className="text-sm font-bold tabular" style={{
                      color: marks >= maxMarks * 0.6 ? '#22c55e' : marks >= maxMarks * 0.3 ? '#f59e0b' : '#ef4444',
                    }}>
                      {marks}
                    </div>
                    <div className="text-[7px] text-muted-foreground">/ {maxMarks}</div>
                  </div>
                ) : (
                  <Clock size={16} className="text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-white">{t.name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{totalQ} Q</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    {pt.endedAt ? formatHM(Math.floor((pt.endedAt - pt.startedAt) / 1000) - pt.pausedSec) : '—'}
                  </span>
                  <span>·</span>
                  <span>{daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}</span>
                </div>
                {/* Stats row */}
                <div className="flex gap-2 mt-1 text-[9px]">
                  <span className="flex items-center gap-0.5 text-green-400">
                    <CheckCircle size={8} /> {answered}
                  </span>
                  {hasScore && (
                    <>
                      <span className="flex items-center gap-0.5 text-green-400">{correct} ✓</span>
                      <span className="flex items-center gap-0.5 text-red-400">{wrong} ✗</span>
                    </>
                  )}
                  {flagged > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Flag size={8} /> {flagged}
                    </span>
                  )}
                  {!hasScore && (
                    <span className="text-amber-400">Unscored</span>
                  )}
                </div>
              </div>

              <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
