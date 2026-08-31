'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Bell, Wifi, WifiOff, Send, Unlink, ChevronRight } from 'lucide-react';
import { usePartner } from '@/lib/store/partner';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { useHistory } from '@/lib/store/history';
import { cn, formatHM, vibrate, todayKey } from '@/lib/utils';
import { PairSheet } from '@/components/partner/PairSheet';

export function PartnerCard() {
  const { partner, partnerStatus, shareChapter, setShareChapter, unpair, sendNudge, myName } = usePartner();
  const [showSheet, setShowSheet] = useState(false);
  const [showPair, setShowPair] = useState(false);
  const myTodaySec = useHistory((s) => s.getTodayStudySeconds());

  if (!partner) {
    return (
      <>
        <button
          onClick={() => setShowPair(true)}
          className="w-full glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/[0.07] transition border border-white/5"
        >
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Users size={18} className="text-white/40" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-white/80">Pair with a study partner</div>
            <div className="text-[10px] text-white/40">Sync with a friend and study together</div>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
        <AnimatePresence>
          {showPair && <PairSheet key="pair" onClose={() => setShowPair(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // Determine partner's online status (online if lastSeen < 30s ago)
  const isOnline = partnerStatus && Date.now() - partnerStatus.lastSeen < 30000;
  const partnerStudying = partnerStatus?.isStudying && !partnerStatus?.isPaused;
  const partnerWasting = partnerStatus?.isWasting;
  const partnerPaused = partnerStatus?.isPaused;

  const combinedSec = myTodaySec + (partnerStatus?.todayStudySeconds || 0);

  const statusColor = partnerWasting ? '#ef4444' : partnerPaused ? '#f59e0b' : partnerStudying ? '#22c55e' : '#6b7280';
  const statusText = partnerWasting ? 'Wasting time' : partnerPaused ? 'Paused' : partnerStudying ? 'Studying' : (isOnline ? 'Online' : 'Offline');

  const handleNudge = () => {
    vibrate(15);
    sendNudge('Hey, time to study! 👊');
    alert('Nudge sent to ' + partner.name);
  };

  return (
    <>
      <div className="glass rounded-2xl p-3 border border-teal-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center text-sm font-bold text-black">
              {partner.name.charAt(0).toUpperCase()}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0f]"
              style={{ background: isOnline ? statusColor : '#6b7280' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{partner.name}</div>
            <div className="text-[10px] text-white/50 flex items-center gap-1">
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {statusText}
            </div>
          </div>
          <button
            onClick={() => setShowSheet(true)}
            className="text-white/40 hover:text-white text-xs px-2"
          >
            Manage
          </button>
        </div>

        {/* Partner's current activity */}
        {partnerStudying && partnerStatus?.currentSubject && (
          <div className="text-[10px] text-white/50 mb-2">
            Studying: <span className="text-white/80 font-medium">{partnerStatus.currentSubject}</span>
            {partnerStatus.shareChapter && partnerStatus.currentChapter && (
              <span className="text-white/40"> · {partnerStatus.currentChapter}</span>
            )}
          </div>
        )}

        {/* Combined total */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-white/50">Together today</div>
          <div className="text-lg font-bold tabular bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
            {formatHM(combinedSec)}
          </div>
        </div>

        {/* Split */}
        <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2">
          <span>You: <span className="text-white/60 tabular">{formatHM(myTodaySec)}</span></span>
          <span>·</span>
          <span>{partner.name}: <span className="text-white/60 tabular">{formatHM(partnerStatus?.todayStudySeconds || 0)}</span></span>
          {partnerStatus?.streak !== undefined && partnerStatus.streak > 0 && (
            <>
              <span>·</span>
              <span>🔥 {partnerStatus.streak}</span>
            </>
          )}
        </div>

        <button
          onClick={handleNudge}
          className="w-full py-2 rounded-xl bg-teal-500/20 text-teal-400 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Bell size={12} /> Send Nudge
        </button>
      </div>

      <AnimatePresence>
        {showSheet && (
          <PartnerManageSheet
            onClose={() => setShowSheet(false)}
            shareChapter={shareChapter}
            setShareChapter={setShareChapter}
            onUnpair={unpair}
            partnerName={partner.name}
            myName={myName}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function PartnerManageSheet({ onClose, shareChapter, setShareChapter, onUnpair, partnerName, myName }: {
  onClose: () => void;
  shareChapter: boolean;
  setShareChapter: (v: boolean) => void;
  onUnpair: () => void;
  partnerName: string;
  myName: string;
}) {
  const [showUnlink, setShowUnlink] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
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
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Partner Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Paired with</div>
            <div className="text-sm font-semibold">{partnerName}</div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Your name (visible to partner)</div>
            <div className="text-sm font-semibold">{myName}</div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Share chapter & activity</div>
                <div className="text-[10px] text-white/40">When off, partner sees only your subject</div>
              </div>
              <button
                onClick={() => { setShareChapter(!shareChapter); vibrate(8); }}
                className={cn('w-12 h-7 rounded-full transition relative', shareChapter ? 'bg-teal-500' : 'bg-white/10')}
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={cn('absolute top-1 w-5 h-5 rounded-full bg-white', shareChapter ? 'left-6' : 'left-1')}
                />
              </button>
            </div>
          </div>

          {!showUnlink ? (
            <button
              onClick={() => setShowUnlink(true)}
              className="w-full py-2.5 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <Unlink size={14} /> Unpair
            </button>
          ) : (
            <div className="glass rounded-xl p-3 border border-red-500/30">
              <p className="text-xs text-white/60 mb-2">Are you sure? Both users will lose access immediately.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnlink(false)}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onUnpair(); onClose(); }}
                  className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold"
                >
                  Unpair
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
