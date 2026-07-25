'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress?: number; // 0-100 for locked badges
  progressText?: string; // e.g. "37/50 lectures"
}

const ALL_BADGES: Omit<Badge, 'unlockedAt' | 'progress' | 'progressText'>[] = [
  { id: 'first_session', title: 'First Steps', description: 'Complete your first study session', icon: '🥇' },
  { id: '10_hours', title: '10 Hours Club', description: 'Study 10 total hours', icon: '⏰' },
  { id: 'week_streak', title: 'Week Warrior', description: '7-day study streak', icon: '🔥' },
  { id: 'first_chapter', title: 'Chapter Crusher', description: 'Complete 1 full chapter (all resources)', icon: '📚' },
  { id: '50_lectures', title: 'Lecture Legend', description: 'Complete 50 lectures', icon: '📖' },
  { id: '100_dpps', title: 'DPP Master', description: 'Solve 100 DPPs', icon: '📝' },
  { id: 'first_mock', title: 'First Mock', description: 'Take your first mock test', icon: '🎯' },
  { id: 'half_syllabus', title: 'Half Century', description: 'Complete 50% syllabus', icon: '🏆' },
  { id: '8h_day', title: 'Speed Demon', description: 'Study 8h in one day', icon: '⚡' },
  { id: '10_recall', title: 'Memory Master', description: 'Complete 10 Active Recall challenges', icon: '🧠' },
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
  }) => string[]; // returns newly unlocked badge IDs
  getBadges: () => Badge[];
  getUnlockedCount: () => number;
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
          week_streak: () => stats.streak >= 7,
          first_chapter: () => stats.completedChapters >= 1,
          '50_lectures': () => stats.completedLectures >= 50,
          '100_dpps': () => stats.completedDPPs >= 100,
          first_mock: () => stats.hasTests,
          half_syllabus: () => stats.syllabusPct >= 50,
          '8h_day': () => stats.todayStudyHours >= 8,
          '10_recall': () => stats.recallCount >= 10,
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
    }),
    { name: 'neet-achievements' }
  )
);
