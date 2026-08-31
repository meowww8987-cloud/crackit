'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Flame, Trophy, Target, BookOpen, TrendingUp, Clock, Zap, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { usePartner } from '@/lib/store/partner';
import { useHistory } from '@/lib/store/history';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { useTests } from '@/lib/store/tests';
import { formatHM, todayKey, dateKey, addDays, vibrate } from '@/lib/utils';
import type { Target as TargetType } from '@/lib/types';
import { PartnerAvatar } from '@/components/partner/PartnerAvatar';
import { PartnerProgressRing } from '@/components/partner/PartnerProgressRing';

const EMPTY_TARGETS: TargetType[] = [];

// Theme-aware colors — darker for light theme visibility
const YOU_COLOR = '#0d9488';       // dark teal
const PARTNER_COLOR = '#7c3aed';   // dark violet
const YOU_LIGHT = '#14b8a6';
const PARTNER_LIGHT = '#a78bfa';
const WASTED_COLOR = '#dc2626';    // dark red
const GOLD_COLOR = '#d97706';      // dark gold

interface Props {
  onClose: () => void;
}

export function PartnerComparisonSheet({ onClose }: Props) {
  const partner = usePartner();
  const sessions = useHistory((s) => s.sessions);
  const myActiveSession = useSession((s) => s.active);
  const _byDate = useTargets((s) => s.byDate);
  const _today = todayKey();
  const myTodayTargets = _byDate[_today] || EMPTY_TARGETS;
  const myTests = useTests.getState().tests;

  const [, setTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => { if (!document.hidden) setTick(t => t + 1); }, 5000);
    return () => clearInterval(tickInterval);
  }, []);

  // === Week navigation state ===
  const [weekOffset, setWeekOffset] = useState(0);
  const lbTouchStartX = useRef<number | null>(null);
  const lbTouchStartY = useRef<number | null>(null);
  const onLbTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    lbTouchStartX.current = e.touches[0].clientX;
    lbTouchStartY.current = e.touches[0].clientY;
  };
  const onLbTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (lbTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - lbTouchStartX.current;
    const dy = e.changedTouches[0].clientY - (lbTouchStartY.current ?? 0);
    lbTouchStartX.current = null;
    lbTouchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    vibrate(8);
    if (dx > 0) setWeekOffset(o => Math.max(0, o - 1));
    else setWeekOffset(o => o + 1);
  };

  // My stats
  const today = _today;
  const myLiveSec = getLiveStudySeconds(myActiveSession);
  const myTodaySec = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.studySeconds, 0) + (myActiveSession ? myLiveSec : 0);
  const myTodayWasted = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.wastedSeconds, 0);
  const myStreak = useHistory.getState().getStreak();
  const myTargetsDone = myTodayTargets.filter((t) => t.done).length;
  const myTargetsTotal = myTodayTargets.length;
  const myLastTest = myTests.filter((t) => t.totalMarks !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0];
  const myLastTestScore = myLastTest?.totalMarks ?? null;

  // Partner stats
  const pd = partner.partnerLastData;
  const partnerSec = pd?.todaySec || 0;
  const partnerWasted = pd?.todayWastedSec || 0;
  const partnerStreak = pd?.streak || 0;
  const partnerTargetsDone = pd?.targetsDone || 0;
  const partnerTargetsTotal = pd?.targetsTotal || 0;
  const partnerLastTestScore = pd?.lastTestScore ?? null;

  // === Weekly leaderboard ===
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), -((6 - i) + weekOffset * 7));
    return dateKey(d);
  });
  const weekDateObjs = weekDates.map(k => new Date(k + 'T00:00:00'));

  const myDailySec = weekDates.map(date =>
    sessions.filter((s) => s.date === date).reduce((a, s) => a + s.studySeconds, 0)
  );
  const myDailyWasted = weekDates.map(date =>
    sessions.filter((s) => s.date === date).reduce((a, s) => a + s.wastedSeconds, 0)
  );

  const partnerDailyHistory: number[] = pd?.dailyHistory || [];
  const partnerHasData = weekOffset === 0 && partnerDailyHistory.length === 7;
  const partnerDailySec = weekDates.map((_, i) => {
    if (partnerHasData) return partnerDailyHistory[i] || 0;
    return 0;
  });
  const maxDaily = Math.max(...myDailySec, ...partnerDailySec, 1);
  const daysWon = partnerHasData
    ? myDailySec.filter((my, i) => my > partnerDailySec[i]).length
    : 0;
  const myWeekTotal = myDailySec.reduce((a, b) => a + b, 0);
  const partnerWeekTotal = partnerHasData ? partnerDailySec.reduce((a, b) => a + b, 0) : 0;
  const myWeekWasted = myDailyWasted.reduce((a, b) => a + b, 0);

  // Partner per-day wasted from dailyWastedHistory (NEW — synced in payload)
  const partnerDailyWastedHistory: number[] = pd?.dailyWastedHistory || [];
  const partnerDailyWasted = weekDates.map((_, i) => {
    if (partnerHasData && partnerDailyWastedHistory.length === 7) return partnerDailyWastedHistory[i] || 0;
    return 0;
  });
  const partnerWeekWasted = partnerHasData ? partnerDailyWasted.reduce((a, b) => a + b, 0) : 0;

  // Subject breakdown
  const mySubjects: Record<string, number> = {};
  sessions.filter((s) => s.date === today).forEach((s) => {
    mySubjects[s.subject] = (mySubjects[s.subject] || 0) + s.studySeconds;
  });

  // Freshness
  const partnerAge = partner.partnerLastSeen ? Date.now() - partner.partnerLastSeen : null;

  const myStatus: 'studying' | 'paused' | 'wasting' | 'offline' | 'online' = myActiveSession
    ? (myActiveSession.wasting ? 'wasting'
       : myActiveSession.paused ? 'paused'
       : 'studying')
    : 'online';
  const partnerStatus: 'studying' | 'paused' | 'wasting' | 'offline' | 'online' =
    partnerAge === null || partnerAge > 120_000 ? 'offline'
    : pd?.isStudying ? 'studying'
    : pd?.isWasting ? 'wasting'
    : pd?.isPaused ? 'paused'
    : 'online';

  // Combined stats
  const combinedToday = myTodaySec + partnerSec;
  const combinedWasted = myTodayWasted + partnerWasted;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-md mx-auto min-h-screen rounded-t-3xl mt-8 p-5 pb-12"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users size={20} style={{ color: PARTNER_COLOR }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Study Together</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Hero: Avatars + Progress Ring */}
        <div className="flex items-center justify-center gap-6 py-4 mb-4">
          <div className="flex flex-col items-center gap-2">
            <PartnerAvatar
              initials={(partner.name || 'Y').slice(0, 2)}
              accentColor={YOU_COLOR}
              status={myStatus}
              size={64}
            />
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: YOU_COLOR }}>YOU</div>
          </div>

          <PartnerProgressRing
            mySec={myTodaySec}
            partnerSec={partnerSec}
            myColor={YOU_COLOR}
            partnerColor={PARTNER_COLOR}
            size={120}
            centerLabel={formatHM(Math.max(myTodaySec, partnerSec))}
            centerSublabel="today"
          />

          <div className="flex flex-col items-center gap-2">
            <PartnerAvatar
              initials={(partner.partnerName || 'P').slice(0, 2)}
              accentColor={PARTNER_COLOR}
              status={partnerStatus}
              size={64}
            />
            <div className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[70px]" style={{ color: PARTNER_COLOR }}>
              {(partner.partnerName || 'PARTNER').slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Live status badge */}
        <div className="flex items-center justify-center mb-5">
          {partnerAge !== null && partnerAge < 20_000 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: '#16a34a' }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#16a34a' }}>Live · {Math.floor(partnerAge/1000)}s</span>
            </div>
          ) : partnerAge !== null && partnerAge < 120_000 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />
              <span className="text-[10px] font-semibold" style={{ color: '#d97706' }}>Last seen {Math.floor(partnerAge/1000)}s ago</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#dc2626' }} />
              <span className="text-[10px] font-semibold" style={{ color: '#dc2626' }}>Offline</span>
            </div>
          )}
        </div>

        {/* === Weekly Leaderboard — modernized with wasted time === */}
        <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div
            data-card
            onTouchStart={onLbTouchStart}
            onTouchEnd={onLbTouchEnd}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} style={{ color: YOU_COLOR }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Weekly Leaderboard</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { vibrate(8); setWeekOffset(o => Math.max(0, o - 1)); }}
                  disabled={weekOffset === 0}
                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 transition active:scale-90"
                  style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[10px] font-bold min-w-[80px] text-center" style={{ color: 'var(--foreground)' }}>
                  {weekOffset === 0 ? 'This Week' : `${weekOffset}w ago`}
                </span>
                <button
                  onClick={() => { vibrate(8); setWeekOffset(o => o + 1); }}
                  className="w-6 h-6 rounded flex items-center justify-center transition active:scale-90"
                  style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Week summary — 3 tiles with study + wasted */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* YOU tile */}
              <div className="rounded-xl p-2.5" style={{ background: `${YOU_COLOR}10`, border: `1px solid ${YOU_COLOR}25` }}>
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: YOU_COLOR }} />
                  <span className="text-[9px] font-bold uppercase" style={{ color: YOU_COLOR }}>You</span>
                </div>
                <div className="text-lg font-bold tabular" style={{ color: 'var(--foreground)' }}>{formatHM(myWeekTotal)}</div>
                <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>7-day study</div>
                {myWeekWasted > 60 && (
                  <div className="text-[9px] tabular mt-0.5" style={{ color: WASTED_COLOR }}>⚠ {formatHM(myWeekWasted)} wasted</div>
                )}
              </div>
              {/* PARTNER tile */}
              <div className="rounded-xl p-2.5" style={{ background: `${PARTNER_COLOR}10`, border: `1px solid ${PARTNER_COLOR}25` }}>
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: PARTNER_COLOR }} />
                  <span className="text-[9px] font-bold uppercase" style={{ color: PARTNER_COLOR }}>Partner</span>
                </div>
                <div className="text-lg font-bold tabular" style={{ color: 'var(--foreground)' }}>{partnerHasData ? formatHM(partnerWeekTotal) : '—'}</div>
                <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>7-day study</div>
                <div className="flex items-center justify-between mt-0.5">
                  {partnerHasData && partnerWeekWasted > 60 ? (
                    <span className="text-[9px] tabular" style={{ color: WASTED_COLOR }}>⚠ {formatHM(partnerWeekWasted)}</span>
                  ) : (
                    <span className="text-[9px]" style={{ color: GOLD_COLOR }}>{partnerHasData ? `${daysWon}/7 won` : 'No data'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mb-3 text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: `linear-gradient(90deg, ${YOU_COLOR}, ${YOU_LIGHT})` }} /> You
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: `linear-gradient(90deg, ${PARTNER_COLOR}, ${PARTNER_LIGHT})` }} /> Partner
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: `${WASTED_COLOR}80` }} /> Wasted
              </span>
            </div>

            {/* Daily bars — stacked design with wasted overlay */}
            <div className="space-y-2">
              {weekDates.map((date, i) => {
                const dayObj = weekDateObjs[i];
                const dayLabel = dayObj.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
                const dateLabel = dayObj.getDate();
                const myH = myDailySec[i];
                const pH = partnerDailySec[i];
                const myW = myDailyWasted[i];
                const myWon = myH >= pH;
                const isToday = weekOffset === 0 && i === 6;
                return (
                  <div
                    key={date}
                    className="flex items-center gap-2 text-[10px] rounded-lg p-2"
                    style={{
                      background: isToday ? `${YOU_COLOR}08` : 'transparent',
                      border: isToday ? `1px solid ${YOU_COLOR}30` : '1px solid transparent',
                    }}
                  >
                    {/* Day label */}
                    <div className="w-8 shrink-0 text-center">
                      <div className="font-bold text-[10px]" style={{ color: isToday ? YOU_COLOR : 'var(--foreground)' }}>{dayLabel}</div>
                      <div className="text-[8px]" style={{ color: 'var(--muted-foreground)' }}>{dateLabel}</div>
                    </div>

                    {/* Bars container */}
                    <div className="flex-1 space-y-1">
                      {/* YOU bar — study (gradient) + wasted (red overlay) */}
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--border)' }}>
                          {/* Study bar */}
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(myH/maxDaily)*100}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            className="h-full rounded-full absolute left-0 top-0"
                            style={{
                              background: `linear-gradient(90deg, ${YOU_COLOR}, ${YOU_LIGHT})`,
                              boxShadow: myH > 0 ? `0 0 4px ${YOU_COLOR}80` : 'none',
                            }}
                          />
                          {/* Wasted overlay — red stripe on top of study bar */}
                          {myW > 0 && (
                            <div
                              className="absolute top-0 h-full rounded-full"
                              style={{
                                left: `${(myH/maxDaily)*100}%`,
                                width: `${Math.min(20, (myW/maxDaily)*100)}%`,
                                background: `${WASTED_COLOR}80`,
                                border: `0.5px solid ${WASTED_COLOR}`,
                              }}
                            />
                          )}
                        </div>
                        {/* Time + wasted badge */}
                        <div className="flex flex-col items-end shrink-0 w-14">
                          <span className="tabular font-bold text-[9px]" style={{ color: myWon && myH > 0 ? YOU_COLOR : 'var(--muted-foreground)' }}>
                            {formatHM(myH)}
                          </span>
                          {myW > 60 && (
                            <span className="tabular text-[7px]" style={{ color: WASTED_COLOR }}>⚠{formatHM(myW)}</span>
                          )}
                        </div>
                      </div>

                      {/* PARTNER bar */}
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: 'var(--border)' }}>
                          {partnerHasData && pH > 0 && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(pH/maxDaily)*100}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 + 0.1 }}
                              className="h-full rounded-full absolute left-0 top-0"
                              style={{
                                background: `linear-gradient(90deg, ${PARTNER_COLOR}, ${PARTNER_LIGHT})`,
                                boxShadow: `0 0 4px ${PARTNER_COLOR}80`,
                              }}
                            />
                          )}
                          {/* Partner wasted overlay */}
                          {partnerHasData && partnerDailyWasted[i] > 0 && (
                            <div
                              className="absolute top-0 h-full rounded-full"
                              style={{
                                left: `${(pH/maxDaily)*100}%`,
                                width: `${Math.min(20, (partnerDailyWasted[i]/maxDaily)*100)}%`,
                                background: `${WASTED_COLOR}80`,
                                border: `0.5px solid ${WASTED_COLOR}`,
                              }}
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0 w-14">
                          <span className="tabular font-bold text-[9px]" style={{ color: !myWon && partnerHasData && pH > 0 ? PARTNER_COLOR : 'var(--muted-foreground)' }}>
                            {partnerHasData && pH > 0 ? formatHM(pH) : '—'}
                          </span>
                          {partnerHasData && partnerDailyWasted[i] > 60 && (
                            <span className="tabular text-[7px]" style={{ color: WASTED_COLOR }}>⚠{formatHM(partnerDailyWasted[i])}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Winner badge */}
                    {myWon && myH > 0 && (
                      <span className="text-[10px] shrink-0" title="You won this day">🏆</span>
                    )}
                  </div>
                );
              })}
            </div>
            {weekOffset > 0 && (
              <div className="text-center text-[8px] mt-2" style={{ color: 'var(--muted-foreground)' }}>
                ← swipe right for previous week · left for next →
              </div>
            )}
          </div>
        </div>

        {/* === 4 Stat Cards in 2x2 Grid === */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {/* Streak */}
          <StatCard
            icon={<Flame size={14} style={{ color: GOLD_COLOR }} />}
            label="Streak"
            myValue={`${myStreak}`}
            partnerValue={`${partnerStreak}`}
            unit="days"
          />
          {/* Targets */}
          <StatCard
            icon={<Target size={14} style={{ color: YOU_COLOR }} />}
            label="Targets"
            myValue={`${myTargetsDone}/${myTargetsTotal}`}
            partnerValue={`${partnerTargetsDone}/${partnerTargetsTotal}`}
            unit="done today"
          />
          {/* Last Test */}
          <StatCard
            icon={<Trophy size={14} style={{ color: GOLD_COLOR }} />}
            label="Last Test"
            myValue={myLastTestScore ?? '—'}
            partnerValue={partnerLastTestScore ?? '—'}
            unit="/ 720"
          />
          {/* Today's Study */}
          <StatCard
            icon={<Clock size={14} style={{ color: YOU_COLOR }} />}
            label="Today"
            myValue={formatHM(myTodaySec)}
            partnerValue={formatHM(partnerSec)}
            unit="study time"
          />
        </div>

        {/* === Subject Comparison — modernized === */}
        <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3">
            <BookOpen size={14} style={{ color: YOU_COLOR }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Subjects Today</span>
          </div>

          {/* YOU subjects — full width with modern bars */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: YOU_COLOR }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: YOU_COLOR }}>Your Subjects</span>
            </div>
            {Object.entries(mySubjects).length === 0 ? (
              <div className="text-[10px] italic py-2" style={{ color: 'var(--muted-foreground)' }}>No study yet today</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(mySubjects).sort((a,b) => b[1]-a[1]).map(([subj, sec]) => {
                  const subjColors: Record<string, string> = {
                    Physics: '#2563eb', Chemistry: '#16a34a', Botany: '#d97706', Zoology: '#9333ea', General: '#0d9488',
                  };
                  const subjColor = subjColors[subj] || YOU_COLOR;
                  const pct = (sec/Math.max(...Object.values(mySubjects),1))*100;
                  return (
                    <div key={subj} className="flex items-center gap-2">
                      <span className="w-16 text-[10px] font-semibold truncate" style={{ color: 'var(--foreground)' }}>{subj}</span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden relative" style={{ background: 'var(--border)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${subjColor}, ${subjColor}cc)`,
                            boxShadow: `0 0 4px ${subjColor}80`,
                          }}
                        />
                      </div>
                      <span className="tabular text-[10px] font-bold w-10 text-right" style={{ color: 'var(--foreground)' }}>{formatHM(sec)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px mb-4" style={{ background: 'var(--border)' }} />

          {/* PARTNER subjects */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: PARTNER_COLOR }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: PARTNER_COLOR }}>Partner's Activity</span>
            </div>
            {pd?.lastSubject ? (
              <div className="space-y-2">
                {/* Current subject bar */}
                <div className="flex items-center gap-2">
                  <span className="w-16 text-[10px] font-semibold truncate" style={{ color: 'var(--foreground)' }}>{pd.lastSubject}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${PARTNER_COLOR}, ${PARTNER_LIGHT})`,
                        boxShadow: `0 0 4px ${PARTNER_COLOR}80`,
                      }}
                    />
                  </div>
                  <span className="tabular text-[10px] font-bold w-10 text-right" style={{ color: 'var(--foreground)' }}>{formatHM(partnerSec)}</span>
                </div>
                {/* Chapter + lecture info */}
                {pd?.lastChapter && (
                  <div className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                    <span>📖</span>
                    <span className="truncate">{pd.lastChapter}</span>
                  </div>
                )}
                {pd?.lastLecture && (
                  <div className="flex items-center gap-1.5 text-[9px]" style={{ color: PARTNER_COLOR }}>
                    <span>📄</span>
                    <span className="truncate">{pd.lastLecture}</span>
                  </div>
                )}
                {pd?.lastTopic && (
                  <div className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                    <span>📌</span>
                    <span className="truncate">{pd.lastTopic}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] italic py-2" style={{ color: 'var(--muted-foreground)' }}>No data from partner</div>
            )}
          </div>
        </div>

        {/* === Quick Stats Row === */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Sessions</div>
            <div className="text-sm font-bold tabular" style={{ color: YOU_COLOR }}>{sessions.length}</div>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>P-Tests</div>
            <div className="text-sm font-bold tabular" style={{ color: PARTNER_COLOR }}>{pd?.weekTestCount || 0}</div>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div className="text-[9px] uppercase" style={{ color: 'var(--muted-foreground)' }}>Days Won</div>
            <div className="text-sm font-bold tabular" style={{ color: GOLD_COLOR }}>{daysWon}/7</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[9px] text-center mt-5" style={{ color: 'var(--muted-foreground)' }}>
          Real-time sync · Last: {partner.lastSyncAt ? new Date(partner.lastSyncAt).toLocaleTimeString() : 'never'}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// Stat Card — 2x2 grid card with YOU vs PARTNER
// =====================================================

function StatCard({
  icon,
  label,
  myValue,
  partnerValue,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  myValue: string | number;
  partnerValue: string | number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase" style={{ color: YOU_COLOR }}>You</span>
          <span className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>{myValue}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase" style={{ color: PARTNER_COLOR }}>Partner</span>
          <span className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>{partnerValue}</span>
        </div>
      </div>
      <div className="text-[8px] mt-1.5 text-center" style={{ color: 'var(--muted-foreground)' }}>{unit}</div>
    </div>
  );
}
