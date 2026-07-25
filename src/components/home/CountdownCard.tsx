'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { diffDays, todayKey } from '@/lib/utils';
import { CountUp } from '@/components/shared/CountUp';

/**
 * CountdownCard — merged "Days to NEET" + "Projected NEET Score" card.
 *
 * Combines two previously-separate cards into one clean, compact block:
 *  - Top: Days to NEET countdown + prep progress + syllabus progress
 *  - Bottom: Projected NEET score with mini progress bar + advice
 *
 * This keeps the Home tab neat — one card instead of two.
 */
export function CountdownCard() {
  const examDate = useSettings((s) => s.examDate);
  const prepStart = useSettings((s) => s.prepStartDate);
  const targetScore = useSettings((s) => s.targetScore);

  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);

  // === Countdown math ===
  const daysToExam = diffDays(todayKey(), examDate);
  const prepDay = prepStart ? diffDays(prepStart, todayKey()) + 1 : (sessions.length > 0 ? 1 : 0);
  const prepTotal = prepStart ? diffDays(prepStart, examDate) : 326;
  const prepPct = prepTotal > 0 ? Math.min(100, Math.round((prepDay / prepTotal) * 100)) : 0;

  const syllabusPct = useMemo(() => {
    const total = lectures.length;
    if (total === 0) return 0;
    return Math.round((lectures.filter((l) => l.done).length / total) * 100);
  }, [lectures]);

  // === Score prediction math ===
  const prediction = useMemo(() => {
    const totalStudySec = sessions.reduce((a, s) => a + s.studySeconds, 0);
    const totalStudyHours = totalStudySec / 3600;
    const completedLectures = lectures.filter((l) => l.done).length;
    const syllabusFraction = lectures.length > 0 ? completedLectures / lectures.length : 0;

    // Streak
    const studyDays = new Set<string>();
    for (const s of sessions) { if (s.studySeconds >= 60) studyDays.add(s.date); }
    let streak = 0;
    const d = new Date();
    const tKey = todayKey();
    if (!studyDays.has(tKey)) d.setDate(d.getDate() - 1);
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (studyDays.has(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }

    // Test factor
    const pastTests = tests.filter((t) => t.totalMarks !== undefined);
    const testFactor = pastTests.length > 0
      ? (pastTests.reduce((a, t) => a + (t.totalMarks! / 720), 0) / pastTests.length)
      : 0.5;

    // Formula
    const baseScore = 400;
    const studyFactor = Math.min(1.5, totalStudyHours / 500);
    const consistencyFactor = Math.min(1, streak / 30);
    const projected = Math.round(baseScore * studyFactor * (0.5 + syllabusFraction * 0.5) * (0.6 + consistencyFactor * 0.4) * (0.7 + testFactor * 0.3));

    const gap = targetScore - projected;
    const pct = Math.min(100, Math.round((projected / 720) * 100));

    let advice = '';
    if (gap > 100) advice = 'Need significant improvement — increase study hours';
    else if (gap > 50) advice = 'Getting closer — keep consistent';
    else if (gap > 0) advice = 'Almost there — push a bit more!';
    else advice = 'On track for your target! 🎉';

    return { projected, gap, pct, advice, totalStudyHours, streak };
  }, [sessions, lectures, tests, targetScore]);

  // Animated score number
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(prediction.projected * eased));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [prediction.projected]);

  const scoreColor = prediction.gap <= 0 ? '#22c55e' : prediction.gap <= 50 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
      className="glass rounded-2xl p-4 bg-gradient-to-br from-teal-500/10 to-green-500/5"
    >
      {/* === Section 1: Days to NEET === */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-t-muted">
            {prepStart ? `Prep Day ${prepDay}` : 'Days to NEET'}
          </div>
          <CountUp
            value={daysToExam}
            duration={1000}
            className="text-4xl font-bold tabular bg-gradient-to-r from-teal-500 to-green-500 bg-clip-text text-transparent"
          />
          <div className="text-xs text-t-secondary">days left</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-t-secondary">
            EXAM {new Date(examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {prepStart && (
            <div className="text-[10px] text-t-muted mt-0.5">
              Since {new Date(prepStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Prep progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-t-muted mb-1 tabular">
          <span>Day {prepDay} of {prepTotal}</span>
          <span>{prepPct}% elapsed</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${prepPct}%` }}
            transition={{ duration: 0.8 }}
            className="h-full bg-gradient-to-r from-teal-500 to-green-500"
          />
        </div>
      </div>

      {/* Syllabus progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-t-muted mb-1">
          <span>Syllabus</span>
          <span className="tabular">{syllabusPct}% done</span>
        </div>
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-green-500" style={{ width: `${syllabusPct}%` }} />
        </div>
      </div>

      {/* === Divider === */}
      <div className="my-3 border-t border-white/10" />

      {/* === Section 2: Projected NEET Score === */}
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={14} className="text-teal-500 dark:text-teal-400" />
        <span className="text-[10px] font-bold text-t-secondary uppercase tracking-wide">Projected NEET Score</span>
        <span className="ml-auto text-[10px] text-t-muted">Target: {targetScore}</span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <motion.span
          className="text-3xl font-bold tabular"
          style={{ color: scoreColor }}
        >
          {displayScore}
        </motion.span>
        <span className="text-sm text-t-muted mb-0.5">/ 720</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: scoreColor }}
          initial={{ width: 0 }}
          animate={{ width: `${prediction.pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] text-t-muted mb-1.5">
        <span>Study: {Math.round(prediction.totalStudyHours)}h</span>
        <span>Streak: {prediction.streak}d</span>
        <span>Syllabus: {syllabusPct}%</span>
      </div>
      <p className="text-[10px] font-medium" style={{ color: scoreColor }}>{prediction.advice}</p>
    </motion.div>
  );
}
