'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Partner } from '@/lib/types';
import { uid } from '@/lib/utils';

// Partner sync uses localStorage as a shared "channel" so two browser tabs
// (or two devices using the same storage) can pair and see each other's status.
// This keeps the app 100% offline with no backend.

interface PartnerStatus {
  // Written by each user to a shared key
  userId: string;
  name: string;
  isStudying: boolean;
  isPaused: boolean;
  isWasting: boolean;
  currentSubject: string | null;
  currentChapter: string | null;
  todayStudySeconds: number;
  streak: number;
  lastSeen: number;
  shareChapter: boolean;
}

interface PartnerStore {
  // My identity
  myUserId: string;
  myName: string;
  // Pairing
  partner: Partner | null;
  myPairCode: string | null; // code I generated for someone to pair with me
  // Partner's live status (polled)
  partnerStatus: PartnerStatus | null;
  // Nudges received
  nudges: { id: string; from: string; message: string; timestamp: number }[];
  // Settings
  shareChapter: boolean;

  // Actions
  generatePairCode: (myName: string) => string;
  pairWithCode: (code: string, myName: string) => boolean;
  unpair: () => void;
  setShareChapter: (v: boolean) => void;
  // Broadcast my status to the shared channel
  broadcastStatus: (status: Partial<PartnerStatus>) => void;
  // Poll partner's status from the shared channel
  pollPartnerStatus: () => void;
  // Send a nudge
  sendNudge: (message: string) => void;
  // Mark nudge as read
  clearNudges: () => void;
}

const PARTNER_CHANNEL_PREFIX = 'neet-partner-channel-';

function readChannel(code: string): { statusA?: PartnerStatus; statusB?: PartnerStatus; partnerA?: Partner; partnerB?: Partner; nudgesA?: any[]; nudgesB?: any[] } | null {
  try {
    const raw = localStorage.getItem(PARTNER_CHANNEL_PREFIX + code);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeChannel(code: string, data: any) {
  try {
    localStorage.setItem(PARTNER_CHANNEL_PREFIX + code, JSON.stringify(data));
  } catch {}
}

export const usePartner = create<PartnerStore>()(
  persist(
    (set, get) => ({
      myUserId: uid(),
      myName: 'You',
      partner: null,
      myPairCode: null,
      partnerStatus: null,
      nudges: [],
      shareChapter: true,

      generatePairCode: (myName) => {
        // Generate a 6-digit code
        const code = Math.random().toString().slice(2, 8);
        set({ myPairCode: code, myName });
        // Initialize the channel with my status slot
        const existing = readChannel(code);
        if (!existing) {
          writeChannel(code, {
            statusA: { userId: get().myUserId, name: myName, isStudying: false, isPaused: false, isWasting: false, currentSubject: null, currentChapter: null, todayStudySeconds: 0, streak: 0, lastSeen: Date.now(), shareChapter: true },
            statusB: undefined,
            partnerA: undefined,
            partnerB: undefined,
            nudgesA: [],
            nudgesB: [],
          });
        }
        return code;
      },

      pairWithCode: (code, myName) => {
        const channel = readChannel(code);
        if (!channel) {
          return false;
        }
        // I'm joining as partner B
        const partner: Partner = {
          code,
          name: channel.statusA?.name || 'Partner',
          pairedAt: Date.now(),
          shareChapter: channel.statusA?.shareChapter ?? true,
        };
        // Write my status to slot B
        const updated = {
          ...channel,
          statusB: { userId: get().myUserId, name: myName, isStudying: false, isPaused: false, isWasting: false, currentSubject: null, currentChapter: null, todayStudySeconds: 0, streak: 0, lastSeen: Date.now(), shareChannel: get().shareChapter, shareChapter: get().shareChapter },
          partnerB: partner,
        };
        writeChannel(code, updated);
        // Also set partner A's partner reference
        if (channel.statusA) {
          const partnerARef: Partner = { code, name: myName, pairedAt: Date.now(), shareChapter: get().shareChapter };
          writeChannel(code, { ...updated, partnerA: partnerARef });
        }
        set({ partner, myName, myPairCode: code });
        return true;
      },

      unpair: () => {
        const code = get().myPairCode || get().partner?.code;
        if (code) {
          const channel = readChannel(code);
          if (channel) {
            // Clear my slot
            const isA = channel.statusA?.userId === get().myUserId;
            if (isA) {
              writeChannel(code, { ...channel, statusA: undefined, partnerA: undefined });
            } else {
              writeChannel(code, { ...channel, statusB: undefined, partnerB: undefined });
            }
          }
        }
        set({ partner: null, myPairCode: null, partnerStatus: null });
      },

      setShareChapter: (v) => {
        set({ shareChapter: v });
        // Re-broadcast my status with new privacy setting
        get().broadcastStatus({});
      },

      broadcastStatus: (status) => {
        const code = get().myPairCode || get().partner?.code;
        if (!code) return;
        const channel = readChannel(code);
        if (!channel) return;
        const isA = channel.statusA?.userId === get().myUserId;
        const myCurrentStatus = isA ? channel.statusA : channel.statusB;
        if (!myCurrentStatus) return;
        const newStatus: PartnerStatus = {
          ...myCurrentStatus,
          ...status,
          userId: get().myUserId,
          name: get().myName,
          lastSeen: Date.now(),
          shareChapter: get().shareChapter,
        };
        if (isA) {
          writeChannel(code, { ...channel, statusA: newStatus });
        } else {
          writeChannel(code, { ...channel, statusB: newStatus });
        }
      },

      pollPartnerStatus: () => {
        const code = get().myPairCode || get().partner?.code;
        if (!code) {
          set({ partnerStatus: null });
          return;
        }
        const channel = readChannel(code);
        if (!channel) {
          set({ partnerStatus: null });
          return;
        }
        const isA = channel.statusA?.userId === get().myUserId;
        const partnerStatus = isA ? channel.statusB : channel.statusA;
        // Check for nudges
        const myNudges = isA ? channel.nudgesB : channel.nudgesA;
        if (myNudges && myNudges.length > 0) {
          const existingIds = new Set(get().nudges.map((n) => n.id));
          const newNudges = myNudges.filter((n: any) => !existingIds.has(n.id));
          if (newNudges.length > 0) {
            set((s) => ({
              nudges: [...s.nudges, ...newNudges.map((n: any) => ({ ...n }))].slice(-20),
            }));
            // Clear the nudges I've now seen
            if (isA) {
              writeChannel(code, { ...channel, nudgesB: [] });
            } else {
              writeChannel(code, { ...channel, nudgesA: [] });
            }
          }
        }
        set({ partnerStatus: partnerStatus || null });
      },

      sendNudge: (message) => {
        const code = get().myPairCode || get().partner?.code;
        if (!code) return;
        const channel = readChannel(code);
        if (!channel) return;
        const isA = channel.statusA?.userId === get().myUserId;
        const nudge = { id: uid(), from: get().myName, message, timestamp: Date.now() };
        // Send to partner's inbox (opposite slot)
        if (isA) {
          const partnerInbox = channel.nudgesB || [];
          writeChannel(code, { ...channel, nudgesB: [...partnerInbox, nudge] });
        } else {
          const partnerInbox = channel.nudgesA || [];
          writeChannel(code, { ...channel, nudgesA: [...partnerInbox, nudge] });
        }
      },

      clearNudges: () => set({ nudges: [] }),
    }),
    {
      name: 'neet-partner',
      partialize: (s) => ({
        myUserId: s.myUserId,
        myName: s.myName,
        partner: s.partner,
        myPairCode: s.myPairCode,
        shareChapter: s.shareChapter,
      }),
    }
  )
);
