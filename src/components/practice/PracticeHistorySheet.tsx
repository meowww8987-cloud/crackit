'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ChevronRight, Check, Clock, Eye, AlertCircle, ChevronDown, Play, Trash2, Pause } from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { cn, vibrate, formatHMS } from '@/lib/utils';
import { PracticeSessionDetail } from './PracticeSessionDetail';

function timeSincePause(pausedAt?: number | null): string {
  if (!pausedAt) return '';
  const diffMs = Date.now() - pausedAt;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * A question-level "is set" predicate:
 *  - correct answer marked, OR
 *  - either note (concept / formula) populated
 *  → considered "set" → eligible for the Edit button.
 */
function questionIsSet(q: PracticeQuestion) {
  return !!q.correctAnswer || !!q.conceptNotes || !!q.formulaNotes;
}

/**
 * A session-level "is set" predicate:
 *  - any question set → session is set
 *  → Edit button shown when session is opened.
 */
function sessionIsSet(session: PracticeSession) {
  return session.questions.some(questionIsSet);
}

export function PracticeHistorySheet({ open, onClose }: Props) {
  const history = usePractice((s) => s.history);
  const pausedPractices = usePractice((s) => s.pausedPractices);
  const resumePractice = usePractice((s) => s.resumePractice);
  const deletePausedPractice = usePractice((s) => s.deletePausedPractice);

  const [view, setView] = useState<'sessions' | 'wrong'>('sessions');
  // Tracks which session was tapped → opens full-screen detail page.
  const [selected, setSelected] = useState<{ sessionId: string; focusQIndex?: number } | null>(null);

  // Reset view state when sheet closes.
  useEffect(() => {
    if (!open) {
      setView('sessions');
      setSelected(null);
    }
  }, [open]);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)),
    [history]
  );

  const totalSessions = history.length;
  const totalQuestions = history.reduce((a, s) => a + s.questions.length, 0);
  const totalCorrect = history.reduce((a, s) => a + s.correctCount, 0);
  const totalWrong = history.reduce((a, s) => a + s.wrongCount, 0);
  const overallAccuracy = totalCorrect + totalWrong > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  // Wrong questions for the revision list (only true `wrong` result).
  const wrongQuestions = useMemo(() => {
    const wrong: { session: PracticeSession; qIndex: number }[] = [];
    for (const session of sortedHistory) {
      session.questions.forEach((q, i) => {
        if (q.result === 'wrong') wrong.push({ session, qIndex: i });
      });
    }
    return wrong;
  }, [sortedHistory]);

  return (
    <>
      {/* ============ Full-screen detail page (sits on top of the sheet) ============ */}
      <AnimatePresence>
        {selected && (
          <PracticeSessionDetail
            sessionId={selected.sessionId}
            focusQIndex={selected.focusQIndex}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* ============ History list sheet ============ */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-black/90" />

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col glass-strong rounded-3xl"
            >
              {/* Top drag indicator */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 shrink-0" />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div className="text-center mb-4 px-5 shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center mx-auto mb-2 border border-blue-500/30">
                  <BookOpen size={24} className="text-blue-300" />
                </div>
                <h2 className="text-lg font-bold text-white">Practice History</h2>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {totalSessions} sessions · {totalQuestions} questions · {overallAccuracy}% accuracy
                </p>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 pb-8">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen size={40} className="text-blue-300/40 mx-auto mb-3" />
                    <p className="text-white/60 text-sm">No practice sessions yet.</p>
                    <p className="text-white/40 text-[10px] mt-1">Long-press the Tests tab → Practice Mode to start.</p>
                  </div>
                ) : (
                  <>
                    {/* === Resume Paused Practice section (only shows if any exist) === */}
                    {pausedPractices.length > 0 && (
                      <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Pause size={12} className="text-amber-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
                            Resume Paused Practice
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {pausedPractices.map((p) => {
                            const totalElapsed = p.accumulatedTimeSec || 0;
                            const answeredCount = p.questions.filter(q => q.status === 'answered').length;
                            const skippedCount = p.questions.filter(q => q.status === 'skipped').length;
                            const reviewCount = p.questions.filter(q => q.status === 'review-later').length;
                            const currentQ = p.resumeQuestionIndex ?? 0;
                            return (
                              <div
                                key={p.id}
                                className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-2.5 flex items-center gap-2"
                              >
                                <button
                                  onClick={() => {
                                    vibrate(15);
                                    resumePractice(p.id);
                                    onClose();
                                  }}
                                  className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500/30 active:scale-95 transition shrink-0"
                                  aria-label="Resume practice"
                                >
                                  <Play size={16} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-white truncate">{p.name}</div>
                                  <div className="text-[10px] text-white/50 flex items-center gap-1.5 mt-0.5">
                                    <Clock size={9} />
                                    <span className="tabular">{formatHMS(totalElapsed)}</span>
                                    <span className="opacity-40">·</span>
                                    <span>Q{currentQ + 1}{p.questionCount > 0 ? `/${p.questionCount}` : ''}</span>
                                    {answeredCount > 0 && <span className="text-green-400">✓{answeredCount}</span>}
                                    {skippedCount > 0 && <span className="text-white/40">→{skippedCount}</span>}
                                    {reviewCount > 0 && <span className="text-amber-400">⚑{reviewCount}</span>}
                                  </div>
                                  <div className="text-[9px] text-white/30 mt-0.5">
                                    Paused {timeSincePause(p.pausedAt)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    vibrate(8);
                                    if (confirm(`Discard "${p.name}"? Progress will be lost.`)) {
                                      deletePausedPractice(p.id);
                                    }
                                  }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                                  aria-label="Discard paused practice"
                                  title="Discard"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* View toggle */}
                    <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4 sticky top-0 z-10">
                      <button
                        onClick={() => setView('sessions')}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-xs font-bold transition',
                          view === 'sessions' ? 'bg-blue-500/30 text-white' : 'text-white/40'
                        )}
                      >
                        Sessions ({totalSessions})
                      </button>
                      <button
                        onClick={() => setView('wrong')}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-xs font-bold transition',
                          view === 'wrong' ? 'bg-red-500/30 text-red-200' : 'text-white/40'
                        )}
                      >
                        Wrong ({wrongQuestions.length})
                      </button>
                    </div>

                    {/* ============ Revision view (wrong questions) ============ */}
                    {view === 'wrong' && (
                      <div>
                        {wrongQuestions.length === 0 ? (
                          <div className="text-center py-8">
                            <Check size={28} className="text-green-400/60 mx-auto mb-2" />
                            <p className="text-green-400/60 text-sm">No wrong questions!</p>
                            <p className="text-white/30 text-[10px] mt-1">All your sessions are clean.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {wrongQuestions.map(({ session, qIndex }) => {
                              const q = session.questions[qIndex];
                              const isSet = questionIsSet(q);

                              return (
                                <button
                                  key={`${session.id}-${qIndex}`}
                                  onClick={() => {
                                    vibrate(10);
                                    setSelected({ sessionId: session.id, focusQIndex: qIndex });
                                  }}
                                  className="w-full text-left rounded-xl overflow-hidden glass p-3 active:scale-[0.98] transition"
                                  style={{ borderLeft: '3px solid #ef4444' }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-red-400 w-12 shrink-0">
                                      {session.subject.slice(0, 4)} Q{q.number}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] text-white/50 truncate flex items-center gap-1.5">
                                        <Clock size={9} />
                                        {formatHMS(q.timeSpentSec)}
                                        <span className="opacity-40">·</span>
                                        <span className="truncate">{session.chapter}</span>
                                      </div>
                                      <div className="text-[10px] text-white/40 mt-0.5 truncate">
                                        {session.name}
                                      </div>
                                    </div>
                                    {q.userAnswer && (
                                      <span className="text-[10px] text-white/70 shrink-0">You:{q.userAnswer}</span>
                                    )}
                                    {q.correctAnswer && (
                                      <span className="text-[10px] text-red-300 shrink-0">Ans:{q.correctAnswer}</span>
                                    )}
                                    {isSet && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">
                                        SET
                                      </span>
                                    )}
                                    <ChevronRight size={14} className="text-white/30 shrink-0" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ============ Session list ============ */}
                    {view === 'sessions' && (
                      <div className="space-y-2">
                        {sortedHistory.map((session) => {
                          const isSet = sessionIsSet(session);
                          const date = new Date(session.startedAt);
                          const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                          const accuracy = session.correctCount + session.wrongCount > 0
                            ? Math.round((session.correctCount / (session.correctCount + session.wrongCount)) * 100)
                            : 0;
                          const accColor = accuracy >= 70 ? '#22c55e' : accuracy >= 40 ? '#f59e0b' : '#ef4444';

                          return (
                            <button
                              key={session.id}
                              onClick={() => {
                                vibrate(10);
                                setSelected({ sessionId: session.id });
                              }}
                              className="w-full text-left glass rounded-2xl overflow-hidden p-3 active:scale-[0.98] transition"
                            >
                              <div className="flex items-center gap-3">
                                {/* Date pill */}
                                <div className="text-center min-w-[38px] shrink-0">
                                  <div className="text-[9px] text-white/40 uppercase">{dateStr.split(' ')[0]}</div>
                                  <div className="text-sm font-bold">{date.getDate()}</div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                                    {session.name}
                                    {isSet && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">
                                        SET
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                                    <Clock size={9} className="inline" />
                                    {timeStr}
                                    <span className="opacity-40">·</span>
                                    {formatHMS(session.totalTimeSec)}
                                    <span className="opacity-40">·</span>
                                    {session.questions.length}Q
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div
                                    className="text-base font-bold tabular leading-none"
                                    style={accuracy > 0 ? { color: accColor } : undefined}
                                  >
                                    <span className={accuracy > 0 ? undefined : 'text-white/40'}>
                                      {accuracy > 0 ? `${accuracy}%` : '—'}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-white/40 mt-0.5">
                                    {session.correctCount}/{session.correctCount + session.wrongCount} ✓
                                  </div>
                                </div>

                                <ChevronRight size={16} className="text-white/30 shrink-0" />
                              </div>

                              {/* Mini preview strip of question results */}
                              <div className="mt-2.5 flex gap-0.5 flex-wrap">
                                {session.questions.slice(0, 30).map((q, qi) => {
                                  const c =
                                    q.result === 'correct'
                                      ? '#22c55e'
                                      : q.result === 'wrong'
                                        ? '#ef4444'
                                        : '#94a3b8';
                                  return (
                                    <div
                                      key={qi}
                                      className="w-1.5 h-3 rounded-sm"
                                      style={{ background: c, opacity: q.result === 'unmarked' ? 0.3 : 0.85 }}
                                      title={`Q${q.number}: ${q.result}`}
                                    />
                                  );
                                })}
                                {session.questions.length > 30 && (
                                  <span className="text-[8px] text-white/40 self-center ml-1">
                                    +{session.questions.length - 30}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[9px] text-white/40 text-center mt-4 leading-relaxed">
                      {view === 'sessions'
                        ? 'Tap any session to open its full detail report.'
                        : 'Tap any wrong question to open its session and edit.'}
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
