'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, ChevronRight } from 'lucide-react';
import { useAchievements } from '@/lib/store/achievements';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useRecall } from '@/lib/store/recall';
import { useTests } from '@/lib/store/tests';
import { usePractice } from '@/lib/store/practice';
import { pushToast } from '@/components/shared/Toast';
import { triggerEffect } from '@/components/shared/Effects';
import { AchievementCinematic, type UnlockData } from '@/components/shared/AchievementCinematic';
import { vibrate } from '@/lib/utils';

export function AchievementBadges() {
  const unlocked = useAchievements((s) => s.unlocked);
  const checkAchievements = useAchievements((s) => s.checkAchievements);
  const getProgress = useAchievements((s) => s.getProgress);
  const lastStatsRef = useRef('');
  const [cinematic, setCinematic] = useState<UnlockData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const tests = useTests((s) => s.tests);
  const recallChallenges = useRecall((s) => s.challenges);
  const practiceHistory = usePractice((s) => s.history);

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
      practiceCount: practiceHistory.length,
      testCount: tests.length,
    };
  }, [sessions, lectures, tests, recallChallenges, practiceHistory]);

  // Check achievements only when stats change
  useEffect(() => {
    const statsKey = JSON.stringify(stats);
    if (statsKey === lastStatsRef.current) return;
    lastStatsRef.current = statsKey;

    const newBadges = checkAchievements(stats);
    for (const id of newBadges) {
      const badgeDefs: Record<string, { title: string; description: string; icon: string }> = {
        first_session: { title: 'First Steps', description: 'Complete your first study session', icon: '🥇' },
        '10_hours': { title: '10 Hours Club', description: 'Study 10 total hours', icon: '⏰' },
        '50_hours': { title: 'Half Century', description: 'Study 50 total hours', icon: '⭐' },
        '100_hours': { title: 'Centurion', description: 'Study 100 total hours', icon: '💯' },
        '500_hours': { title: 'Legendary', description: 'Study 500 total hours', icon: '👑' },
        '8h_day': { title: 'Speed Demon', description: 'Study 8h in one day', icon: '⚡' },
        '12h_day': { title: 'Marathoner', description: 'Study 12h in one day', icon: '🏃' },
        week_streak: { title: 'Week Warrior', description: '7-day study streak', icon: '🔥' },
        '14_day_streak': { title: 'Fortnight Fighter', description: '14-day study streak', icon: '⚔️' },
        '30_day_streak': { title: 'Month Master', description: '30-day study streak', icon: '🌟' },
        '100_day_streak': { title: 'Unbreakable', description: '100-day study streak', icon: '💎' },
        first_chapter: { title: 'Chapter Crusher', description: 'Complete 1 full chapter', icon: '📚' },
        '50_lectures': { title: 'Lecture Legend', description: 'Complete 50 lectures', icon: '📖' },
        '100_dpps': { title: 'DPP Master', description: 'Solve 100 DPPs', icon: '📝' },
        half_syllabus: { title: 'Halfway Hero', description: 'Complete 50% syllabus', icon: '🏆' },
        full_syllabus: { title: 'Syllabus Slayer', description: 'Complete 100% syllabus', icon: '🗡️' },
        first_practice: { title: 'Practice Rookie', description: 'Complete your first practice session', icon: '🎯' },
        '50_practice': { title: 'Practice Pro', description: 'Complete 50 practice sessions', icon: '🎪' },
        first_mock: { title: 'First Mock', description: 'Take your first mock test', icon: '📝' },
        '10_tests': { title: 'Test Titan', description: 'Take 10 tests', icon: '🎖️' },
        '10_recall': { title: 'Memory Master', description: 'Complete 10 Active Recall challenges', icon: '🧠' },
        '50_recall': { title: 'Memory Maestro', description: 'Complete 50 Active Recall challenges', icon: '🎓' },
      };
      const badge = badgeDefs[id];
      if (badge) {
        pushToast(`🏆 ${badge.title} unlocked!`, badge.description);
        triggerEffect('fireworks', 'achievement');
        setTimeout(() => setCinematic({ id, ...badge }), 100);
        break;
      }
    }
  }, [stats, checkAchievements]);

  const allBadges = [
    { id: 'first_session', title: 'First Steps', icon: '🥇', category: 'study' },
    { id: '10_hours', title: '10 Hours', icon: '⏰', category: 'study' },
    { id: '50_hours', title: '50 Hours', icon: '⭐', category: 'study' },
    { id: '100_hours', title: '100 Hours', icon: '💯', category: 'study' },
    { id: '500_hours', title: '500 Hours', icon: '👑', category: 'study' },
    { id: '8h_day', title: 'Speed Demon', icon: '⚡', category: 'study' },
    { id: '12h_day', title: 'Marathoner', icon: '🏃', category: 'study' },
    { id: 'week_streak', title: 'Week Warrior', icon: '🔥', category: 'streak' },
    { id: '14_day_streak', title: 'Fortnight', icon: '⚔️', category: 'streak' },
    { id: '30_day_streak', title: 'Month Master', icon: '🌟', category: 'streak' },
    { id: '100_day_streak', title: 'Unbreakable', icon: '💎', category: 'streak' },
    { id: 'first_chapter', title: 'Chapter Crusher', icon: '📚', category: 'syllabus' },
    { id: '50_lectures', title: 'Lecture Legend', icon: '📖', category: 'syllabus' },
    { id: '100_dpps', title: 'DPP Master', icon: '📝', category: 'syllabus' },
    { id: 'half_syllabus', title: 'Halfway Hero', icon: '🏆', category: 'syllabus' },
    { id: 'full_syllabus', title: 'Syllabus Slayer', icon: '🗡️', category: 'syllabus' },
    { id: 'first_practice', title: 'Practice Rookie', icon: '🎯', category: 'practice' },
    { id: '50_practice', title: 'Practice Pro', icon: '🎪', category: 'practice' },
    { id: 'first_mock', title: 'First Mock', icon: '📝', category: 'test' },
    { id: '10_tests', title: 'Test Titan', icon: '🎖️', category: 'test' },
    { id: '10_recall', title: 'Memory Master', icon: '🧠', category: 'recall' },
    { id: '50_recall', title: 'Memory Maestro', icon: '🎓', category: 'recall' },
  ];

  const progressData = useMemo(() => getProgress(stats), [stats, getProgress]);
  const unlockedCount = Object.keys(unlocked).length;

  // Show first 8 badges on card (scrollable), all in detail sheet
  const cardBadges = allBadges.slice(0, 8);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-3 cursor-pointer"
        style={{ border: '1px solid var(--border)' }}
        onClick={() => { vibrate(8); setShowDetail(true); }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Trophy size={14} style={{ color: '#d97706' }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Achievements</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular font-bold" style={{ color: '#d97706' }}>{unlockedCount}/{allBadges.length}</span>
            <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
          </div>
        </div>

        {/* Badge row — scrollable, with progress bars */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {cardBadges.map((badge, i) => {
            const isUnlocked = !!unlocked[badge.id];
            const progress = progressData[badge.id];
            const showProgress = !isUnlocked && progress && progress.progress > 0;
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="shrink-0 flex flex-col items-center gap-1 w-14"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg relative"
                  style={{
                    background: isUnlocked ? 'rgba(217,119,6,0.15)' : 'var(--muted)',
                    border: isUnlocked ? '1.5px solid rgba(217,119,6,0.4)' : '1px solid var(--border)',
                    filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.5)',
                    boxShadow: isUnlocked ? '0 0 8px rgba(217,119,6,0.3)' : 'none',
                  }}
                >
                  {badge.icon}
                  {/* Progress ring overlay */}
                  {showProgress && (
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="none" stroke="var(--border)" strokeWidth="2" />
                      <circle
                        cx="20" cy="20" r="18" fill="none"
                        stroke="#d97706" strokeWidth="2" strokeLinecap="round"
                        strokeDasharray={113.1}
                        strokeDashoffset={113.1 - (progress.progress / 100) * 113.1}
                      />
                    </svg>
                  )}
                </div>
                <span className="text-[8px] text-center leading-tight truncate w-full" style={{ color: isUnlocked ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                  {badge.title}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress hint */}
        {unlockedCount < allBadges.length && (
          <div className="text-center text-[9px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
            {allBadges.length - unlockedCount} more to unlock · Tap for details
          </div>
        )}

        <AchievementCinematic data={cinematic} onClose={() => setCinematic(null)} />
      </motion.div>

      {/* Detail sheet */}
      <AnimatePresence>
        {showDetail && (
          <AchievementDetailSheet
            badges={allBadges}
            unlocked={unlocked}
            progressData={progressData}
            onClose={() => setShowDetail(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// Detail Sheet — all badges with progress
// =====================================================

function AchievementDetailSheet({
  badges,
  unlocked,
  progressData,
  onClose,
}: {
  badges: { id: string; title: string; icon: string; category: string }[];
  unlocked: Record<string, number>;
  progressData: Record<string, { progress: number; progressText: string }>;
  onClose: () => void;
}) {
  const categories = ['study', 'streak', 'syllabus', 'practice', 'test', 'recall'];
  const categoryLabels: Record<string, string> = {
    study: '📚 Study Time',
    streak: '🔥 Streaks',
    syllabus: '📖 Syllabus',
    practice: '🎯 Practice',
    test: '📝 Tests',
    recall: '🧠 Recall',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}>
            <Trophy size={24} style={{ color: '#d97706' }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Achievements</h2>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            {Object.keys(unlocked).length}/{badges.length} unlocked
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>
            <span>Overall Progress</span>
            <span className="tabular font-bold" style={{ color: '#d97706' }}>{Math.round((Object.keys(unlocked).length / badges.length) * 100)}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(Object.keys(unlocked).length / badges.length) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #d97706, #fbbf24)', boxShadow: '0 0 6px rgba(217,119,6,0.4)' }}
            />
          </div>
        </div>

        {/* Badges by category */}
        <div className="space-y-4">
          {categories.map((cat) => {
            const catBadges = badges.filter((b) => b.category === cat);
            if (catBadges.length === 0) return null;
            return (
              <div key={cat}>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  {categoryLabels[cat]}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {catBadges.map((badge) => {
                    const isUnlocked = !!unlocked[badge.id];
                    const progress = progressData[badge.id];
                    return (
                      <div key={badge.id} className="flex flex-col items-center gap-1">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl relative"
                          style={{
                            background: isUnlocked ? 'rgba(217,119,6,0.15)' : 'var(--muted)',
                            border: isUnlocked ? '1.5px solid rgba(217,119,6,0.4)' : '1px solid var(--border)',
                            filter: isUnlocked ? 'none' : 'grayscale(1) brightness(0.5)',
                            boxShadow: isUnlocked ? '0 0 8px rgba(217,119,6,0.3)' : 'none',
                          }}
                        >
                          {badge.icon}
                          {isUnlocked && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: '#16a34a' }}>
                              <span className="text-[7px] text-white">✓</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[7px] text-center leading-tight truncate w-full" style={{ color: isUnlocked ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                          {badge.title}
                        </span>
                        {!isUnlocked && progress && (
                          <span className="text-[6px] tabular" style={{ color: 'var(--muted-foreground)' }}>{progress.progressText}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-center mt-5" style={{ color: 'var(--muted-foreground)' }}>
          Tap outside to close
        </p>
      </motion.div>
    </motion.div>
  );
}
