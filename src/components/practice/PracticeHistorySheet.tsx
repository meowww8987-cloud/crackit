'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Check, AlertCircle, BookOpen, ChevronDown, Filter } from 'lucide-react';
import { usePractice, type PracticeSession } from '@/lib/store/practice';
import { formatHM, cn, vibrate } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PracticeHistorySheet({ open, onClose }: Props) {
  const history = usePractice((s) => s.history);
  const markQuestion = usePractice((s) => s.markQuestion);
  const saveNotes = usePractice((s) => s.saveNotes);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [filterWrong, setFilterWrong] = useState(false);
  const [conceptDraft, setConceptDraft] = useState('');
  const [formulaDraft, setFormulaDraft] = useState('');

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  }, [history]);

  // Aggregate stats
  const totalSessions = history.length;
  const totalQuestions = history.reduce((a, s) => a + s.questions.length, 0);
  const totalCorrect = history.reduce((a, s) => a + s.correctCount, 0);
  const totalWrong = history.reduce((a, s) => a + s.wrongCount, 0);
  const overallAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;

  // Get all wrong questions across sessions for revision
  const wrongQuestions = useMemo(() => {
    const wrong: { session: PracticeSession; qIndex: number; question: PracticeSession['questions'][0] }[] = [];
    for (const session of history) {
      session.questions.forEach((q, i) => {
        if (q.result === 'wrong' || (filterWrong && q.result === 'unmarked' && q.status === 'answered')) {
          wrong.push({ session, qIndex: i, question: q });
        }
      });
    }
    return wrong;
  }, [history, filterWrong]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[88vh] overflow-y-auto force-dark-ui"
            style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #0d1320 50%, #0a0f1a 100%)', borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '1px solid rgba(59,130,241,0.25)', borderBottom: 'none' }}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 mt-3" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"><X size={16} /></button>

            {/* Header */}
            <div className="text-center mb-4 px-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
                <BookOpen size={28} className="text-blue-300" />
              </div>
              <h2 className="text-lg font-bold text-white">Practice History</h2>
              <p className="text-[11px] text-blue-200/50 mt-0.5">{totalSessions} sessions · {totalQuestions} questions · {overallAccuracy}% overall accuracy</p>
            </div>

            <div className="px-4 pb-8">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen size={40} className="text-blue-300/20 mx-auto mb-3" />
                  <p className="text-blue-200/50 text-sm">No practice sessions yet.</p>
                  <p className="text-blue-200/30 text-[10px] mt-1">Long-press the Tests tab → Practice Mode to start.</p>
                </div>
              ) : (
                <>
                  {/* === Revision filter toggle === */}
                  <button
                    onClick={() => setFilterWrong(!filterWrong)}
                    className={cn('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition mb-3',
                      filterWrong ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/50 border border-white/10')}
                  >
                    <Filter size={12} />
                    {filterWrong ? `Showing ${wrongQuestions.length} wrong/unmarked questions for revision` : 'Show only wrong questions for revision'}
                  </button>

                  {/* === Wrong questions revision view === */}
                  {filterWrong && wrongQuestions.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-red-300/60 mb-2">Revision Queue</h3>
                      {wrongQuestions.map(({ session, qIndex, question }) => {
                        const isExpanded = expandedQ === qIndex && expandedSession === session.id;
                        return (
                          <div key={`${session.id}-${qIndex}`} className="rounded-xl overflow-hidden" style={{ borderLeft: '3px solid #ef4444' }}>
                            <div className="glass p-2.5 flex items-center gap-3" onClick={() => {
                              if (isExpanded) { setExpandedQ(null); setExpandedSession(null); }
                              else { setExpandedQ(qIndex); setExpandedSession(session.id); setConceptDraft(question.conceptNotes || ''); setFormulaDraft(question.formulaNotes || ''); }
                            }}>
                              <div className="text-xs font-bold text-red-400 w-12">{session.subject.slice(0, 4)} Q{question.number}</div>
                              <div className="flex-1 text-[10px] text-white/50">
                                {formatHM(question.timeSpentSec)} · {session.chapter}
                                {question.conceptNotes && <span className="ml-1 text-amber-400/60">📝</span>}
                              </div>
                              <ChevronDown size={14} className={cn('text-white/30 transition', isExpanded && 'rotate-180')} />
                            </div>
                            {isExpanded && (
                              <div className="p-3 bg-white/[0.02] space-y-2">
                                {question.conceptNotes && <div className="text-xs text-white/70"><span className="text-amber-400/60 font-semibold">Concept:</span> {question.conceptNotes}</div>}
                                {question.formulaNotes && <div className="text-xs text-white/70"><span className="text-amber-400/60 font-semibold">Formula:</span> {question.formulaNotes}</div>}
                                <div>
                                  <label className="text-[9px] text-white/40 uppercase">Edit concept notes</label>
                                  <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="What went wrong..." className="w-full p-2 rounded-lg bg-white/5 text-xs mt-1 h-14 resize-none" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-white/40 uppercase">Edit formula notes</label>
                                  <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Key formula..." className="w-full p-2 rounded-lg bg-white/5 text-xs mt-1 h-10 resize-none" />
                                </div>
                                <button onClick={() => { saveNotes(session.id, qIndex, conceptDraft, formulaDraft); vibrate(10); setExpandedQ(null); setExpandedSession(null); }}
                                  className="w-full py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold active:scale-95 transition">Save Notes</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* === Session list === */}
                  {!filterWrong && (
                    <div className="space-y-2">
                      {sortedHistory.map((session) => {
                        const isExpanded = expandedSession === session.id;
                        const date = new Date(session.startedAt);
                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const accuracy = (session.correctCount + session.wrongCount) > 0 ? Math.round((session.correctCount / (session.correctCount + session.wrongCount)) * 100) : 0;
                        const accColor = accuracy >= 70 ? '#22c55e' : accuracy >= 40 ? '#f59e0b' : '#ef4444';

                        return (
                          <div key={session.id} className="glass rounded-xl overflow-hidden">
                            {/* Session header */}
                            <button onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                              className="w-full p-3 flex items-center gap-3 text-left">
                              <div className="text-center min-w-[40px]">
                                <div className="text-[10px] text-white/40">{dateStr.split(' ')[0]}</div>
                                <div className="text-sm font-bold">{date.getDate()}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{session.name}</div>
                                <div className="text-[10px] text-white/40">
                                  {timeStr} · {formatHM(session.totalTimeSec)} · {session.questions.length}Q
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold tabular" style={{ color: accColor }}>{accuracy}%</div>
                                <div className="text-[9px] text-white/40">{session.correctCount}/{session.correctCount + session.wrongCount} ✓</div>
                              </div>
                              <ChevronDown size={14} className={cn('text-white/30 transition', isExpanded && 'rotate-180')} />
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="p-3 pt-0 space-y-1.5">
                                {/* Stats row */}
                                <div className="grid grid-cols-4 gap-1 text-center mb-2">
                                  <div className="rounded-lg p-1.5 bg-green-500/10"><div className="text-sm font-bold text-green-400 tabular">{session.correctCount}</div><div className="text-[8px] text-white/40">Correct</div></div>
                                  <div className="rounded-lg p-1.5 bg-red-500/10"><div className="text-sm font-bold text-red-400 tabular">{session.wrongCount}</div><div className="text-[8px] text-white/40">Wrong</div></div>
                                  <div className="rounded-lg p-1.5 bg-white/5"><div className="text-sm font-bold text-white/40 tabular">{session.skippedCount}</div><div className="text-[8px] text-white/40">Skip</div></div>
                                  <div className="rounded-lg p-1.5 bg-amber-500/10"><div className="text-sm font-bold text-amber-400 tabular">{session.unmarkedCount}</div><div className="text-[8px] text-white/40">Unmarked</div></div>
                                </div>

                                {/* Per-question detail */}
                                {session.questions.map((q, qi) => {
                                  const qExpanded = expandedQ === qi && expandedSession === session.id;
                                  const qColor = q.result === 'correct' ? '#22c55e' : q.result === 'wrong' ? '#ef4444' : 'rgba(255,255,255,0.15)';
                                  return (
                                    <div key={qi} className="rounded-lg overflow-hidden" style={{ borderLeft: `2px solid ${qColor}` }}>
                                      <div className="p-2 flex items-center gap-2 bg-white/[0.02]" onClick={() => {
                                        if (qExpanded) { setExpandedQ(null); setExpandedSession(null); }
                                        else { setExpandedQ(qi); setExpandedSession(session.id); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); }
                                      }}>
                                        <span className="text-[10px] font-bold w-8" style={{ color: qColor }}>Q{q.number}</span>
                                        <span className="text-[10px] text-white/50 flex-1">{formatHM(q.timeSpentSec)} · {q.status}</span>
                                        {q.conceptNotes && <span className="text-amber-400/60 text-[10px]">📝</span>}
                                        <button onClick={(e) => { e.stopPropagation(); markQuestion(session.id, qi, q.result === 'correct' ? 'unmarked' : 'correct'); }} className={cn('w-5 h-5 rounded flex items-center justify-center', q.result === 'correct' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30')}><Check size={10} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); markQuestion(session.id, qi, q.result === 'wrong' ? 'unmarked' : 'wrong'); }} className={cn('w-5 h-5 rounded flex items-center justify-center', q.result === 'wrong' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/30')}><AlertCircle size={10} /></button>
                                      </div>
                                      {qExpanded && (
                                        <div className="p-2 bg-white/[0.02] space-y-1.5">
                                          {q.conceptNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Concept:</span> {q.conceptNotes}</div>}
                                          {q.formulaNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Formula:</span> {q.formulaNotes}</div>}
                                          <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="Concept notes..." className="w-full p-1.5 rounded bg-white/5 text-[10px] h-10 resize-none" />
                                          <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Formula..." className="w-full p-1.5 rounded bg-white/5 text-[10px] h-8 resize-none" />
                                          <button onClick={() => { saveNotes(session.id, qi, conceptDraft, formulaDraft); setExpandedQ(null); }} className="w-full py-1.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-semibold">Save</button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <p className="text-[9px] text-blue-200/30 text-center mt-4">📚 Practice History · Tap a session to see per-question detail · Toggle revision filter for wrong questions</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
