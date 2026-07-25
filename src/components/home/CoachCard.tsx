'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, ChevronRight, X } from 'lucide-react';
import { useNav } from '@/lib/store/nav';
import { subjectColor } from '@/lib/colors';
import { formatHM, todayKey } from '@/lib/utils';
import { generateCoachInsights, generateWeeklyReport, type CoachInsight, type WeeklyReport } from '@/lib/coachData';
import { useMounted } from '@/lib/hooks/useMounted';

/**
 * CoachCard — AI Study Coach card on Home tab.
 * Shows 1-4 prioritized insights based on analysis of sessions, tests, syllabus.
 * Each insight has an emoji, title, detail, and optional action button.
 */
export function CoachCard() {
  const mounted = useMounted();
  const setTab = useNav((s) => s.setTab);

  const insights = useMemo(() => mounted ? generateCoachInsights() : [], [mounted]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!mounted || insights.length === 0) return null;
  const visible = insights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  const typeColors = {
    warning: '#f59e0b',
    positive: '#22c55e',
    suggestion: '#3b82f6',
    info: '#14b8a6',
  };

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Brain size={14} className="text-purple-400" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-white/60">
          AI Coach
        </span>
        <span className="text-[9px] text-white/30 ml-auto">{visible.length} insights</span>
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {visible.map((insight) => {
            const c = typeColors[insight.type];
            return (
              <motion.div
                key={insight.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-2.5 flex items-start gap-2"
                style={{ background: `${c}10`, border: `1px solid ${c}25` }}
              >
                <span className="text-lg leading-none mt-0.5">{insight.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold" style={{ color: c }}>{insight.title}</div>
                  <div className="text-[10px] text-white/50 leading-snug mt-0.5">{insight.detail}</div>
                  {insight.action && (
                    <button
                      onClick={() => setTab(insight.action!.tab as any)}
                      className="text-[10px] font-bold mt-1 flex items-center gap-0.5"
                      style={{ color: c }}
                    >
                      {insight.action.label} <ChevronRight size={10} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(insight.id))}
                  className="text-white/20 hover:text-white/50 shrink-0"
                >
                  <X size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

const WEEKLY_REPORT_KEY = 'neet-weekly-report-last-shown';

/**
 * WeeklyReportCard — auto-shows on Sunday at 8 PM.
 * Summarizes the past 7 days: total time, best/worst day, subject breakdown,
 * tests taken, comparison with last week, and one key insight.
 */
export function WeeklyReportCard() {
  const mounted = useMounted();
  const [show, setShow] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const hour = now.getHours();
    const lastShown = typeof window !== 'undefined' ? localStorage.getItem(WEEKLY_REPORT_KEY) : null;
    const today = todayKey();

    if (day === 0 && hour >= 20 && lastShown !== today) {
      const r = generateWeeklyReport();
      if (r) {
        setReport(r);
        setShow(true);
        localStorage.setItem(WEEKLY_REPORT_KEY, today);
      }
    }
  }, [mounted]);

  if (!show || !report) return null;

  const trendColor = report.comparisonVsLastWeek > 0 ? '#22c55e' : report.comparisonVsLastWeek < 0 ? '#ef4444' : '#f59e0b';
  const trendIcon = report.comparisonVsLastWeek > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[9990] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-strong rounded-t-3xl p-6 pb-8"
          >
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h2 className="text-lg font-bold">Weekly Report</h2>
              </div>
              <button onClick={() => setShow(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                <X size={16} />
              </button>
            </div>

            {/* Top insight */}
            <div className="glass rounded-xl p-3 mb-4 text-center">
              <div className="text-xs text-white/60">{report.topInsight}</div>
            </div>

            {/* Total time + comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase text-white/40 mb-1">Total Study</div>
                <div className="text-2xl font-bold tabular text-green-400">{formatHM(report.totalStudySec)}</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase text-white/40 mb-1">vs Last Week</div>
                <div className="text-2xl font-bold tabular flex items-center justify-center gap-1" style={{ color: trendColor }}>
                  {trendIcon}
                  {report.comparisonVsLastWeek > 0 ? '+' : ''}{report.comparisonVsLastWeek}%
                </div>
              </div>
            </div>

            {/* Best / Worst day */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="glass rounded-xl p-2.5">
                <div className="text-[9px] uppercase text-white/40">Best Day</div>
                <div className="text-sm font-bold text-green-400">{formatHM(report.bestDay.sec)}</div>
                <div className="text-[9px] text-white/40">{new Date(report.bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
              <div className="glass rounded-xl p-2.5">
                <div className="text-[9px] uppercase text-white/40">Slowest Day</div>
                <div className="text-sm font-bold text-amber-400">{formatHM(report.worstDay.sec)}</div>
                <div className="text-[9px] text-white/40">{new Date(report.worstDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>

            {/* Subject breakdown */}
            {report.subjectBreakdown.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-2">Subject Distribution</div>
                <div className="space-y-1.5">
                  {report.subjectBreakdown.map((s) => {
                    const c = subjectColor(s.subject);
                    const pct = report.totalStudySec > 0 ? Math.round((s.sec / report.totalStudySec) * 100) : 0;
                    return (
                      <div key={s.subject} className="flex items-center gap-2 text-xs">
                        <span className="w-16 font-bold" style={{ color: c.hex }}>{s.subject}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.hex }} />
                        </div>
                        <span className="text-white/60 tabular w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tests */}
            {report.testsTaken > 0 && (
              <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/60">Tests taken: {report.testsTaken}</div>
                  <div className="text-[10px] text-white/40">Average score: {report.avgTestScore}/720</div>
                </div>
                <span className="text-2xl">📝</span>
              </div>
            )}

            <button
              onClick={() => setShow(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm"
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
