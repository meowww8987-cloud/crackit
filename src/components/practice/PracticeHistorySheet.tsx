'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ChevronDown, Filter, Save, Pencil, Check, XCircle, Clock, Eye } from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { formatHMS, cn, vibrate } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS: Record<string, string> = { A: '#3b82f6', B: '#22c55e', C: '#f59e0b', D: '#ef4444' };

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
 *  → Edit button shown when session is expanded.
 */
function sessionIsSet(session: PracticeSession) {
  return session.questions.some(questionIsSet);
}

export function PracticeHistorySheet({ open, onClose }: Props) {
  const history = usePractice((s) => s.history);
  const markCorrectAnswer = usePractice((s) => s.markCorrectAnswer);
  const saveNotes = usePractice((s) => s.saveNotes);

  const [view, setView] = useState<'sessions' | 'wrong'>('sessions');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  // Tracks which session is currently in Edit mode (only one at a time).
  const [editingSession, setEditingSession] = useState<string | null>(null);

  // Per-question expand (notes preview) state — keyed by `${sessionId}:${qIndex}`.
  const [openNote, setOpenNote] = useState<string | null>(null);

  // Draft buffers for editable fields — only used while a session is in Edit mode.
  const [draftNotes, setDraftNotes] = useState<Record<number, { concept: string; formula: string }>>({});

  // Reset transient state when sheet closes.
  useEffect(() => {
    if (!open) {
      setExpandedSession(null);
      setEditingSession(null);
      setOpenNote(null);
      setView('sessions');
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

  const qKey = (sid: string, qi: number) => `${sid}:${qi}`;

  /** Enter Edit mode for a session — pre-fill draft buffers from current data. */
  function enterEditMode(session: PracticeSession) {
    vibrate(10);
    const drafts: Record<number, { concept: string; formula: string }> = {};
    session.questions.forEach((q, i) => {
      drafts[i] = { concept: q.conceptNotes || '', formula: q.formulaNotes || '' };
    });
    setDraftNotes(drafts);
    setEditingSession(session.id);
    setOpenNote(null);
  }

  /** Exit Edit mode — discard any unsaved local draft state. */
  function exitEditMode() {
    vibrate(8);
    setEditingSession(null);
    setDraftNotes({});
  }

  /** Persist a single question's notes from the draft buffer. */
  function persistNotes(session: PracticeSession, qIndex: number) {
    const draft = draftNotes[qIndex];
    if (!draft) return;
    saveNotes(session.id, qIndex, draft.concept, draft.formula);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

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
                            const key = qKey(session.id, qIndex);
                            const isEditingQ = editingSession === session.id;
                            const isSet = questionIsSet(q);
                            const isNoteOpen = openNote === key;
                            const draft = draftNotes[qIndex] || { concept: q.conceptNotes || '', formula: q.formulaNotes || '' };

                            return (
                              <div
                                key={key}
                                className="rounded-xl overflow-hidden glass"
                                style={{ borderLeft: '3px solid #ef4444' }}
                              >
                                {/* Row header */}
                                <button
                                  onClick={() => {
                                    vibrate(8);
                                    setOpenNote(isNoteOpen ? null : key);
                                  }}
                                  className="w-full p-3 flex items-center gap-2 text-left"
                                >
                                  <span className="text-[10px] font-bold text-red-400 w-12 shrink-0">
                                    {session.subject.slice(0, 4)} Q{q.number}
                                  </span>
                                  <span className="text-[10px] text-white/50 flex-1 min-w-0 truncate">
                                    {formatHMS(q.timeSpentSec)} · {session.chapter}
                                  </span>
                                  {q.userAnswer && (
                                    <span className="text-[10px] text-white/70">You: {q.userAnswer}</span>
                                  )}
                                  {q.correctAnswer && (
                                    <span className="text-[10px] text-red-300">Ans: {q.correctAnswer}</span>
                                  )}
                                  {isSet && (
                                    <Pencil size={11} className="text-amber-400/70 shrink-0" />
                                  )}
                                  <ChevronDown
                                    size={12}
                                    className={cn('text-white/30 transition shrink-0', isNoteOpen && 'rotate-180')}
                                  />
                                </button>

                                {/* Expanded body */}
                                {isNoteOpen && (
                                  <div className="p-3 pt-0 space-y-2.5">
                                    {/* Read-only answer strip when not editing */}
                                    {!isEditingQ && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-white/40 uppercase tracking-wide w-12 shrink-0">Correct</span>
                                        {q.correctAnswer ? (
                                          <span
                                            className="px-2 py-1 rounded text-[10px] font-bold text-white"
                                            style={{ background: OPTION_COLORS[q.correctAnswer] }}
                                          >
                                            {q.correctAnswer}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-white/40">— not marked —</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Editable A/B/C/D only when this session is in edit mode */}
                                    {isEditingQ && (
                                      <div>
                                        <span className="text-[9px] text-white/40 uppercase tracking-wide block mb-1">Mark correct</span>
                                        <div className="flex gap-1">
                                          {OPTIONS.map((opt) => {
                                            const isSelected = q.correctAnswer === opt;
                                            const isYourAnswer = q.userAnswer === opt;
                                            return (
                                              <button
                                                key={opt}
                                                onClick={() => {
                                                  vibrate(8);
                                                  markCorrectAnswer(session.id, qIndex, isSelected ? null : opt);
                                                }}
                                                className={cn(
                                                  'flex-1 py-1.5 rounded text-[10px] font-bold transition border',
                                                  isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10'
                                                )}
                                                style={
                                                  isSelected
                                                    ? { background: OPTION_COLORS[opt], borderColor: OPTION_COLORS[opt] }
                                                    : isYourAnswer
                                                      ? { borderColor: `${OPTION_COLORS[opt]}80`, color: OPTION_COLORS[opt] }
                                                      : {}
                                                }
                                              >
                                                {opt}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Notes display / edit */}
                                    {isEditingQ ? (
                                      <>
                                        <textarea
                                          value={draft.concept}
                                          onChange={(e) =>
                                            setDraftNotes((p) => ({
                                              ...p,
                                              [qIndex]: { ...p[qIndex], concept: e.target.value },
                                            }))
                                          }
                                          placeholder="Concept notes…"
                                          className="w-full p-2 rounded-lg bg-white/5 text-xs h-12 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                        />
                                        <textarea
                                          value={draft.formula}
                                          onChange={(e) =>
                                            setDraftNotes((p) => ({
                                              ...p,
                                              [qIndex]: { ...p[qIndex], formula: e.target.value },
                                            }))
                                          }
                                          placeholder="Formula notes…"
                                          className="w-full p-2 rounded-lg bg-white/5 text-xs h-10 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                        />
                                        <button
                                          onClick={() => { persistNotes(session, qIndex); vibrate(10); }}
                                          className="w-full py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition"
                                        >
                                          <Save size={11} /> Save Notes
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {q.conceptNotes && (
                                          <div className="text-[10px] text-white/60">
                                            <span className="text-amber-400/60">Concept:</span> {q.conceptNotes}
                                          </div>
                                        )}
                                        {q.formulaNotes && (
                                          <div className="text-[10px] text-white/60">
                                            <span className="text-amber-400/60">Formula:</span> {q.formulaNotes}
                                          </div>
                                        )}
                                        {!q.conceptNotes && !q.formulaNotes && (
                                          <p className="text-[10px] text-white/30 italic">No notes recorded.</p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
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
                        const isExpanded = expandedSession === session.id;
                        const isEditing = editingSession === session.id;
                        const isSet = sessionIsSet(session);
                        const date = new Date(session.startedAt);
                        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const accuracy = session.correctCount + session.wrongCount > 0
                          ? Math.round((session.correctCount / (session.correctCount + session.wrongCount)) * 100)
                          : 0;
                        const accColor = accuracy >= 70 ? '#22c55e' : accuracy >= 40 ? '#f59e0b' : '#ef4444';

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              'glass rounded-2xl overflow-hidden transition',
                              isEditing && 'ring-1 ring-amber-400/40'
                            )}
                          >
                            {/* Session header */}
                            <button
                              onClick={() => {
                                vibrate(8);
                                if (isEditing) return; // don't collapse while editing
                                setExpandedSession(isExpanded ? null : session.id);
                              }}
                              className="w-full p-3 flex items-center gap-3 text-left"
                            >
                              {/* Date pill */}
                              <div className="text-center min-w-[38px] shrink-0">
                                <div className="text-[9px] text-white/40 uppercase">{dateStr.split(' ')[0]}</div>
                                <div className="text-sm font-bold">{date.getDate()}</div>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{session.name}</div>
                                <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                                  <Clock size={9} className="inline" />
                                  {timeStr}
                                  <span className="opacity-40">·</span>
                                  {formatHMS(session.totalTimeSec)}
                                  <span className="opacity-40">·</span>
                                  {session.questions.length}Q
                                  {isSet && (
                                    <span className="ml-1 text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                                      SET
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className="text-base font-bold tabular leading-none"
                                  style={{ color: accuracy > 0 ? accColor : 'rgba(255,255,255,0.3)' }}
                                >
                                  {accuracy > 0 ? `${accuracy}%` : '—'}
                                </div>
                                <div className="text-[9px] text-white/40 mt-0.5">
                                  {session.correctCount}/{session.correctCount + session.wrongCount} ✓
                                </div>
                              </div>

                              <ChevronDown
                                size={14}
                                className={cn('text-white/30 transition shrink-0', isExpanded && 'rotate-180')}
                              />
                            </button>

                            {/* Expanded: Detail Report */}
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-1 space-y-3">
                                {/* Status banner when editing */}
                                {isEditing && (
                                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                      <Pencil size={11} /> Edit Mode — tap A/B/C/D to change correct answer
                                    </span>
                                  </div>
                                )}

                                {/* Stats row */}
                                <div className="grid grid-cols-4 gap-1.5">
                                  <StatChip color="#22c55e" value={session.correctCount} label="Right" />
                                  <StatChip color="#ef4444" value={session.wrongCount} label="Wrong" />
                                  <StatChip color="#94a3b8" value={session.skippedCount} label="Skip" />
                                  <StatChip color="#f59e0b" value={session.unmarkedCount} label="Unset" />
                                </div>

                                {/* Question list */}
                                <div className="space-y-1.5">
                                  {session.questions.map((q, qi) => {
                                    const key = qKey(session.id, qi);
                                    const isNoteOpen = openNote === key;
                                    const draft = draftNotes[qi] || { concept: q.conceptNotes || '', formula: q.formulaNotes || '' };

                                    const qColor =
                                      q.result === 'correct'
                                        ? '#22c55e'
                                        : q.result === 'wrong'
                                          ? '#ef4444'
                                          : '#94a3b8';

                                    const ResultIcon = q.result === 'correct' ? Check : q.result === 'wrong' ? XCircle : null;

                                    return (
                                      <div
                                        key={qi}
                                        className="rounded-lg overflow-hidden bg-white/[0.02]"
                                        style={{ borderLeft: `2px solid ${qColor}` }}
                                      >
                                        {/* Row header */}
                                        <div className="p-2 flex items-center gap-2">
                                          <span className="text-[10px] font-bold w-7 shrink-0" style={{ color: qColor }}>
                                            Q{q.number}
                                          </span>

                                          <span className="text-[9px] text-white/40 tabular">{formatHMS(q.timeSpentSec)}</span>

                                          {/* User answer */}
                                          {q.userAnswer ? (
                                            <span className="text-[9px] text-white/60">
                                              You: <span className="font-bold">{q.userAnswer}</span>
                                            </span>
                                          ) : (
                                            <span className="text-[9px] text-white/30">No answer</span>
                                          )}

                                          <div className="flex-1" />

                                          {/* Correct answer display (read-only when not editing) */}
                                          {!isEditing && q.correctAnswer && (
                                            <span className="text-[9px] text-white/60">
                                              Ans: <span className="font-bold" style={{ color: qColor }}>{q.correctAnswer}</span>
                                            </span>
                                          )}

                                          {/* Result icon */}
                                          {ResultIcon && <ResultIcon size={11} style={{ color: qColor }} />}

                                          {/* Notes toggle — only if has notes, or in edit mode */}
                                          {(q.conceptNotes || q.formulaNotes || isEditing) && (
                                            <button
                                              onClick={() => {
                                                vibrate(6);
                                                setOpenNote(isNoteOpen ? null : key);
                                              }}
                                              className="text-[9px] text-amber-400/70 hover:text-amber-400 transition shrink-0 px-1"
                                              aria-label="Toggle notes"
                                            >
                                              {isNoteOpen ? '−' : '+'}
                                            </button>
                                          )}
                                        </div>

                                        {/* Editable A/B/C/D — only in Edit mode */}
                                        {isEditing && (
                                          <div className="px-2 pb-2 flex gap-1">
                                            {OPTIONS.map((opt) => {
                                              const isSelected = q.correctAnswer === opt;
                                              const isYourAnswer = q.userAnswer === opt;
                                              return (
                                                <button
                                                  key={opt}
                                                  onClick={() => {
                                                    vibrate(8);
                                                    markCorrectAnswer(session.id, qi, isSelected ? null : opt);
                                                  }}
                                                  className={cn(
                                                    'flex-1 py-1.5 rounded text-[9px] font-bold transition border',
                                                    isSelected ? 'text-white' : 'text-white/40 bg-white/5 border-white/10'
                                                  )}
                                                  style={
                                                    isSelected
                                                      ? { background: OPTION_COLORS[opt], borderColor: OPTION_COLORS[opt] }
                                                      : isYourAnswer
                                                        ? { borderColor: `${OPTION_COLORS[opt]}80`, color: OPTION_COLORS[opt] }
                                                        : {}
                                                  }
                                                >
                                                  {opt}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Notes panel */}
                                        {isNoteOpen && (
                                          <div className="px-2 pb-2 space-y-1.5">
                                            {isEditing ? (
                                              <>
                                                <textarea
                                                  value={draft.concept}
                                                  onChange={(e) =>
                                                    setDraftNotes((p) => ({
                                                      ...p,
                                                      [qi]: { ...p[qi], concept: e.target.value },
                                                    }))
                                                  }
                                                  placeholder="Concept notes…"
                                                  className="w-full p-1.5 rounded bg-white/5 text-[10px] h-9 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                                />
                                                <textarea
                                                  value={draft.formula}
                                                  onChange={(e) =>
                                                    setDraftNotes((p) => ({
                                                      ...p,
                                                      [qi]: { ...p[qi], formula: e.target.value },
                                                    }))
                                                  }
                                                  placeholder="Formula…"
                                                  className="w-full p-1.5 rounded bg-white/5 text-[10px] h-8 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                                                />
                                              </>
                                            ) : (
                                              <>
                                                {q.conceptNotes && (
                                                  <div className="text-[10px] text-white/60">
                                                    <span className="text-amber-400/60">Concept:</span> {q.conceptNotes}
                                                  </div>
                                                )}
                                                {q.formulaNotes && (
                                                  <div className="text-[10px] text-white/60">
                                                    <span className="text-amber-400/60">Formula:</span> {q.formulaNotes}
                                                  </div>
                                                )}
                                                {!q.conceptNotes && !q.formulaNotes && (
                                                  <p className="text-[10px] text-white/30 italic">No notes recorded.</p>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Action bar */}
                                <div className="pt-1">
                                  {isEditing ? (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={exitEditMode}
                                        className="flex-1 py-2 rounded-xl bg-white/5 text-white/70 text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                                      >
                                        <XCircle size={12} /> Done
                                      </button>
                                      <p className="text-[9px] text-white/40 self-center px-1 leading-tight">
                                        Changes save automatically when you tap A/B/C/D or close the panel.
                                      </p>
                                    </div>
                                  ) : isSet ? (
                                    <button
                                      onClick={() => enterEditMode(session)}
                                      className="w-full py-2 rounded-xl bg-amber-500/15 text-amber-400 text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                                    >
                                      <Pencil size={12} /> Edit
                                    </button>
                                  ) : (
                                    <div className="text-center py-1.5 flex items-center justify-center gap-1.5 text-white/30 text-[10px]">
                                      <Eye size={11} /> Read-only report — no answers marked for this session
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[9px] text-white/40 text-center mt-4 leading-relaxed">
                    Tap a session to expand the detail report.<br />
                    {view === 'sessions'
                      ? 'Sessions with marked answers show an Edit button — read-only until you tap Edit.'
                      : 'Tap a wrong question to view notes. Use the Sessions tab to enable Edit mode.'}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- small building blocks ---------- */

function StatChip({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: `${color}1a` }}>
      <div className="text-sm font-bold tabular leading-none" style={{ color }}>{value}</div>
      <div className="text-[8px] text-white/50 mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}
