'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Plus, Search, ChevronDown, Calendar, Layers, Trash2, Check, Clock } from 'lucide-react';
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

  // Today's targets — to compute "X today" badges on chapters
  const todayTargets = useTargets((s) => s.byDate[todayKey()] || EMPTY_TARGETS);
  const addTarget = useTargets((s) => s.addTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);

  // Stats — "studying" = any lecture with ANY resource done but not all done
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

  // Filter subjects + chapters
  const filteredSubjects = useMemo(() => {
    if (subjectFilter === 'all') return subjects;
    return subjects.filter((s) => s.name === subjectFilter);
  }, [subjects, subjectFilter]);

  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* Title + search on same line */}
      <div className="flex items-center gap-2">
        <GraduationCap size={20} className="text-teal-400 shrink-0" />
        <h1 className="text-xl font-bold shrink-0">Syllabus</h1>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-teal-400/50"
          />
        </div>
        <button
          onClick={() => { triggerTimeline(); vibrate(10); }}
          className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-teal-400 transition"
          title="Progress Timeline"
        >
          <Clock size={14} />
        </button>
      </div>

      {/* Summary line */}
      <div className="text-xs text-white/50">
        <span className="text-green-400">{doneCount} done</span>
        {' · '}
        <span className="text-amber-400">{studyingCount} studying</span>
        {' · '}
        <span className="text-white/60">{nextCount} next</span>
        {overdueCount > 0 && (
          <>
            {' · '}
            <span className="text-red-400">{overdueCount} overdue</span>
          </>
        )}
        {' · '}
        <span>{lectures.length} total</span>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <FilterPill active={subjectFilter === 'all'} onClick={() => setSubjectFilter('all')}>All</FilterPill>
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
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <FilterPill active={progressFilter === 'all'} onClick={() => setProgressFilter('all')}>All Progress</FilterPill>
          <FilterPill active={progressFilter === 'studying'} onClick={() => setProgressFilter('studying')}>Studying</FilterPill>
          <FilterPill active={progressFilter === 'next'} onClick={() => setProgressFilter('next')}>Next</FilterPill>
          <FilterPill active={progressFilter === 'done'} onClick={() => setProgressFilter('done')}>Done</FilterPill>
          <FilterPill active={progressFilter === 'overdue'} onClick={() => setProgressFilter('overdue')}>Overdue Rev.</FilterPill>
        </div>
      </div>

      {/* Build Syllabus button */}
      <button
        onClick={() => { setShowBuildSheet(true); vibrate(10); }}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-teal-500/20"
      >
        <Plus size={18} /> Build Syllabus
      </button>

      {/* Formula Vault — collapsible section for saving formulas/concepts */}
      <FormulaVault />

      {/* Empty state */}
      {subjects.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <GraduationCap size={40} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/60 text-sm mb-1">No syllabus yet.</p>
          <p className="text-white/40 text-xs">Tap "Build Syllabus" to select NEET chapters & lectures.</p>
        </div>
      )}

      {/* Subjects + chapters */}
      <div className="space-y-3">
        {filteredSubjects.map((subj) => {
          const color = subjectColor(subj.name);
          const subjChapters = chapters.filter((c) => c.subjectId === subj.id);
          if (subjectFilter !== 'all' && subj.name !== subjectFilter) return null;
          if (subjChapters.length === 0) {
            return (
              <div key={subj.id} className="glass rounded-2xl overflow-hidden">
                <div className="p-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: color.hex }} />
                  <span className="text-xs font-bold uppercase" style={{ color: color.hex }}>{subj.name}</span>
                  <span className="text-xs text-white/40 ml-auto">No chapters</span>
                </div>
                <button
                  onClick={() => { setAddChapterFor(subj); vibrate(10); }}
                  className="w-full m-2 mt-0 py-2.5 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  style={{ borderColor: `${color.hex}40`, color: color.hex }}
                >
                  <Plus size={12} /> Add Chapter
                </button>
              </div>
            );
          }
          return (
            <div key={subj.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="w-3 h-3 rounded" style={{ background: color.hex }} />
                <span className="text-xs font-bold uppercase" style={{ color: color.hex }}>{subj.name}</span>
                <button
                  onClick={() => { setAddChapterFor(subj); vibrate(10); }}
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold transition flex items-center gap-1"
                  style={{ background: `${color.hex}20`, color: color.hex }}
                >
                  <Plus size={10} /> Chapter
                </button>
              </div>
              {subjChapters.map((ch, chIndex) => {
                const chLectures = lectures.filter((l) => l.chapterId === ch.id);
                const chOverdue = chLectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt)).length;
                const chIsEven = chIndex % 2 === 0;

                // Aggregate resource counts across all lectures in chapter
                const lecDone = chLectures.filter((l) => l.done).length;
                const dppDone = chLectures.filter((l) => l.dppDone).length;
                const notesDone = chLectures.filter((l) => l.notesDone).length;
                const revDone = chLectures.filter((l) => l.revisionDone).length;
                const totalResources = chLectures.length * 4;
                const doneResources = lecDone + dppDone + notesDone + revDone;
                const pct = totalResources > 0 ? Math.round((doneResources / totalResources) * 100) : 0;

                // "In Progress" = any resource done but not all
                const isInProgress = doneResources > 0 && pct < 100;

                // Apply progress filter
                if (progressFilter === 'done' && pct !== 100) return null;
                if (progressFilter === 'next' && doneResources > 0) return null;
                if (progressFilter === 'studying' && !isInProgress) return null;
                if (progressFilter === 'overdue' && chOverdue === 0) return null;
                // Search filter
                if (search && !matchesSearch(ch.name) && !chLectures.some((l) => matchesSearch(l.topic))) return null;

                const chOpen = openChapter === ch.id;
                // Count today's targets linked to this chapter
                const chTodayTargets = todayTargets.filter((t) => t.chapterId === ch.id);
                const chTodayCount = chTodayTargets.length;

                return (
                  <div
                    key={ch.id}
                    className="card-solid rounded-2xl overflow-hidden transition-all"
                    style={{
                      // Solid dark base + strong subject-color border. Color
                      // tint applied via child .card-tint overlay so the chapter
                      // visibly belongs to its subject without muddying text.
                      borderColor: isInProgress ? color.hex : `${color.hex}80`,
                      boxShadow: isInProgress
                        ? `0 0 20px ${color.hex}40`
                        : undefined,
                    }}
                  >
                    {/* Subject color tint overlay */}
                    <div
                      className="card-tint"
                      style={{
                        background: isInProgress
                          ? `linear-gradient(135deg, ${color.hex}33, ${color.hex}14)`
                          : `linear-gradient(135deg, ${color.hex}1f, ${color.hex}0a)`,
                      }}
                    />
                    {/* Content wrapper — sits above the tint */}
                    <div className="relative p-3 flex items-center gap-2">
                      <button
                        onClick={() => setOpenChapter(chOpen ? null : ch.id)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 transition-all"
                        style={{
                          background: pct === 100 && chLectures.length > 0 ? '#22c55e' : isInProgress ? color.hex : doneResources > 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                          color: doneResources > 0 || isInProgress ? '#000' : '#fff',
                          boxShadow: isInProgress ? `0 0 8px ${color.hex}80` : 'none',
                        }}
                      >
                        {pct === 100 && chLectures.length > 0 ? '✓' : isInProgress ? '◐' : ''}
                      </button>
                      <button
                        onClick={() => setOpenChapter(chOpen ? null : ch.id)}
                        className={cn('text-sm flex-1 text-left truncate text-white', isInProgress ? 'font-bold' : 'font-medium')}
                      >
                        {ch.name}
                      </button>
                      {/* In Progress badge */}
                      {isInProgress && (
                        <span
                          className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color.hex}40`, color: '#fff', border: `1px solid ${color.hex}80` }}
                        >
                          STUDYING
                        </span>
                      )}
                      {/* Weightage badge */}
                      {ch.pyqCount > 0 && (
                        <span
                          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded tabular"
                          style={{
                            background: ch.pyqCount >= 8 ? 'rgba(239,68,68,0.25)' : ch.pyqCount >= 6 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.10)',
                            color: ch.pyqCount >= 8 ? '#fca5a5' : ch.pyqCount >= 6 ? '#fcd34d' : '#ffffffcc',
                            border: `1px solid ${ch.pyqCount >= 8 ? 'rgba(239,68,68,0.4)' : ch.pyqCount >= 6 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)'}`,
                          }}
                          title="NEET marks weightage"
                        >
                          ⚖ {ch.pyqCount}m
                        </span>
                      )}
                      {/* +Lec button (right of chapter name) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddLectureFor({ chapter: ch, subject: subj }); vibrate(10); }}
                        className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold transition flex items-center gap-1"
                        style={{ background: `${color.hex}30`, color: '#fff', border: `1px solid ${color.hex}60` }}
                        title="Add lecture to this chapter"
                      >
                        <Plus size={10} /> Lec
                      </button>
                      <span className="text-[10px] font-bold tabular shrink-0" style={{ color: pct === 100 ? '#22c55e' : color.hex }}>
                        {pct}%
                      </span>
                      {chTodayCount > 0 && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shrink-0"
                          style={{ background: `${color.hex}25`, color: color.hex }}
                        >
                          <Calendar size={8} /> {chTodayCount}
                        </span>
                      )}
                      {chOverdue > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold shrink-0">
                          {chOverdue} od
                        </span>
                      )}
                      <span className="text-[10px] text-white/40 tabular shrink-0">{chLectures.length} lec</span>
                      <button
                        onClick={() => setOpenChapter(chOpen ? null : ch.id)}
                        className="shrink-0"
                      >
                        <ChevronDown size={14} className={cn('text-white/40 transition-transform', chOpen && 'rotate-180')} />
                      </button>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-white/5">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : color.hex }} />
                    </div>

                    {/* Resource breakdown row */}
                    {chLectures.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] tabular text-white/40 bg-white/[0.02]">
                        <span>📺 <span style={{ color: '#14b8a6' }}>{lecDone}</span>/{chLectures.length}</span>
                        <span>📝 <span style={{ color: '#22c55e' }}>{dppDone}</span>/{chLectures.length}</span>
                        <span>📖 <span style={{ color: '#3b82f6' }}>{notesDone}</span>/{chLectures.length}</span>
                        <span>🔄 <span style={{ color: '#f59e0b' }}>{revDone}</span>/{chLectures.length}</span>
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {chOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-2 pt-2 space-y-1.5">
                            {chLectures.length === 0 && (
                              <p className="text-xs text-white/30 text-center py-2">No lectures yet. Tap "Add Lecture" above.</p>
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

      {editingLecture && (
        <LectureEditModal
          lecture={editingLecture}
          onClose={() => setEditingLecture(null)}
        />
      )}

      {addChapterFor && (
        <AddChapterSheet
          subject={addChapterFor}
          onClose={() => setAddChapterFor(null)}
          showToast={(msg, sub) => _showToast(msg, sub)}
        />
      )}

      {showBuildSheet && (
        <BuildSyllabusSheet
          onClose={() => setShowBuildSheet(false)}
          showToast={(msg, sub) => _showToast(msg, sub)}
        />
      )}

      {addLectureFor && (
        <AddLectureSheet
          chapter={addLectureFor.chapter}
          subject={addLectureFor.subject}
          onClose={() => setAddLectureFor(null)}
          showToast={(msg, sub) => _showToast(msg, sub)}
        />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: { hex: string };
}) {
  return (
    <button
      onClick={() => { onClick(); vibrate(6); }}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition shrink-0',
        active
          ? 'text-black font-bold'
          : 'bg-white/5 text-white/60 hover:bg-white/10'
      )}
      style={
        active
          ? { background: color?.hex ?? '#14b8a6' }
          : color
          ? { background: `${color.hex}20`, color: color.hex, border: `1px solid ${color.hex}30` }
          : undefined
      }
    >
      {children}
    </button>
  );
}
