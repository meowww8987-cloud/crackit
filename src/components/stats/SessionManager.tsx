'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  X, Trash2, Search, AlertTriangle, Clock, Filter,
  CheckCircle2, Calendar, ChevronDown,
} from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { subjectColor } from '@/lib/colors';
import type { SavedSession } from '@/lib/types';
import { cn, formatHM, vibrate, todayKey } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

type FilterMode = 'all' | 'corrupted' | 'today' | 'week' | 'wasted';

/**
 * SessionManager — modern full-screen session browser + deleter.
 *
 * Features:
 * - Summary: total sessions, total study, total wasted
 * - Filter tabs: All / Corrupted / Today / This Week / Wasted
 * - Search by subject/chapter/topic
 * - Scrollable session list (newest first)
 * - Each session: date, time, subject, study/waste, delete button
 * - Long-press session → detail view
 * - Bulk actions: Delete all corrupted / Delete before date / Delete ALL
 * - Confirmations for destructive actions
 *
 * Corruption detection:
 * - studySeconds > 12 * 3600 (over 12h — impossible single session)
 * - studySeconds < 0 or wastedSeconds < 0 (negative)
 * - endedAt < startedAt (time travel)
 * - Missing subject/date/startedAt/endedAt
 * - wastedSeconds > studySeconds * 10 (absurd waste ratio)
 */
export function SessionManager({ onClose }: Props) {
  const sessions = useHistory((s) => s.sessions);
  const deleteSession = useHistory((s) => s.deleteSession);
  const deleteSessionsBulk = useHistory((s) => s.deleteSessionsBulk);
  const deleteSessionsBeforeDate = useHistory((s) => s.deleteSessionsBeforeDate);
  const deleteAllSessions = useHistory((s) => s.deleteAllSessions);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'amber' | 'red';
  } | null>(null);
  const [selectedSession, setSelectedSession] = useState<SavedSession | null>(null);

  // === Corruption detection ===
  const isCorrupted = (s: SavedSession): boolean => {
    if (s.studySeconds > 12 * 3600) return true; // > 12h
    if (s.studySeconds < 0 || s.wastedSeconds < 0) return true; // negative
    if (s.endedAt < s.startedAt) return true; // time travel
    if (!s.subject || !s.date || !s.startedAt || !s.endedAt) return true; // missing fields
    if (s.wastedSeconds > s.studySeconds * 10 && s.wastedSeconds > 3600) return true; // absurd waste ratio
    return false;
  };

  const corruptedSessions = useMemo(
    () => sessions.filter(isCorrupted),
    [sessions]
  );

  // === Filtered + searched sessions ===
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Filter
    switch (filter) {
      case 'corrupted':
        result = result.filter(isCorrupted);
        break;
      case 'today': {
        const today = todayKey();
        result = result.filter((s) => s.date === today);
        break;
      }
      case 'week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().slice(0, 10);
        result = result.filter((s) => s.date >= weekAgoStr);
        break;
      }
      case 'wasted':
        result = result.filter((s) => s.wastedSeconds > 60);
        break;
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.subject?.toLowerCase().includes(q) ||
        s.chapter?.toLowerCase().includes(q) ||
        s.topic?.toLowerCase().includes(q) ||
        s.mode?.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    result.sort((a, b) => b.startedAt - a.startedAt);
    return result;
  }, [sessions, filter, search]);

  // === Summary stats ===
  const summary = useMemo(() => {
    const totalStudy = sessions.reduce((a, s) => a + (s.studySeconds || 0), 0);
    const totalWaste = sessions.reduce((a, s) => a + (s.wastedSeconds || 0), 0);
    return {
      total: sessions.length,
      study: totalStudy,
      waste: totalWaste,
      corrupted: corruptedSessions.length,
    };
  }, [sessions, corruptedSessions]);

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '?';
    }
  };

  // === Handlers ===
  const handleDeleteSession = (id: string) => {
    vibrate([10, 30, 10]);
    deleteSession(id);
    setSelectedSession(null);
  };

  const handleDeleteCorrupted = () => {
    setConfirmAction({
      title: `Delete ${corruptedSessions.length} corrupted session${corruptedSessions.length === 1 ? '' : 's'}?`,
      message: 'These sessions have invalid data (over 12h study, negative time, missing fields, or absurd waste ratios). They will be permanently removed. Your valid sessions are NOT affected.',
      onConfirm: () => {
        deleteSessionsBulk(corruptedSessions.map((s) => s.id));
        setConfirmAction(null);
        vibrate([10, 30, 10]);
      },
      variant: 'amber',
    });
  };

  const handleDeleteBeforeDate = (date: string) => {
    const count = sessions.filter((s) => s.date < date).length;
    if (count === 0) {
      alert('No sessions before this date.');
      return;
    }
    setConfirmAction({
      title: `Delete ${count} session${count === 1 ? '' : 's'} before ${formatDate(date)}?`,
      message: `All sessions dated BEFORE ${formatDate(date)} will be permanently removed. Sessions on ${formatDate(date)} and later are NOT affected.`,
      onConfirm: () => {
        deleteSessionsBeforeDate(date);
        setConfirmAction(null);
        setShowBulkMenu(false);
        vibrate([10, 30, 10]);
      },
      variant: 'amber',
    });
  };

  const handleDeleteAll = () => {
    setConfirmAction({
      title: `Delete ALL ${sessions.length} sessions?`,
      message: 'Every single study session in your history will be permanently removed. This affects your stats, streak, and all reports. This CANNOT be undone. Consider exporting a backup first.',
      onConfirm: () => {
        deleteAllSessions();
        setConfirmAction(null);
        setShowBulkMenu(false);
        vibrate([10, 50, 10]);
      },
      variant: 'red',
    });
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-foreground/10 shrink-0">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Data Manager
          </div>
          <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
            Study Sessions
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
        >
          <X size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-foreground/5 shrink-0">
        <div className="grid grid-cols-4 gap-2">
          <SummaryStat label="Total" value={summary.total.toString()} color="var(--foreground)" />
          <SummaryStat label="Study" value={formatHM(summary.study)} color="#22c55e" />
          <SummaryStat label="Waste" value={formatHM(summary.waste)} color="#ef4444" />
          <SummaryStat
            label="Corrupt"
            value={summary.corrupted.toString()}
            color={summary.corrupted > 0 ? '#f59e0b' : 'var(--muted-foreground)'}
          />
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-foreground/5 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, chapter, topic..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[12px] focus:outline-none"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-foreground/5 shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
            All ({sessions.length})
          </FilterPill>
          <FilterPill
            active={filter === 'corrupted'}
            onClick={() => setFilter('corrupted')}
            highlight={summary.corrupted > 0}
          >
            ⚠ Corrupted ({summary.corrupted})
          </FilterPill>
          <FilterPill active={filter === 'today'} onClick={() => setFilter('today')}>
            Today
          </FilterPill>
          <FilterPill active={filter === 'week'} onClick={() => setFilter('week')}>
            This Week
          </FilterPill>
          <FilterPill active={filter === 'wasted'} onClick={() => setFilter('wasted')}>
            Wasted
          </FilterPill>
        </div>
      </div>

      {/* Bulk actions button */}
      <div className="px-4 py-2 border-b border-foreground/5 shrink-0">
        <button
          onClick={() => { setShowBulkMenu(true); vibrate(8); }}
          className="w-full py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        >
          <Filter size={12} /> Bulk actions
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 overscroll-contain" style={{ touchAction: 'pan-y' }}>
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <div className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>
              {filter === 'corrupted' ? 'No corrupted sessions!' :
               search ? 'No sessions match your search' :
               'No sessions yet'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {filter === 'corrupted' ? 'All your data looks healthy.' : 'Start studying to see sessions here.'}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 pb-4">
            {filteredSessions.map((s) => {
              const color = subjectColor(s.subject || 'General');
              const corrupted = isCorrupted(s);
              return (
                <div
                  key={s.id}
                  onClick={() => { setSelectedSession(s); vibrate(8); }}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition active:scale-[0.98]',
                    corrupted && 'border-amber-500/30'
                  )}
                  style={{
                    background: corrupted ? 'rgba(245,158,11,0.05)' : `${color.hex}08`,
                    borderColor: corrupted ? 'rgba(245,158,11,0.3)' : `${color.hex}15`,
                  }}
                >
                  {/* Color dot */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                    style={{ background: `${color.hex}20`, color: color.hex }}
                  >
                    {(s.subject || '?')[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                        {s.subject || 'Unknown'}
                      </span>
                      {corrupted && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 shrink-0">
                          CORRUPT
                        </span>
                      )}
                      {s.mode === 'free' && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-500 shrink-0">
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Calendar size={8} />
                      <span>{formatDate(s.date)}</span>
                      <span>·</span>
                      <Clock size={8} />
                      <span>{formatTime(s.startedAt)}</span>
                      {s.chapter && (
                        <>
                          <span>·</span>
                          <span className="truncate">{s.chapter}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time stats */}
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-bold tabular text-green-500">
                      {formatHM(s.studySeconds || 0)}
                    </div>
                    {(s.wastedSeconds || 0) > 0 && (
                      <div className="text-[9px] tabular text-red-500">
                        ⚠ {formatHM(s.wastedSeconds)}
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/15 transition active:scale-90 shrink-0"
                    aria-label="Delete session"
                  >
                    <Trash2 size={12} className="text-red-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === Bulk actions menu === */}
      {showBulkMenu && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10003] bg-black/80"
            onClick={() => setShowBulkMenu(false)}
          />
          <div className="fixed inset-0 z-[10004] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl pointer-events-auto overflow-hidden"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-foreground/10">
                <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Bulk actions</div>
                <div className="text-[10px] text-muted-foreground">Delete multiple sessions at once</div>
              </div>
              <div className="py-1">
                {/* Delete corrupted */}
                <button
                  onClick={() => { setShowBulkMenu(false); handleDeleteCorrupted(); }}
                  disabled={corruptedSessions.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left disabled:opacity-40"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-600">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-amber-600">Delete corrupted ({corruptedSessions.length})</div>
                    <div className="text-[10px] text-muted-foreground">Sessions with invalid data</div>
                  </div>
                </button>

                {/* Delete before date */}
                <DeleteBeforeDateButton onConfirm={handleDeleteBeforeDate} />

                {/* Delete ALL */}
                <button
                  onClick={() => { setShowBulkMenu(false); handleDeleteAll(); }}
                  disabled={sessions.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left disabled:opacity-40"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-red-500/20 text-red-600">
                    <Trash2 size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-red-600">Delete ALL ({sessions.length})</div>
                    <div className="text-[10px] text-muted-foreground">Permanently remove every session</div>
                  </div>
                </button>
              </div>
              <div className="border-t border-foreground/10 p-2">
                <button
                  onClick={() => setShowBulkMenu(false)}
                  className="w-full py-2 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-foreground/10 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Confirmation dialog === */}
      {confirmAction && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10005] bg-black/80"
            onClick={() => setConfirmAction(null)}
          />
          <div className="fixed inset-0 z-[10006] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    confirmAction.variant === 'red' ? 'bg-red-500/15' : 'bg-amber-500/15'
                  )}>
                    <Trash2 size={18} className={confirmAction.variant === 'red' ? 'text-red-500' : 'text-amber-500'} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                      {confirmAction.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1">{confirmAction.message}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[12px] font-semibold hover:bg-foreground/10 active:scale-95 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction.onConfirm}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-[12px] font-bold text-white active:scale-95 transition',
                      confirmAction.variant === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                    )}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Session detail === */}
      {selectedSession && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10003] bg-black/80"
            onClick={() => setSelectedSession(null)}
          />
          <div className="fixed inset-0 z-[10004] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-border shadow-2xl pointer-events-auto overflow-hidden"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const s = selectedSession;
                const color = subjectColor(s.subject || 'General');
                const corrupted = isCorrupted(s);
                const duration = Math.round((s.endedAt - s.startedAt) / 60000);
                return (
                  <>
                    <div className="px-4 py-3 border-b border-foreground/10" style={{ background: `${color.hex}10` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: `${color.hex}25`, color: color.hex }}>
                            {(s.subject || '?')[0]}
                          </div>
                          <div>
                            <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{s.subject || 'Unknown'}</div>
                            <div className="text-[10px] text-muted-foreground">{formatDate(s.date)} · {formatTime(s.startedAt)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedSession(null)}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition"
                        >
                          <X size={14} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <DetailRow label="Subject" value={s.subject || 'Missing'} />
                      <DetailRow label="Chapter" value={s.chapter || '—'} />
                      <DetailRow label="Topic" value={s.topic || '—'} />
                      <DetailRow label="Mode" value={s.mode || '—'} />
                      <DetailRow label="Date" value={s.date} />
                      <DetailRow label="Started" value={formatTime(s.startedAt)} />
                      <DetailRow label="Ended" value={formatTime(s.endedAt)} />
                      <DetailRow label="Duration" value={`${duration} min`} />
                      <DetailRow label="Study time" value={formatHM(s.studySeconds || 0)} valueColor="#22c55e" />
                      {(s.wastedSeconds || 0) > 0 && (
                        <DetailRow label="Wasted time" value={formatHM(s.wastedSeconds)} valueColor="#ef4444" />
                      )}
                      <DetailRow label="Mood" value={s.mood || 'Not set'} />
                      {s.targetId && <DetailRow label="Target ID" value={s.targetId} />}
                      {s.plannedSlotId && <DetailRow label="Routine block" value={s.plannedSlotId} />}
                      {corrupted && (
                        <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                          <div className="text-[10px] font-bold text-amber-600 mb-0.5">⚠ CORRUPTED SESSION</div>
                          <div className="text-[9px] text-amber-600/80">
                            {s.studySeconds > 12 * 3600 ? 'Study time exceeds 12 hours. ' : ''}
                            {(s.studySeconds < 0 || s.wastedSeconds < 0) ? 'Negative time values. ' : ''}
                            {s.endedAt < s.startedAt ? 'End time before start time. ' : ''}
                            {(!s.subject || !s.date) ? 'Missing required fields. ' : ''}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-foreground/10 flex gap-2">
                      <button
                        onClick={() => setSelectedSession(null)}
                        className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[12px] font-semibold hover:bg-foreground/10 active:scale-95 transition"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="flex-1 py-2 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 active:scale-95 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </motion.div>,
    document.body
  );
}

// ===== Sub-components =====
function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[13px] font-bold tabular" style={{ color }}>{value}</div>
      <div className="text-[8px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterPill({ active, onClick, highlight, children }: {
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => { onClick(); vibrate(5); }}
      className={cn(
        'px-2.5 py-1 rounded-lg text-[10px] font-bold transition border active:scale-95 shrink-0',
        active
          ? 'border-transparent'
          : highlight
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
          : 'border-border bg-foreground/5 text-muted-foreground'
      )}
      style={active ? { background: 'var(--foreground)', color: 'var(--background)' } : undefined}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold truncate ml-2 max-w-[60%] text-right" style={{ color: valueColor || 'var(--foreground)' }}>
        {value}
      </span>
    </div>
  );
}

function DeleteBeforeDateButton({ onConfirm }: { onConfirm: (date: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-600">
          <Calendar size={14} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Delete before date</div>
          <div className="text-[10px] text-muted-foreground">Remove all sessions before a specific date</div>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              />
              <button
                onClick={() => onConfirm(date)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white active:scale-95"
                style={{ background: '#3b82f6' }}
              >
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
