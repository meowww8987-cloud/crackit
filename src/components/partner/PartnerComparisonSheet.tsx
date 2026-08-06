'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Flame, Trophy, Target, BookOpen, TrendingUp, Clock, Zap } from 'lucide-react';
import { usePartner } from '@/lib/store/partner';
import { useHistory } from '@/lib/store/history';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { useTargets } from '@/lib/store/targets';
import { useTests } from '@/lib/store/tests';
import { formatHM, todayKey } from '@/lib/utils';
import type { Target as TargetType } from '@/lib/types';
import { PartnerAvatar } from '@/components/partner/PartnerAvatar';
import { PartnerProgressRing } from '@/components/partner/PartnerProgressRing';

const EMPTY_TARGETS: TargetType[] = [];

interface Props {
  onClose: () => void;
}

/**
 * PartnerComparisonSheet — full-screen overlay with ALL comparison features.
 *
 * Modern design:
 * - Bento grid layout (varied card sizes)
 * - Avatars with status rings
 * - Concentric progress rings
 * - Monospace stats
 * - Real-time sync (3s push + fetch)
 * - Skeleton shimmer while loading
 */
export function PartnerComparisonSheet({ onClose }: Props) {
  const partner = usePartner();
  const syncData = usePartner((s) => s.syncData);
  const fetchPartnerData = usePartner((s) => s.fetchPartnerData);
  const sessions = useHistory((s) => s.sessions);
  const myActiveSession = useSession((s) => s.active);
  const _byDate = useTargets((s) => s.byDate);
  const _today = todayKey();
  const myTodayTargets = _byDate[_today] || EMPTY_TARGETS;
  const myTests = useTests.getState().tests;

  // Real-time polling
  const [, setTick] = useState(0);
  useEffect(() => {
    syncData();
    fetchPartnerData();
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    const syncInterval = setInterval(() => {
      syncData();
      fetchPartnerData();
    }, 3000);
    return () => {
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [syncData, fetchPartnerData]);

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

  // Weekly leaderboard
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const myDailySec = last7Days.map(date =>
    sessions.filter((s) => s.date === date).reduce((a, s) => a + s.studySeconds, 0)
  );
  const partnerWeekSec = pd?.weekSec || 0;
  const partnerDailyAvg = Math.floor(partnerWeekSec / 7);
  const partnerDailySec = last7Days.map((_, i) => i === 6 ? partnerSec : partnerDailyAvg);
  const maxDaily = Math.max(...myDailySec, ...partnerDailySec, 1);
  const daysWon = myDailySec.filter((my, i) => my > partnerDailySec[i]).length;

  // Subject breakdown
  const mySubjects: Record<string, number> = {};
  sessions.filter((s) => s.date === today).forEach((s) => {
    mySubjects[s.subject] = (mySubjects[s.subject] || 0) + s.studySeconds;
  });

  // Freshness
  const partnerAge = partner.partnerLastSeen ? Date.now() - partner.partnerLastSeen : null;

  const myStatus = myActiveSession ? (myActiveSession.paused ? 'idle' : 'online') : 'offline';
  const partnerStatus = partnerAge !== null && partnerAge < 20000 ? 'online' : partnerAge !== null && partnerAge < 120000 ? 'idle' : 'offline';

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
              status={myStatus as 'online' | 'idle' | 'offline'}
              isStudying={!!myActiveSession && !myActiveSession.paused}
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
              isStudying={pd?.isStudying || false}
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
        {/* Row 1: Weekly Leaderboard (full width) */}
        <BentoCard className="col-span-2">
          <BentoHeader icon={<TrendingUp size={14} />} title="Weekly Leaderboard" subtitle={`Won ${daysWon}/7 days`} />
          <div className="space-y-1.5 mt-2">
            {last7Days.map((date, i) => {
              const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
              const myH = myDailySec[i];
              const pH = partnerDailySec[i];
              const myWon = myH >= pH;
              return (
                <div key={date} className="flex items-center gap-2 text-[10px]">
                  <span className="w-8 text-t-muted font-semibold">{dayLabel}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(myH/maxDaily)*100}%` }} />
                      </div>
                      <span className={`tabular w-10 text-right font-mono ${myWon ? 'text-teal-500 font-bold' : 'text-t-muted'}`}>{formatHM(myH)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(pH/maxDaily)*100}%` }} />
                      </div>
                      <span className={`tabular w-10 text-right font-mono ${!myWon ? 'text-violet-500 font-bold' : 'text-t-muted'}`}>{formatHM(pH)}</span>
                    </div>
                  </div>
                  {myWon && myH > 0 && <span className="text-[8px]">🏆</span>}
                </div>
              );
            })}
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
