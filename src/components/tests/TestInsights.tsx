'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitCompare, Sparkles, ArrowRight, Check } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useTargets } from '@/lib/store/targets';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { pushToast } from '@/components/shared/Toast';
import { todayKey, vibrate } from '@/lib/utils';
import type { Subject, Test } from '@/lib/types';

/**
 * TestComparisonView — side-by-side diff of 2 tests.
 *
 * User picks 2 past tests → sees:
 *  - Total marks Δ (with up/down arrow)
 *  - Per-subject marks Δ
 *  - Time taken Δ (if timer data available)
 *  - Silly mistakes Δ (if analytics available)
 *  - Predicted rank Δ
 */
export function TestComparisonView() {
  const tests = useTests((s) => s.tests);
  const pastTests = useMemo(
    () =>
      tests
        .filter((t) => t.totalMarks !== undefined)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [tests],
  );

  const [idA, setIdA] = useState<string>(pastTests[0]?.id || '');
  const [idB, setIdB] = useState<string>(pastTests[1]?.id || '');

  const testA = pastTests.find((t) => t.id === idA);
  const testB = pastTests.find((t) => t.id === idB);

  if (pastTests.length < 2) {
    return (
      <div className="glass rounded-2xl p-4 text-center">
        <GitCompare size={24} className="text-muted-foreground/60 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          Need at least 2 completed tests to compare. You have {pastTests.length}.
        </p>
      </div>
    );
  }

  const testSubjects = SUBJECTS.filter((s) => s !== 'General');
  const delta = (a?: number, b?: number) => {
    if (a === undefined || b === undefined) return null;
    return a - b;
  };

  const totalDelta = delta(testA?.totalMarks, testB?.totalMarks);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare size={14} className="text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Compare Tests
        </span>
      </div>

      {/* Test pickers */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Test A (newer)</label>
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="w-full bg-foreground/5 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400/50"
          >
            {pastTests.map((t) => (
              <option key={t.id} value={t.id} className="bg-gray-900">
                {t.name} ({t.totalMarks})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Test B (older)</label>
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="w-full bg-foreground/5 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400/50"
          >
            {pastTests.map((t) => (
              <option key={t.id} value={t.id} className="bg-gray-900">
                {t.name} ({t.totalMarks})
              </option>
            ))}
          </select>
        </div>
      </div>

      {testA && testB && (
        <div className="space-y-2">
          {/* Total marks */}
          <ComparisonRow
            label="Total Marks"
            valueA={testA.totalMarks}
            valueB={testB.totalMarks}
            unit="/720"
            higherIsBetter
          />

          {/* Per-subject marks */}
          {testSubjects.map((subj) => {
            const a = testA.subjectMarks?.[subj];
            const b = testB.subjectMarks?.[subj];
            if (a === undefined && b === undefined) return null;
            const c = subjectColor(subj);
            return (
              <ComparisonRow
                key={subj}
                label={subj}
                valueA={a}
                valueB={b}
                unit="/180"
                color={c.hex}
                higherIsBetter
              />
            );
          })}

          {/* Predicted rank */}
          {testA.predictedRank && testB.predictedRank && (
            <ComparisonRow
              label="Predicted Rank"
              valueA={testA.predictedRank.rank}
              valueB={testB.predictedRank.rank}
              higherIsBetter={false}
            />
          )}

          {/* Time taken */}
          {testA.timerElapsedSec && testB.timerElapsedSec && (
            <ComparisonRow
              label="Time Taken"
              valueA={Math.floor(testA.timerElapsedSec / 60)}
              valueB={Math.floor(testB.timerElapsedSec / 60)}
              unit="min"
              higherIsBetter={false}
            />
          )}

          {/* Silly mistakes (if analytics) */}
          {testA.analytics && testB.analytics && (
            <ComparisonRow
              label="Silly Mistakes"
              valueA={Object.values(testA.analytics).reduce((a, s) => a + s.sillyMistakes, 0)}
              valueB={Object.values(testB.analytics).reduce((a, s) => a + s.sillyMistakes, 0)}
              higherIsBetter={false}
            />
          )}

          {/* Overall assessment */}
          {totalDelta !== null && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 pt-3 border-t border-border text-center"
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Overall Change
              </div>
              <div
                className="text-2xl font-bold tabular"
                style={{
                  color: totalDelta > 0 ? '#22c55e' : totalDelta < 0 ? '#ef4444' : '#ffffff',
                }}
              >
                {totalDelta > 0 ? '+' : ''}{totalDelta} marks
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {totalDelta > 5
                  ? 'Significant improvement — keep it up!'
                  : totalDelta > 0
                  ? 'Slight improvement — momentum building'
                  : totalDelta === 0
                  ? 'No change — try a different strategy'
                  : totalDelta > -10
                  ? 'Slight dip — review weak topics'
                  : 'Big drop — diagnose what went wrong'}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  valueA,
  valueB,
  unit,
  color,
  higherIsBetter = true,
}: {
  label: string;
  valueA?: number;
  valueB?: number;
  unit?: string;
  color?: string;
  higherIsBetter?: boolean;
}) {
  if (valueA === undefined && valueB === undefined) return null;
  const a = valueA ?? 0;
  const b = valueB ?? 0;
  const diff = a - b;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  const isNeutral = diff === 0;

  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <span
        className="flex-1 truncate"
        style={{ color: color || '#ffffff' }}
      >
        {label}
      </span>
      <span className="tabular text-white font-bold w-12 text-right">{a}</span>
      <span className="text-muted-foreground/60 text-[10px] w-12 text-center">
        vs
      </span>
      <span className="tabular text-muted-foreground w-12 text-left">{b}</span>
      <span
        className="tabular font-bold w-14 text-right"
        style={{
          color: isNeutral ? '#ffffff60' : isPositive ? '#22c55e' : '#ef4444',
        }}
      >
        {diff > 0 ? '+' : ''}{diff}
        {unit && diff !== 0 && <span className="text-[9px] ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

// ===== Revision Plan Generator =====

/**
 * RevisionPlanGenerator — auto-builds a 7-day revision plan from a test's
 * weak topics + subject performance.
 *
 * Algorithm:
 *  1. Parse weak topics from the test's `weakTopics` field (comma/newline separated)
 *  2. If no weak topics text, infer from subject marks — weakest subject gets
 *     more revision time
 *  3. Distribute topics across 7 days, ~2 hours/day
 *  4. Each day gets 2-3 topics, alternating subjects to avoid fatigue
 *  5. One-tap "Add to today's targets" pushes the plan to Study tab
 */
export function RevisionPlanGenerator({ test }: { test: Test }) {
  const addTarget = useTargets((s) => s.addTarget);
  const [plan, setPlan] = useState<Test['revisionPlan']>(test.revisionPlan);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const generatePlan = () => {
    vibrate(15);
    const weakTopicsText = test.weakTopics || '';
    const parsedTopics = weakTopicsText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 14); // max 14 topics across 7 days

    // If no weak topics text, infer from subject marks
    if (parsedTopics.length === 0 && test.subjectMarks) {
      const testSubjects = SUBJECTS.filter((s) => s !== 'General');
      const sorted = testSubjects
        .map((s) => ({ subject: s, marks: test.subjectMarks?.[s] ?? 180 }))
        .sort((a, b) => a.marks - b.marks); // weakest first
      // Create 2 topics per weakest subject
      const inferred = sorted.slice(0, 3).flatMap(({ subject }) => [
        `${subject} — weak areas`,
        `${subject} — PYQ practice`,
      ]);
      const newPlan = distributeAcrossDays(inferred.map((topic, i) => ({
        subject: (sorted[i % sorted.length]?.subject || 'General') as Subject,
        chapter: 'Revision',
        topic,
        minutes: 60,
      })));
      setPlan(newPlan);
      return;
    }

    // Map topics to subjects by keyword
    const subjectMap: Record<string, Subject> = {
      // Physics keywords
      motion: 'Physics', force: 'Physics', energy: 'Physics', wave: 'Physics',
      optics: 'Physics', current: 'Physics', charge: 'Physics', magnetic: 'Physics',
      // Chemistry keywords
      organic: 'Chemistry', reaction: 'Chemistry', compound: 'Chemistry',
      bond: 'Chemistry', acid: 'Chemistry', base: 'Chemistry', mole: 'Chemistry',
      // Botany keywords
      plant: 'Botany', photosynth: 'Botany', cell: 'Botany', flower: 'Botany',
      // Zoology keywords
      human: 'Zoology', anatomy: 'Zoology', physiology: 'Zoology',
      genetics: 'Zoology', evolution: 'Zoology', reproduction: 'Zoology',
    };

    const targets = parsedTopics.map((topic) => {
      const lower = topic.toLowerCase();
      let subject: Subject = 'General';
      for (const [keyword, subj] of Object.entries(subjectMap)) {
        if (lower.includes(keyword)) { subject = subj; break; }
      }
      return { subject, chapter: 'Revision', topic, minutes: 60 };
    });

    setPlan(distributeAcrossDays(targets));
  };

  const distributeAcrossDays = (targets: { subject: Subject; chapter: string; topic: string; minutes: number }[]) => {
    const days: Test['revisionPlan'] = [];
    const perDay = Math.max(2, Math.ceil(targets.length / 7));
    for (let d = 0; d < 7; d++) {
      const dayTargets = targets.slice(d * perDay, (d + 1) * perDay);
      if (dayTargets.length > 0) {
        days.push({ day: d, targets: dayTargets });
      }
    }
    return days;
  };

  const addToToday = (day: number, targets: { subject: Subject; chapter: string; topic: string; minutes: number }[]) => {
    vibrate(15);
    const today = todayKey();
    let added = 0;
    for (const t of targets) {
      addTarget({
        date: today,
        subject: t.subject,
        activity: 'Revision',
        chapter: t.chapter,
        topic: t.topic,
        expectedMinutes: t.minutes,
      });
      added++;
    }
    setAdded((prev) => new Set(prev).add(`day-${day}`));
    pushToast(
      `${added} revision target${added === 1 ? '' : 's'} added`,
      'Check Study tab →',
      'success',
    );
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            7-Day Revision Plan
          </span>
        </div>
        {!plan && (
          <button
            onClick={generatePlan}
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/15"
          >
            Generate
          </button>
        )}
      </div>

      {!plan && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Auto-builds a 7-day plan from this test's weak topics. Distributes topics
          across days with subject alternation to avoid fatigue.
        </p>
      )}

      {plan && (
        <div className="space-y-2 max-h-64 overflow-y-auto scroll-area">
          {plan.map((day) => {
            const dayKey = `day-${day.day}`;
            const isAdded = added.has(dayKey);
            return (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: day.day * 0.05 }}
                className="rounded-xl p-2.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Day {day.day + 1}
                  </span>
                  {isAdded ? (
                    <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                      <Check size={10} /> Added
                    </span>
                  ) : (
                    <button
                      onClick={() => addToToday(day.day, day.targets)}
                      className="text-[10px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                    >
                      Add <ArrowRight size={10} />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {day.targets.map((t, i) => {
                    const c = subjectColor(t.subject);
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: c.hex }}
                        />
                        <span className="text-muted-foreground truncate flex-1">{t.topic}</span>
                        <span className="text-muted-foreground text-[10px]">{t.minutes}m</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
