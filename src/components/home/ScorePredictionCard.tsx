'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTests } from '@/lib/store/tests';
import { useSettings } from '@/lib/store/settings';
import { formatHM } from '@/lib/utils';

export function ScorePredictionCard() {
  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);
  const targetScore = useSettings((s) => s.targetScore);

  const prediction = useMemo(() => {
    const totalStudySec = sessions.reduce((a, s) => a + s.studySeconds, 0);
    const totalStudyHours = totalStudySec / 3600;
    const completedLectures = lectures.filter((l) => l.done).length;
    const syllabusPct = lectures.length > 0 ? completedLectures / lectures.length : 0;

    // Streak
    const studyDays = new Set<string>();
    for (const s of sessions) { if (s.studySeconds >= 60) studyDays.add(s.date); }
    let streak = 0;
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!studyDays.has(todayKey)) d.setDate(d.getDate() - 1);
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
    const projected = Math.round(baseScore * studyFactor * (0.5 + syllabusPct * 0.5) * (0.6 + consistencyFactor * 0.4) * (0.7 + testFactor * 0.3));

    const gap = targetScore - projected;
    const pct = Math.min(100, Math.round((projected / 720) * 100));

    let advice = '';
    if (gap > 100) advice = 'Need significant improvement — increase study hours';
    else if (gap > 50) advice = 'Getting closer — keep consistent';
    else if (gap > 0) advice = 'Almost there — push a bit more!';
    else advice = 'On track for your target! 🎉';

    return { projected, gap, pct, advice, totalStudyHours, syllabusPct: Math.round(syllabusPct * 100), streak };
  }, [sessions, lectures, tests, targetScore]);

  // Animated number
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
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-teal-400" />
        <span className="text-xs font-bold text-muted-foreground">Projected NEET Score</span>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <motion.span
          className="text-4xl font-bold tabular"
          style={{ color: scoreColor }}
        >
          {displayScore}
        </motion.span>
        <span className="text-sm text-muted-foreground mb-1">/ 720</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Target: {targetScore}
        </span>
      </div>
      <div className="h-2 rounded-full bg-foreground/5 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: scoreColor }}
          initial={{ width: 0 }}
          animate={{ width: `${prediction.pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
        <span>Syllabus: {prediction.syllabusPct}%</span>
        <span>Study: {Math.round(prediction.totalStudyHours)}h</span>
        <span>Streak: {prediction.streak}d</span>
      </div>
      <p className="text-[10px]" style={{ color: scoreColor }}>{prediction.advice}</p>
    </div>
  );
}
