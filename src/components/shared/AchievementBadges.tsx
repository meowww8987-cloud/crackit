'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAchievements } from '@/lib/store/achievements';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useRecall } from '@/lib/store/recall';
import { useTests } from '@/lib/store/tests';
import { pushToast } from '@/components/shared/Toast';
import { triggerEffect } from '@/components/shared/Effects';
import { AchievementCinematic, type UnlockData } from '@/components/shared/AchievementCinematic';

export function AchievementBadges() {
  const unlocked = useAchievements((s) => s.unlocked);
  const checkAchievements = useAchievements((s) => s.checkAchievements);
  const lastStatsRef = useRef('');
  const [cinematic, setCinematic] = useState<UnlockData | null>(null);

  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);
  const recallChallenges = useRecall((s) => s.challenges);

  const stats = useMemo(() => {
    const totalStudySec = sessions.reduce((a, s) => a + s.studySeconds, 0);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todaySec = sessions.filter((s) => s.date === todayKey).reduce((a, s) => a + s.studySeconds, 0);
    const completedLectures = lectures.filter((l) => l.done).length;
    const completedDPPs = lectures.filter((l) => l.dppDone).length;
    const syllabusPct = lectures.length > 0 ? Math.round((completedLectures / lectures.length) * 100) : 0;

    const chapterIds = [...new Set(lectures.map((l) => l.chapterId))];
    const completedChapters = chapterIds.filter((cid) => {
      const chLecs = lectures.filter((l) => l.chapterId === cid);
      return chLecs.length > 0 && chLecs.every((l) => l.done && l.dppDone && l.notesDone && l.revisionDone);
    }).length;

    const studyDays = new Set<string>();
    for (const s of sessions) {
      if (s.studySeconds >= 60) studyDays.add(s.date);
    }
    let streak = 0;
    const d = new Date();
    const tKey = todayKey;
    if (!studyDays.has(tKey)) d.setDate(d.getDate() - 1);
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (studyDays.has(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }

    return {
      totalStudyHours: totalStudySec / 3600,
      streak,
      completedLectures,
      completedDPPs,
      completedChapters,
      syllabusPct,
      hasTests: tests.length > 0,
      todayStudyHours: todaySec / 3600,
      recallCount: recallChallenges.filter((c) => c.completedAt > 0).length,
    };
  }, [sessions, lectures, tests, recallChallenges]);

  // Check achievements only when stats change (debounced via string comparison)
  useEffect(() => {
    const statsKey = JSON.stringify(stats);
    if (statsKey === lastStatsRef.current) return;
    lastStatsRef.current = statsKey;

    const newBadges = checkAchievements(stats);
    for (const id of newBadges) {
      const badgeDefs: Record<string, { title: string; description: string; icon: string }> = {
        first_session: { title: 'First Steps', description: 'Complete your first study session', icon: '🥇' },
        '10_hours': { title: '10 Hours Club', description: 'Study 10 total hours', icon: '⏰' },
        week_streak: { title: 'Week Warrior', description: '7-day study streak', icon: '🔥' },
        first_chapter: { title: 'Chapter Crusher', description: 'Complete 1 full chapter', icon: '📚' },
        '50_lectures': { title: 'Lecture Legend', description: 'Complete 50 lectures', icon: '📖' },
        '100_dpps': { title: 'DPP Master', description: 'Solve 100 DPPs', icon: '📝' },
        first_mock: { title: 'First Mock', description: 'Take your first mock test', icon: '🎯' },
        half_syllabus: { title: 'Half Century', description: 'Complete 50% syllabus', icon: '🏆' },
        '8h_day': { title: 'Speed Demon', description: 'Study 8h in one day', icon: '⚡' },
        '10_recall': { title: 'Memory Master', description: 'Complete 10 Active Recall challenges', icon: '🧠' },
      };
      const badge = badgeDefs[id];
      if (badge) {
        pushToast(`🏆 ${badge.title} unlocked!`, badge.description);
        triggerEffect('fireworks', 'achievement');
        // Trigger cinematic for the first unlocked badge
        setTimeout(() => setCinematic({ id, ...badge }), 100);
        break; // Only show one cinematic at a time
      }
    }
  }, [stats, checkAchievements]);

  const allBadges = [
    { id: 'first_session', title: 'First Steps', icon: '🥇' },
    { id: '10_hours', title: '10 Hours', icon: '⏰' },
    { id: 'week_streak', title: 'Week Warrior', icon: '🔥' },
    { id: 'first_chapter', title: 'Chapter Crusher', icon: '📚' },
    { id: '50_lectures', title: 'Lecture Legend', icon: '📖' },
    { id: '100_dpps', title: 'DPP Master', icon: '📝' },
    { id: 'first_mock', title: 'First Mock', icon: '🎯' },
    { id: 'half_syllabus', title: 'Half Century', icon: '🏆' },
    { id: '8h_day', title: 'Speed Demon', icon: '⚡' },
    { id: '10_recall', title: 'Memory Master', icon: '🧠' },
  ];

  const unlockedCount = Object.keys(unlocked).length;

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white/70">🏆 Achievements</span>
        <span className="text-[10px] tabular text-white/40">{unlockedCount}/{allBadges.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {allBadges.map((badge, i) => {
          const isUnlocked = !!unlocked[badge.id];
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 flex flex-col items-center gap-1 w-14"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{
                  background: isUnlocked ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                  border: isUnlocked ? '1.5px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.05)',
                  filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.4)',
                }}
              >
                {badge.icon}
              </div>
              <span className="text-[8px] text-white/50 text-center leading-tight truncate w-full">
                {badge.title}
              </span>
            </motion.div>
          );
        })}
      </div>

      <AchievementCinematic data={cinematic} onClose={() => setCinematic(null)} />
    </div>
  );
}
