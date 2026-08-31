'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Copy, Check } from 'lucide-react';
import { usePartner } from '@/lib/store/partner';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function PairSheet({ onClose }: Props) {
  const { generatePairCode, pairWithCode, myPairCode } = usePartner();
  const [mode, setMode] = useState<'choose' | 'generate' | 'enter'>('choose');
  const [myName, setMyName] = useState('You');
  const [enterCode, setEnterCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = () => {
    vibrate(15);
    const code = generatePairCode(myName || 'You');
    setMode('generate');
  };

  const handlePair = () => {
    if (enterCode.length !== 6) {
      setError('Code must be 6 digits');
      return;
    }
    setError('');
    const success = pairWithCode(enterCode, myName || 'You');
    if (success) {
      vibrate([10, 30, 10]);
      onClose();
    } else {
      setError('Invalid code — ask your partner to generate one first');
    }
  };

  const copyCode = () => {
    if (myPairCode) {
      navigator.clipboard?.writeText(myPairCode);
      setCopied(true);
      vibrate(8);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users size={18} className="text-teal-400" />
            Pair with Partner
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        {mode === 'choose' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">YOUR NAME</label>
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
              />
            </div>

            <button
              onClick={handleGenerate}
              className="w-full p-4 rounded-xl glass border border-teal-500/30 text-left hover:bg-white/[0.07] transition"
            >
              <div className="text-sm font-semibold text-teal-300 mb-1">Generate a pairing code</div>
              <div className="text-[10px] text-white/40">Your partner enters this code to pair with you</div>
            </button>

            <button
              onClick={() => setMode('enter')}
              className="w-full p-4 rounded-xl glass border border-white/10 text-left hover:bg-white/[0.07] transition"
            >
              <div className="text-sm font-semibold text-white/80 mb-1">Enter a pairing code</div>
              <div className="text-[10px] text-white/40">You have a 6-digit code from your partner</div>
            </button>
          </div>
        )}

        {mode === 'generate' && myPairCode && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-white/50">Share this code with your partner:</p>
            <div className="glass rounded-2xl p-6">
              <div className="text-5xl font-bold tabular tracking-[0.3em] bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
                {myPairCode}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Code</>}
            </button>
            <p className="text-[10px] text-white/40">
              Keep this app open. Your partner enters the code on their device to pair.
              Status updates share every 5 seconds.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-white/50"
            >
              Done
            </button>
          </div>
        )}

        {mode === 'enter' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">PARTNER'S 6-DIGIT CODE</label>
              <input
                value={enterCode}
                onChange={(e) => setEnterCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center text-2xl font-bold tabular tracking-[0.3em] focus:outline-none focus:border-teal-400/50"
                maxLength={6}
                inputMode="numeric"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handlePair}
              disabled={enterCode.length !== 6}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-sm transition active:scale-[0.98]',
                enterCode.length === 6
                  ? 'bg-gradient-to-r from-teal-500 to-green-500 text-black'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              )}
            >
              Pair Now
            </button>
            <button
              onClick={() => setMode('choose')}
              className="w-full py-2 text-xs text-white/50"
            >
              ← Back
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
