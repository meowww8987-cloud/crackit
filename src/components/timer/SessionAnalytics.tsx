'use client';

import { motion } from 'framer-motion';
import { X, TrendingUp, Zap, Clock, Target } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { formatHM, formatClock } from '@/lib/utils';

interface Props {
  studySeconds: number;
  wastedSeconds: number;
  distractionCount: number;
  longestFocusStreak: number; // seconds of longest uninterrupted study
  onClose: () => void;
}

export function SessionAnalytics({ studySeconds, wastedSeconds, distractionCount, longestFocusStreak, onClose }: Props) {
  const sessions = useHistory((s) => s.sessions);
  const dailyGoal = useSettings((s) => s.dailyGoalHours);

  // Focus Score: 0-100 based on study:wasted ratio + session length
  const totalSec = studySeconds + wastedSeconds;
  const wasteRatio = totalSec > 0 ? wastedSeconds / totalSec : 0;
  const lengthBonus = Math.min(20, Math.round(studySeconds / 60 / 3)); // +1 per 3 min, max 20
  const focusScore = Math.max(0, Math.min(100, Math.round((1 - wasteRatio) * 80) + lengthBonus));

  // Average session comparison
  const avgStudySec = sessions.length > 0
    ? sessions.reduce((a, s) => a + s.studySeconds, 0) / sessions.length
    : 0;
  const comparison = avgStudySec > 0
    ? Math.round(((studySeconds - avgStudySec) / avgStudySec) * 100)
    : 0;

  const scoreColor = focusScore >= 80 ? '#22c55e' : focusScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center px-6"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm glass rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={18} className="text-teal-400" />
            Session Report
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        {/* Focus Score — big number */}
        <div className="text-center mb-5">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Focus Score</div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="text-6xl font-bold tabular"
            style={{ color: scoreColor }}
          >
            {focusScore}
          </motion.div>
          <div className="text-xs mt-1" style={{ color: scoreColor }}>
            {focusScore >= 80 ? 'Excellent focus!' : focusScore >= 50 ? 'Decent — room to improve' : 'Distracted session'}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatBox icon={<Clock size={12} />} label="Study Time" value={formatHM(studySeconds)} color="#22c55e" />
          <StatBox icon={<Clock size={12} />} label="Wasted" value={formatHM(wastedSeconds)} color="#ef4444" />
          <StatBox icon={<Zap size={12} />} label="Best Streak" value={formatClock(longestFocusStreak)} color="#14b8a6" />
          <StatBox icon={<Target size={12} />} label="Distractions" value={String(distractionCount)} color="#f59e0b" />
        </div>

        {/* Comparison */}
        {avgStudySec > 0 && (
          <div className="glass rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">vs Your Average</span>
              <span
                className="font-bold tabular"
                style={{ color: comparison >= 0 ? '#22c55e' : '#ef4444' }}
              >
                {comparison >= 0 ? '↑' : '↓'} {Math.abs(comparison)}%
              </span>
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              This session: {formatHM(studySeconds)} · Average: {formatHM(avgStudySec)}
            </div>
          </div>
        )}

        {/* Efficiency bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Efficiency</span>
            <span className="tabular">{Math.round((1 - wasteRatio) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: scoreColor }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((1 - wasteRatio) * 100)}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98]"
        >
          Continue
        </button>
      </motion.div>
    </motion.div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] text-white/40 mb-1">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="text-base font-bold tabular" style={{ color }}>{value}</div>
    </div>
  );
}
