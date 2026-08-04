'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Plus, Search, ChevronDown, Calendar, Clock, Sigma, Layers } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject, Lecture, SubjectEntity } from '@/lib/types';
import { cn, vibrate, isRevisionOverdue, todayKey } from '@/lib/utils';
import { LectureResourceRow } from '@/components/syllabus/LectureResourceRow';
import { LectureEditModal } from '@/components/syllabus/LectureEditModal';
import { AddChapterSheet } from '@/components/syllabus/AddChapterSheet';
import { BuildSyllabusSheet } from '@/components/syllabus/BuildSyllabusSheet';
import { FormulaVault } from '@/components/syllabus/FormulaVault';
import { AddLectureSheet } from '@/components/syllabus/AddLectureSheet';
import { triggerTimeline } from '@/components/app/AppShell';

type ProgressFilter = 'all' | 'studying' | 'next' | 'done' | 'overdue';

const EMPTY_TARGETS: import('@/lib/types').Target[] = [];

// Toast type — shared with AppShell via global trigger
let _showToast: (msg: string, sub?: string) => void = () => {};
export function setSyllabusToastHandler(fn: (msg: string, sub?: string) => void) { _showToast = fn; }

export function SyllabusTab() {
  const { subjects, chapters, lectures, deleteChapter } = useSyllabus();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [addChapterFor, setAddChapterFor] = useState<SubjectEntity | null>(null);
  const [addLectureFor, setAddLectureFor] = useState<{ chapter: import('@/lib/types').Chapter; subject: SubjectEntity } | null>(null);
  const [showBuildSheet, setShowBuildSheet] = useState(false);
  const [showFormulaVault, setShowFormulaVault] = useState(false);

  // Today's targets
  const todayTargets = useTargets((s) => s.byDate[todayKey()] || EMPTY_TARGETS);

  // Stats
  const doneCount = lectures.filter((l) => l.done).length;
  const studyingCount = lectures.filter((l) => {
    const res = [l.done, l.dppDone, l.notesDone, l.revisionDone].filter(Boolean).length;
    return res > 0 && res < 4;
  }).length;
  const nextCount = lectures.filter((l) => {
    const res = [l.done, l.dppDone, l.notesDone, l.revisionDone].filter(Boolean).length;
    return res === 0;
  }).length;
  const overdueCount = lectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt)).length;

  const filteredSubjects = useMemo(() => {
    if (subjectFilter === 'all') return subjects;
    return subjects.filter((s) => s.name === subjectFilter);
  }, [subjects, subjectFilter]);

  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* === Modern Header — title + search + timeline === */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Syllabus</h1>
        <div className="flex-1" />
        <button
          onClick={() => { triggerTimeline(); vibrate(10); }}
          className="shrink-0 w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-t-muted hover:text-teal-400 hover:bg-white/10 transition"
          title="Progress Timeline"
        >
          <Clock size={16} />
        </button>
      </div>

      {/* === Search bar (full width, clean) === */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters, lectures..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50 focus:bg-white/[0.07] transition"
        />
      </div>

      {/* === Summary stats — clean pill row === */}
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500 dark:text-green-400 font-semibold">
          ✓ {doneCount} done
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 font-semibold">
          ◐ {studyingCount} active
        </span>
        {overdueCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 dark:text-red-400 font-semibold">
            ⚠ {overdueCount} overdue
          </span>
        )}
        <span className="text-t-muted ml-auto">{lectures.length} total lectures</span>
      </div>

      {/* === Subject filter — single row, colored pills === */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        <FilterPill active={subjectFilter === 'all'} onClick={() => setSubjectFilter('all')}>
          All
        </FilterPill>
        {SUBJECTS.map((s) => (
          <FilterPill
            key={s}
            active={subjectFilter === s}
            onClick={() => setSubjectFilter(s)}
            color={subjectColor(s)}
          >
            {s}
          </FilterPill>
        ))}
      </div>

      {/* === Progress filter — compact pills === */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        <FilterPill small active={progressFilter === 'all'} onClick={() => setProgressFilter('all')}>All</FilterPill>
        <FilterPill small active={progressFilter === 'studying'} onClick={() => setProgressFilter('studying')}>Active</FilterPill>
        <FilterPill small active={progressFilter === 'next'} onClick={() => setProgressFilter('next')}>Next Up</FilterPill>
        <FilterPill small active={progressFilter === 'done'} onClick={() => setProgressFilter('done')}>Done</FilterPill>
        <FilterPill small active={progressFilter === 'overdue'} onClick={() => setProgressFilter('overdue')}>⚠ Overdue</FilterPill>
      </div>

      {/* === Actions — Build + Formula Vault side by side === */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { setShowBuildSheet(true); vibrate(10); }}
          className="py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition shadow-lg shadow-teal-500/20"
        >
          <Plus size={16} /> Build Syllabus
        </button>
        <button
          onClick={() => { setShowFormulaVault(true); vibrate(10); }}
          className="py-3 rounded-xl bg-white/5 border border-white/10 text-t-primary font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] hover:bg-white/10 transition"
        >
          <Sigma size={16} /> Formula Vault
        </button>
      </div>

      {/* === Empty state === */}
      {subjects.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={28} className="text-teal-500 dark:text-teal-400" />
          </div>
          <p className="text-t-primary text-sm font-semibold mb-1">No syllabus yet</p>
          <p className="text-t-muted text-xs">Tap "Build Syllabus" to select NEET chapters & lectures</p>
        </div>
      )}

      {/* === Subjects + Chapters === */}
      <div className="space-y-5">
        {filteredSubjects.map((subj) => {
          const color = subjectColor(subj.name);
          const subjChapters = chapters.filter((c) => c.subjectId === subj.id);
          if (subjectFilter !== 'all' && subj.name !== subjectFilter) return null;

          if (subjChapters.length === 0) {
            return (
              <div key={subj.id}>
                <SubjectHeader name={subj.name} color={color} count={0} onAdd={() => { setAddChapterFor(subj); vibrate(10); }} />
                <button
                  onClick={() => { setAddChapterFor(subj); vibrate(10); }}
                  className="w-full py-3 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  style={{ borderColor: `${color.hex}40`, color: color.hex }}
                >
                  <Plus size={14} /> Add Chapter
                </button>
              </div>
            );
          }

          return (
            <div key={subj.id} className="space-y-2">
              <SubjectHeader
                name={subj.name}
                color={color}
                count={subjChapters.length}
                onAdd={() => { setAddChapterFor(subj); vibrate(10); }}
              />
              {subjChapters.map((ch) => {
                const chLectures = lectures.filter((l) => l.chapterId === ch.id);
                const chOverdue = chLectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt)).length;

                // Resource counts
                const lecDone = chLectures.filter((l) => l.done).length;
                const dppDone = chLectures.filter((l) => l.dppDone).length;
                const notesDone = chLectures.filter((l) => l.notesDone).length;
                const revDone = chLectures.filter((l) => l.revisionDone).length;
                const totalResources = chLectures.length * 4;
                const doneResources = lecDone + dppDone + notesDone + revDone;
                const pct = totalResources > 0 ? Math.round((doneResources / totalResources) * 100) : 0;
                const isInProgress = doneResources > 0 && pct < 100;
                const isComplete = pct === 100 && chLectures.length > 0;

                // Apply filters
                if (progressFilter === 'done' && pct !== 100) return null;
                if (progressFilter === 'next' && doneResources > 0) return null;
                if (progressFilter === 'studying' && !isInProgress) return null;
                if (progressFilter === 'overdue' && chOverdue === 0) return null;
                if (search && !matchesSearch(ch.name) && !chLectures.some((l) => matchesSearch(l.topic))) return null;

                const chOpen = openChapter === ch.id;
                const chTodayCount = todayTargets.filter((t) => t.chapterId === ch.id).length;

                return (
                  <div
                    key={ch.id}
                    className="glass rounded-2xl overflow-hidden transition-all"
                    style={{
                      borderColor: isInProgress ? `${color.hex}60` : 'var(--border-card)',
                    }}
                  >
                    {/* === Chapter header — clean, 3 elements only === */}
                    <button
                      onClick={() => setOpenChapter(chOpen ? null : ch.id)}
                      className="w-full p-3.5 flex items-center gap-3 text-left"
                    >
                      {/* Status circle */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all"
                        style={{
                          background: isComplete ? '#22c55e' : isInProgress ? color.hex : 'rgba(255,255,255,0.06)',
                          color: isComplete || isInProgress ? '#000' : '#fff',
                        }}
                      >
                        {isComplete ? '✓' : isInProgress ? `${pct}` : ''}
                      </div>

                      {/* Chapter name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm truncate', isInProgress ? 'font-bold text-t-primary' : 'font-medium text-t-primary')}>
                          {ch.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-t-muted mt-0.5">
                          <span className="tabular">{chLectures.length} lectures</span>
                          {ch.pyqCount > 0 && (
                            <span className="tabular" style={{ color: ch.pyqCount >= 8 ? '#fca5a5' : ch.pyqCount >= 6 ? '#fcd34d' : undefined }}>
                              ⚖ {ch.pyqCount}m
                            </span>
                          )}
                          {chTodayCount > 0 && (
                            <span className="flex items-center gap-0.5" style={{ color: color.hex }}>
                              <Calendar size={9} /> {chTodayCount}
                            </span>
                          )}
                          {chOverdue > 0 && (
                            <span className="text-amber-500 dark:text-amber-400">⚠ {chOverdue}</span>
                          )}
                        </div>
                      </div>

                      {/* Percentage + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-sm font-bold tabular"
                          style={{ color: isComplete ? '#22c55e' : isInProgress ? color.hex : '#6b7280' }}
                        >
                          {pct}%
                        </span>
                        <ChevronDown size={16} className={cn('text-t-muted transition-transform', chOpen && 'rotate-180')} />
                      </div>
                    </button>

                    {/* === Progress bar — thicker, rounded === */}
                    <div className="px-3.5">
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{
                            background: isComplete
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                          }}
                        />
                      </div>
                    </div>

                    {/* === Resource breakdown — readable, inline === */}
                    {chLectures.length > 0 && (
                      <div className="flex items-center gap-3 px-3.5 py-2.5 text-[11px] tabular">
                        <span className="text-t-muted">📺 <span className="text-teal-500 dark:text-teal-400 font-semibold">{lecDone}</span>/{chLectures.length}</span>
                        <span className="text-t-muted">📝 <span className="text-green-500 dark:text-green-400 font-semibold">{dppDone}</span>/{chLectures.length}</span>
                        <span className="text-t-muted">📖 <span className="text-blue-500 dark:text-blue-400 font-semibold">{notesDone}</span>/{chLectures.length}</span>
                        <span className="text-t-muted">🔄 <span className="text-amber-500 dark:text-amber-400 font-semibold">{revDone}</span>/{chLectures.length}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddLectureFor({ chapter: ch, subject: subj }); vibrate(10); }}
                          className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold transition flex items-center gap-0.5"
                          style={{ background: `${color.hex}20`, color: color.hex, border: `1px solid ${color.hex}40` }}
                        >
                          <Plus size={10} /> Lec
                        </button>
                      </div>
                    )}

                    {/* === Expanded lectures === */}
                    <AnimatePresence initial={false}>
                      {chOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2 pb-2 space-y-1">
                            {chLectures.length === 0 && (
                              <p className="text-xs text-t-muted text-center py-3">No lectures yet</p>
                            )}
                            {chLectures
                              .filter((l) => {
                                if (progressFilter === 'done') return l.done;
                                if (progressFilter === 'next') return !l.done;
                                if (progressFilter === 'studying') return !l.done && l.revisionStage >= 0;
                                if (progressFilter === 'overdue') return l.done && isRevisionOverdue(l.nextRevisionAt);
                                return true;
                              })
                              .filter((l) => !search || matchesSearch(l.topic))
                              .map((lec, lecIndex) => (
                                <LectureResourceRow
                                  key={lec.id}
                                  lecture={lec}
                                  chapter={ch}
                                  subject={subj}
                                  index={lecIndex}
                                  onEdit={() => setEditingLecture(lec)}
                                />
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* === Modals === */}
      {editingLecture && (
        <LectureEditModal lecture={editingLecture} onClose={() => setEditingLecture(null)} />
      )}
      {addChapterFor && (
        <AddChapterSheet subject={addChapterFor} onClose={() => setAddChapterFor(null)} showToast={(msg, sub) => _showToast(msg, sub)} />
      )}
      {showBuildSheet && (
        <BuildSyllabusSheet onClose={() => setShowBuildSheet(false)} showToast={(msg, sub) => _showToast(msg, sub)} />
      )}
      {addLectureFor && (
        <AddLectureSheet chapter={addLectureFor.chapter} subject={addLectureFor.subject} onClose={() => setAddLectureFor(null)} showToast={(msg, sub) => _showToast(msg, sub)} />
      )}
      {showFormulaVault && (
        <FormulaVaultInline onClose={() => setShowFormulaVault(false)} />
      )}
    </div>
  );
}

/** Subject header — bold, with color dot, count, and add button */
function SubjectHeader({ name, color, count, onAdd }: { name: string; color: { hex: string }; count: number; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color.hex }} />
      <span className="text-sm font-black uppercase tracking-wider" style={{ color: color.hex }}>{name}</span>
      <span className="text-[10px] text-t-muted font-medium">{count} {count === 1 ? 'chapter' : 'chapters'}</span>
      <button
        onClick={onAdd}
        className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition"
        style={{ background: `${color.hex}15`, color: color.hex }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

/** Filter pill — modern, compact */
function FilterPill({
  active,
  onClick,
  children,
  color,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: { hex: string };
  small?: boolean;
}) {
  return (
    <button
      onClick={() => { onClick(); vibrate(6); }}
      className={cn(
        'rounded-full font-medium whitespace-nowrap transition shrink-0',
        small ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
        active
          ? 'text-black font-bold'
          : 'bg-white/5 text-t-muted hover:bg-white/10 hover:text-t-secondary'
      )}
      style={
        active
          ? { background: color?.hex ?? '#14b8a6' }
          : color
          ? { background: `${color.hex}15`, color: color.hex, border: `1px solid ${color.hex}25` }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/** Formula Vault inline wrapper — renders the FormulaVault in a sheet */
function FormulaVaultInline({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Formula Vault</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-t-secondary">✕</button>
        </div>
        <FormulaVault />
      </div>
    </div>
  );
}
