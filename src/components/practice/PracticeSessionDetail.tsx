'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, Pencil, Check, XCircle, Clock, Eye, Save,
  Calendar, BookOpen, Timer, Target, AlertCircle,
} from 'lucide-react';
import { usePractice, type PracticeSession, type PracticeQuestion } from '@/lib/store/practice';
import { cn, vibrate, formatHMS } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS: Record<string, string> = { A: '#3b82f6', B: '#22c55e', C: '#f59e0b', D: '#ef4444' };

interface Props {
  sessionId: string;
  focusQIndex?: number;
  onClose: () => void;
}

/** A question is "set" if it has a marked correct answer OR any notes. */
function questionIsSet(q: PracticeQuestion) {
  return !!q.correctAnswer || !!q.conceptNotes || !!q.formulaNotes;
}

/** A session is "set" if any question is set → eligible for the Edit button. */
function sessionIsSet(session: PracticeSession) {
  return session.questions.some(questionIsSet);
}

export function PracticeSessionDetail({ sessionId, focusQIndex, onClose }: Props) {
  const session = usePractice((s) => s.history.find((h) => h.id === sessionId));
  const markCorrectAnswer = usePractice((s) => s.markCorrectAnswer);
  const saveNotes = usePractice((s) => s.saveNotes);

  const [isEditing, setIsEditing] = useState(false);
  const [openNoteIdx, setOpenNoteIdx] = useState<number | null>(null);
  // Draft notes buffer keyed by question index — only filled when entering edit mode.
  const [draftNotes, setDraftNotes] = useState<Record<number, { concept: string; formula: string }>>({});

  const focusRef = useRef<HTMLDivElement | null>(null);

  // Scroll the focused question into view on mount (used when navigated from Wrong-Q list).
  useEffect(() => {
    if (focusQIndex !== undefined && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setOpenNoteIdx(focusQIndex);
    }
  }, [focusQIndex]);

  // Close on hardware back / Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing, onClose]);

  if (!session) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <div className="text-center">
            <AlertCircle size={32} className="text-white/40 mx-auto mb-2" />
            <p className="text-white/60 text-sm">Session not found.</p>
            <p className="text-white/40 text-[10px] mt-1">It may have been deleted.</p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const date = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const totalMarked = session.correctCount + session.wrongCount;
  const accuracy = totalMarked > 0 ? Math.round((session.correctCount / totalMarked) * 100) : 0;
  const accColor = accuracy >= 70 ? '#22c55e' : accuracy >= 40 ? '#f59e0b' : '#ef4444';
  const isSet = sessionIsSet(session);

  function enterEditMode() {
    vibrate(10);
    const drafts: Record<number, { concept: string; formula: string }> = {};
    session!.questions.forEach((q, i) => {
      drafts[i] = { concept: q.conceptNotes || '', formula: q.formulaNotes || '' };
    });
    setDraftNotes(drafts);
    setIsEditing(true);
    setOpenNoteIdx(null);
  }

  function exitEditMode() {
    vibrate(8);
    setIsEditing(false);
    setDraftNotes({});
  }

  function persistNotes(qIndex: number) {
    const draft = draftNotes[qIndex];
    if (!draft) return;
    saveNotes(session!.id, qIndex, draft.concept, draft.formula);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col"
      >
        {/* ============ Top App Bar ============ */}
        <div className="shrink-0 px-3 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isEditing) {
                  exitEditMode();
                } else {
                  vibrate(8);
                  onClose();
                }
              }}
              className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/80 hover:bg-white/10 transition shrink-0"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold truncate">{session.name}</h2>
                {isSet && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">
                    SET
                  </span>
                )}
                {isEditing && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold shrink-0">
                    EDITING
                  </span>
                )}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5 truncate">
                {session.subject} · {session.chapter}
              </div>
            </div>

            {/* Right-side action: Edit or Done */}
            {isEditing ? (
              <button
                onClick={exitEditMode}
                className="px-3 h-9 rounded-xl bg-green-500/20 text-green-400 text-xs font-bold flex items-center gap-1 active:scale-95 transition shrink-0"
              >
                <Check size={14} /> Done
              </button>
            ) : isSet ? (
              <button
                onClick={enterEditMode}
                className="px-3 h-9 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1 active:scale-95 transition shrink-0"
              >
                <Pencil size={13} /> Edit
              </button>
            ) : null}
          </div>
        </div>

        {/* ============ Scrollable body ============ */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Hero accuracy card */}
          <div
            className={cn(
              'rounded-2xl p-4 flex items-center gap-4',
              isEditing && 'ring-1 ring-amber-400/40'
            )}
            style={{
              background: `linear-gradient(135deg, ${accColor}22, ${accColor}08)`,
              border: `1px solid ${accColor}40`,
            }}
          >
            <div className="shrink-0">
              <div className="text-3xl font-bold tabular leading-none" style={{ color: accColor }}>
                {accuracy > 0 ? `${accuracy}%` : '—'}
              </div>
              <div className="text-[9px] text-white/40 uppercase tracking-wide mt-1">Accuracy</div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-y-1.5 gap-x-3 text-[10px]">
              <Meta icon={Calendar} label={dateStr} />
              <Meta icon={Clock} label={`${timeStr} · ${formatHMS(session.totalTimeSec)}`} />
              <Meta icon={BookOpen} label={`${session.questions.length} questions`} />
              <Meta icon={Target} label={`${totalMarked} marked`} />
            </div>
          </div>

          {/* Read-only banner for not-set sessions */}
          {!isSet && !isEditing && (
            <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 text-[10px]">
              <Eye size={12} /> Read-only report — no answers marked for this session
            </div>
          )}

          {/* Edit mode banner */}
          {isEditing && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-medium">
              <Pencil size={12} /> Edit Mode — tap A/B/C/D to change correct answer · Done to finish
            </div>
          )}

          {/* Stats chips */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatChip color="#22c55e" value={session.correctCount} label="Right" />
            <StatChip color="#ef4444" value={session.wrongCount} label="Wrong" />
            <StatChip color="#94a3b8" value={session.skippedCount} label="Skip" />
            <StatChip color="#f59e0b" value={session.unmarkedCount} label="Unset" />
          </div>

          {/* Question list */}
          <div className="space-y-2">
            {session.questions.map((q, qi) => {
              const isFocus = focusQIndex === qi;
              const isNoteOpen = openNoteIdx === qi;
              const draft = draftNotes[qi] || { concept: q.conceptNotes || '', formula: q.formulaNotes || '' };

              const qColor =
                q.result === 'correct' ? '#22c55e' : q.result === 'wrong' ? '#ef4444' : '#94a3b8';
              const ResultIcon = q.result === 'correct' ? Check : q.result === 'wrong' ? XCircle : null;

              return (
                <div
                  key={qi}
                  ref={isFocus ? focusRef : null}
                  className={cn(
                    'rounded-xl overflow-hidden bg-white/[0.02] transition',
                    isFocus && 'ring-2 ring-amber-400/60',
                    isEditing && 'bg-white/[0.04]'
                  )}
                  style={{ borderLeft: `3px solid ${qColor}` }}
                >
                  {/* Row header */}
                  <div className="p-3 flex items-center gap-2.5">
                    <span
                      className="text-xs font-bold w-8 shrink-0 tabular"
                      style={{ color: qColor }}
                    >
                      Q{q.number}
                    </span>

                    <span className="text-[10px] text-white/40 tabular flex items-center gap-1 shrink-0">
                      <Clock size={9} /> {formatHMS(q.timeSpentSec)}
                    </span>

                    {/* User answer */}
                    {q.userAnswer ? (
                      <span className="text-[10px] text-white/70">
                        You: <span className="font-bold" style={{ color: OPTION_COLORS[q.userAnswer] || '#fff' }}>{q.userAnswer}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30 italic">No answer</span>
                    )}

                    <div className="flex-1" />

                    {/* Correct answer (read-only when not editing) */}
                    {!isEditing && q.correctAnswer && (
                      <span className="text-[10px] text-white/70">
                        Ans: <span className="font-bold" style={{ color: qColor }}>{q.correctAnswer}</span>
                      </span>
                    )}

                    {/* Result icon */}
                    {ResultIcon && <ResultIcon size={13} style={{ color: qColor }} />}

                    {/* Notes toggle */}
                    {(q.conceptNotes || q.formulaNotes || isEditing) && (
                      <button
                        onClick={() => {
                          vibrate(6);
                          setOpenNoteIdx(isNoteOpen ? null : qi);
                        }}
                        className="text-[10px] text-amber-400/70 hover:text-amber-400 transition shrink-0 w-5 h-5 flex items-center justify-center rounded"
                        aria-label="Toggle notes"
                      >
                        {isNoteOpen ? '−' : '+'}
                      </button>
                    )}
                  </div>

                  {/* Editable A/B/C/D — only in Edit mode */}
                  {isEditing && (
                    <div className="px-3 pb-3 flex gap-1.5">
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
                              'flex-1 py-2 rounded-lg text-[11px] font-bold transition border',
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
                    <div className="px-3 pb-3 space-y-2">
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
                            className="w-full p-2 rounded-lg bg-white/5 text-[11px] h-14 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
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
                            className="w-full p-2 rounded-lg bg-white/5 text-[11px] h-12 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                          />
                          <button
                            onClick={() => { persistNotes(qi); vibrate(10); }}
                            className="w-full py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-95 transition"
                          >
                            <Save size={11} /> Save Notes
                          </button>
                        </>
                      ) : (
                        <>
                          {q.conceptNotes && (
                            <div className="text-[11px] text-white/70 leading-snug">
                              <span className="text-amber-400/70 font-bold">Concept:</span> {q.conceptNotes}
                            </div>
                          )}
                          {q.formulaNotes && (
                            <div className="text-[11px] text-white/70 leading-snug">
                              <span className="text-amber-400/70 font-bold">Formula:</span> {q.formulaNotes}
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

          <p className="text-[9px] text-white/40 text-center pt-2 leading-relaxed">
            {isEditing
              ? 'Changes save automatically when you tap A/B/C/D or close the panel.'
              : isSet
                ? 'Tap Edit to mark correct answers or update notes.'
                : 'Detail report view — no markings to edit.'}
          </p>
        </div>

        {/* ============ Sticky bottom action (only when editing) ============ */}
        {isEditing && (
          <div className="shrink-0 p-3 border-t border-white/5 bg-black/80 backdrop-blur">
            <button
              onClick={exitEditMode}
              className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Check size={16} /> Done Editing
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- small building blocks ---------- */

function Meta({ icon: Icon, label }: { icon: typeof Calendar; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-white/70 min-w-0">
      <Icon size={10} className="shrink-0 text-white/40" />
      <span className="truncate text-[10px]">{label}</span>
    </div>
  );
}

function StatChip({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="rounded-xl p-2 text-center" style={{ background: `${color}1a` }}>
      <div className="text-base font-bold tabular leading-none" style={{ color }}>{value}</div>
      <div className="text-[8px] text-white/50 mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}
