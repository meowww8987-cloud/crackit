'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, X, Flame, Check, Zap } from 'lucide-react';
import { usePact } from '@/lib/store/pact';
import { usePartner } from '@/lib/store/partner';
import { useHistory } from '@/lib/store/history';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { useSettings } from '@/lib/store/settings';
import { cn, formatHM, todayKey, vibrate } from '@/lib/utils';

/**
 * PactCard — shows the active Study Pact (mutual commitment with partner).
 *
 * States:
 * 1. NO PARTNER: "Pair with a friend to start a study pact"
 * 2. NO ACTIVE PACT: "Start a Study Pact" → opens setup sheet
 * 3. ACTIVE PACT: Shows both partners' progress toward the target, with
 *    a "pact streak" flame. If either is behind, shows a warning.
 *
 * The pact is a daily commitment. Both must hit the target hours for the
 * day to count as a "pact win" (streak +1). If either misses, streak
 * resets to 0 for both.
 */
export function PactCard() {
  const partner = usePartner();
  const pact = usePact();
  const [showSetup, setShowSetup] = useState(false);

  // My today's study seconds (saved + live)
  const sessions = useHistory((s) => s.sessions);
  const activeSession = useSession((s) => s.active);
  const today = todayKey();
  const mySavedSec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0);
  const myLiveSec = activeSession ? getLiveStudySeconds(activeSession) : 0;
  const myTodaySec = mySavedSec + myLiveSec;

  // Partner's today seconds (from synced data)
  const partnerSec = partner.partnerLastData?.todaySec || 0;
  const partnerName = partner.partnerName;

  const todayPact = pact.getTodayPact();

  // No partner paired
  if (!partner.code || !partnerName) {
    return null; // PartnerCard already shows the pairing CTA
  }

  // No active pact
  if (!todayPact) {
    return (
      <>
        <button
          onClick={() => { vibrate(10); setShowSetup(true); }}
          className="w-full glass rounded-2xl p-3 flex items-center gap-3 border border-pink-500/20 hover:bg-white/[0.07] transition active:scale-[0.99]"
        >
          <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center shrink-0">
            <Handshake size={18} className="text-pink-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-pink-300">Start a Study Pact</div>
            <div className="text-[10px] text-t-muted">Commit to a daily goal together · both must hit it</div>
          </div>
        </button>
        <AnimatePresence>
          {showSetup && <PactSetupSheet onClose={() => setShowSetup(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // Active pact — show progress
  const targetSec = todayPact.targetSec;
  const myPct = Math.min(100, (myTodaySec / targetSec) * 100);
  const partnerPct = Math.min(100, (partnerSec / targetSec) * 100);
  const myDone = myTodaySec >= targetSec;
  const partnerDone = partnerSec >= targetSec;
  const bothDone = myDone && partnerDone;

  return (
    <>
      <div className="glass rounded-2xl p-3 border border-pink-500/30">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Handshake size={14} className="text-pink-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-pink-300">Study Pact</span>
          {pact.streak > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs font-bold text-orange-400">
              <Flame size={12} /> {pact.streak}
            </span>
          )}
          <button
            onClick={() => { vibrate(8); setShowSetup(true); }}
            className="text-t-muted hover:text-t-primary transition text-[10px] underline"
          >
            edit
          </button>
        </div>

        {/* Target */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold tabular">{todayPact.targetHours}h</div>
          <div className="text-[10px] text-t-muted">daily target · both must hit</div>
        </div>

        {/* Both progress bars */}
        <div className="space-y-2">
          {/* ME */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-bold text-teal-400 uppercase">You {myDone && <Check size={10} className="inline text-green-400" />}</span>
              <span className="tabular text-t-secondary font-semibold">
                {formatHM(myTodaySec)} / {todayPact.targetHours}h
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                animate={{ width: `${myPct}%` }}
                transition={{ duration: 0.5 }}
                className={cn('h-full rounded-full', myDone ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-teal-500 to-green-500')}
              />
            </div>
          </div>
          {/* PARTNER */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-bold text-violet-400 uppercase truncate">{partnerName} {partnerDone && <Check size={10} className="inline text-green-400" />}</span>
              <span className="tabular text-t-secondary font-semibold">
                {formatHM(partnerSec)} / {todayPact.targetHours}h
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                animate={{ width: `${partnerPct}%` }}
                transition={{ duration: 0.5 }}
                className={cn('h-full rounded-full', partnerDone ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-violet-500 to-purple-500')}
              />
            </div>
          </div>
        </div>

        {/* Status message */}
        <div className="mt-3 text-center">
          {bothDone ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs font-bold text-green-400 flex items-center justify-center gap-1"
            >
              <Check size={12} /> Pact complete! Streak +1 tomorrow
            </motion.div>
          ) : (
            <p className="text-[10px] text-t-muted">
              {!myDone && !partnerDone && 'Both behind — get studying! 💪'}
              {myDone && !partnerDone && `You're done — ${partnerName} needs ${formatHM(Math.max(0, targetSec - partnerSec))} more`}
              {!myDone && partnerDone && `${partnerName} is done — you need ${formatHM(Math.max(0, targetSec - myTodaySec))} more`}
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSetup && <PactSetupSheet onClose={() => setShowSetup(false)} />}
      </AnimatePresence>
    </>
  );
}

// === Setup Sheet ===
function PactSetupSheet({ onClose }: { onClose: () => void }) {
  const pact = usePact();
  const [hours, setHours] = useState(pact.activeTargetHours || 6);
  const [recurring, setRecurring] = useState(pact.recurring);

  const handleSave = () => {
    vibrate([10, 30, 10]);
    pact.setPact(hours, recurring);
    onClose();
  };

  const handleCancel = () => {
    vibrate(10);
    pact.cancelPact();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-6 pb-8"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Handshake size={18} className="text-pink-400" />
            <h2 className="text-lg font-bold">Study Pact</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-t-muted mb-4 leading-snug">
          Both you and your partner commit to studying <strong className="text-pink-300">{hours} hours</strong> today.
          If <strong>both</strong> hit the target, your pact streak grows. If either misses, the streak resets.
        </p>

        {/* Hours picker */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-t-secondary">Daily Target</span>
            <span className="text-2xl font-bold tabular text-pink-400">{hours}h</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[4, 5, 6, 7, 8, 9, 10, 12].map((h) => (
              <button
                key={h}
                onClick={() => { setHours(h); vibrate(6); }}
                className={cn(
                  'py-2.5 rounded-lg text-sm font-bold transition',
                  hours === h ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/50'
                )}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Recurring toggle */}
        <button
          onClick={() => { setRecurring(!recurring); vibrate(8); }}
          className="w-full mb-5 p-3 rounded-xl bg-white/5 flex items-center justify-between hover:bg-white/10 transition"
        >
          <div className="flex items-center gap-2">
            <Zap size={14} className={recurring ? 'text-pink-400' : 'text-white/30'} />
            <div className="text-left">
              <div className="text-sm font-semibold">Auto-renew daily</div>
              <div className="text-[10px] text-t-muted">Same target every day until cancelled</div>
            </div>
          </div>
          <div className={cn('w-10 h-6 rounded-full transition relative', recurring ? 'bg-pink-500' : 'bg-white/10')}>
            <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', recurring ? 'left-5' : 'left-1')} />
          </div>
        </button>

        {/* Actions */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Handshake size={16} /> {pact.activeTargetHours ? 'Update Pact' : 'Start Pact'}
        </button>
        {pact.activeTargetHours && (
          <button
            onClick={handleCancel}
            className="w-full mt-2 py-2.5 rounded-xl bg-white/5 text-red-400 text-sm font-medium hover:bg-white/10 transition"
          >
            Cancel pact
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
