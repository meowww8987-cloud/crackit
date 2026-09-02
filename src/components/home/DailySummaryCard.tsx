'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useSettings } from '@/lib/store/settings';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { formatHM, todayKey, diffDays } from '@/lib/utils';
import { playSound } from '@/lib/sounds';

const STORAGE_KEY = 'neet-last-summary-date';

/**
 * DailySummaryCard — slide-up card showing today's study recap.
 *
 * Triggers when:
 *  - It's past 9 PM AND user has studied ≥1 session today AND
 *    user hasn't already seen today's summary (tracked in localStorage)
 *
 * Or:
 *  - User opens app the day after studying (morning recap of yesterday)
 *
 * Shows:
 *  - Total time studied today
 *  - Per-subject breakdown (3 pills)
 *  - 1 win (best moment — longest session or new streak milestone)
 *  - 1 focus area for tomorrow (weakest subject)
 *  - Confetti + success sound if beat yesterday
 */
export function DailySummaryCard() {
  const [show, setShow] = useState(false);
  const [summary, setSummary] = useState<{
    totalSec: number;
    subjects: { subject: string; sec: number; pct: number }[];
    yesterdaySec: number;
    beatYesterday: boolean;
    longestSession: number;
    weakestSubject: string | null;
  } | null>(null);

  const sessions = useHistory((s) => s.sessions);
  const dailyGoal = useSettings((s) => s.dailyGoalHours);

  useEffect(() => {
    // Only check after mount (avoid SSR)
    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      const today = todayKey();
      const yesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      // Have we already shown today's summary?
      const lastShown = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (lastShown === today) return;

      // Today's sessions
      const todaySessions = sessions.filter((s) => s.date === today);
      const todaySec = todaySessions.reduce((a, s) => a + s.studySeconds, 0);

      // Trigger conditions:
      // 1. It's past 9 PM and user studied today → show today's summary
      // 2. It's morning (before noon) and user studied yesterday but not today
      //    → show yesterday's recap
      const isEveningRecap = hour >= 21 && todaySec > 60;
      const yesterdaySessions = sessions.filter((s) => s.date === yesterday);
      const yesterdaySec = yesterdaySessions.reduce((a, s) => a + s.studySeconds, 0);
      const isMorningRecap = hour < 12 && yesterdaySec > 60 && todaySec < 60;

      if (!isEveningRecap && !isMorningRecap) return;

      // Build summary
      const targetDate = isEveningRecap ? today : yesterday;
      const targetSessions = sessions.filter((s) => s.date === targetDate);
      const totalSec = targetSessions.reduce((a, s) => a + s.studySeconds, 0);

      // Per-subject breakdown
      const subjectMap: Record<string, number> = {};
      for (const s of targetSessions) {
        subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.studySeconds;
      }
      const subjectList = Object.entries(subjectMap)
        .map(([subject, sec]) => ({
          subject,
          sec,
          pct: totalSec > 0 ? Math.round((sec / totalSec) * 100) : 0,
        }))
        .sort((a, b) => b.sec - a.sec)
        .slice(0, 4);

      // Did we beat yesterday?
      const beatYesterday = isEveningRecap && totalSec > yesterdaySec && yesterdaySec > 0;

      // Longest session
      const longestSession = targetSessions.reduce((a, s) => Math.max(a, s.studySeconds), 0);

      // Weakest subject (least studied today → focus for tomorrow)
      const allSubjects = SUBJECTS.filter((s) => s !== 'General');
      let weakestSubject: string | null = null;
      let weakestSec = Infinity;
      for (const subj of allSubjects) {
        const sec = subjectMap[subj] || 0;
        if (sec < weakestSec) {
          weakestSec = sec;
          weakestSubject = subj;
        }
      }
      if (weakestSec === 0 && subjectList.length > 0) {
        // If multiple subjects have 0, pick one not studied at all
        weakestSubject = allSubjects.find((s) => !subjectMap[s]) || null;
      }

      setSummary({
        totalSec,
        subjects: subjectList,
        yesterdaySec,
        beatYesterday,
        longestSession,
        weakestSubject,
      });
      setShow(true);
      if (beatYesterday) playSound('success');

      // Mark as shown
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, today);
      }
    };
    // Delay 1s after mount so it doesn't fight with splash screen
    const t = setTimeout(check, 2500);
    return () => clearTimeout(t);
  }, [sessions, dailyGoal]);

  const close = () => setShow(false);

  return (
    <AnimatePresence>
      {show && summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[9990] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-strong rounded-t-3xl p-6 pb-8 max-h-[88vh] overflow-y-auto scroll-area"
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-foreground/30 rounded-full mx-auto mb-4" />

            {/* Close */}
            <button
              onClick={close}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="text-center mb-5">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="text-4xl mb-2"
              >
                {summary.beatYesterday ? '🎉' : '🌙'}
              </motion.div>
              <h2 className="text-xl font-bold">
                {summary.beatYesterday ? 'Great day!' : 'Today\'s Recap'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.beatYesterday
                  ? `You beat yesterday by ${formatHM(summary.totalSec - summary.yesterdaySec)}`
                  : 'Here\'s how your study day went'}
              </p>
            </div>

            {/* Big stat */}
            <div className="glass rounded-2xl p-4 mb-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Total Studied
              </div>
              <div className="text-4xl font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
                {formatHM(summary.totalSec)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Goal: {dailyGoal}h ·{' '}
                <span style={{ color: summary.totalSec >= dailyGoal * 3600 ? '#22c55e' : '#f59e0b' }}>
                  {Math.round((summary.totalSec / (dailyGoal * 3600)) * 100)}%
                </span>
              </div>
            </div>

            {/* Subject breakdown */}
            {summary.subjects.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Subject Breakdown
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {summary.subjects.map((s, i) => {
                    const c = subjectColor(s.subject as any);
                    return (
                      <motion.div
                        key={s.subject}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.08 }}
                        className="glass rounded-xl p-2.5 flex items-center gap-2"
                      >
                        <div className="w-2 h-8 rounded" style={{ background: c.hex }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold" style={{ color: c.hex }}>
                            {s.subject}
                          </div>
                          <div className="text-xs tabular text-foreground">{formatHM(s.sec)}</div>
                        </div>
                        <div className="text-[9px] text-muted-foreground tabular">{s.pct}%</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Win + Focus area */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="glass rounded-xl p-3 border border-green-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={11} className="text-green-400" />
                  <span className="text-[9px] font-bold uppercase text-green-400">Win</span>
                </div>
                <div className="text-xs text-foreground leading-snug">
                  Longest focus block: <strong className="text-white">{formatHM(summary.longestSession)}</strong>
                </div>
              </div>
              <div className="glass rounded-xl p-3 border border-amber-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={11} className="text-amber-400" />
                  <span className="text-[9px] font-bold uppercase text-amber-400">Tomorrow</span>
                </div>
                <div className="text-xs text-foreground leading-snug">
                  Focus on: <strong className="text-white">{summary.weakestSubject || 'Consistency'}</strong>
                </div>
              </div>
            </div>

            {/* Dismiss button */}
            <button
              onClick={close}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
