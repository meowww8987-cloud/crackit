'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { cn, formatHM, vibrate } from '@/lib/utils';
import type { Mood } from '@/lib/types';

const MOODS: { value: Mood; emoji: string; label: string; color: string }[] = [
  { value: 'confident', emoji: '😊', label: 'Confident', color: '#22c55e' },
  { value: 'okay', emoji: '🙂', label: 'Okay', color: '#14b8a6' },
  { value: 'struggling', emoji: '😰', label: 'Struggling', color: '#f59e0b' },
  { value: 'tired', emoji: '😴', label: 'Tired', color: '#6b7280' },
];

const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Very Low', color: '#ef4444' },
  { value: 2, label: 'Low', color: '#f59e0b' },
  { value: 3, label: 'Okay', color: '#eab308' },
  { value: 4, label: 'High', color: '#84cc16' },
  { value: 5, label: 'Very High', color: '#22c55e' },
];

export function MoodPicker() {
  const { pendingMoodSession, saveWithMood, cancelPending } = useSession();
  const markLectureDoneWithStats = useSyllabus((s) => s.markLectureDoneWithStats);
  const addLectureStats = useSyllabus((s) => s.addLectureStats);
  const toggleTargetDone = useTargets((s) => s.toggleDone);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [confidence, setConfidence] = useState<number>(3);

  if (!pendingMoodSession) return null;

  // Compute cumulative "today" totals for this target so the user understands
  // that the just-finished session adds on top of prior sessions today.
  // (pendingMoodSession hasn't been written to history yet, so we add it manually.)
  const priorTodayStudy = pendingMoodSession.targetId
    ? useHistory.getState().getSessionsForTargetToday(pendingMoodSession.targetId)
        .reduce((acc, s) => acc + s.studySeconds, 0)
    : 0;
  const priorTodayWasted = pendingMoodSession.targetId
    ? useHistory.getState().getSessionsForTargetToday(pendingMoodSession.targetId)
        .reduce((acc, s) => acc + s.wastedSeconds, 0)
    : 0;
  const totalTodayStudy = priorTodayStudy + pendingMoodSession.studySeconds;
  const totalTodayWasted = priorTodayWasted + pendingMoodSession.wastedSeconds;
  const showCumulative = pendingMoodSession.targetId !== null && priorTodayStudy > 0;

  const handlePickMood = (m: Mood) => {
    setSelectedMood(m);
    vibrate(10);
  };

  const handleConfirm = () => {
    if (!selectedMood) return;
    vibrate([10, 30, 10]);

    // Update lecture stats if linked
    if (pendingMoodSession.targetId) {
      // Find the target to get lectureId
      const target = useTargets.getState().getTodayTargets().find((t) => t.id === pendingMoodSession.targetId);
      if (target?.lectureId) {
        // Add study time to lecture stats
        addLectureStats(
          target.lectureId,
          pendingMoodSession.studySeconds,
          pendingMoodSession.wastedSeconds,
          confidence
        );
      }
    }

    saveWithMood(selectedMood);
  };

  const handleSkip = () => {
    // Still add stats without confidence
    if (pendingMoodSession.targetId) {
      const target = useTargets.getState().getTodayTargets().find((t) => t.id === pendingMoodSession.targetId);
      if (target?.lectureId) {
        addLectureStats(
          target.lectureId,
          pendingMoodSession.studySeconds,
          pendingMoodSession.wastedSeconds
        );
      }
    }
    cancelPending();
  };

  return (
    <motion.div
      data-focus-overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex flex-col items-center justify-center px-6 force-dark-ui"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm text-center"
      >
        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Session Complete</div>

        {/* Session summary */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">This Session · Studied</div>
              <div className="text-2xl font-bold text-green-400 tabular">
                {formatHM(pendingMoodSession.studySeconds)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">This Session · Wasted</div>
              <div className="text-2xl font-bold text-red-400 tabular">
                {formatHM(pendingMoodSession.wastedSeconds)}
              </div>
            </div>
          </div>
          {showCumulative && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total today (all sessions):</span>
              <span className="tabular">
                <span className="text-green-400 font-semibold">{formatHM(totalTodayStudy)}</span>
                {totalTodayWasted > 0 && (
                  <span className="text-red-400/80 ml-2">⚠ {formatHM(totalTodayWasted)}</span>
                )}
              </span>
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold mb-1">How was it?</h2>
        <p className="text-sm text-muted-foreground mb-4">Rate your focus quality</p>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {MOODS.map((m) => (
            <motion.button
              key={m.value}
              whileTap={{ scale: 0.96 }}
              onClick={() => handlePickMood(m.value)}
              className={cn(
                'glass rounded-xl p-3 flex flex-col items-center gap-1 transition',
                selectedMood === m.value ? 'ring-2' : 'hover:bg-foreground/10'
              )}
              style={selectedMood === m.value ? { borderColor: m.color, '--tw-ring-color': m.color } as any : undefined}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[9px] font-semibold" style={{ color: m.color }}>{m.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Confidence picker — only if mood selected */}
        {selectedMood && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 mb-4 text-left"
          >
            <div className="text-xs font-semibold text-muted-foreground mb-2 text-center">
              Confidence level on this topic
            </div>
            <div className="flex justify-center gap-1.5 mb-2">
              {CONFIDENCE_LEVELS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setConfidence(c.value); vibrate(6); }}
                  className={cn(
                    'w-9 h-9 rounded-full text-xs font-bold transition',
                    confidence === c.value ? 'text-black scale-110' : 'bg-foreground/10 text-muted-foreground'
                  )}
                  style={confidence === c.value ? { background: c.color } : undefined}
                >
                  {c.value}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-center" style={{ color: CONFIDENCE_LEVELS[confidence - 1].color }}>
              {CONFIDENCE_LEVELS[confidence - 1].label}
            </div>
          </motion.div>
        )}

        {selectedMood ? (
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] mb-2"
          >
            Save Session
          </button>
        ) : (
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-muted-foreground"
          >
            Skip
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
