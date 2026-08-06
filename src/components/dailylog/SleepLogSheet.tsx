'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Zap, X } from 'lucide-react';
import { useDailyLog } from '@/lib/store/dailyLog';
import { cn, vibrate } from '@/lib/utils';

interface Props { onClose: () => void; }

export function SleepLogSheet({ onClose }: Props) {
  const logToday = useDailyLog((s) => s.logToday);
  const [sleepHours, setSleepHours] = useState(7);
  const [energyLevel, setEnergyLevel] = useState(3);

  const handleSave = () => { vibrate([10, 30, 10]); logToday(sleepHours, energyLevel); onClose(); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }} onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Moon size={18} className="text-indigo-400" /><h2 className="text-lg font-bold">Sleep & Energy</h2></div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"><X size={16} /></button>
          </div>
        </div>
        <div className="overflow-y-auto scroll-area px-5 py-5 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-white/60 flex items-center gap-1.5"><Moon size={12} /> Sleep Hours</label>
              <span className="text-2xl font-bold tabular text-indigo-400">{sleepHours}h</span>
            </div>
            <div className="flex gap-1.5">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                <button key={h} onClick={() => { setSleepHours(h); vibrate(6); }}
                  className={cn('flex-1 py-2.5 rounded-lg text-xs font-bold transition', sleepHours === h ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/50')}>{h}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-white/60 flex items-center gap-1.5"><Zap size={12} /> Energy Level</label>
              <span className="text-sm font-bold" style={{ color: energyLevel >= 4 ? '#22c55e' : energyLevel >= 3 ? '#f59e0b' : '#ef4444' }}>
                {['', 'Exhausted', 'Tired', 'Okay', 'Good', 'Energized'][energyLevel]}
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button key={lvl} onClick={() => { setEnergyLevel(lvl); vibrate(6); }}
                  className="flex-1 py-4 rounded-xl flex flex-col items-center gap-1 transition"
                  style={{
                    background: energyLevel === lvl ? (lvl >= 4 ? 'rgba(34,197,94,0.2)' : lvl >= 3 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)',
                    border: energyLevel === lvl ? `1.5px solid ${lvl >= 4 ? '#22c55e' : lvl >= 3 ? '#f59e0b' : '#ef4444'}` : '1px solid transparent',
                  }}>
                  <span className="text-lg">{'⚡'.repeat(lvl)}</span><span className="text-[8px] text-white/40">{lvl}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 z-10 px-5 py-3 glass" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={handleSave} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm active:scale-[0.98]">Save Log</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
