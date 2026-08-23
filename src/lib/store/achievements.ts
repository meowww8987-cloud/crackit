'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'study' | 'streak' | 'syllabus' | 'practice' | 'test' | 'recall';
  unlockedAt?: number;
  progress?: number; // 0-100 for locked badges
  progressText?: string; // e.g. "37/50 lectures"
}

// Extended badge definitions — 20 badges across 6 categories
const ALL_BADGES: Omit<Badge, 'unlockedAt' | 'progress' | 'progressText'>[] = [
  // === Study Time ===
  { id: 'first_session', title: 'First Steps', description: 'Complete your first study session', icon: '🥇', category: 'study' },
  { id: '10_hours', title: '10 Hours Club', description: 'Study 10 total hours', icon: '⏰', category: 'study' },
  { id: '50_hours', title: 'Half Century', description: 'Study 50 total hours', icon: '⭐', category: 'study' },
  { id: '100_hours', title: 'Centurion', description: 'Study 100 total hours', icon: '💯', category: 'study' },
  { id: '500_hours', title: 'Legendary', description: 'Study 500 total hours', icon: '👑', category: 'study' },
  { id: '8h_day', title: 'Speed Demon', description: 'Study 8h in one day', icon: '⚡', category: 'study' },
  { id: '12h_day', title: 'Marathoner', description: 'Study 12h in one day', icon: '🏃', category: 'study' },

  // === Streaks ===
  { id: 'week_streak', title: 'Week Warrior', description: '7-day study streak', icon: '🔥', category: 'streak' },
  { id: '14_day_streak', title: 'Fortnight Fighter', description: '14-day study streak', icon: '⚔️', category: 'streak' },
  { id: '30_day_streak', title: 'Month Master', description: '30-day study streak', icon: '🌟', category: 'streak' },
  { id: '100_day_streak', title: 'Unbreakable', description: '100-day study streak', icon: '💎', category: 'streak' },

  // === Syllabus ===
  { id: 'first_chapter', title: 'Chapter Crusher', description: 'Complete 1 full chapter', icon: '📚', category: 'syllabus' },
  { id: '50_lectures', title: 'Lecture Legend', description: 'Complete 50 lectures', icon: '📖', category: 'syllabus' },
  { id: '100_dpps', title: 'DPP Master', description: 'Solve 100 DPPs', icon: '📝', category: 'syllabus' },
  { id: 'half_syllabus', title: 'Halfway Hero', description: 'Complete 50% syllabus', icon: '🏆', category: 'syllabus' },
  { id: 'full_syllabus', title: 'Syllabus Slayer', description: 'Complete 100% syllabus', icon: '🗡️', category: 'syllabus' },

  // === Practice ===
  { id: 'first_practice', title: 'Practice Rookie', description: 'Complete your first practice session', icon: '🎯', category: 'practice' },
  { id: '50_practice', title: 'Practice Pro', description: 'Complete 50 practice sessions', icon: '🎪', category: 'practice' },

  // === Tests ===
  { id: 'first_mock', title: 'First Mock', description: 'Take your first mock test', icon: '📝', category: 'test' },
  { id: '10_tests', title: 'Test Titan', description: 'Take 10 tests', icon: '🎖️', category: 'test' },

  // === Recall ===
  { id: '10_recall', title: 'Memory Master', description: 'Complete 10 Active Recall challenges', icon: '🧠', category: 'recall' },
  { id: '50_recall', title: 'Memory Maestro', description: 'Complete 50 Active Recall challenges', icon: '🎓', category: 'recall' },
];

interface AchievementsStore {
  unlocked: Record<string, number>; // badgeId -> timestamp
  checkAchievements: (stats: {
    totalStudyHours: number;
    streak: number;
    completedLectures: number;
    completedDPPs: number;
    completedChapters: number;
    syllabusPct: number;
    hasTests: boolean;
    todayStudyHours: number;
    recallCount: number;
    practiceCount?: number;
    testCount?: number;
  }) => string[];
  getBadges: () => Badge[];
  getUnlockedCount: () => number;
  getProgress: (stats: any) => Record<string, { progress: number; progressText: string }>;
}

export const useAchievements = create<AchievementsStore>()(
  persist(
    (set, get) => ({
      unlocked: {},

      checkAchievements: (stats) => {
        const newlyUnlocked: string[] = [];
        const current = get().unlocked;

        const checks: Record<string, () => boolean> = {
          first_session: () => stats.totalStudyHours > 0 || stats.completedLectures > 0,
          '10_hours': () => stats.totalStudyHours >= 10,
          '50_hours': () => stats.totalStudyHours >= 50,
          '100_hours': () => stats.totalStudyHours >= 100,
          '500_hours': () => stats.totalStudyHours >= 500,
          '8h_day': () => stats.todayStudyHours >= 8,
          '12h_day': () => stats.todayStudyHours >= 12,
          week_streak: () => stats.streak >= 7,
          '14_day_streak': () => stats.streak >= 14,
          '30_day_streak': () => stats.streak >= 30,
          '100_day_streak': () => stats.streak >= 100,
          first_chapter: () => stats.completedChapters >= 1,
          '50_lectures': () => stats.completedLectures >= 50,
          '100_dpps': () => stats.completedDPPs >= 100,
          half_syllabus: () => stats.syllabusPct >= 50,
          full_syllabus: () => stats.syllabusPct >= 100,
          first_practice: () => (stats.practiceCount || 0) >= 1,
          '50_practice': () => (stats.practiceCount || 0) >= 50,
          first_mock: () => stats.hasTests,
          '10_tests': () => (stats.testCount || 0) >= 10,
          '10_recall': () => stats.recallCount >= 10,
          '50_recall': () => stats.recallCount >= 50,
        };

        for (const badge of ALL_BADGES) {
          if (!current[badge.id] && checks[badge.id]?.()) {
            newlyUnlocked.push(badge.id);
          }
        }

        if (newlyUnlocked.length > 0) {
          const now = Date.now();
          const updated = { ...current };
          for (const id of newlyUnlocked) {
            updated[id] = now;
          }
          set({ unlocked: updated });
        }

        return newlyUnlocked;
      },

      getBadges: () => {
        const unlocked = get().unlocked;
        return ALL_BADGES.map((b) => ({
          ...b,
          unlockedAt: unlocked[b.id],
        }));
      },

      getUnlockedCount: () => Object.keys(get().unlocked).length,

      getProgress: (stats) => {
        const progress: Record<string, { progress: number; progressText: string }> = {};

        const progressChecks: Record<string, { current: number; target: number; label: string }> = {
          '10_hours': { current: stats.totalStudyHours, target: 10, label: 'hours' },
          '50_hours': { current: stats.totalStudyHours, target: 50, label: 'hours' },
          '100_hours': { current: stats.totalStudyHours, target: 100, label: 'hours' },
          '500_hours': { current: stats.totalStudyHours, target: 500, label: 'hours' },
          '8h_day': { current: stats.todayStudyHours, target: 8, label: 'h today' },
          '12h_day': { current: stats.todayStudyHours, target: 12, label: 'h today' },
          week_streak: { current: stats.streak, target: 7, label: 'days' },
          '14_day_streak': { current: stats.streak, target: 14, label: 'days' },
          '30_day_streak': { current: stats.streak, target: 30, label: 'days' },
          '100_day_streak': { current: stats.streak, target: 100, label: 'days' },
          '50_lectures': { current: stats.completedLectures, target: 50, label: 'lectures' },
          '100_dpps': { current: stats.completedDPPs, target: 100, label: 'DPPs' },
          half_syllabus: { current: stats.syllabusPct, target: 50, label: '%' },
          full_syllabus: { current: stats.syllabusPct, target: 100, label: '%' },
          '10_recall': { current: stats.recallCount, target: 10, label: 'challenges' },
          '50_recall': { current: stats.recallCount, target: 50, label: 'challenges' },
          '50_practice': { current: stats.practiceCount || 0, target: 50, label: 'sessions' },
          '10_tests': { current: stats.testCount || 0, target: 10, label: 'tests' },
        };

        for (const [id, check] of Object.entries(progressChecks)) {
          const pct = Math.min(100, Math.round((check.current / check.target) * 100));
          progress[id] = {
            progress: pct,
            progressText: `${Math.round(check.current)}/${check.target} ${check.label}`,
          };
        }

        return progress;
      },
    }),
    { name: 'neet-achievements' }
  )
);
