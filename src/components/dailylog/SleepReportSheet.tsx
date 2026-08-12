'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, TrendingUp, Clock, Star, Sparkles } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import {
  buildWeeklySleepReport,
  verdictLabel,
  verdictColor,
  formatHour,
  formatSleepDuration,
  classifySleep,
} from '@/lib/sleepHealth';
import { formatHM } from '@/lib/utils';

interface SleepReportSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * SleepReportSheet — full-screen sheet showing the user's sleep health report.
 *
 * Opened by long-pressing:
 *  - the "Past 6 Days" sleep row in History tab
 *  - any session card in History tab (sleep history entries)
 *  - the Stats tab header (future)
 *
 * Contents:
 *  - Overall sleep health score (0-100) + verdict
 *  - Last 7 nights breakdown (chart-like)
 *  - Average bedtime + duration + consistency
 *  - Personalized recommendations
 */
export function SleepReportSheet({ open, onClose }: SleepReportSheetProps) {
  const history = useSleep((s) => s.history);
  const report = buildWeeklySleepReport(history);

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
            className="relative w-full max-w-md max-h-[88vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8 force-dark-ui"
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
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
                <Moon size={28} className="text-indigo-300" />
              </div>
              <h2 className="text-lg font-bold">Sleep Health Report</h2>
              <p className="text-[11px] text-white/50 mt-0.5">Last 7 nights</p>
            </div>

            {/* === Health Score Big Card === */}
            <div
              className="rounded-2xl p-4 mb-4 border"
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
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.healthScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: verdictColor(report.verdict) }}
                />
              </div>
            </div>

            {/* === Stats grid === */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard
                icon={<Clock size={14} />}
                label="Avg Duration"
                value={report.avgNightHours > 0 ? `${report.avgNightHours.toFixed(1)}h` : '—'}
                hint="target 7-9h"
              />
              <StatCard
                icon={<Moon size={14} />}
                label="Avg Bedtime"
                value={report.avgBedtime > 0 ? formatHour(report.avgBedtime) : '—'}
                hint="ideal 10-11:30 PM"
              />
              <StatCard
                icon={<TrendingUp size={14} />}
                label="Consistency"
                value={`${report.bedtimeConsistency}%`}
                hint="bedtime regularity"
              />
              <StatCard
                icon={<Star size={14} />}
                label="Avg Quality"
                value={report.avgQuality > 0 ? `${report.avgQuality.toFixed(1)}/5` : '—'}
                hint="your rating"
              />
            </div>

            {/* === Last 7 nights === */}
            {report.nights.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2 flex items-center gap-1">
                  <Sparkles size={12} /> Last {report.nights.length} Nights
                </h3>
                <div className="space-y-1.5">
                  {report.nights.slice().reverse().map((n, i) => {
                    const d = new Date(n.bedTime);
                    const bedtimeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const wakeStr = n.wakeTime
                      ? new Date(n.wakeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : '?';
                    return (
                      <div
                        key={i}
                        className="glass rounded-xl p-2.5 flex items-center gap-3"
                        style={{ borderLeft: `3px solid ${verdictColor(n.score >= 85 ? 'excellent' : n.score >= 65 ? 'good' : n.score >= 45 ? 'fair' : 'poor')}` }}
                      >
                        <div className="text-center min-w-[42px]">
                          <div className="text-[10px] text-white/40 uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          <div className="text-sm font-bold">{d.getDate()}</div>
                        </div>
                        <div className="text-xl">{n.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{n.label}</div>
                          <div className="text-[10px] text-white/50">
                            {bedtimeStr} → {wakeStr} · {formatSleepDuration(n.durationSec)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold tabular" style={{ color: verdictColor(n.score >= 85 ? 'excellent' : n.score >= 65 ? 'good' : n.score >= 45 ? 'fair' : 'poor') }}>
                            {n.score}
                          </div>
                          {n.quality != null && (
                            <div className="text-[9px] text-white/40">{'★'.repeat(n.quality)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === Recommendations === */}
            <div className="mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">Recommendations</h3>
              <div className="space-y-1.5">
                {report.recommendations.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-100 flex items-start gap-2"
                  >
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span className="flex-1">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[9px] text-white/30 text-center mt-4">
              Long-press any sleep entry in History to see this report · Tap anywhere outside to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
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

/** Helper exported for callers — analyze a single sleep entry (for inline display). */
export function analyzeEntry(bedTime: number, durationSec: number) {
  return classifySleep(bedTime, durationSec);
}
