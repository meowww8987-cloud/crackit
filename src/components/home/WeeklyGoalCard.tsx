'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Check, ChevronRight } from 'lucide-react';
import { useWeeklyGoals } from '@/lib/store/weeklyGoals';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { dateKey, addDays } from '@/lib/utils';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';

export function WeeklyGoalCard() {
  const { currentGoals, setWeeklyGoals, checkWeekRollover, goalWeekStart } = useWeeklyGoals();
  const [showSetter, setShowSetter] = useState(false);
  const [studyHours, setStudyHours] = useState(50);
  const [lectures, setLectures] = useState(10);
  const [dpps, setDpps] = useState(5);

  const sessions = useHistory((s) => s.sessions);
  const lectures_ = useSyllabus((s) => s.lectures);

  // Check week rollover on mount
  useEffect(() => {
    checkWeekRollover();
  }, [checkWeekRollover]);

  // Calculate this week's progress
  const progress = useMemo(() => {
    const weekStart = goalWeekStart || dateKey(addDays(new Date(), -new Date().getDay() + 1));
    const weekAgo = Date.now() - 7 * 86400000;
    const weekSessions = sessions.filter((s) => s.endedAt >= weekAgo);
    const studySec = weekSessions.reduce((a, s) => a + s.studySeconds, 0);
    const studyHoursDone = studySec / 3600;

    // Count lectures/DPPs completed this week (simplified — checks doneDate)
    const weekStartMs = new Date(weekStart + 'T00:00:00').getTime();
    const lecturesDone = lectures_.filter((l) => l.doneDate && l.doneDate >= weekStartMs).length;
    const dppsDone = lectures_.filter((l) => l.dppDone && l.doneDate && l.doneDate >= weekStartMs).length;

    return { studyHoursDone, lecturesDone, dppsDone };
  }, [sessions, lectures_, goalWeekStart]);

  if (!currentGoals) {
    return (
      <>
        <button
          onClick={() => setShowSetter(true)}
          className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/[0.07] transition border border-teal-500/20"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
            <Target size={18} className="text-teal-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-teal-300">Set Weekly Goals</div>
            <div className="text-[10px] text-white/40">Define what you want to achieve this week</div>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
        <AnimatePresence>
          {showSetter && <GoalSetter onClose={() => setShowSetter(false)} studyHours={studyHours} setStudyHours={setStudyHours} lectures={lectures} setLectures={setLectures} dpps={dpps} setDpps={setDpps} onSave={() => { setWeeklyGoals({ studyHours, lectures, dpps }); setShowSetter(false); }} />}
        </AnimatePresence>
      </>
    );
  }

  const studyPct = Math.min(100, Math.round((progress.studyHoursDone / currentGoals.studyHours) * 100));
  const lecPct = Math.min(100, Math.round((progress.lecturesDone / currentGoals.lectures) * 100));
  const dppPct = Math.min(100, Math.round((progress.dppsDone / currentGoals.dpps) * 100));

  return (
    <>
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-teal-400" />
          <span className="text-xs font-bold text-white/70">This Week's Goals</span>
          <button onClick={() => setShowSetter(true)} className="ml-auto text-[10px] text-teal-400 hover:underline">
            Edit
          </button>
        </div>

        <GoalBar label="Study" done={`${progress.studyHoursDone.toFixed(1)}h`} goal={`${currentGoals.studyHours}h`} pct={studyPct} color="#14b8a6" />
        <GoalBar label="Lectures" done={String(progress.lecturesDone)} goal={String(currentGoals.lectures)} pct={lecPct} color="#22c55e" />
        <GoalBar label="DPPs" done={String(progress.dppsDone)} goal={String(currentGoals.dpps)} pct={dppPct} color="#3b82f6" />
      </div>

      <AnimatePresence>
        {showSetter && <GoalSetter onClose={() => setShowSetter(false)} studyHours={currentGoals.studyHours} setStudyHours={setStudyHours} lectures={currentGoals.lectures} setLectures={setLectures} dpps={currentGoals.dpps} setDpps={setDpps} onSave={() => { setWeeklyGoals({ studyHours, lectures, dpps }); setShowSetter(false); }} />}
      </AnimatePresence>
    </>
  );
}

function GoalBar({ label, done, goal, pct, color }: { label: string; done: string; goal: string; pct: number; color: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-white/50">{label}</span>
        <span className="tabular" style={{ color: pct >= 100 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
          {done} / {goal} {pct >= 100 && '✓'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: pct >= 100 ? '#22c55e' : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function GoalSetter({ onClose, studyHours, setStudyHours, lectures, setLectures, dpps, setDpps, onSave }: {
  onClose: () => void;
  studyHours: number; setStudyHours: (v: number) => void;
  lectures: number; setLectures: (v: number) => void;
  dpps: number; setDpps: (v: number) => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl p-5 pb-8"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-bold mb-5">Set Weekly Goals</h2>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-semibold text-white/60">Study Hours</label>
              <span className="text-sm font-bold tabular text-teal-400">{studyHours}h</span>
            </div>
            <ScrollAwareSlider>
              <input type="range" min={10} max={100} step={5} value={studyHours} onChange={(e) => setStudyHours(Number(e.target.value))} className="w-full" />
            </ScrollAwareSlider>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-semibold text-white/60">Lectures to Complete</label>
              <span className="text-sm font-bold tabular text-green-400">{lectures}</span>
            </div>
            <ScrollAwareSlider>
              <input type="range" min={1} max={50} step={1} value={lectures} onChange={(e) => setLectures(Number(e.target.value))} className="w-full" />
            </ScrollAwareSlider>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-semibold text-white/60">DPPs to Solve</label>
              <span className="text-sm font-bold tabular text-blue-400">{dpps}</span>
            </div>
            <ScrollAwareSlider>
              <input type="range" min={1} max={50} step={1} value={dpps} onChange={(e) => setDpps(Number(e.target.value))} className="w-full" />
            </ScrollAwareSlider>
          </div>
        </div>

        <button
          onClick={onSave}
          className="w-full mt-5 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98]"
        >
          <Check size={16} className="inline mr-1" /> Set Goals
        </button>
      </motion.div>
    </motion.div>
  );
}
