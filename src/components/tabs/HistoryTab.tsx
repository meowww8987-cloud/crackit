'use client';

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History as HistoryIcon, Trophy, ChevronDown, Calendar, Moon } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { useTests } from '@/lib/store/tests';
import { useTargets } from '@/lib/store/targets';
import { useSleep } from '@/lib/store/sleep';
import { SmartEmptyState } from '@/components/shared/SmartEmptyState';
import { SleepReportSheet } from '@/components/dailylog/SleepReportSheet';
import { subjectColor } from '@/lib/colors';
import type { Test } from '@/lib/types';
import { formatHM, moodEmoji, todayKey, addDays, dateKey } from '@/lib/utils';

interface TimelineEntry {
  type: 'session' | 'test';
  date: string;
  timestamp: number;
  session?: import('@/lib/types').SavedSession;
  test?: Test;
}

export function HistoryTab() {
  const sessions = useHistory((s) => s.sessions);
  const tests = useTests((s) => s.tests);
  const sleepHistory = useSleep((s) => s.history);
  const [expandedDay, setExpandedDay] = useState<string | null>(todayKey());
  const [showSleepReport, setShowSleepReport] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowSleepReport(true);
    }, 500);
  };
  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Build merged timeline
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];
    for (const s of sessions) {
      entries.push({ type: 'session', date: s.date, timestamp: s.endedAt, session: s });
    }
    for (const t of tests) {
      entries.push({ type: 'test', date: t.date, timestamp: new Date(t.date + 'T12:00:00').getTime(), test: t });
    }
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }, [sessions, tests]);

  // Group by date
  const groups = useMemo(() => {
    const map: Record<string, TimelineEntry[]> = {};
    for (const e of timeline) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [timeline]);

  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="pt-2 pb-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <HistoryIcon size={20} className="text-teal-400" />
        History
      </h1>

      {timeline.length === 0 && (
        <SmartEmptyState tab="history" />
      )}

      {/* Past 6 days overview */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 px-1 flex items-center gap-1">
            <Calendar size={12} /> Past 6 Days
          </h3>
          <div className="space-y-1.5">
            {Array.from({ length: 6 }, (_, i) => {
              const d = addDays(new Date(), -(i + 1));
              const key = dateKey(d);
              const daySessions = sessions.filter((s) => s.date === key);
              if (daySessions.length === 0) return null;
              const studySec = daySessions.reduce((a, s) => a + s.studySeconds, 0);
              const wastedSec = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);
              const dayTargets = useTargets.getState().byDate[key] || [];
              const doneCount = dayTargets.filter((t) => t.done).length;
              return (
                <div key={key} className="glass rounded-xl p-2.5 flex items-center gap-3">
                  <div className="text-center min-w-[40px]">
                    <div className="text-[10px] text-white/40 uppercase">
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-base font-bold tabular">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/50">
                      <span className="text-white/80 font-semibold tabular">{doneCount}</span>/{dayTargets.length} done
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-green-400 tabular">▶ {formatHM(studySec)}</span>
                      {wastedSec > 0 && (
                        <span className="text-xs text-red-400 tabular">⚠ {formatHM(wastedSec)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Sleep section — long-press any entry for the full report === */}
      {sleepHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-white/40 px-1 flex items-center gap-1">
            <Moon size={12} /> Sleep History
            <span className="ml-auto text-[9px] text-white/30 normal-case font-normal">long-press for report</span>
          </h3>
          <div className="space-y-1.5">
            {sleepHistory.slice(0, 6).map((entry) => {
              const bedDate = new Date(entry.bedTime);
              const durationSec = entry.durationSec || 0;
              const isNight = durationSec >= 4 * 3600;
              return (
                <div
                  key={entry.id}
                  className="glass rounded-xl p-2.5 flex items-center gap-3 select-none"
                  onTouchStart={handleLongPressStart}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                  <div className="text-center min-w-[42px]">
                    <div className="text-[10px] text-white/40 uppercase">
                      {bedDate.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-base font-bold tabular">{bedDate.getDate()}</div>
                  </div>
                  <div className="text-xl">{isNight ? '🌙' : '💤'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">
                      {isNight ? 'Night Sleep' : 'Nap'}
                    </div>
                    <div className="text-[10px] text-white/50">
                      {bedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {entry.wakeTime && (
                        <> → {new Date(entry.wakeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-indigo-300 tabular">{formatHM(durationSec)}</div>
                    {entry.quality != null && (
                      <div className="text-[9px] text-white/40">{'★'.repeat(entry.quality)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SleepReportSheet open={showSleepReport} onClose={() => setShowSleepReport(false)} />

      {/* Timeline */}
      <div className="space-y-3">
        {dates.map((date) => {
          const dayEntries = groups[date];
          const daySessions = dayEntries.filter((e) => e.type === 'session');
          const totalStudy = daySessions.reduce((a, e) => a + (e.session?.studySeconds || 0), 0);
          const totalWasted = daySessions.reduce((a, e) => a + (e.session?.wastedSeconds || 0), 0);
          const d = new Date(date + 'T00:00:00');
          const isToday = date === todayKey();
          const isExpanded = expandedDay === date;

          return (
            <div key={date}>
              <button
                onClick={() => setExpandedDay(isExpanded ? null : date)}
                className="w-full flex items-center gap-2 mb-2 px-1"
              >
                <span className="text-xs font-bold uppercase text-white/60">
                  {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-xs text-white/40 tabular ml-auto">
                  ▶ {formatHM(totalStudy)}
                  {totalWasted > 0 && <span className="text-red-400"> · ⚠ {formatHM(totalWasted)}</span>}
                </span>
                <ChevronDown size={12} className={`text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5"
                  >
                    {dayEntries.map((e, i) => {
                      if (e.type === 'test' && e.test) {
                        return <TestTimelineCard key={`test-${e.test.id}-${i}`} test={e.test} />;
                      }
                      if (e.session) {
                        return <SessionTimelineCard key={`sess-${e.session.id}`} session={e.session} />;
                      }
                      return null;
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionTimelineCard({ session }: { session: import('@/lib/types').SavedSession }) {
  const c = subjectColor(session.subject);
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3">
      <div className="text-center min-w-[40px]">
        <div className="text-[10px] text-white/40 uppercase">
          {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short' })}
        </div>
        <div className="text-base font-bold tabular">{new Date(session.startedAt).getDate()}</div>
      </div>
      <div className="w-2 h-10 rounded" style={{ background: c.hex }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {session.subject} · {session.chapter}
          {session.mode === 'free' && (
            <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">FREE</span>
          )}
        </div>
        <div className="text-[10px] text-white/40">
          {new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {' — '}
          {new Date(session.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-green-400 font-semibold tabular">▶ {formatHM(session.studySeconds)}</div>
        {session.wastedSeconds > 0 && (
          <div className="text-[10px] text-red-400 tabular">⚠ {formatHM(session.wastedSeconds)}</div>
        )}
      </div>
      <span className="text-lg">{moodEmoji(session.mood)}</span>
    </div>
  );
}

function TestTimelineCard({ test }: { test: Test }) {
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3 border border-amber-500/20">
      <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
        <Trophy size={16} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{test.name}</div>
        <div className="text-[10px] text-white/40">
          {test.type} · {new Date(test.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div className="text-right">
        {test.totalMarks !== undefined ? (
          <>
            <div className="text-sm text-amber-400 font-bold tabular">{test.totalMarks}</div>
            <div className="text-[10px] text-white/40">/720</div>
          </>
        ) : (
          <div className="text-[10px] text-white/40">No result</div>
        )}
      </div>
      {test.hasAnalytics && <Trophy size={12} className="text-purple-400" />}
    </div>
  );
}
