'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Star } from 'lucide-react';
import { useSleep } from '@/lib/store/sleep';
import { classifySleep, verdictColor } from '@/lib/sleepHealth';
import { formatHM } from '@/lib/utils';
import { SleepAnalysisSheet } from './SleepAnalysisSheet';

interface SleepHistorySheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * SleepHistorySheet — scrollable list of all past sleep entries.
 *
 * Each entry shows:
 *  - Date + weekday
 *  - Sleep type emoji + label (Night Sleep / Late Night / Noon Nap / etc.)
 *  - Bedtime → wake time
 *  - Duration
 *  - Quality star rating (if set)
 *  - Per-entry health score (color-coded)
 *
 * Long-press any entry → opens SleepAnalysisSheet for detailed report.
 */
export function SleepHistorySheet({ open, onClose }: SleepHistorySheetProps) {
  const history = useSleep((s) => s.history);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<'weekly' | 'monthly'>('weekly');

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, typeof history> = {};
    for (const e of history) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [history]);

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

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
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
                <Moon size={28} className="text-indigo-300" />
              </div>
              <h2 className="text-lg font-bold">Sleep History</h2>
              <p className="text-[11px] text-white/50 mt-0.5">{history.length} entries · long-press for report</p>
            </div>

            {/* Quick analysis buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setAnalysisTab('weekly'); setShowAnalysis(true); }}
                className="flex-1 py-2 rounded-xl bg-indigo-500/15 text-indigo-200 text-xs font-semibold active:scale-95 transition"
              >
                📊 Weekly Report
              </button>
              <button
                onClick={() => { setAnalysisTab('monthly'); setShowAnalysis(true); }}
                className="flex-1 py-2 rounded-xl bg-purple-500/15 text-purple-200 text-xs font-semibold active:scale-95 transition"
              >
                📈 Monthly Report
              </button>
            </div>

            {/* === Sleep entries grouped by date === */}
            {history.length === 0 ? (
              <div className="text-center py-12">
                <Moon size={40} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/50 text-sm">No sleep entries yet.</p>
                <p className="text-white/30 text-[10px] mt-1">Tap the NEET logo on Home to start sleep mode.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dates.map((date) => {
                  const entries = grouped[date];
                  const d = new Date(date + 'T00:00:00');
                  return (
                    <div key={date}>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 mb-1.5 px-1">
                        {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="space-y-1.5">
                        {entries.map((entry) => {
                          const dur = entry.durationSec || 0;
                          const analysis = classifySleep(entry.bedTime, dur);
                          const bedDate = new Date(entry.bedTime);
                          const wakeDate = entry.wakeTime ? new Date(entry.wakeTime) : null;
                          return (
                            <div
                              key={entry.id}
                              className="glass rounded-xl p-2.5 flex items-center gap-3 select-none"
                              style={{ borderLeft: `3px solid ${verdictColor(analysis.verdict)}` }}
                            >
                              <div className="text-2xl shrink-0">{analysis.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{analysis.label}</div>
                                <div className="text-[10px] text-white/50">
                                  {bedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  {wakeDate && (
                                    <> → {wakeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-bold tabular text-indigo-300">{formatHM(dur)}</div>
                                {entry.quality != null && (
                                  <div className="flex items-center gap-0.5 justify-end mt-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        size={8}
                                        className={s <= entry.quality! ? 'text-amber-400 fill-amber-400' : 'text-white/20'}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div
                                className="text-sm font-bold tabular shrink-0 w-7 text-center"
                                style={{ color: verdictColor(analysis.verdict) }}
                              >
                                {analysis.score}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[9px] text-white/30 text-center mt-4">
              Tap "Weekly Report" or "Monthly Report" above for detailed analysis
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* Sleep Analysis Sheet (opened from quick buttons) */}
      <SleepAnalysisSheet
        open={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        initialTab={analysisTab}
      />
    </AnimatePresence>
  );
}
