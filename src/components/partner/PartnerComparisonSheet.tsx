'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Flame, Trophy, Target, BookOpen, TrendingUp, Clock, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const tickInterval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(tickInterval);
  }, []);

  // === Week navigation state ===
  const [weekOffset, setWeekOffset] = useState(0);
  const lbTouchStartX = useRef<number | null>(null);
  const lbTouchStartY = useRef<number | null>(null);
  const onLbTouchStart = (e: React.TouchEvent) => {
    lbTouchStartX.current = e.touches[0].clientX;
    lbTouchStartY.current = e.touches[0].clientY;
  };
  const onLbTouchEnd = (e: React.TouchEvent) => {
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
  const myStreak = useHistory.getState().getStreak();
  const myTargetsDone = myTodayTargets.filter((t) => t.done).length;
  const myTargetsTotal = myTodayTargets.length;
  const myLastTest = myTests.filter((t) => t.totalMarks !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0];
  const myLastTestScore = myLastTest?.totalMarks ?? null;

  // Partner stats
  const pd = partner.partnerLastData;
  const partnerSec = pd?.todaySec || 0;
  const partnerStreak = pd?.streak || 0;
  const partnerTargetsDone = pd?.targetsDone || 0;
  const partnerTargetsTotal = pd?.targetsTotal || 0;
  const partnerLastTestScore = pd?.lastTestScore ?? null;

  // === Weekly leaderboard with weekOffset ===
  // YOUR data is accurate per-day (from local sessions).
  // PARTNER only sends todaySec (today's total) + weekSec (7-day total).
  // No per-day breakdown available. Show ONLY real data:
  //   - Today (this week): show partner's actual todaySec
  //   - Past days: show "—" (no data available)
  //   - Past weeks: show "—" for all days
  //   - Week total: show partner's actual weekSec (not sum of per-day)
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
  const partnerWeekSec = pd?.weekSec || 0;
  const partnerTodaySec = pd?.todaySec || 0;
  const partnerHasData = weekOffset === 0 && partnerWeekSec > 0;
  // Partner per-day: ONLY today has real data. Past days = 0 (shown as "—").
  const partnerDailySec = weekDates.map((_, i) => {
    if (weekOffset === 0 && i === 6) return partnerTodaySec; // today = real data
    return 0; // past days = no data
  });
  const maxDaily = Math.max(...myDailySec, partnerTodaySec, 1);
  // Only count "won" for today (the only day with real partner data)
  const daysWon = partnerHasData && myDailySec[6] > partnerTodaySec ? 1 : 0;
  const myWeekTotal = myDailySec.reduce((a, b) => a + b, 0);
  const partnerWeekTotal = partnerHasData ? partnerWeekSec : 0;
  const myWeekWasted = myDailyWasted.reduce((a, b) => a + b, 0);

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
  // For partner, infer from their pushed data + freshness
  const partnerStatus: 'studying' | 'paused' | 'wasting' | 'offline' | 'online' =
    partnerAge === null || partnerAge > 120_000 ? 'offline'
    : pd?.isStudying ? 'studying'
    : pd?.isWasting ? 'wasting'
    : pd?.isPaused ? 'paused'
    : 'online';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-md mx-auto min-h-screen glass-strong rounded-t-3xl mt-8 p-5 pb-12"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold">Study with Friend</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-t-secondary hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Hero: Avatars + Progress Ring */}
        <div className="flex items-center justify-center gap-6 py-4 mb-4">
          <div className="flex flex-col items-center gap-2">
            <PartnerAvatar
              initials={(partner.name || 'Y').slice(0, 2)}
              accentColor="#14b8a6"
              status={myStatus}
              size={64}
            />
            <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">YOU</div>
          </div>

          <PartnerProgressRing
            mySec={myTodaySec}
            partnerSec={partnerSec}
            myColor="#14b8a6"
            partnerColor="#8b5cf6"
            size={120}
            centerLabel={formatHM(Math.max(myTodaySec, partnerSec))}
            centerSublabel="today"
          />

          <div className="flex flex-col items-center gap-2">
            <PartnerAvatar
              initials={(partner.partnerName || 'P').slice(0, 2)}
              accentColor="#8b5cf6"
              status={partnerStatus}
              size={64}
            />
            <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider truncate max-w-[70px]">
              {(partner.partnerName || 'PARTNER').slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Live status badge */}
        <div className="flex items-center justify-center mb-5">
          {partnerAge !== null && partnerAge < 20_000 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Live · {Math.floor(partnerAge/1000)}s</span>
            </div>
          ) : partnerAge !== null && partnerAge < 120_000 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Last seen {Math.floor(partnerAge/1000)}s ago</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Offline</span>
            </div>
          )}
        </div>

        {/* === Bento Grid === */}
        {/* Row 1: Weekly Leaderboard (full width) — swipeable */}
        <BentoCard className="col-span-2" >
          <div
            data-card
            onTouchStart={onLbTouchStart}
            onTouchEnd={onLbTouchEnd}
          >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">Weekly Leaderboard</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { vibrate(8); setWeekOffset(o => Math.max(0, o - 1)); }}
                disabled={weekOffset === 0}
                className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/60 disabled:opacity-30 transition active:scale-90"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-bold text-white/80 min-w-[80px] text-center">
                {weekOffset === 0 ? 'This Week' : `${weekOffset}w ago`}
              </span>
              <button
                onClick={() => { vibrate(8); setWeekOffset(o => o + 1); }}
                className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/60 transition active:scale-90"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Week total summary */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-center">
              <div className="text-[9px] text-teal-400 font-bold uppercase">You</div>
              <div className="text-sm font-bold tabular text-teal-400">{formatHM(myWeekTotal)}</div>
              {myWeekWasted > 0 && <div className="text-[8px] text-red-400/70 tabular">⚠ {formatHM(myWeekWasted)}</div>}
            </div>
            <div className="text-center">
              <div className="text-[9px] text-white/40 uppercase">Today</div>
              <div className="text-sm font-bold tabular text-white/80">
                {partnerHasData ? (
                  myDailySec[6] > partnerTodaySec ? 'You ✅' : myDailySec[6] < partnerTodaySec ? 'Partner ✅' : 'Tie'
                ) : '—'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-violet-400 font-bold uppercase">Partner</div>
              <div className="text-sm font-bold tabular text-violet-400">{partnerHasData ? formatHM(partnerWeekTotal) : 'No data'}</div>
              {partnerHasData && <div className="text-[8px] text-white/40">7-day total</div>}
            </div>
          </div>

          {/* Daily bars */}
          <div className="space-y-1.5">
            {weekDates.map((date, i) => {
              const dayObj = weekDateObjs[i];
              const dayLabel = dayObj.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
              const dateLabel = dayObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
              const myH = myDailySec[i];
              const pH = partnerDailySec[i];
              const myW = myDailyWasted[i];
              const myWon = myH >= pH;
              const isToday = weekOffset === 0 && i === 6;
              return (
                <div key={date} className={`flex items-center gap-2 text-[10px] ${isToday ? 'bg-teal-500/5 rounded-lg px-1 py-0.5' : ''}`}>
                  <div className="w-10 shrink-0">
                    <div className="font-semibold text-white/70">{dayLabel}</div>
                    <div className="text-[8px] text-white/40">{dateLabel}</div>
                  </div>
                  <div className="flex-1 space-y-0.5">
                    {/* My bar */}
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden relative">
                        <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${(myH/maxDaily)*100}%` }} />
                        {myW > 0 && (
                          <div className="absolute top-0 right-0 h-full bg-red-500/40 rounded-full" style={{ width: `${Math.min(30, (myW/maxDaily)*100)}%` }} />
                        )}
                      </div>
                      <span className={`tabular w-12 text-right font-mono ${myWon ? 'text-teal-400 font-bold' : 'text-white/50'}`}>
                        {formatHM(myH)}
                        {myW > 0 && <span className="text-red-400/60 text-[8px] ml-0.5">⚠{Math.round(myW/60)}m</span>}
                      </span>
                    </div>
                    {/* Partner bar — only today has real data */}
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                        {partnerHasData && pH > 0 ? (
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(pH/maxDaily)*100}%` }} />
                        ) : null}
                      </div>
                      <span className={`tabular w-12 text-right font-mono ${!myWon && partnerHasData && pH > 0 ? 'text-violet-400 font-bold' : 'text-white/50'}`}>
                        {partnerHasData && pH > 0 ? (
                          formatHM(pH)
                        ) : (
                          <span className="text-white/30 text-[9px]">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                  {myWon && myH > 0 && <span className="text-[8px] shrink-0">🏆</span>}
                </div>
              );
            })}
          </div>
          {weekOffset > 0 && (
            <div className="text-center text-[8px] text-white/40 mt-2">
              ← swipe right for previous week · left for next →
            </div>
          )}
          </div>
        </BentoCard>

        {/* Row 2: Streak + Targets (side by side) */}
        <BentoCard>
          <BentoHeader icon={<Flame size={14} />} title="Streak" />
          <div className="text-center py-2">
            <div className="text-3xl mb-1">🔥</div>
            <div className="text-xl font-bold tabular font-mono">
              <span className="text-teal-500 dark:text-teal-400">{myStreak}</span>
              <span className="text-t-muted/40 mx-0.5 text-sm">vs</span>
              <span className="text-violet-500 dark:text-violet-400">{partnerStreak}</span>
            </div>
            <div className="text-[9px] text-t-muted mt-0.5">days</div>
          </div>
        </BentoCard>

        <BentoCard>
          <BentoHeader icon={<Target size={14} />} title="Targets" />
          <div className="text-center py-2">
            <div className="text-xl font-bold tabular font-mono">
              <span className="text-teal-500 dark:text-teal-400">{myTargetsDone}/{myTargetsTotal}</span>
              <span className="text-t-muted/40 mx-0.5 text-sm">·</span>
              <span className="text-violet-500 dark:text-violet-400">{partnerTargetsDone}/{partnerTargetsTotal}</span>
            </div>
            <div className="text-[9px] text-t-muted mt-0.5">done today</div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${myTargetsTotal > 0 ? (myTargetsDone/myTargetsTotal*100) : 0}%` }} />
            </div>
          </div>
        </BentoCard>

        {/* Row 3: Test Score + Study Time */}
        <BentoCard>
          <BentoHeader icon={<Trophy size={14} />} title="Last Test" />
          <div className="text-center py-2">
            <div className="text-xl font-bold tabular font-mono">
              <span className="text-teal-500 dark:text-teal-400">{myLastTestScore ?? '—'}</span>
              <span className="text-t-muted/40 mx-0.5 text-sm">·</span>
              <span className="text-violet-500 dark:text-violet-400">{partnerLastTestScore ?? '—'}</span>
            </div>
            <div className="text-[9px] text-t-muted mt-0.5">/ 720</div>
          </div>
        </BentoCard>

        <BentoCard>
          <BentoHeader icon={<Clock size={14} />} title="Study Time" />
          <div className="text-center py-2">
            <div className="text-sm font-bold tabular font-mono">
              <span className="text-teal-500 dark:text-teal-400">{formatHM(myTodaySec)}</span>
            </div>
            <div className="text-[9px] text-t-muted">you · today</div>
            <div className="text-sm font-bold tabular font-mono mt-1">
              <span className="text-violet-500 dark:text-violet-400">{formatHM(partnerSec)}</span>
            </div>
            <div className="text-[9px] text-t-muted">partner · today</div>
          </div>
        </BentoCard>

        {/* Row 4: Subject Comparison (full width) */}
        <BentoCard className="col-span-2">
          <BentoHeader icon={<BookOpen size={14} />} title="Subject Comparison · Today" />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-1.5">YOUR SUBJECTS</div>
              {Object.entries(mySubjects).length === 0 ? (
                <div className="text-[10px] text-t-muted italic">No study yet</div>
              ) : (
                Object.entries(mySubjects).sort((a,b) => b[1]-a[1]).map(([subj, sec]) => (
                  <div key={subj} className="flex items-center gap-1.5 text-[10px] mb-1">
                    <span className="w-14 text-t-secondary truncate">{subj}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(sec/Math.max(...Object.values(mySubjects),1))*100}%` }} />
                    </div>
                    <span className="tabular text-t-muted w-8 text-right font-mono">{formatHM(sec)}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 mb-1.5">PARTNER</div>
              {pd?.lastSubject ? (
                <div className="flex items-center gap-1.5 text-[10px] mb-1">
                  <span className="w-14 text-t-secondary truncate">{pd.lastSubject}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <span className="tabular text-t-muted w-8 text-right font-mono">{formatHM(partnerSec)}</span>
                </div>
              ) : (
                <div className="text-[10px] text-t-muted italic">No data</div>
              )}
              {pd?.lastChapter && <div className="text-[9px] text-t-muted mt-1">📖 {pd.lastChapter}</div>}
              {pd?.lastLecture && <div className="text-[9px] text-violet-500 dark:text-violet-400">📄 {pd.lastLecture}</div>}
            </div>
          </div>
        </BentoCard>

        {/* Row 5: Quick Stats (3 columns) */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="glass rounded-xl p-2 text-center">
            <div className="text-[9px] text-t-muted uppercase">Sessions</div>
            <div className="text-sm font-bold tabular font-mono text-teal-500 dark:text-teal-400">{sessions.length}</div>
          </div>
          <div className="glass rounded-xl p-2 text-center">
            <div className="text-[9px] text-t-muted uppercase">P-Tests</div>
            <div className="text-sm font-bold tabular font-mono text-violet-500 dark:text-violet-400">{pd?.weekTestCount || 0}</div>
          </div>
          <div className="glass rounded-xl p-2 text-center">
            <div className="text-[9px] text-t-muted uppercase">Days Won</div>
            <div className="text-sm font-bold tabular font-mono text-amber-500 dark:text-amber-400">{daysWon}/7</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[9px] text-t-muted text-center mt-5">
          Real-time · Sync every 3s · Last: {partner.lastSyncAt ? new Date(partner.lastSyncAt).toLocaleTimeString() : 'never'}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Bento card wrapper — varied sizes via col-span. */
function BentoCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-3.5 ${className}`}>
      {children}
    </div>
  );
}

/** Bento card header with icon + title + optional subtitle. */
function BentoHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-t-secondary">{icon}</span>
      <span className="text-xs font-bold text-t-secondary uppercase tracking-wide">{title}</span>
      {subtitle && <span className="text-[10px] text-t-muted ml-auto">{subtitle}</span>}
    </div>
  );
}
