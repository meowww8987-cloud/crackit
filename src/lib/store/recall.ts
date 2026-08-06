'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RecallChallenge, RecallRating } from '@/lib/types';
import { uid, todayKey } from '@/lib/utils';
import { useSyllabus } from './syllabus';

interface RecallStore {
  challenges: RecallChallenge[];
  // Topics re-queued for tomorrow (forgotten or vague)
  requeuedTopicIds: string[];
  // Track per-topic retention history: topicId -> array of ratings with dates
  topicHistory: Record<string, { date: string; rating: RecallRating }[]>;

  getTodayChallenge: () => RecallChallenge | null;
  hasTodayChallenge: () => boolean;
  // Generates a new challenge for today (called when user starts it)
  generateChallenge: () => RecallChallenge;
  // Saves results for today's challenge
  saveResults: (results: Record<string, RecallRating>) => RecallChallenge;
  // Get retention trend (last N days)
  getRetentionTrend: (days: number) => { date: string; score: number }[];
  // Get average retention for a topic
  getTopicRetention: (topicId: string) => number; // 0-100
}

export const useRecall = create<RecallStore>()(
  persist(
    (set, get) => ({
      challenges: [],
      requeuedTopicIds: [],
      topicHistory: {},

      getTodayChallenge: () => {
        const today = todayKey();
        return get().challenges.find((c) => c.date === today) || null;
      },

      hasTodayChallenge: () => {
        const today = todayKey();
        return get().challenges.some((c) => c.date === today);
      },

      generateChallenge: () => {
        const today = todayKey();
        // Check if already exists
        const existing = get().challenges.find((c) => c.date === today);
        if (existing) return existing;

        // Pull from lectures marked done in past 3-7 days
        const now = Date.now();
        const threeDaysAgo = now - 3 * 86400000;
        const sevenDaysAgo = now - 7 * 86400000;

        const syllabusState = useSyllabus.getState();
        const eligibleLectures = syllabusState.lectures.filter((l) => {
          if (!l.done || !l.lastRevisedAt) return false;
          return l.lastRevisedAt >= sevenDaysAgo && l.lastRevisedAt <= threeDaysAgo;
        });

        // Also include re-queued topics
        const requeued = syllabusState.lectures.filter((l) =>
          get().requeuedTopicIds.includes(l.id)
        );

        // Combine, dedupe, prioritize re-queued
        const seen = new Set<string>();
        const pool: string[] = [];

        // Re-queued first
        for (const l of requeued) {
          if (!seen.has(l.id)) {
            pool.push(l.id);
            seen.add(l.id);
          }
        }
        // Then eligible
        for (const l of eligibleLectures) {
          if (!seen.has(l.id)) {
            pool.push(l.id);
            seen.add(l.id);
          }
        }

        // If pool is small, also include recently done (last 14 days)
        if (pool.length < 5) {
          const fourteenDaysAgo = now - 14 * 86400000;
          const recent = syllabusState.lectures.filter(
            (l) => l.done && l.lastRevisedAt && l.lastRevisedAt >= fourteenDaysAgo
          );
          for (const l of recent) {
            if (!seen.has(l.id) && pool.length < 10) {
              pool.push(l.id);
              seen.add(l.id);
            }
          }
        }

        // Limit to 5-10
        const topicIds = pool.slice(0, Math.min(10, Math.max(5, pool.length)));

        const challenge: RecallChallenge = {
          id: uid(),
          date: today,
          topicIds,
          results: {},
          retentionScore: 0,
          completedAt: 0,
        };

        set((s) => ({ challenges: [...s.challenges, challenge] }));
        return challenge;
      },

      saveResults: (results) => {
        const today = todayKey();
        // Calculate retention score: remembered=1, vague=0.5, forgot=0
        const total = Object.keys(results).length;
        const score =
          total > 0
            ? Math.round(
                (Object.values(results).reduce(
                  (acc, r) => acc + (r === 'remembered' ? 1 : r === 'vague' ? 0.5 : 0),
                  0
                ) /
                  total) *
                  100
              )
            : 0;

        // Update topic history
        const topicHistory = { ...get().topicHistory };
        for (const [topicId, rating] of Object.entries(results)) {
          if (!topicHistory[topicId]) topicHistory[topicId] = [];
          topicHistory[topicId] = [...topicHistory[topicId], { date: today, rating }].slice(-20);
        }

        // Re-queue forgotten and vague topics
        const requeuedTopicIds = [...get().requeuedTopicIds];
        for (const [topicId, rating] of Object.entries(results)) {
          if (rating === 'forgot' || rating === 'vague') {
            if (!requeuedTopicIds.includes(topicId)) {
              requeuedTopicIds.push(topicId);
            }
          } else {
            // Remove from re-queue if remembered
            const idx = requeuedTopicIds.indexOf(topicId);
            if (idx >= 0) requeuedTopicIds.splice(idx, 1);
          }
        }

        const updated: RecallChallenge = {
          id: uid(),
          date: today,
          topicIds: Object.keys(results),
          results,
          retentionScore: score,
          completedAt: Date.now(),
        };

        set((s) => ({
          challenges: s.challenges
            .filter((c) => c.date !== today)
            .concat(updated),
          topicHistory,
          requeuedTopicIds,
        }));

        return updated;
      },

      getRetentionTrend: (days) => {
        const result: { date: string; score: number }[] = [];
        const challenges = [...get().challenges].sort((a, b) => a.date.localeCompare(b.date));
        for (const c of challenges) {
          if (c.completedAt > 0) {
            result.push({ date: c.date, score: c.retentionScore });
          }
        }
        return result.slice(-days);
      },

      getTopicRetention: (topicId) => {
        const history = get().topicHistory[topicId] || [];
        if (history.length === 0) return -1; // no data
        const total = history.length;
        const sum = history.reduce(
          (acc, h) => acc + (h.rating === 'remembered' ? 100 : h.rating === 'vague' ? 50 : 0),
          0
        );
        return Math.round(sum / total);
      },
    }),
    { name: 'neet-recall' }
  )
);
