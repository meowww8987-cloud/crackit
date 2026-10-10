'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, BookOpen, ChevronRight, ChevronLeft, BookOpen as LecIcon, FileText, StickyNote, RefreshCw, Star, Atom, FlaskConical, Leaf, Dna, Layers } from 'lucide-react';
import { useTargets } from '@/lib/store/targets';
import { useSyllabus } from '@/lib/store/syllabus';
import { useSession } from '@/lib/store/session';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, todayKey, vibrate } from '@/lib/utils';
import { getLearnedExpectedMinutes } from '@/lib/store/learnedTime';

interface Props {
  editing?: Target | null;
  /** Pre-fill the sheet from another entry point (e.g., SyllabusTab's
   * "+ To Today" button on the assignment pop). Skips Step 1 entirely. */
  prefill?: {
    subject: Subject;
    chapterId: string;
    activity: ActivityType;
  } | null;
  onClose: () => void;
}

// Activity config with colors + icons
const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof BookOpen; color: string; label: string }> = {
  Lecture:   { icon: BookOpen,   color: '#3b82f6', label: 'Lecture' },
  DPP:       { icon: FileText,   color: '#f59e0b', label: 'DPP' },
  Notes:     { icon: StickyNote, color: '#a855f7', label: 'Notes' },
  Revision:  { icon: RefreshCw,  color: '#22c55e', label: 'Revision' },
  Assignment:{ icon: FileText,   color: '#7c3aed', label: 'Assignment' },
  Custom:    { icon: Star,       color: '#6b7280', label: 'Custom' },
};
const ACTIVITIES = Object.keys(ACTIVITY_CONFIG) as ActivityType[];

// Subject icons — each subject gets a unique icon (not just a color dot)
const SUBJECT_ICONS: Record<string, typeof Atom> = {
  Physics:   Atom,
  Chemistry: FlaskConical,
  Botany:    Leaf,
  Zoology:   Dna,
  General:   Layers,
};

// Preset snap points for the expected time slider — must match slider range
const TIME_PRESETS = [30, 45, 60, 90, 120, 150, 180];

export function AddTargetSheet({ editing, prefill, onClose }: Props) {
  const addTarget = useTargets((s) => s.addTarget);
  const updateTarget = useTargets((s) => s.updateTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);

  const syllabusSubjects = useSyllabus((s) => s.subjects);
  const syllabusChapters = useSyllabus((s) => s.chapters);
  const syllabusLectures = useSyllabus((s) => s.lectures);

  // === Smart default subject: use the subject from the active session,
  // or the subject of the last saved session. Falls back to first syllabus subject.
  const activeSession = useSession((s) => s.active);
  const smartDefaultSubject = useMemo<Subject>(() => {
    if (editing?.subject) return editing.subject;
    if (prefill?.subject) return prefill.subject;
    if (activeSession?.subject) return activeSession.subject;
    return (syllabusSubjects[0]?.name as Subject) || 'Physics';
  }, [editing, prefill, activeSession, syllabusSubjects]);

  // Form state
  // When prefill is set, jump straight to Step 2 (chapter already chosen).
  const [step, setStep] = useState<1 | 2 | 3>(editing ? 3 : prefill ? 2 : 1);
  const [subject, setSubject] = useState<Subject>(smartDefaultSubject);
  const [activity, setActivity] = useState<ActivityType>(
    editing?.activity || prefill?.activity || 'Lecture'
  );
  // Initialize expectedMinutes with learned time for the default subject+activity.
  // This avoids a flicker from 60 → learned value on first render.
  const [expectedMinutes, setExpectedMinutes] = useState(
    editing?.expectedMinutes || getLearnedExpectedMinutes(smartDefaultSubject, editing?.activity || prefill?.activity || 'Lecture')
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    editing?.chapterId || prefill?.chapterId || ''
  );
  const [selectedLectureIds, setSelectedLectureIds] = useState<Set<string>>(
    new Set(editing?.lectureId ? [editing.lectureId] : [])
  );
  // === Assignment multi-select — mirrors selectedLectureIds ===
  // When the user picks activity=Assignment and a chapter, they can pick
  // one or more specific assignments from that chapter's assignment list.
  // Each selected assignment becomes its own target linked via assignmentId.
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(
    new Set(editing?.assignmentId ? [editing.assignmentId] : [])
  );
  const [customTopic, setCustomTopic] = useState(
    editing?.isChapterTarget ? '' : (editing?.topic && !editing.lectureId ? editing.topic : '')
  );

  // Auto-fill expected time from learned patterns
  useEffect(() => {
    if (editing) return;
    const learned = getLearnedExpectedMinutes(subject, activity);
    setExpectedMinutes(learned);
  }, [subject, activity, editing]);

  // Chapters for selected subject
  const availableChapters = useMemo(() => {
    const subjEntity = syllabusSubjects.find((s) => s.name === subject);
    if (!subjEntity) return [];
    return syllabusChapters.filter((c) => c.subjectId === subjEntity.id);
  }, [subject, syllabusSubjects, syllabusChapters]);

  // Lectures for selected chapter
  const availableLectures = useMemo(() => {
    if (!selectedChapterId) return [];
    return syllabusLectures
      .filter((l) => l.chapterId === selectedChapterId)
      .sort((a, b) => a.lecNo - b.lecNo);
  }, [selectedChapterId, syllabusLectures]);

  // === Assignments for selected chapter ===
  // Sourced from chapter.assignments array. Mirrors availableLectures.
  const availableAssignments = useMemo(() => {
    if (!selectedChapterId) return [];
    const ch = syllabusChapters.find((c) => c.id === selectedChapterId);
    return ch?.assignments || [];
  }, [selectedChapterId, syllabusChapters]);

  const selectedChapter = syllabusChapters.find((c) => c.id === selectedChapterId);

  // === Auto-scroll to the chapter the user is currently studying ===
  // If there's an active session, find its chapter in the list and scroll to it.
  // Skip this entirely when prefill is set (user explicitly chose a chapter).
  const chapterListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefill || editing) return; // respect explicit choices
    if (step !== 2 || !chapterListRef.current) return;
    // If the user has an active session, find the matching chapter
    if (activeSession?.chapter) {
      const matchCh = availableChapters.find((c) => c.name === activeSession.chapter);
      if (matchCh) {
        // Auto-select it + scroll to it
        setSelectedChapterId(matchCh.id);
        setTimeout(() => {
          const el = chapterListRef.current?.querySelector(`[data-chapter-id="${matchCh.id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [step, activeSession, availableChapters, prefill, editing]);

  const toggleLecture = (lecId: string) => {
    vibrate(6);
    setSelectedLectureIds((prev) => {
      const next = new Set(prev);
      if (next.has(lecId)) next.delete(lecId);
      else next.add(lecId);
      return next;
    });
  };

  const selectAllLectures = () => {
    vibrate(8);
    if (selectedLectureIds.size === availableLectures.length) {
      setSelectedLectureIds(new Set());
    } else {
      setSelectedLectureIds(new Set(availableLectures.map((l) => l.id)));
    }
  };

  // === Assignment multi-select helpers — mirror toggleLecture/selectAllLectures ===
  // Picking any assignment implicitly sets activity='Assignment' (and hides lectures,
  // since lectures are only relevant for non-assignment activities). Picking the last
  // assignment OFF reverts activity back to 'Lecture' so the lectures picker reappears.
  const toggleAssignment = (aId: string) => {
    vibrate(6);
    setSelectedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(aId)) {
        next.delete(aId);
        // If we just removed the last assignment, revert activity to Lecture
        // (so the lectures picker reappears and the activity picker unlocks).
        if (next.size === 0 && selectedLectureIds.size === 0) {
          setActivity('Lecture');
        }
      } else {
        next.add(aId);
        // Picking an assignment locks activity to Assignment
        setActivity('Assignment');
      }
      return next;
    });
  };

  const selectAllAssignments = () => {
    vibrate(8);
    if (selectedAssignmentIds.size === availableAssignments.length) {
      // Deselecting all → revert activity if no lectures
      setSelectedAssignmentIds(new Set());
      if (selectedLectureIds.size === 0) setActivity('Lecture');
    } else {
      setSelectedAssignmentIds(new Set(availableAssignments.map((a) => a.id)));
      setActivity('Assignment');
    }
  };

  const isAssignment = activity === 'Assignment';
  // Assignment is chapter-level — submit is allowed if a chapter is selected AND
  // (the user picked at least one specific assignment OR there are no assignments
  // in the chapter to pick from, OR they typed a custom topic).
  const assignmentHasSelection = selectedAssignmentIds.size > 0;
  const canSubmit = selectedChapterId && (
    (isAssignment && (assignmentHasSelection || availableAssignments.length === 0 || customTopic.trim() !== '')) ||
    (!isAssignment && (selectedLectureIds.size > 0 || customTopic.trim() || activity !== 'Lecture'))
  );
  const canProceedStep2 = selectedChapterId;

  const handleSubmit = () => {
    if (!selectedChapterId || !selectedChapter) return;
    vibrate(15);

    const targetsToAdd: Parameters<typeof addTarget>[0][] = [];

    // === Assignment: one target per selected assignment (linked via assignmentId) ===
    // Falls back to chapter-level target when the user hasn't picked any specific
    // assignment (e.g., chapter has no assignments yet, or they typed a custom topic).
    if (isAssignment) {
      if (selectedAssignmentIds.size > 0) {
        for (const aId of selectedAssignmentIds) {
          const a = availableAssignments.find((x) => x.id === aId);
          if (!a) continue;
          targetsToAdd.push({
            date: todayKey(), subject, activity: 'Assignment',
            chapter: selectedChapter.name,
            topic: a.name,
            expectedMinutes, chapterId: selectedChapterId,
            assignmentId: a.id, isChapterTarget: true,
          });
        }
      } else {
        // Fall back to chapter-level (no specific assignment picked)
        targetsToAdd.push({
          date: todayKey(), subject, activity: 'Assignment',
          chapter: selectedChapter.name,
          topic: customTopic.trim() || `Assignment: ${selectedChapter.name}`,
          expectedMinutes, chapterId: selectedChapterId, isChapterTarget: true,
        });
      }
    } else if (selectedLectureIds.size > 0) {
      for (const lecId of selectedLectureIds) {
        const lec = syllabusLectures.find((l) => l.id === lecId);
        if (!lec) continue;
        targetsToAdd.push({
          date: todayKey(), subject, activity,
          chapter: selectedChapter.name, lecture: `L${lec.lecNo}`,
          topic: lec.topic, expectedMinutes,
          lectureId: lec.id, chapterId: selectedChapterId,
        });
      }
    } else if (customTopic.trim()) {
      targetsToAdd.push({
        date: todayKey(), subject, activity,
        chapter: selectedChapter.name, topic: customTopic.trim(),
        expectedMinutes, chapterId: selectedChapterId, isChapterTarget: true,
      });
    } else if (activity !== 'Lecture') {
      targetsToAdd.push({
        date: todayKey(), subject, activity,
        chapter: selectedChapter.name, topic: `${activity}: ${selectedChapter.name}`,
        expectedMinutes, chapterId: selectedChapterId, isChapterTarget: true,
      });
    }

    if (editing) {
      if (targetsToAdd.length > 0) updateTarget(editing.id, targetsToAdd[0]);
    } else {
      targetsToAdd.forEach((t) => addTarget(t));
    }
    onClose();
  };

  const color = subjectColor(subject);
  const actConfig = ACTIVITY_CONFIG[activity];

  const isLectureAdded = (lecId: string) => {
    if (editing) return false;
    const lec = syllabusLectures.find((l) => l.id === lecId);
    if (!lec || !selectedChapter) return false;
    return isAlreadyAdded(subject, selectedChapter.name, 'Lecture', `L${lec.lecNo}`);
  };

  // === Mirror of isLectureAdded for assignments ===
  // Scans today's targets for one that's already been added with the same
  // (subject + chapter + Assignment + assignmentId). We can't reuse
  // isAlreadyAdded directly because that one matches by lecture label.
  const todaysTargets = useTargets((s) => s.byDate[todayKey()] || []);
  const isAssignmentAdded = (aId: string) => {
    if (editing) return false;
    if (!selectedChapter) return false;
    return todaysTargets.some(
      (t) =>
        t.subject === subject &&
        t.chapter === selectedChapter.name &&
        t.activity === 'Assignment' &&
        t.assignmentId === aId
    );
  };

  // Snap the slider to the nearest preset
  const snapToPreset = (val: number) => {
    let closest = TIME_PRESETS[0];
    let minDiff = Math.abs(val - closest);
    for (const p of TIME_PRESETS) {
      const diff = Math.abs(val - p);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }
    // Only snap if within 7 min of a preset
    return minDiff <= 7 ? closest : Math.max(30, Math.round(val / 5) * 5);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-3xl max-h-[85vh] flex flex-col"
        style={{ borderTop: `3px solid ${color.hex}` }}
      >
        {/* === Header with step indicator === */}
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step > 1 && !editing && (
                <button
                  onClick={() => { setStep((step - 1) as 1 | 2 | 3); vibrate(8); }}
                  className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <h2 className="text-lg font-bold">{editing ? 'Edit Target' : 'Add Target'}</h2>
            </div>
            {/* Step indicator */}
            {!editing && (
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={cn('h-1.5 rounded-full transition-all', s === step ? 'w-6 bg-teal-400' : s < step ? 'w-1.5 bg-teal-400/50' : 'w-1.5 bg-foreground/15')}
                  />
                ))}
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* === Step content (slides in from right) === */}
        <div className="overflow-y-auto scroll-area flex-1">
          <AnimatePresence mode="wait">
            {/* === STEP 1: Pick Subject === */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4"
              >
                <label className="text-xs font-semibold text-muted-foreground mb-3 block">PICK A SUBJECT</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {SUBJECTS.map((s) => {
                    const c = subjectColor(s);
                    const sel = subject === s;
                    const hasSyllabus = syllabusSubjects.some((sub) => sub.name === s);
                    const SubjIcon = SUBJECT_ICONS[s] || Layers;
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          setSubject(s);
                          setSelectedChapterId('');
                          setSelectedLectureIds(new Set());
                          vibrate(10);
                          // Auto-advance to Step 2 on subject select
                          if (!editing) setStep(2);
                        }}
                        className={cn(
                          'py-4 rounded-2xl text-sm font-bold transition border relative flex flex-col items-center gap-1.5',
                          sel ? 'text-black' : 'text-adaptive'
                        )}
                        style={sel
                          ? { background: c.hex, borderColor: c.hex }
                          : { background: `${c.hex}10`, borderColor: `${c.hex}30` }
                        }
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={sel
                            ? { background: 'rgba(0,0,0,0.15)' }
                            : { background: `${c.hex}20` }
                          }
                        >
                          <SubjIcon size={18} style={{ color: sel ? '#000' : c.hex }} />
                        </div>
                        {s}
                        {hasSyllabus && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Smart hint */}
                {activeSession?.subject && (
                  <p className="text-[10px] text-teal-400/70 mt-3 text-center">
                    ✦ {activeSession.subject} is highlighted because you're currently studying it
                  </p>
                )}
              </motion.div>
            )}

            {/* === STEP 2: Pick Chapter + Lecture (auto-scroll to current) === */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4"
              >
                <label className="text-xs font-semibold text-muted-foreground mb-2 block flex items-center gap-1">
                  <BookOpen size={11} /> CHAPTER
                </label>
                {availableChapters.length === 0 ? (
                  <div className="glass rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-2">No {subject} chapters in your syllabus yet.</p>
                    <p className="text-[10px] text-teal-400">Long-press Syllabus tab → Build Syllabus</p>
                  </div>
                ) : (
                  <div ref={chapterListRef} className="space-y-1 max-h-44 overflow-y-auto scroll-area">
                    {availableChapters.map((ch) => {
                      const sel = selectedChapterId === ch.id;
                      const chLecCount = syllabusLectures.filter((l) => l.chapterId === ch.id).length;
                      const isCurrent = activeSession?.chapter === ch.name;
                      return (
                        <button
                          key={ch.id}
                          data-chapter-id={ch.id}
                          onClick={() => {
                            setSelectedChapterId(ch.id);
                            setSelectedLectureIds(new Set());
                            setCustomTopic('');
                            vibrate(8);
                          }}
                          className={cn(
                            'w-full p-2.5 rounded-xl flex items-center gap-2 transition border',
                            sel ? 'border-2' : 'border border-foreground/10 bg-foreground/[0.04] hover:bg-foreground/[0.07]'
                          )}
                          style={sel ? { background: `${color.hex}15`, borderColor: color.hex } : undefined}
                        >
                          <div className="w-1 h-6 rounded" style={{ background: color.hex }} />
                          <span className="text-xs font-medium flex-1 text-left truncate">{ch.name}</span>
                          {isCurrent && <span className="text-[8px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-full">STUDYING</span>}
                          <span className="text-[9px] text-muted-foreground/60 tabular">{chLecCount} lec</span>
                          {sel && <Check size={14} style={{ color: color.hex }} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* === Side-by-side two-column selector: Lecture | Assignment ===
                    Replaces the previous stacked (up/down) layout. Default = Lecture.
                    Selected column gets its colour; only the matching picker shows below. */}
                {selectedChapterId && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {/* Lecture column */}
                    <button
                      onClick={() => {
                        if (isAssignment) {
                          // Switching from Assignment → Lecture: clear assignment
                          // selections so they don't get submitted by accident.
                          setSelectedAssignmentIds(new Set());
                          setActivity('Lecture');
                          vibrate(8);
                        }
                      }}
                      className={cn(
                        'py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition border',
                        !isAssignment ? 'border-2' : 'border border-foreground/10 bg-foreground/[0.04]'
                      )}
                      style={!isAssignment ? { background: `${color.hex}20`, borderColor: color.hex } : undefined}
                    >
                      <BookOpen size={14} style={{ color: !isAssignment ? color.hex : 'var(--muted-foreground, rgba(128,128,128,0.6))' }} />
                      <span className="text-[11px] font-bold" style={{ color: !isAssignment ? color.hex : 'var(--muted-foreground, rgba(128,128,128,0.6))' }}>
                        Lecture{availableLectures.length > 0 && (
                          <span className="ml-1 tabular opacity-70">{availableLectures.length}</span>
                        )}
                      </span>
                    </button>
                    {/* Assignment column */}
                    <button
                      onClick={() => {
                        if (!isAssignment) {
                          // Switching from Lecture → Assignment: clear lecture
                          // selections (assignment targets are inherently Assignment activity).
                          setSelectedLectureIds(new Set());
                          setActivity('Assignment');
                          vibrate(8);
                        }
                      }}
                      className={cn(
                        'py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition border',
                        isAssignment ? 'border-2' : 'border border-foreground/10 bg-foreground/[0.04]'
                      )}
                      style={isAssignment ? { background: 'rgba(168,85,247,0.18)', borderColor: '#a855f7' } : undefined}
                    >
                      <FileText size={14} style={{ color: isAssignment ? '#a855f7' : 'var(--muted-foreground, rgba(128,128,128,0.6))' }} />
                      <span className="text-[11px] font-bold" style={{ color: isAssignment ? '#a855f7' : 'var(--muted-foreground, rgba(128,128,128,0.6))' }}>
                        Assignment{availableAssignments.length > 0 && (
                          <span className="ml-1 tabular opacity-70">{availableAssignments.length}</span>
                        )}
                      </span>
                    </button>
                  </div>
                )}

                {/* === Lecture picker — only shown when Lecture column is selected === */}
                {selectedChapterId && !isAssignment && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-muted-foreground">LECTURES</label>
                      {availableLectures.length > 0 && (
                        <button onClick={selectAllLectures} className="text-[10px] text-teal-400">
                          {selectedLectureIds.size === availableLectures.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    {availableLectures.length === 0 ? (
                      <div className="rounded-xl p-3 text-center" style={{ background: `${color.hex}08`, border: `1px dashed ${color.hex}30` }}>
                        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>No lectures in this chapter yet</p>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto scroll-area">
                        {availableLectures.map((lec) => {
                          const sel = selectedLectureIds.has(lec.id);
                          const already = isLectureAdded(lec.id);
                          return (
                            <button
                              key={lec.id}
                              onClick={() => !already && toggleLecture(lec.id)}
                              disabled={already}
                              className={cn(
                                'w-full p-2 rounded-lg flex items-center gap-2 transition',
                                sel ? 'bg-teal-500/15' : 'bg-foreground/[0.03] hover:bg-foreground/[0.07]',
                                already && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <div
                                className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                                style={sel ? { background: color.hex, borderColor: color.hex } : { borderColor: 'rgba(255,255,255,0.2)' }}
                              >
                                {sel && <Check size={10} className="text-black" strokeWidth={3} />}
                                {already && !sel && <Check size={10} className="text-green-400" strokeWidth={3} />}
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground tabular w-6">L{lec.lecNo}</span>
                              <span className={cn('text-xs truncate flex-1 text-left', sel ? 'text-foreground' : 'text-muted-foreground')}>{lec.topic}</span>
                              {already && <span className="text-[9px] text-green-400 font-bold">ADDED</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* === Assignment picker — only shown when Assignment column is selected === */}
                {selectedChapterId && isAssignment && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <FileText size={11} style={{ color: '#a855f7' }} /> ASSIGNMENTS
                      </label>
                      {availableAssignments.length > 0 && (
                        <button onClick={selectAllAssignments} className="text-[10px] text-teal-400">
                          {selectedAssignmentIds.size === availableAssignments.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    {availableAssignments.length === 0 ? (
                      <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(168,85,247,0.05)', border: '1px dashed rgba(168,85,247,0.25)' }}>
                        <p className="text-[10px]" style={{ color: 'rgba(168,85,247,0.85)' }}>No assignments in this chapter yet</p>
                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Add via Syllabus tab → chapter → Assignment</p>
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto scroll-area">
                        {availableAssignments.map((a) => {
                          const sel = selectedAssignmentIds.has(a.id);
                          const already = isAssignmentAdded(a.id);
                          return (
                            <button
                              key={a.id}
                              onClick={() => !already && toggleAssignment(a.id)}
                              disabled={already}
                              className={cn(
                                'w-full p-2 rounded-lg flex items-center gap-2 transition',
                                sel ? 'bg-teal-500/15' : 'bg-foreground/[0.03] hover:bg-foreground/[0.07]',
                                already && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <div
                                className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                                style={sel ? { background: '#a855f7', borderColor: '#a855f7' } : { borderColor: 'rgba(255,255,255,0.2)' }}
                              >
                                {sel && <Check size={10} className="text-black" strokeWidth={3} />}
                                {already && !sel && <Check size={10} className="text-green-400" strokeWidth={3} />}
                              </div>
                              <FileText size={10} style={{ color: '#a855f7' }} className="shrink-0" />
                              <span className={cn('text-xs truncate flex-1 text-left', sel ? 'text-foreground' : 'text-muted-foreground')}>{a.name}</span>
                              {a.doneCount > 0 && (
                                <span className="text-[9px] tabular font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{a.doneCount}×</span>
                              )}
                              {already && <span className="text-[9px] text-green-400 font-bold">ADDED</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* === STEP 3: Confirm (activity + expected time + topic) === */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4"
              >
                {/* Summary of selection */}
                <div className="glass rounded-2xl p-3 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color.hex}22` }}>
                    <div className="w-3 h-3 rounded" style={{ background: color.hex }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold" style={{ color: color.hex }}>{subject}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{selectedChapter?.name || 'No chapter'}</div>
                  </div>
                  {selectedLectureIds.size > 0 && (
                    <span className="text-[10px] text-teal-400 font-bold">{selectedLectureIds.size} lec</span>
                  )}
                  {selectedAssignmentIds.size > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{selectedAssignmentIds.size} asg</span>
                  )}
                </div>

                {/* Activity picker — color-coded with icons.
                    When assignments are picked, activity is locked to Assignment
                    (assignment targets are inherently Assignment activity). */}
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  ACTIVITY{selectedAssignmentIds.size > 0 && ' · locked (Assignment)'}
                </label>
                <div className="flex gap-2 mb-4">
                  {ACTIVITIES.map((a) => {
                    const cfg = ACTIVITY_CONFIG[a];
                    const Icon = cfg.icon;
                    const sel = activity === a;
                    const locked = selectedAssignmentIds.size > 0 && a !== 'Assignment';
                    return (
                      <button
                        key={a}
                        onClick={() => { if (!locked) { setActivity(a); vibrate(8); } }}
                        disabled={locked}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl flex flex-col items-center gap-1 transition border',
                          sel ? 'border-2' : 'border border-foreground/10 bg-foreground/[0.04]',
                          locked && 'opacity-30 cursor-not-allowed'
                        )}
                        style={sel ? { background: `${cfg.color}20`, borderColor: cfg.color } : undefined}
                      >
                        <Icon size={16} style={{ color: sel ? cfg.color : 'var(--muted-foreground, rgba(128,128,128,0.6))' }} />
                        <span className="text-[9px] font-semibold" style={{ color: sel ? cfg.color : 'var(--muted-foreground, rgba(128,128,128,0.6))' }}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Expected time — slider with preset snap points */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground">EXPECTED TIME</label>
                    <span className="text-lg font-bold tabular" style={{ color: actConfig.color }}>{expectedMinutes} min</span>
                  </div>
                  {/* Slider */}
                  <ScrollAwareSlider>
                    <input
                      type="range"
                      min={30}
                      max={180}
                      step={5}
                      value={expectedMinutes}
                      onChange={(e) => setExpectedMinutes(Number(e.target.value))}
                      onMouseUp={(e) => setExpectedMinutes(snapToPreset(Number((e.target as HTMLInputElement).value)))}
                      onTouchEnd={(e) => setExpectedMinutes(snapToPreset(Number((e.target as HTMLInputElement).value)))}
                      className="w-full"
                      style={{ accentColor: actConfig.color }}
                    />
                  </ScrollAwareSlider>
                  {/* Preset snap buttons */}
                  <div className="flex justify-between mt-2">
                    {TIME_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setExpectedMinutes(p); vibrate(6); }}
                        className={cn(
                          'px-2 py-1 rounded-lg text-[10px] font-bold transition',
                          expectedMinutes === p ? 'text-black' : 'text-muted-foreground bg-foreground/5 hover:bg-foreground/10'
                        )}
                        style={expectedMinutes === p ? { background: actConfig.color } : undefined}
                      >
                        {p}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom topic (for non-lecture or custom). Hidden when assignments are picked
                    because each assignment target uses the assignment name as its topic. */}
                {activity !== 'Lecture' && selectedLectureIds.size === 0 && selectedAssignmentIds.size === 0 && (
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">TOPIC (optional)</label>
                    <input
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder={`e.g. ${activity} practice`}
                      className="w-full bg-foreground/5 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* === Footer with Next / Create button === */}
        <div className="sticky bottom-0 z-10 px-5 py-3 glass rounded-b-3xl" style={{ borderTop: '1px solid var(--border)' }}>
          {step === 1 && (
            <p className="text-[10px] text-muted-foreground/60 text-center py-3">Tap a subject to continue</p>
          )}
          {step === 2 && (
            <button
              onClick={() => {
                if (canProceedStep2) {
                  // If assignments are picked, activity is already locked to Assignment
                  // by toggleAssignment. If lectures are picked (no assignments), activity
                  // stays at user's choice (defaults to Lecture). Either way, proceed to step 3.
                  setStep(3);
                  vibrate(10);
                }
              }}
              disabled={!canProceedStep2}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2',
                canProceedStep2 ? 'text-black' : 'bg-foreground/5 text-muted-foreground/60 cursor-not-allowed'
              )}
              style={canProceedStep2 ? { background: color.hex } : undefined}
            >
              {(() => {
                const total = selectedLectureIds.size + selectedAssignmentIds.size;
                if (total > 0) return `Next (${total} selected)`;
                return 'Next';
              })()} <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98]',
                canSubmit ? 'text-black' : 'bg-foreground/5 text-muted-foreground/60 cursor-not-allowed'
              )}
              style={canSubmit ? { background: color.hex } : undefined}
            >
              {editing ? 'Update Target' : (() => {
                const total = selectedLectureIds.size + selectedAssignmentIds.size;
                return total > 0 ? `Add ${total} Target${total > 1 ? 's' : ''}` : 'Add Target';
              })()}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
