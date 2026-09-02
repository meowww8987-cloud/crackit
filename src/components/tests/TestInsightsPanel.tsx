'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { subjectColor } from '@/lib/colors';
import {
  computeTestBadges,
  computeTestLeaderboard,
  detectBehaviorPatterns,
} from '@/lib/testReadiness';
import { TestComparisonView } from '@/components/tests/TestInsights';
import { cn, todayKey, diffDays } from '@/lib/utils';

/**
 * Composite insights panel for the Tests tab.
 * Shows:
 *  - Test Type Leaderboard (personal best per type)
 *  - Behavior Pattern insights (when ≥3 tests have results)
 *  - Test Streak Badges (gamification)
 *
 * Renders nothing if the user has no tests yet (handled by parent empty state).
 */
export function TestInsightsPanel() {
  const tests = useTests((s) => s.tests);

  const badges = useMemo(() => computeTestBadges(tests), [tests]);
  const leaderboard = useMemo(() => computeTestLeaderboard(tests), [tests]);
  const insights = useMemo(() => detectBehaviorPatterns(tests), [tests]);

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  if (tests.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* === Leaderboard === */}
      {leaderboard.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Personal Best by Type
            </span>
          </div>
          <div className="space-y-2">
            {leaderboard.map((leader, i) => {
              const c = subjectColor('Physics'); // generic teal for test types
              const trendIcon =
                leader.trend === 'up' ? (
                  <TrendingUp size={11} className="text-green-400" />
                ) : leader.trend === 'down' ? (
                  <TrendingDown size={11} className="text-red-400" />
                ) : (
                  <Minus size={11} className="text-muted-foreground/60" />
                );
              return (
                <div key={leader.type} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      i === 0
                        ? 'bg-amber-500 text-black'
                        : i === 1
                        ? 'bg-slate-400 text-black'
                        : i === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-foreground/10 text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{leader.type}</div>
                    <div className="text-[9px] text-muted-foreground truncate">
                      Best: {leader.bestTestName} · {leader.count} test{leader.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular text-teal-400">
                      {leader.bestScore}
                    </div>
                    <div className="text-[9px] text-muted-foreground">avg {leader.avgScore}</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 shrink-0 w-8">
                    {trendIcon}
                    <span className="text-[9px] tabular text-muted-foreground">{leader.latestScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Behavior Insights === */}
      {insights.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Behavior Patterns
            </span>
          </div>
          <div className="space-y-2">
            {insights.map((ins) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'rounded-xl p-2.5 flex items-start gap-2',
                  ins.type === 'positive'
                    ? 'bg-green-500/10 border border-green-500/20'
                    : ins.type === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : 'bg-foreground/5 border border-border',
                )}
              >
                <span className="text-lg leading-none mt-0.5">{ins.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-xs font-bold leading-tight',
                      ins.type === 'positive'
                        ? 'text-green-300'
                        : ins.type === 'warning'
                        ? 'text-amber-300'
                        : 'text-foreground',
                    )}
                  >
                    {ins.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{ins.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* === Badges === */}
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🏅</span>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Test Achievements
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {unlockedBadges.length}/{badges.length}
          </span>
        </div>

        {unlockedBadges.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {unlockedBadges.map((b) => (
              <div
                key={b.id}
                className="rounded-xl p-2 flex flex-col items-center text-center bg-gradient-to-br from-amber-500/15 to-amber-700/5 border border-amber-500/25"
              >
                <span className="text-xl mb-0.5">{b.emoji}</span>
                <span className="text-[8px] font-bold text-amber-300 leading-tight">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {lockedBadges.length > 0 && (
          <>
            <div className="text-[10px] text-muted-foreground/60 mb-2">Locked</div>
            <div className="grid grid-cols-4 gap-2">
              {lockedBadges.slice(0, 8).map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl p-2 flex flex-col items-center text-center bg-foreground/[0.03] border border-border opacity-50"
                >
                  <span className="text-xl mb-0.5 grayscale">{b.emoji}</span>
                  <span className="text-[8px] text-muted-foreground leading-tight">{b.label}</span>
                  {b.progress && (
                    <span className="text-[8px] text-muted-foreground/60 mt-0.5 tabular">
                      {b.progress.current}/{b.progress.target}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Test Comparison — side-by-side diff of 2 completed tests */}
      <TestComparisonView />
    </div>
  );
}
