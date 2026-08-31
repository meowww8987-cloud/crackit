'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, ListOrdered, Layers } from 'lucide-react';
import { cn, vibrate } from '@/lib/utils';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import type { PaperTestConfig } from '@/lib/types';

interface Props {
  testName: string;
  onClose: () => void;
  onStart: (config: PaperTestConfig) => void;
}

const PRESETS = [
  { label: 'NEET Full', questionCount: 180, durationMin: 200, desc: '180 Q · 3h 20m · 45/subject' },
  { label: 'NEET Mini', questionCount: 60, durationMin: 60, desc: '60 Q · 1h · 15/subject' },
  { label: 'Half NEET', questionCount: 100, durationMin: 120, desc: '100 Q · 2h · 25/subject' },
  { label: 'Quick Test', questionCount: 32, durationMin: 30, desc: '32 Q · 30m · 8/subject' },
];

const PER_Q_PRESETS = [30, 45, 60, 90, 120, 180];

/**
 * PaperTestSetupSheet — shown before launching PaperTestCompanion.
 *
 * Lets the user customize:
 *  - Question count (presets or custom 10-200)
 *  - Duration (presets or custom 10-300 min)
 *  - Default time per question (30/45/60/90/120/180 sec) — applies to ALL
 *    questions. During the test, user can tap "+30s" to extend a SPECIFIC
 *    question on-demand (not carried to next question).
 *  - Marking scheme (+4/-1 NEET default, or custom)
 *  - Section alerts (on/off)
 */
export function PaperTestSetupSheet({ testName, onClose, onStart }: Props) {
  const [questionCount, setQuestionCount] = useState(180);
  const [durationMin, setDurationMin] = useState(200);
  const autoPerQ = Math.floor((durationMin * 60) / questionCount);
  const [defaultSecPerQ, setDefaultSecPerQ] = useState<number>(autoPerQ);
  const [useCustomPerQ, setUseCustomPerQ] = useState(false);
  const [marksPerCorrect, setMarksPerCorrect] = useState(4);
  const [negativePerWrong, setNegativePerWrong] = useState(1);
  const [sectionsEnabled, setSectionsEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>('NEET Full');

  // Effective per-Q time: custom if set, otherwise auto-calculated from duration/Q count
  const effectivePerQ = useCustomPerQ ? defaultSecPerQ : autoPerQ;

  const applyPreset = (preset: typeof PRESETS[0]) => {
    vibrate(10);
    setQuestionCount(preset.questionCount);
    setDurationMin(preset.durationMin);
    setUseCustomPerQ(false);
    setActivePreset(preset.label);
  };

  const handleStart = () => {
    vibrate(15);
    onStart({
      questionCount,
      durationMin,
      defaultSecPerQuestion: effectivePerQ,
      marksPerCorrect,
      negativePerWrong,
      sectionsEnabled,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto scroll-area"
      >
        <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Setup Paper Test</h2>
            <p className="text-[10px] text-white/40 mt-0.5 truncate max-w-[260px]">{testName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Presets */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">QUICK PRESETS</label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={cn(
                  'p-2.5 rounded-xl text-left transition',
                  activePreset === p.label
                    ? 'bg-teal-500 text-black'
                    : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                <div className="text-xs font-bold">{p.label}</div>
                <div className={cn('text-[9px] mt-0.5', activePreset === p.label ? 'text-black/60' : 'text-white/40')}>
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom question count */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block flex items-center gap-1">
            <ListOrdered size={11} /> QUESTION COUNT
          </label>
          <div className="flex items-center gap-3">
            <ScrollAwareSlider>
              <input
                type="range"
                min={4}
                max={200}
                step={4}
                value={questionCount}
                onChange={(e) => { setQuestionCount(Number(e.target.value)); setActivePreset(null); setUseCustomPerQ(false); }}
                className="flex-1"
              />
            </ScrollAwareSlider>
            <span className="text-sm font-bold tabular text-teal-400 w-12 text-right">{questionCount}</span>
          </div>
          <p className="text-[10px] text-white/40 mt-1">
            <span className="tabular text-teal-400 font-bold">{questionCount / 4}</span> questions per subject (always multiples of 4 for equal distribution)
          </p>
        </div>

        {/* Custom duration */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block flex items-center gap-1">
            <Clock size={11} /> DURATION (MINUTES)
          </label>
          <div className="flex items-center gap-3">
            <ScrollAwareSlider>
              <input
                type="range"
                min={10}
                max={300}
                step={5}
                value={durationMin}
                onChange={(e) => { setDurationMin(Number(e.target.value)); setActivePreset(null); setUseCustomPerQ(false); }}
                className="flex-1"
              />
            </ScrollAwareSlider>
            <span className="text-sm font-bold tabular text-teal-400 w-16 text-right">
              {Math.floor(durationMin / 60) > 0
                ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                : `${durationMin}m`}
            </span>
          </div>
        </div>

        {/* Default time per question */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            TIME PER QUESTION
          </label>
          <p className="text-[10px] text-white/40 mb-2 leading-snug">
            Every question starts with this timer. During the test, tap "+30s" to
            extend a SPECIFIC question that needs more time (not carried to next Q).
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {PER_Q_PRESETS.map((sec) => (
              <button
                key={sec}
                onClick={() => { setDefaultSecPerQ(sec); setUseCustomPerQ(true); vibrate(6); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold tabular transition',
                  useCustomPerQ && defaultSecPerQ === sec
                    ? 'bg-teal-500 text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10',
                )}
              >
                {sec}s
              </button>
            ))}
            <button
              onClick={() => { setUseCustomPerQ(false); vibrate(6); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                !useCustomPerQ
                  ? 'bg-teal-500 text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10',
              )}
            >
              Auto ({autoPerQ}s)
            </button>
          </div>
        </div>

        {/* Sections toggle */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block flex items-center gap-1">
            <Layers size={11} /> SUBJECT SECTION ALERTS
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => { setSectionsEnabled(true); vibrate(6); }}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold transition',
                sectionsEnabled ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60',
              )}
            >
              ON (auto alerts)
            </button>
            <button
              onClick={() => { setSectionsEnabled(false); vibrate(6); }}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold transition',
                !sectionsEnabled ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60',
              )}
            >
              OFF
            </button>
          </div>
        </div>

        {/* Marking scheme (collapsed) */}
        <details className="mb-4">
          <summary className="text-xs font-semibold text-white/60 cursor-pointer mb-2">
            MARKING SCHEME (+{marksPerCorrect}/−{negativePerWrong})
          </summary>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Per correct</label>
              <input
                type="number"
                min={1}
                max={10}
                value={marksPerCorrect}
                onChange={(e) => setMarksPerCorrect(Number(e.target.value) || 4)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Per wrong</label>
              <input
                type="number"
                min={0}
                max={5}
                value={negativePerWrong}
                onChange={(e) => setNegativePerWrong(Number(e.target.value) || 1)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
          </div>
        </details>

        {/* Summary + start */}
        <div className="glass rounded-xl p-3 mb-3 text-center">
          <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Test Summary</div>
          <div className="text-sm font-bold text-white">
            {questionCount} questions · {Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`}
          </div>
          <div className="text-[10px] text-white/50 mt-1">
            <span className="tabular text-teal-400 font-bold">{effectivePerQ}s</span> per question · tap +30s during test to extend
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Start Test →
        </button>
      </motion.div>
    </motion.div>
  );
}
