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
    warning: '#d97706',
    positive: '#16a34a',
    suggestion: '#2563eb',
    info: '#0d9488',
  };

  return (
    <div className="glass rounded-2xl p-3" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <Brain size={14} style={{ color: '#7c3aed' }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
          AI Coach
        </span>
        <span className="text-[9px] ml-auto" style={{ color: 'var(--muted-foreground)' }}>{visible.length} insights</span>
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
                  <div className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{insight.detail}</div>
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
                  className="shrink-0"
                  style={{ color: 'var(--muted-foreground)' }}
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

  const trendColor = report.comparisonVsLastWeek > 0 ? '#16a34a' : report.comparisonVsLastWeek < 0 ? '#dc2626' : '#d97706';
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
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-t-3xl p-6 pb-8"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Weekly Report</h2>
              </div>
              <button onClick={() => setShow(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Top insight */}
            <div className="rounded-xl p-3 mb-4 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{report.topInsight}</div>
            </div>

            {/* Total time + comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>Total Study</div>
                <div className="text-2xl font-bold tabular" style={{ color: '#16a34a' }}>{formatHM(report.totalStudySec)}</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>vs Last Week</div>
                <div className="text-2xl font-bold tabular flex items-center justify-center gap-1" style={{ color: trendColor }}>
                  {trendIcon}
                  {report.comparisonVsLastWeek > 0 ? '+' : ''}{report.comparisonVsLastWeek}%
                </div>
              </div>
            </div>

            {/* Best / Worst day */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-2.5" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Best Day</div>
                <div className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatHM(report.bestDay.sec)}</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{new Date(report.bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Slowest Day</div>
                <div className="text-sm font-bold" style={{ color: '#d97706' }}>{formatHM(report.worstDay.sec)}</div>
                <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{new Date(report.worstDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>

            {/* Subject breakdown */}
            {report.subjectBreakdown.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Subject Distribution</div>
                <div className="space-y-1.5">
                  {report.subjectBreakdown.map((s) => {
                    const c = subjectColor(s.subject);
                    const pct = report.totalStudySec > 0 ? Math.round((s.sec / report.totalStudySec) * 100) : 0;
                    return (
                      <div key={s.subject} className="flex items-center gap-2 text-xs">
                        <span className="w-16 font-bold" style={{ color: c.hex }}>{s.subject}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.hex }} />
                        </div>
                        <span className="tabular w-10 text-right" style={{ color: 'var(--muted-foreground)' }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tests */}
            {report.testsTaken > 0 && (
              <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tests taken: {report.testsTaken}</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Average score: {report.avgTestScore}/720</div>
                </div>
                <span className="text-2xl">📝</span>
              </div>
            )}

            <button
              onClick={() => setShow(false)}
              className="w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(90deg, #0d9488, #16a34a)' }}
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
