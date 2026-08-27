'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Plus, Search, ChevronDown, ChevronRight, Calendar, Clock, Sigma,
  GripVertical, Check, X, CheckCircle2, RotateCcw, Trash2, Sparkles, BookMarked, FlaskConical,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { useSyllabus } from '@/lib/store/syllabus';
import { useTargets } from '@/lib/store/targets';
import { useSession } from '@/lib/store/session';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject, Lecture, SubjectEntity, Chapter } from '@/lib/types';
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

let _showToast: (msg: string, sub?: string) => void = () => {};
export function setSyllabusToastHandler(fn: (msg: string, sub?: string) => void) { _showToast = fn; }

export function SyllabusTab() {
  const { subjects, chapters, lectures, deleteChapter, reorderChapters } = useSyllabus();
  const [search, setSearch] = useState('');
  const [reorderMode, setReorderMode] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem('syllabus-subject-filter') as Subject | 'all') || 'all';
  });
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem('syllabus-progress-filter') as ProgressFilter) || 'all';
  });

  const handleSubjectFilter = (f: Subject | 'all') => {
    setSubjectFilter(f);
    try { localStorage.setItem('syllabus-subject-filter', f); } catch {}
  };
  const handleProgressFilter = (f: ProgressFilter) => {
    setProgressFilter(f);
    try { localStorage.setItem('syllabus-progress-filter', f); } catch {}
  };

  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [addChapterFor, setAddChapterFor] = useState<SubjectEntity | null>(null);
  const [addLectureFor, setAddLectureFor] = useState<{ chapter: import('@/lib/types').Chapter; subject: SubjectEntity } | null>(null);
  const [showBuildSheet, setShowBuildSheet] = useState(false);
  const [showFormulaVault, setShowFormulaVault] = useState(false);
  const [chapterMenu, setChapterMenu] = useState<Chapter | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());
  const headerLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for subject collapse events from SubjectHeader children
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const { subject, collapsed } = ce.detail;
      setCollapsedSubjects((prev) => {
        const next = new Set(prev);
        if (collapsed) next.add(subject);
        else next.delete(subject);
        return next;
      });
    };
    window.addEventListener('syllabus-subject-collapse', handler);
    return () => window.removeEventListener('syllabus-subject-collapse', handler);
  }, []);

  const todayTargets = useTargets((s) => s.byDate[todayKey()] || EMPTY_TARGETS);
  const activeSession = useSession((s) => s.active);

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

  // === Header stats ===
  const totalLectures = lectures.length;
  const overallPct = totalLectures > 0 ? Math.round((doneCount / totalLectures) * 100) : 0;
  const todayKeyStr = todayKey();
  const doneTodayCount = lectures.filter((l) => {
    if (!l.doneDate) return false;
    const d = new Date(l.doneDate);
    const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dKey === todayKeyStr;
  }).length;
  const overallPctColor = overallPct >= 70 ? '#22c55e' : overallPct >= 30 ? '#f59e0b' : '#ef4444';

  // === Filter bar stats ===
  // Per-subject lecture count (for filter pill counts)
  const subjectLectureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lec of lectures) {
      const ch = chapters.find((c) => c.id === lec.chapterId);
      if (ch) {
        const subj = subjects.find((s) => s.id === ch.subjectId);
        if (subj) counts[subj.name] = (counts[subj.name] || 0) + 1;
      }
    }
    return counts;
  }, [lectures, chapters, subjects]);

  // Search match count — how many lectures match the current search
  const searchMatchCount = search
    ? lectures.filter((l) => l.topic.toLowerCase().includes(search.toLowerCase())).length
    : 0;

  // Active filter count — for the "clear all" banner
  const activeFilterCount = (subjectFilter !== 'all' ? 1 : 0) + (progressFilter !== 'all' ? 1 : 0) + (search ? 1 : 0);

  const clearAllFilters = () => {
    setSearch('');
    handleSubjectFilter('all');
    handleProgressFilter('all');
    vibrate(10);
  };

  const filteredSubjects = useMemo(() => {
    if (subjectFilter === 'all') return subjects;
    return subjects.filter((s) => s.name === subjectFilter);
  }, [subjects, subjectFilter]);

  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8, delay: 0, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortChapters = (list: typeof chapters) => [...list].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.createdAt - b.createdAt;
  });

  const handleDragEnd = (subjectId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const subjChapters = sortChapters(chapters.filter((c) => c.subjectId === subjectId));
    const oldIndex = subjChapters.findIndex((c) => c.id === active.id);
    const newIndex = subjChapters.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(subjChapters, oldIndex, newIndex).map((c) => c.id);
    reorderChapters(subjectId, newOrder);
    vibrate(10);
  };

  return (
    <div className="pt-2 pb-4 space-y-4">
      {/* === Header — 2-row compact summary ===
          Row 1: Title + 3 icon buttons (Timeline, Reorder, Build)
          Row 2: One-line summary (overall %, lectures done/total, overdue, today)
          Long-press header → quick actions menu (Build, Formula Vault) */}
      <div
        className={cn(
          'glass rounded-2xl p-3 transition-all',
          reorderMode && 'ring-2 ring-teal-500/40 bg-teal-500/5'
        )}
        onPointerDown={() => {
          headerLongPressRef.current = setTimeout(() => {
            setShowHeaderMenu(true);
            vibrate(20);
          }, 500);
        }}
        onPointerUp={() => { if (headerLongPressRef.current) { clearTimeout(headerLongPressRef.current); headerLongPressRef.current = null; } }}
        onPointerLeave={() => { if (headerLongPressRef.current) { clearTimeout(headerLongPressRef.current); headerLongPressRef.current = null; } }}
      >
        {/* Row 1: Title + icon buttons */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Syllabus
          </h1>
          {reorderMode && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30"
            >
              REORDER MODE
            </motion.span>
          )}
          <div className="flex-1" />
          {/* Timeline button */}
          <button
            onClick={() => { triggerTimeline(); vibrate(10); }}
            className="shrink-0 w-8 h-8 rounded-lg glass flex items-center justify-center hover:bg-foreground/10 transition active:scale-95"
            aria-label="Progress Timeline"
            title="Progress Timeline"
          >
            <Clock size={15} className="text-muted-foreground" />
          </button>
          {/* Reorder toggle — pulses when active */}
          <button
            onClick={() => { setReorderMode(!reorderMode); vibrate(10); }}
            className={cn(
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95',
              reorderMode
                ? 'bg-teal-500 text-black'
                : 'glass text-muted-foreground hover:bg-foreground/10'
            )}
            aria-label={reorderMode ? 'Exit reorder mode' : 'Reorder chapters'}
            title="Reorder chapters"
          >
            <GripVertical size={15} />
          </button>
          {/* Build button — primary accent, opens BuildSyllabusSheet */}
          <button
            onClick={() => { setShowBuildSheet(true); vibrate(10); }}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              color: '#fff',
              boxShadow: '0 2px 8px -2px rgba(20,184,166,0.5)',
            }}
            aria-label="Build Syllabus"
            title="Build / Edit Syllabus"
          >
            <Sparkles size={15} />
          </button>
        </div>

        {/* Row 2: One-line summary — only show if there are lectures */}
        {totalLectures > 0 && (
          <div className="flex items-center gap-2 mt-2 text-[11px] tabular" style={{ color: 'var(--muted-foreground)' }}>
            {/* Overall % — colored by progress */}
            <span className="font-bold text-sm" style={{ color: overallPctColor }}>
              {overallPct}%
            </span>
            <span>·</span>
            <span>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{doneCount}</span>
              /{totalLectures} lectures
            </span>
            {/* Overdue badge — tappable to filter by overdue */}
            {overdueCount > 0 && (
              <>
                <span>·</span>
                <button
                  onClick={() => { handleProgressFilter('overdue'); vibrate(8); }}
                  className="font-semibold text-red-500 dark:text-red-400 hover:underline active:scale-95 transition"
                  title="Show overdue lectures"
                >
                  ⚠ {overdueCount} overdue
                </button>
              </>
            )}
            {/* Done today — tappable to filter by done */}
            {doneTodayCount > 0 && (
              <>
                <span>·</span>
                <button
                  onClick={() => { handleProgressFilter('done'); vibrate(8); }}
                  className="font-semibold text-green-500 dark:text-green-400 hover:underline active:scale-95 transition"
                  title="Show completed lectures"
                >
                  +{doneTodayCount} today
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* === Header Quick Actions Menu — long-press to open ===
          Rendered via Portal to escape any transform/overflow context. */}
      {showHeaderMenu && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHeaderMenu(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-[10002] w-[280px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
            style={{
              background: 'var(--popover, rgba(20,22,30,0.96))',
              backdropFilter: 'blur(16px)',
              transform: 'translate(-50%, -50%)',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            <div className="px-4 py-3 border-b border-foreground/10 sticky top-0" style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}>
              <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Quick Actions</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">Syllabus tools</div>
            </div>
            <div className="py-1">
              <button
                onClick={() => { setShowHeaderMenu(false); setShowBuildSheet(true); vibrate(10); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground">Build Syllabus</div>
                  <div className="text-[10px] text-muted-foreground">Add NEET chapters & lectures</div>
                </div>
              </button>
              <button
                onClick={() => { setShowHeaderMenu(false); setShowFormulaVault(true); vibrate(10); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 active:bg-foreground/15 transition text-left"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <BookMarked size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground">Formula Vault</div>
                  <div className="text-[10px] text-muted-foreground">Saved formulas & quick reference</div>
                </div>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Filter Bar — sticky, merges search + stats + filters ===
          Replaces the old 3 separate sections (search, stats row, 2 filter rows).
          - Search has clear button + results count
          - Filter pills show counts (so you know what you're filtering)
          - Active filter banner with "clear all" when filtering
          - Sticky on scroll so filters are always accessible */}
      <div className="sticky top-0 z-20 glass rounded-2xl p-3 space-y-2.5">
        {/* Search with clear + count */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lectures..."
            className="w-full bg-foreground/5 border border-border rounded-xl pl-10 pr-20 py-2.5 text-sm focus:outline-none focus:border-teal-400/50 focus:bg-foreground/[0.07] transition"
            style={{ color: 'var(--foreground)' }}
          />
          {/* Results count + clear button — only when searching */}
          {search && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="text-[10px] tabular text-muted-foreground">{searchMatchCount} found</span>
              <button
                onClick={() => { setSearch(''); vibrate(6); }}
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
                aria-label="Clear search"
              >
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Subject filter pills — with counts, flex-wrap on desktop */}
        <div className="flex gap-1.5 flex-wrap">
          <FilterPill count={totalLectures} active={subjectFilter === 'all'} onClick={() => handleSubjectFilter('all')}>All</FilterPill>
          {SUBJECTS.map((s) => (
            <FilterPill
              key={s}
              count={subjectLectureCounts[s] || 0}
              active={subjectFilter === s}
              onClick={() => handleSubjectFilter(s)}
              color={subjectColor(s)}
            >
              {s}
            </FilterPill>
          ))}
        </div>

        {/* Progress filter pills — with counts */}
        <div className="flex gap-1.5 flex-wrap">
          <FilterPill small count={totalLectures} active={progressFilter === 'all'} onClick={() => handleProgressFilter('all')}>All</FilterPill>
          <FilterPill small count={studyingCount} active={progressFilter === 'studying'} onClick={() => handleProgressFilter('studying')}>In Progress</FilterPill>
          <FilterPill small count={nextCount} active={progressFilter === 'next'} onClick={() => handleProgressFilter('next')}>Not Started</FilterPill>
          <FilterPill small count={doneCount} active={progressFilter === 'done'} onClick={() => handleProgressFilter('done')}>Done</FilterPill>
          {overdueCount > 0 && (
            <FilterPill small count={overdueCount} active={progressFilter === 'overdue'} onClick={() => handleProgressFilter('overdue')}>⚠ Overdue</FilterPill>
          )}
        </div>

        {/* Active filter banner — only shows when filtering */}
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-[10px] pt-1 border-t border-foreground/10"
          >
            <span className="text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
            </span>
            <button
              onClick={clearAllFilters}
              className="ml-auto px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 dark:text-red-400 font-semibold hover:bg-red-500/20 transition active:scale-95"
            >
              clear all
            </button>
          </motion.div>
        )}
      </div>

      {/* Build Syllabus + Formula Vault buttons moved to Syllabus tab
          long-press action sheet (like Free Study + Daily Recall on Study tab).
          This saves vertical space in the Syllabus tab. */}

      {reorderMode && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30">
          <GripVertical size={14} className="text-teal-500 shrink-0" />
          <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold flex-1">Drag chapters to reorder. Tap ✓ when done.</span>
          <button onClick={() => { setReorderMode(false); vibrate(10); }} className="w-7 h-7 rounded-lg bg-teal-500 text-black flex items-center justify-center"><Check size={14} /></button>
        </div>
      )}

      {subjects.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto mb-4"><GraduationCap size={28} className="text-teal-500 dark:text-teal-400" /></div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No syllabus yet</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tap "Build Syllabus" to select NEET chapters & lectures</p>
        </div>
      )}

      <div className="space-y-4">
        {filteredSubjects.map((subj) => {
          const color = subjectColor(subj.name);
          const subjChapters = chapters.filter((c) => c.subjectId === subj.id);
          if (subjectFilter !== 'all' && subj.name !== subjectFilter) return null;

          // Per-subject stats
          const subjLectures = lectures.filter((l) =>
            subjChapters.some((c) => c.id === l.chapterId)
          );
          const subjDoneCount = subjLectures.filter((l) => l.done).length;
          const subjOverallPct = subjLectures.length > 0
            ? Math.round((subjDoneCount / subjLectures.length) * 100)
            : 0;
          const isSubjectActive = activeSession?.subject === subj.name;
          const isCollapsed = collapsedSubjects.has(subj.name);

          if (subjChapters.length === 0) {
            return (
              <div key={subj.id} className="space-y-2">
                <SubjectHeader
                  name={subj.name}
                  color={color}
                  count={0}
                  lectureCount={0}
                  overallPct={0}
                  onAdd={() => { setAddChapterFor(subj); vibrate(10); }}
                  isActive={isSubjectActive}
                />
                {!isCollapsed && (
                  <button onClick={() => { setAddChapterFor(subj); vibrate(10); }} className="w-full py-3 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition" style={{ borderColor: `${color.hex}40`, color: color.hex }}>
                    <Plus size={14} /> Add Chapter
                  </button>
                )}
              </div>
            );
          }
          return (
            <div key={subj.id} className="space-y-2">
              <SubjectHeader
                name={subj.name}
                color={color}
                count={subjChapters.length}
                lectureCount={subjLectures.length}
                overallPct={subjOverallPct}
                onAdd={() => { setAddChapterFor(subj); vibrate(10); }}
                isActive={isSubjectActive}
              />
              {/* Chapters — hidden when subject is collapsed, OR when in reorder mode (reorder shows all) */}
              {!isCollapsed && (
                <>
              {reorderMode ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(subj.id, e)}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext items={sortChapters(subjChapters).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {sortChapters(subjChapters).map((ch) => {
                      const chLectures = lectures.filter((l) => l.chapterId === ch.id);
                      return <SortableChapterCard key={ch.id} chapter={ch} color={color} lectureCount={chLectures.length} />;
                    })}
                  </SortableContext>
                </DndContext>
              ) : null}
              {!reorderMode && subjChapters.map((ch) => {
                const chLectures = lectures.filter((l) => l.chapterId === ch.id);
                const chOverdue = chLectures.filter((l) => l.done && isRevisionOverdue(l.nextRevisionAt)).length;
                const lecDone = chLectures.filter((l) => l.done).length;
                const dppDone = chLectures.filter((l) => l.dppDone).length;
                const notesDone = chLectures.filter((l) => l.notesDone).length;
                const revDone = chLectures.filter((l) => l.revisionDone).length;
                const totalResources = chLectures.length * 4;
                const doneResources = lecDone + dppDone + notesDone + revDone;
                const pct = totalResources > 0 ? Math.round((doneResources / totalResources) * 100) : 0;
                const isInProgress = doneResources > 0 && pct < 100;
                const isComplete = pct === 100 && chLectures.length > 0;
                if (progressFilter === 'done' && pct !== 100) return null;
                if (progressFilter === 'next' && doneResources > 0) return null;
                if (progressFilter === 'studying' && !isInProgress) return null;
                if (progressFilter === 'overdue' && chOverdue === 0) return null;
                if (search && !matchesSearch(ch.name) && !chLectures.some((l) => matchesSearch(l.topic))) return null;
                const chOpen = openChapter === ch.id;
                const chTodayCount = todayTargets.filter((t) => t.chapterId === ch.id).length;
                const isChapterActive = activeSession?.subject === subj.name && chLectures.some((l) => l.id === activeSession?.targetId);
                return (
                  <div
                    key={ch.id}
                    className={cn(
                      'glass rounded-2xl overflow-hidden transition-all relative',
                      isChapterActive && 'glow-pulse'
                    )}
                    style={{
                      borderColor: isInProgress ? `${color.hex}60` : 'var(--border-card)',
                      ['--glow-color' as string]: color.glow,
                    }}
                    onPointerDown={() => {
                      chapterLongPressRef.current = setTimeout(() => {
                        setChapterMenu(ch);
                        vibrate(20);
                      }, 500);
                    }}
                    onPointerUp={() => { if (chapterLongPressRef.current) { clearTimeout(chapterLongPressRef.current); chapterLongPressRef.current = null; } }}
                    onPointerLeave={() => { if (chapterLongPressRef.current) { clearTimeout(chapterLongPressRef.current); chapterLongPressRef.current = null; } }}
                  >
                    {/* 3px subject-color top stripe */}
                    <div
                      className="absolute top-0 left-0 right-0 z-[1] pointer-events-none"
                      style={{
                        height: 3,
                        background: `linear-gradient(90deg, ${color.hex}, ${color.hex}aa)`,
                        opacity: isComplete ? 0.4 : 1,
                      }}
                    />

                    <button onClick={() => setOpenChapter(chOpen ? null : ch.id)} className="w-full p-3.5 pt-4 flex items-center gap-3 text-left relative">
                      {/* Progress ring (28px SVG) replaces the circle number */}
                      <div className="shrink-0 relative" style={{ width: 32, height: 32 }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
                          <circle cx="16" cy="16" r="13" fill="none" stroke="var(--bar-track, rgba(255,255,255,0.08))" strokeWidth="3" />
                          <motion.circle
                            cx="16" cy="16" r="13" fill="none"
                            stroke={isComplete ? '#22c55e' : color.hex}
                            strokeWidth="3"
                            strokeLinecap="round"
                            initial={false}
                            animate={{ strokeDashoffset: 81.68 - (81.68 * pct) / 100 }}
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                            style={{
                              strokeDasharray: 81.68,
                              filter: `drop-shadow(0 0 4px ${isComplete ? 'rgba(34,197,94,0.5)' : color.glow})`,
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isComplete ? (
                            <Check size={14} strokeWidth={3} color="#22c55e" />
                          ) : (
                            <span className="text-[9px] font-bold tabular" style={{ color: isInProgress ? color.hex : 'var(--muted-foreground)' }}>
                              {pct}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm truncate', isInProgress ? 'font-bold' : 'font-medium')} style={{ color: 'var(--foreground)' }}>
                          {ch.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap" style={{ color: 'var(--muted-foreground)' }}>
                          <span className="tabular">{chLectures.length} lectures</span>
                          {ch.pyqCount > 0 && (
                            <span className="tabular font-semibold text-amber-600 dark:text-amber-400">⚖ {ch.pyqCount} PYQ</span>
                          )}
                          {/* Today badge — more prominent */}
                          {chTodayCount > 0 && (
                            <span
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold"
                              style={{ background: `${color.hex}20`, color: color.hex }}
                            >
                              <Calendar size={9} /> {chTodayCount} today
                            </span>
                          )}
                          {/* Overdue badge — pulsing red */}
                          {chOverdue > 0 && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold bg-red-500/15 text-red-500 dark:text-red-400 pulse-slow">
                              ⚠ {chOverdue} overdue
                            </span>
                          )}
                        </div>
                      </div>

                      {/* % + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular" style={{ color: isComplete ? '#22c55e' : isInProgress ? color.hex : 'var(--muted-foreground)' }}>
                          {pct}%
                        </span>
                        <motion.div animate={{ rotate: chOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                          <ChevronDown size={16} className="text-muted-foreground" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Segmented liquid progress bar — matches TargetCard */}
                    <div className="px-3.5">
                      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, rgba(255,255,255,0.06))' }}>
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background: isComplete
                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                : `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                              boxShadow: `0 0 6px ${isComplete ? 'rgba(34,197,94,0.4)' : color.glow}`,
                            }}
                          />
                        </motion.div>
                        {/* Segment dividers at 25/50/75% */}
                        {[25, 50, 75].map((pos) => (
                          <div
                            key={pos}
                            className="absolute top-0 bottom-0 w-px pointer-events-none"
                            style={{ left: `${pos}%`, background: 'var(--border, rgba(255,255,255,0.12))' }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Resource row — cleaner spacing */}
                    {chLectures.length > 0 && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] tabular">
                        <span className="text-muted-foreground">📺 <span className="text-teal-600 dark:text-teal-400 font-semibold">{lecDone}</span>/{chLectures.length}</span>
                        <span className="text-muted-foreground">📝 <span className="text-green-600 dark:text-green-400 font-semibold">{dppDone}</span>/{chLectures.length}</span>
                        <span className="text-muted-foreground">📖 <span className="text-blue-600 dark:text-blue-400 font-semibold">{notesDone}</span>/{chLectures.length}</span>
                        <span className="text-muted-foreground">🔄 <span className="text-amber-600 dark:text-amber-400 font-semibold">{revDone}</span>/{chLectures.length}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddLectureFor({ chapter: ch, subject: subj }); vibrate(10); }}
                          className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold transition flex items-center gap-0.5 active:scale-95"
                          style={{ background: `${color.hex}20`, color: color.hex, border: `1px solid ${color.hex}40` }}
                          aria-label={`Add lecture to ${ch.name}`}
                          title="Add lecture"
                        >
                          <Plus size={10} /> Lec
                        </button>
                      </div>
                    )}

                    {/* Expanded lecture list */}
                    <AnimatePresence initial={false}>
                      {chOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="px-2.5 pb-2.5 pt-1 space-y-2">
                            {chLectures.length === 0 && (<p className="text-xs text-center py-3" style={{ color: 'var(--muted-foreground)' }}>No lectures yet</p>)}
                            {chLectures.filter((l) => { if (progressFilter === 'done') return l.done; if (progressFilter === 'next') return !l.done; if (progressFilter === 'studying') return !l.done && l.revisionStage >= 0; if (progressFilter === 'overdue') return l.done && isRevisionOverdue(l.nextRevisionAt); return true; }).filter((l) => !search || matchesSearch(l.topic)).map((lec, lecIndex) => (<LectureResourceRow key={lec.id} lecture={lec} chapter={ch} subject={subj} index={lecIndex} onEdit={() => setEditingLecture(lec)} />))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
                </>
              )}
            </div>
          );
        })}
      </div>

      {editingLecture && (<LectureEditModal lecture={editingLecture} onClose={() => setEditingLecture(null)} />)}
      {addChapterFor && (<AddChapterSheet subject={addChapterFor} onClose={() => setAddChapterFor(null)} showToast={(msg, sub) => _showToast(msg, sub)} />)}
      {showBuildSheet && (<BuildSyllabusSheet onClose={() => setShowBuildSheet(false)} showToast={(msg, sub) => _showToast(msg, sub)} />)}
      {addLectureFor && (<AddLectureSheet chapter={addLectureFor.chapter} subject={addLectureFor.subject} onClose={() => setAddLectureFor(null)} showToast={(msg, sub) => _showToast(msg, sub)} />)}
      {showFormulaVault && (<FormulaVaultInline onClose={() => setShowFormulaVault(false)} />)}

      {/* === Chapter context menu (long-press) — Mark All Done / Reset / Delete === */}
      <AnimatePresence>
        {chapterMenu && (
          <ChapterContextMenu
            chapter={chapterMenu}
            onClose={() => setChapterMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableChapterCard({ chapter, color, lectureCount }: { chapter: Chapter; color: { hex: string }; lectureCount: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use stable selectors — filter inline creates a new array every render
  // which causes infinite loops with Zustand's useSyncExternalStore.
  const allLectures = useSyllabus((s) => s.lectures);
  const deleteChapter = useSyllabus((s) => s.deleteChapter);
  const updateLecture = useSyllabus((s) => s.updateLecture);
  const lectures = useMemo(() => allLectures.filter((l) => l.chapterId === chapter.id), [allLectures, chapter.id]);
  const allDone = lectures.length > 0 && lectures.every((l) => l.done);

  // Cancel long-press when drag starts
  useEffect(() => {
    if (isDragging && longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, [isDragging]);

  const markAllDone = () => {
    vibrate(15);
    lectures.forEach((l) => { if (!l.done) updateLecture(l.id, { done: true }); });
    setShowMenu(false);
  };
  const resetAll = () => {
    vibrate(15);
    lectures.forEach((l) => { if (l.done) updateLecture(l.id, { done: false }); });
    setShowMenu(false);
  };
  const handleDelete = () => {
    vibrate([10, 30, 10]);
    deleteChapter(chapter.id);
    setShowMenu(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 100 : undefined,
          opacity: isDragging ? 0.9 : 1,
          // GPU acceleration for smooth drag
          willChange: isDragging ? 'transform' : undefined,
          // Stronger shadow when dragging for depth perception
          boxShadow: isDragging ? '0 20px 60px rgba(0,0,0,0.4)' : undefined,
        }}
        className="glass rounded-2xl p-3.5 flex items-center gap-3 mb-2"
        onPointerDown={() => {
          longPressRef.current = setTimeout(() => { setShowMenu(true); vibrate(20); }, 500);
        }}
        onPointerUp={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
        onPointerLeave={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
      >
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"><GripVertical size={18} /></button>
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.hex }} />
        <div className="flex-1 min-w-0"><div className="text-sm font-medium text-foreground truncate">{chapter.name}</div><div className="text-[10px] text-muted-foreground">{lectureCount} lectures{allDone && ' · ✓ all done'}</div></div>
        {chapter.pyqCount > 0 && (<span className="text-[9px] font-bold px-1.5 py-0.5 rounded tabular" style={{ background: `${color.hex}20`, color: color.hex }}>⚖ {chapter.pyqCount}m</span>)}
      </div>

      {/* === Long-press context menu === */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            onClick={() => setShowMenu(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm glass-strong rounded-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold">{chapter.name}</h3>
                  <p className="text-[10px] text-muted-foreground">{lectures.length} lectures · {lectures.filter(l => l.done).length} done</p>
                </div>
                <button onClick={() => setShowMenu(false)} className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground"><X size={14} /></button>
              </div>

              <div className="space-y-1.5">
                {!allDone && (
                  <button onClick={markAllDone} className="w-full p-3 rounded-xl bg-green-500/10 hover:bg-green-500/15 flex items-center gap-3 transition active:scale-95">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-sm font-semibold text-green-300">Mark All Done</span>
                  </button>
                )}
                {allDone && lectures.length > 0 && (
                  <button onClick={resetAll} className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 flex items-center gap-3 transition active:scale-95">
                    <RotateCcw size={18} className="text-amber-400" />
                    <span className="text-sm font-semibold text-amber-300">Reset All (Mark Undone)</span>
                  </button>
                )}
                <button onClick={handleDelete} className="w-full p-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 flex items-center gap-3 transition active:scale-95">
                  <Trash2 size={18} className="text-red-400" />
                  <span className="text-sm font-semibold text-red-300">Delete Chapter</span>
                </button>
              </div>
              <p className="text-[9px] text-white/30 text-center mt-3">Long-press any chapter to see this menu</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SubjectHeader({ name, color, count, lectureCount, overallPct, onAdd, isActive }: {
  name: string;
  color: { hex: string; glow: string };
  count: number;
  lectureCount: number;
  overallPct: number;
  onAdd: () => void;
  isActive?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const collapseKey = `neet-collapse-syllabus-subj-${name}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(collapseKey);
      if (v === '1') setCollapsed(true);
    } catch {}
  }, [collapseKey]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(collapseKey, next ? '1' : '0'); } catch {}
  };

  // Notify parent of collapse state via a custom event
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('syllabus-subject-collapse', { detail: { subject: name, collapsed } }));
  }, [name, collapsed]);

  // Distinct shape per subject for at-a-glance recognition (matches StudyTab)
  const shapes: Record<string, React.ReactNode> = {
    Physics:   <circle cx="8" cy="8" r="6" fill={color.hex} />,
    Chemistry: <rect x="2" y="2" width="12" height="12" rx="3" fill={color.hex} />,
    Botany:    <path d="M8 2 L14 14 L2 14 Z" fill={color.hex} />,
    Zoology:   <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color.hex} />,
    General:   <rect x="4" y="4" width="8" height="8" rx="1" fill={color.hex} />,
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-1 py-1 rounded-md transition',
        isActive && 'glow-pulse'
      )}
      style={{
        ['--glow-color' as string]: color.glow,
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-foreground/10 rounded transition"
        aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={12} style={{ color: color.hex }} />
        </motion.div>
      </button>

      {/* Subject icon — distinct shape per subject */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
        {shapes[name]}
      </svg>

      {/* Subject name */}
      <span className="text-sm font-black uppercase tracking-wider" style={{ color: color.hex }}>
        {name}
      </span>

      {/* Stats: % · lecture count · chapter count */}
      <span className="text-[10px] tabular" style={{ color: 'var(--muted-foreground)' }}>
        <span className="font-bold" style={{ color: overallPct >= 70 ? '#22c55e' : overallPct >= 30 ? '#f59e0b' : '#ef4444' }}>
          {overallPct}%
        </span>
        {' · '}
        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{lectureCount}</span> lec
        {' · '}
        {count} {count === 1 ? 'chapter' : 'chapters'}
      </span>

      <div className="flex-1" />

      {/* Add chapter button */}
      <button
        onClick={onAdd}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-90 shrink-0"
        style={{ background: `${color.hex}15`, color: color.hex }}
        aria-label={`Add chapter to ${name}`}
        title={`Add chapter to ${name}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function FilterPill({ active, onClick, children, color, small, count }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: { hex: string }; small?: boolean; count?: number }) {
  return (
    <button
      onClick={() => { onClick(); vibrate(6); }}
      className={cn(
        'rounded-full font-medium whitespace-nowrap transition shrink-0 flex items-center gap-1',
        small ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
        active ? 'text-black font-bold' : 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
      )}
      style={active ? { background: color?.hex ?? '#14b8a6' } : color ? { background: `${color.hex}15`, color: color.hex, border: `1px solid ${color.hex}25` } : undefined}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn('tabular font-bold', small ? 'text-[9px]' : 'text-[10px]', active ? 'text-black/70' : 'opacity-60')}>
          {count}
        </span>
      )}
    </button>
  );
}

function FormulaVaultInline({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto glass-strong rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Formula Vault</h2><button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">✕</button></div>
        <FormulaVault />
      </div>
    </div>
  );
}

// === Chapter Context Menu — shown on long-press in normal mode ===
function ChapterContextMenu({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  const allLectures = useSyllabus((s) => s.lectures);
  const deleteChapter = useSyllabus((s) => s.deleteChapter);
  const updateLecture = useSyllabus((s) => s.updateLecture);
  const lectures = useMemo(() => allLectures.filter((l) => l.chapterId === chapter.id), [allLectures, chapter.id]);
  const allDone = lectures.length > 0 && lectures.every((l) => l.done);

  const markAllDone = () => {
    vibrate(15);
    lectures.forEach((l) => { if (!l.done) updateLecture(l.id, { done: true }); });
    onClose();
  };
  const resetAll = () => {
    vibrate(15);
    lectures.forEach((l) => { if (l.done) updateLecture(l.id, { done: false }); });
    onClose();
  };
  const handleDelete = () => {
    vibrate([10, 30, 10]);
    deleteChapter(chapter.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass-strong rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold">{chapter.name}</h3>
            <p className="text-[10px] text-muted-foreground">{lectures.length} lectures · {lectures.filter(l => l.done).length} done</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground"><X size={14} /></button>
        </div>

        <div className="space-y-1.5">
          {!allDone && (
            <button onClick={markAllDone} className="w-full p-3 rounded-xl bg-green-500/10 hover:bg-green-500/15 flex items-center gap-3 transition active:scale-95">
              <CheckCircle2 size={18} className="text-green-400" />
              <span className="text-sm font-semibold text-green-300">Mark All Done</span>
            </button>
          )}
          {allDone && lectures.length > 0 && (
            <button onClick={resetAll} className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 flex items-center gap-3 transition active:scale-95">
              <RotateCcw size={18} className="text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">Reset All (Mark Undone)</span>
            </button>
          )}
          <button onClick={handleDelete} className="w-full p-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 flex items-center gap-3 transition active:scale-95">
            <Trash2 size={18} className="text-red-400" />
            <span className="text-sm font-semibold text-red-300">Delete Chapter</span>
          </button>
        </div>
        <p className="text-[9px] text-white/30 text-center mt-3">Long-press any chapter to see this menu</p>
      </motion.div>
    </motion.div>
  );
}
