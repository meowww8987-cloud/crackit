'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, TrendingUp, TrendingDown, Sparkles, CheckCircle2, AlertTriangle, Target, Trophy, Frown } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import {
  buildSleepInsightReport,
  verdictLabel,
  verdictColor,
  formatHour,
  formatSleepDuration,
  type SleepInsightReport,
} from '@/lib/sleepHealth';

interface SleepAnalysisSheetProps {
  open: boolean;
  onClose: () => void;
  /** Initial tab — 'weekly' or 'monthly'. */
  initialTab?: 'weekly' | 'monthly';
}

/**
 * SleepAnalysisSheet — full-screen sheet showing sleep analysis with
 * Weekly + Monthly tabs.
 *
 * Each tab shows:
 *  - Health score + verdict
 *  - Period label + nights/naps analyzed + total hours
 *  - 4 stat tiles (avg duration, bedtime, consistency, quality)
 *  - Best night + worst night highlights
 *  - ✅ Advantages (what's going well)
 *  - ⚠️ Disadvantages (what needs work)
 *  - 🎯 Improvements (actionable recommendations)
 */
export function SleepAnalysisSheet({ open, onClose, initialTab = 'weekly' }: SleepAnalysisSheetProps) {
  const history = useSleep((s) => s.history);
  const [tab, setTab] = useState<'weekly' | 'monthly'>(initialTab);

  const weeklyReport = useMemo(() => buildSleepInsightReport(history, 7), [history]);
  const monthlyReport = useMemo(() => buildSleepInsightReport(history, 30), [history]);
  const report = tab === 'weekly' ? weeklyReport : monthlyReport;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8 force-dark-ui"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
                <Moon size={28} className="text-indigo-300" />
              </div>
              <h2 className="text-lg font-bold">Sleep Analysis</h2>
              <p className="text-[11px] text-white/50 mt-0.5">Health report · advantages · improvements</p>
            </div>

            {/* === Tab switcher === */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4">
              {(['weekly', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    tab === t ? 'bg-indigo-500/30 text-indigo-200' : 'text-white/50'
                  }`}
                >
                  {t === 'weekly' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>

            {/* === Health Score Big Card === */}
            <div
              className="rounded-2xl p-4 mb-3 border"
              style={{
                background: `linear-gradient(135deg, ${verdictColor(report.verdict)}22, ${verdictColor(report.verdict)}11)`,
                borderColor: `${verdictColor(report.verdict)}40`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-white/50 font-semibold">Health Score</div>
                  <div className="text-4xl font-bold tabular" style={{ color: verdictColor(report.verdict) }}>
                    {report.healthScore}
                    <span className="text-base text-white/40 font-normal">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${verdictColor(report.verdict)}22`, color: verdictColor(report.verdict) }}>
                    {verdictLabel(report.verdict)}
                  </div>
                  <div className="text-[9px] text-white/40 mt-1">{report.periodLabel}</div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.healthScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: verdictColor(report.verdict) }}
                />
              </div>
              {/* Period stats */}
              <div className="flex justify-between mt-3 text-[10px] text-white/50">
                <span>{report.nightsAnalyzed} nights · {report.napsAnalyzed} naps</span>
                <span>{report.totalHours.toFixed(1)}h total sleep</span>
              </div>
            </div>

            {/* === Stats grid === */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatTile icon={<Moon size={14} />} label="Avg Duration" value={report.avgNightHours > 0 ? `${report.avgNightHours.toFixed(1)}h` : '—'} hint="target 7-9h" />
              <StatTile icon={<Moon size={14} />} label="Avg Bedtime" value={report.avgBedtime > 0 ? formatHour(report.avgBedtime) : '—'} hint="ideal 10-11:30 PM" />
              <StatTile icon={<TrendingUp size={14} />} label="Consistency" value={`${report.bedtimeConsistency}%`} hint="bedtime regularity" />
              <StatTile icon={<Sparkles size={14} />} label="Avg Quality" value={report.avgQuality > 0 ? `${report.avgQuality.toFixed(1)}/5` : '—'} hint="your rating" />
            </div>

            {/* === Best + Worst night === */}
            {report.bestNight && report.worstNight && report.bestNight.date !== report.worstNight.date && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <NightHighlight
                  icon={<Trophy size={12} />}
                  label="Best Night"
                  entry={report.bestNight}
                  color="#22c55e"
                />
                <NightHighlight
                  icon={<Frown size={12} />}
                  label="Worst Night"
                  entry={report.worstNight}
                  color="#ef4444"
                />
              </div>
            )}

            {/* === Advantages === */}
            <Section
              icon={<CheckCircle2 size={12} />}
              title="What's Going Well"
              color="#22c55e"
              items={report.advantages}
            />

            {/* === Disadvantages === */}
            <Section
              icon={<AlertTriangle size={12} />}
              title="What Needs Work"
              color="#f59e0b"
              items={report.disadvantages}
            />

            {/* === Improvements === */}
            <Section
              icon={<Target size={12} />}
              title="What to Improve"
              color="#14b8a6"
              items={report.improvements}
            />

            <p className="text-[9px] text-white/30 text-center mt-4">
              Tap outside to close · Switch tabs for 7-day vs 30-day view
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="glass rounded-xl p-2.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/40 font-semibold mb-1">
        {icon} {label}
      </div>
      <div className="text-base font-bold tabular">{value}</div>
      <div className="text-[9px] text-white/40 mt-0.5">{hint}</div>
    </div>
  );
}

function NightHighlight({
  icon,
  label,
  entry,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  entry: import('@/lib/sleepHealth').SleepNightEntry;
  color: string;
}) {
  const d = new Date(entry.bedTime);
  return (
    <div
      className="glass rounded-xl p-2.5"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color }}>
        {icon} {label}
      </div>
      <div className="text-xs font-semibold">
        {entry.emoji} {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
      <div className="text-[10px] text-white/50">
        {formatSleepDuration(entry.durationSec)} · score {entry.score}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color }}>
        {icon} {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl p-2.5 text-xs flex items-start gap-2"
            style={{ background: `${color}11`, borderLeft: `2px solid ${color}40` }}
          >
            <span style={{ color }} className="mt-0.5">•</span>
            <span className="flex-1 text-white/80">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
