'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ChevronDown, Filter, Save } from 'lucide-react';
import { usePractice, type PracticeSession } from '@/lib/store/practice';
import { formatHMS, formatHM, cn, vibrate } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PracticeHistorySheet({ open, onClose }: Props) {
  const history = usePractice((s) => s.history);
  const markCorrectAnswer = usePractice((s) => s.markCorrectAnswer);
  const saveNotes = usePractice((s) => s.saveNotes);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null); // unique key: sessionId-qIndex
  const [filterWrong, setFilterWrong] = useState(false);
  const [conceptDraft, setConceptDraft] = useState('');
  const [formulaDraft, setFormulaDraft] = useState('');

  const sortedHistory = useMemo(() => [...history].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)), [history]);

  const totalSessions = history.length;
  const totalQuestions = history.reduce((a, s) => a + s.questions.length, 0);
  const totalCorrect = history.reduce((a, s) => a + s.correctCount, 0);
  const totalWrong = history.reduce((a, s) => a + s.wrongCount, 0);
  const overallAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;

  // Only truly wrong questions for revision
  const wrongQuestions = useMemo(() => {
    const wrong: { session: PracticeSession; qIndex: number }[] = [];
    for (const session of sortedHistory) {
      session.questions.forEach((q, i) => {
        if (q.result === 'wrong') wrong.push({ session, qIndex: i });
      });
    }
    return wrong;
  }, [sortedHistory]);

  const qKey = (sid: string, qi: number) => `${sid}-${qi}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[88vh] overflow-y-auto force-dark-ui rounded-3xl"
            style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #0d1320 50%, #0a0f1a 100%)', border: '1px solid rgba(59,130,241,0.25)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 mt-3" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"><X size={16} /></button>

            {/* Header */}
            <div className="text-center mb-4 px-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center mx-auto mb-2 border border-blue-500/30">
                <BookOpen size={24} className="text-blue-300" />
              </div>
              <h2 className="text-lg font-bold text-white">Practice History</h2>
              <p className="text-[11px] text-blue-200/50 mt-0.5">{totalSessions} sessions · {totalQuestions} questions · {overallAccuracy}% accuracy</p>
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
                  {/* Toggle: All sessions vs Wrong questions revision */}
                  <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4">
                    <button onClick={() => setFilterWrong(false)}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition', !filterWrong ? 'bg-blue-500/30 text-blue-200' : 'text-white/40')}>
                      All Sessions ({totalSessions})
                    </button>
                    <button onClick={() => setFilterWrong(true)}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition', filterWrong ? 'bg-red-500/30 text-red-200' : 'text-white/40')}>
                      Wrong Q ({wrongQuestions.length})
                    </button>
                  </div>

                  {/* === Revision view (wrong questions only) === */}
                  {filterWrong && (
                    <div>
                      {wrongQuestions.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-green-400/60 text-sm">No wrong questions! 🎉</p>
                          <p className="text-white/30 text-[10px] mt-1">Mark correct answers in your sessions to populate this list.</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {wrongQuestions.map(({ session, qIndex }) => {
                            const q = session.questions[qIndex];
                            const key = qKey(session.id, qIndex);
                            const isExpanded = expandedQ === key;
                            return (
                              <div key={key} className="rounded-xl overflow-hidden" style={{ borderLeft: '3px solid #ef4444' }}>
                                <div className="glass p-2.5 flex items-center gap-2" onClick={() => {
                                  if (isExpanded) { setExpandedQ(null); }
                                  else { setExpandedQ(key); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); }
                                }}>
                                  <span className="text-[10px] font-bold text-red-400 w-10 shrink-0">{session.subject.slice(0, 4)} Q{q.number}</span>
                                  <span className="text-[10px] text-white/50 flex-1 min-w-0 truncate">
                                    {formatHMS(q.timeSpentSec)} · {session.chapter}
                                    {q.userAnswer && <span className="text-white/70 ml-1">You:{q.userAnswer}</span>}
                                    {q.correctAnswer && <span className="text-red-300 ml-1">Ans:{q.correctAnswer}</span>}
                                    {q.conceptNotes && <span className="text-amber-400/60 ml-1">📝</span>}
                                  </span>
                                  <ChevronDown size={12} className={cn('text-white/30 transition shrink-0', isExpanded && 'rotate-180')} />
                                </div>
                                {isExpanded && (
                                  <div className="p-2.5 bg-white/[0.02] space-y-2">
                                    {q.conceptNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Concept:</span> {q.conceptNotes}</div>}
                                    {q.formulaNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Formula:</span> {q.formulaNotes}</div>}
                                    {/* Change correct answer */}
                                    <div className="flex gap-1">
                                      {OPTIONS.map((opt) => {
                                        const isSelected = q.correctAnswer === opt;
                                        const optIdx = OPTIONS.indexOf(opt);
                                        const isYourAnswer = q.userAnswer === opt;
                                        return (
                                          <button key={opt} onClick={() => { vibrate(10); markCorrectAnswer(session.id, qIndex, isSelected ? null : opt); }}
                                            className={cn('flex-1 py-1.5 rounded text-[10px] font-bold transition border', isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10')}
                                            style={isSelected ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx] } : isYourAnswer ? { borderColor: `${OPTION_COLORS[optIdx]}80`, color: OPTION_COLORS[optIdx] } : {}}>
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="Edit concept notes..." className="w-full p-2 rounded-lg bg-white/5 text-xs h-12 resize-none" />
                                    <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Edit formula notes..." className="w-full p-2 rounded-lg bg-white/5 text-xs h-10 resize-none" />
                                    <button onClick={() => { saveNotes(session.id, qIndex, conceptDraft, formulaDraft); vibrate(10); setExpandedQ(null); }}
                                      className="w-full py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition">
                                      <Save size={10} /> Save
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                              <div className="text-center min-w-[36px]">
                                <div className="text-[10px] text-white/40">{dateStr.split(' ')[0]}</div>
                                <div className="text-sm font-bold">{date.getDate()}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{session.name}</div>
                                <div className="text-[10px] text-white/40">
                                  {timeStr} · {formatHMS(session.totalTimeSec)} · {session.questions.length}Q
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-base font-bold tabular" style={{ color: accuracy > 0 ? accColor : 'rgba(255,255,255,0.3)' }}>
                                  {accuracy > 0 ? `${accuracy}%` : '?'}
                                </div>
                                <div className="text-[9px] text-white/40">{session.correctCount}/{session.correctCount + session.wrongCount} ✓</div>
                              </div>
                              <ChevronDown size={14} className={cn('text-white/30 transition shrink-0', isExpanded && 'rotate-180')} />
                            </button>

                            {/* Expanded: per-question with inline A/B/C/D */}
                            {isExpanded && (
                              <div className="p-2 pt-0 space-y-1">
                                {/* Stats row */}
                                <div className="grid grid-cols-4 gap-1 text-center mb-2">
                                  <div className="rounded-lg p-1.5 bg-green-500/10"><div className="text-xs font-bold text-green-400 tabular">{session.correctCount}</div><div className="text-[8px] text-white/40">✓</div></div>
                                  <div className="rounded-lg p-1.5 bg-red-500/10"><div className="text-xs font-bold text-red-400 tabular">{session.wrongCount}</div><div className="text-[8px] text-white/40">✗</div></div>
                                  <div className="rounded-lg p-1.5 bg-white/5"><div className="text-xs font-bold text-white/40 tabular">{session.skippedCount}</div><div className="text-[8px] text-white/40">Skip</div></div>
                                  <div className="rounded-lg p-1.5 bg-amber-500/10"><div className="text-xs font-bold text-amber-400 tabular">{session.unmarkedCount}</div><div className="text-[8px] text-white/40">?</div></div>
                                </div>

                                {/* Per-question rows with inline A/B/C/D */}
                                {session.questions.map((q, qi) => {
                                  const key = qKey(session.id, qi);
                                  const qExpanded = expandedQ === key;
                                  const qColor = q.result === 'correct' ? '#22c55e' : q.result === 'wrong' ? '#ef4444' : 'rgba(255,255,255,0.4)';
                                  return (
                                    <div key={qi} className="rounded-lg overflow-hidden" style={{ borderLeft: `2px solid ${qColor}` }}>
                                      <div className="p-1.5 flex items-center gap-1.5 bg-white/[0.02]">
                                        <span className="text-[10px] font-bold w-7 shrink-0" style={{ color: qColor }}>Q{q.number}</span>
                                        <span className="text-[9px] text-white/50 flex-1 min-w-0 truncate">
                                          {formatHMS(q.timeSpentSec)}
                                          {q.userAnswer && <span className="text-white/70 ml-1">You:{q.userAnswer}</span>}
                                          {q.conceptNotes && <span className="text-amber-400/60 ml-1">📝</span>}
                                        </span>
                                        {/* Inline A/B/C/D */}
                                        <div className="flex gap-0.5 shrink-0">
                                          {OPTIONS.map((opt) => {
                                            const isSelected = q.correctAnswer === opt;
                                            const optIdx = OPTIONS.indexOf(opt);
                                            const isYourAnswer = q.userAnswer === opt;
                                            return (
                                              <button key={opt} onClick={() => { vibrate(8); markCorrectAnswer(session.id, qi, isSelected ? null : opt); }}
                                                className={cn('w-5 h-5 rounded text-[9px] font-bold transition border', isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10')}
                                                style={isSelected ? { background: OPTION_COLORS[optIdx], borderColor: OPTION_COLORS[optIdx] } : isYourAnswer ? { borderColor: `${OPTION_COLORS[optIdx]}80`, color: OPTION_COLORS[optIdx] } : {}}>
                                                {opt}
                                              </button>
                                            );
                                          })}
                                        </div>
                                        {/* Expand for notes */}
                                        <button onClick={() => { if (qExpanded) { setExpandedQ(null); } else { setExpandedQ(key); setConceptDraft(q.conceptNotes || ''); setFormulaDraft(q.formulaNotes || ''); } }}
                                          className="text-[9px] text-amber-400/50 hover:text-amber-400 transition shrink-0 w-4">{qExpanded ? '−' : '+'}</button>
                                      </div>
                                      {qExpanded && (
                                        <div className="p-2 bg-white/[0.02] space-y-1.5">
                                          {q.conceptNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Concept:</span> {q.conceptNotes}</div>}
                                          {q.formulaNotes && <div className="text-[10px] text-white/60"><span className="text-amber-400/60">Formula:</span> {q.formulaNotes}</div>}
                                          <textarea value={conceptDraft} onChange={(e) => setConceptDraft(e.target.value)} placeholder="Concept notes..." className="w-full p-1.5 rounded bg-white/5 text-[10px] h-10 resize-none" />
                                          <textarea value={formulaDraft} onChange={(e) => setFormulaDraft(e.target.value)} placeholder="Formula..." className="w-full p-1.5 rounded bg-white/5 text-[10px] h-8 resize-none" />
                                          <button onClick={() => { saveNotes(session.id, qi, conceptDraft, formulaDraft); vibrate(8); setExpandedQ(null); }}
                                            className="w-full py-1.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-semibold flex items-center justify-center gap-1">Save</button>
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

              <p className="text-[9px] text-blue-200/30 text-center mt-4">📚 Practice History · Tap session to expand · Tap A/B/C/D to mark correct answer · + for notes</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
