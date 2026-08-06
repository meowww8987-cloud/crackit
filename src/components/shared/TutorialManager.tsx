'use client';

import { useEffect, useState } from 'react';
import { Tutorial, type TutorialStep, resetAllTutorials } from '@/components/shared/Tutorial';
import { useNav } from '@/lib/store/nav';
import { useSettings } from '@/lib/store/settings';
import type { TabKey } from '@/lib/store/nav';

/**
 * Tutorial step definitions for each major feature.
 * Each tutorial is shown once per session (tracked in localStorage).
 */

const STUDY_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    emoji: '👋',
    title: 'Welcome to Study Tab',
    body: 'This is where you plan and track your daily study targets. Tap + to add a target, or use Smart Plan to auto-suggest what to study next.',
  },
  {
    id: 'target-card',
    emoji: '🎯',
    title: 'Target Cards',
    body: 'Each card shows a study target with progress bar. Tap ▶ to start a focus session, ✓ to mark done. Hold the card for 350ms to drag-reorder.',
  },
  {
    id: 'focus-timer',
    emoji: '⏱️',
    title: 'Focus Timer',
    body: 'When you start a session, a full-screen timer takes over. Tap "I\'m Wasting Time" if you get distracted — it tracks wasted time separately.',
  },
  {
    id: 'doubt-tracker',
    emoji: '❓',
    title: 'Doubt Tracker',
    body: 'The floating ? button at bottom-right lets you quickly log doubts during study. Review them later in the Doubts section.',
  },
];

const TESTS_STEPS: TutorialStep[] = [
  {
    id: 'tests-intro',
    emoji: '📝',
    title: 'Tests Tab',
    body: 'Track all your mock tests — Allen, Aakash, PW, Vibrant, or self-mock. Add a test, set its syllabus scope, and the app calculates your readiness %.',
  },
  {
    id: 'paper-test',
    emoji: '⏱️',
    title: 'Paper Test Mode',
    body: 'LONG-PRESS the Tests tab to start a paper test with per-question timing, A/B/C/D answer logging, flags, and photos. Fully customizable (60/100/180 Q, extra time, etc.).',
  },
  {
    id: 'answer-key',
    emoji: '🎯',
    title: 'Auto-Scoring',
    body: 'After a paper test, paste the 180-char answer key from your coaching PDF. The app auto-scores: +4 correct, -1 wrong, shows per-subject marks + predicted NEET rank.',
  },
  {
    id: 'leaderboard',
    emoji: '🏆',
    title: 'Leaderboard & Patterns',
    body: 'Personal best per test type, behavior pattern insights (time-of-day effect, subject imbalance), and achievement badges unlock as you take more tests.',
  },
];

const SYLLABUS_STEPS: TutorialStep[] = [
  {
    id: 'syllabus-intro',
    emoji: '📚',
    title: 'Syllabus Tab',
    body: 'Build your NEET syllabus by picking subjects → chapters → lectures. Each lecture has 4 sub-resources: Lecture, DPP, Notes, Revision.',
  },
  {
    id: 'spaced-repetition',
    emoji: '🔄',
    title: 'Spaced Repetition',
    body: 'When you mark a lecture done, it enters spaced repetition. The app reminds you to revise at increasing intervals (1 day, 3 days, 7 days, 21 days, 60 days).',
  },
];

const HOME_STEPS: TutorialStep[] = [
  {
    id: 'home-intro',
    emoji: '🏠',
    title: 'Home Tab',
    body: 'Mission control: days to NEET, today\'s progress vs yesterday, streak flame, next test readiness, subject health scores, and predicted NEET score.',
  },
  {
    id: 'streak',
    emoji: '🔥',
    title: 'Streak Protection',
    body: 'Keep your streak alive by studying every day. After 6 PM without study, the flame flickers urgently as a warning.',
  },
];

const STATS_STEPS: TutorialStep[] = [
  {
    id: 'stats-intro',
    emoji: '📊',
    title: 'Stats Tab',
    body: 'Deep analytics: weekly bar charts, subject distribution, 30-day trends, mood distribution, wasted-time ratio, best study hour, and more.',
  },
  {
    id: 'heatmap',
    emoji: '🗓️',
    title: '365-Day Heatmap',
    body: 'GitHub-style heatmap shows your study intensity for the entire year. Tap any day to see that day\'s total study time.',
  },
];

const SETTINGS_STEPS: TutorialStep[] = [
  {
    id: 'settings-intro',
    emoji: '⚙️',
    title: 'Settings Tab',
    body: 'Customize everything: daily goal, target score, focus timer behavior, 3D background, animations, sounds, theme, and data backup.',
  },
  {
    id: '3d-background',
    emoji: '🌌',
    title: '3D Background',
    body: 'Settings → Appearance → 3D Background. Auto mode shows atoms (Physics), DNA (Zoology), molecules (Chemistry), or cells (Botany) based on what you\'re studying.',
  },
];

const TUTORIALS: Record<TabKey, TutorialStep[]> = {
  home: HOME_STEPS,
  study: STUDY_STEPS,
  syllabus: SYLLABUS_STEPS,
  history: [],
  tests: TESTS_STEPS,
  stats: STATS_STEPS,
  settings: SETTINGS_STEPS,
};

/**
 * TutorialManager — listens to active tab + tutorialMode setting.
 * When tutorialMode is ON and user navigates to a tab they haven't seen
 * the tutorial for, shows the tutorial overlay.
 *
 * Renders nothing visible — just manages the overlay lifecycle.
 */
export function TutorialManager() {
  const activeTab = useNav((s) => s.activeTab);
  const tutorialMode = useSettings((s) => s.tutorialMode);
  const [activeTutorial, setActiveTutorial] = useState<TabKey | null>(null);

  useEffect(() => {
    if (!tutorialMode) return;
    const steps = TUTORIALS[activeTab];
    if (!steps || steps.length === 0) return;
    // Check if this tab's tutorial has been seen
    const seen = typeof window !== 'undefined' && localStorage.getItem(`neet-tutorial-seen-${activeTab}-tab`);
    if (!seen) {
      // Small delay so tab transition completes first
      const t = setTimeout(() => setActiveTutorial(activeTab), 500);
      return () => clearTimeout(t);
    }
  }, [activeTab, tutorialMode]);

  if (!tutorialMode || !activeTutorial) return null;

  const steps = TUTORIALS[activeTutorial];
  if (!steps || steps.length === 0) return null;

  return (
    <Tutorial
      tutorialKey={`${activeTutorial}-tab`}
      steps={steps}
      onComplete={() => setActiveTutorial(null)}
    />
  );
}

export { resetAllTutorials };
