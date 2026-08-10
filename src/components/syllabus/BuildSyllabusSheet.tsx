'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ChevronRight, ChevronDown, Search, BookOpen, Layers } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor } from '@/lib/colors';
import { getChaptersForSubject, getNEETSubjects } from '@/lib/neetSyllabus';
import type { Subject } from '@/lib/types';
import { cn, vibrate, todayKey } from '@/lib/utils';
import { useTargets } from '@/lib/store/targets';

interface Props {
  onClose: () => void;
  showToast?: (msg: string, sub?: string) => void;
}

export function BuildSyllabusSheet({ onClose, showToast }: Props) {
  const { addSubject, addChapter, addLecture, subjects: existingSubjects } = useSyllabus();
  const addTarget = useTargets((s) => s.addTarget);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [selectedLectureKeys, setSelectedLectureKeys] = useState<Set<string>>(new Set()); // `${chapterId}-${lecNo}`
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addToToday, setAddToToday] = useState(true);

  const neetSubjects = getNEETSubjects();

  const chapters = useMemo(() => {
    if (!selectedSubject) return [];
    return getChaptersForSubject(selectedSubject);
  }, [selectedSubject]);

  const filteredChapters = useMemo(() => {
    if (!search) return chapters;
    return chapters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [chapters, search]);

  // Group chapters by category
  const groupedChapters = useMemo(() => {
    const map: Record<string, typeof filteredChapters> = {};
    for (const ch of filteredChapters) {
      const cat = ch.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(ch);
    }
    return map;
  }, [filteredChapters]);

  // Check if subject already exists in user's syllabus
  const subjectExists = (subj: Subject) => existingSubjects.some((s) => s.name === subj);

  const handleSubjectPick = (subj: Subject) => {
    vibrate(12);
    if (!subjectExists(subj)) {
      addSubject(subj);
    }
    setSelectedSubject(subj);
    setStep(2);
  };

  const toggleChapter = (chapterId: string) => {
    vibrate(8);
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
        // Also remove its lectures from selection
        setSelectedLectureKeys((lprev) => {
          const lnext = new Set(lprev);
          for (const key of lnext) {
            if (key.startsWith(chapterId + '-')) lnext.delete(key);
          }
          return lnext;
        });
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const toggleLecture = (chapterId: string, lecNo: number) => {
    vibrate(6);
    const key = `${chapterId}-${lecNo}`;
    setSelectedLectureKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllLecturesInChapter = (chapterId: string) => {
    vibrate(8);
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    setSelectedLectureKeys((prev) => {
      const next = new Set(prev);
      const allSelected = chapter.lectures.every((l) => next.has(`${chapterId}-${l.lecNo}`));
      for (const l of chapter.lectures) {
        const key = `${chapterId}-${l.lecNo}`;
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const selectedChapters = useMemo(() => {
    return chapters.filter((c) => selectedChapterIds.has(c.id));
  }, [chapters, selectedChapterIds]);

  const selectedLectureCount = selectedLectureKeys.size;

  const handleConfirm = () => {
    if (!selectedSubject || selectedChapterIds.size === 0) return;
    vibrate(15);

    // Find the subject entity (just created or existing)
    const subjectEntity = useSyllabus.getState().subjects.find((s) => s.name === selectedSubject);
    if (!subjectEntity) return;

    let chaptersAdded = 0;
    let lecturesAdded = 0;
    let targetsAdded = 0;

    for (const chId of selectedChapterIds) {
      const neetChapter = chapters.find((c) => c.id === chId);
      if (!neetChapter) continue;

      // Check if chapter already exists (by name + subject)
      const existingCh = useSyllabus.getState().chapters.find(
        (c) => c.subjectId === subjectEntity.id && c.name === neetChapter.name
      );
      const chapterId = existingCh?.id || addChapter(subjectEntity.id, neetChapter.name);
      chaptersAdded++;

      // Add lectures — either all selected ones, or all default lectures if none selected
      const selectedLecsForChapter = neetChapter.lectures.filter((l) =>
        selectedLectureKeys.has(`${chId}-${l.lecNo}`)
      );
      const lecturesToAdd = selectedLecsForChapter.length > 0 ? selectedLecsForChapter : neetChapter.lectures;

      for (const lec of lecturesToAdd) {
        // Check if lecture already exists
        const existingLec = useSyllabus.getState().lectures.find(
          (l) => l.chapterId === chapterId && l.lecNo === lec.lecNo && !l.isCustom
        );
        if (existingLec) continue;

        const lecId = addLecture(chapterId, lec.topic);
        lecturesAdded++;

        // Add to today if requested and this lecture was explicitly selected
        if (addToToday && selectedLecsForChapter.length > 0) {
          addTarget({
            date: todayKey(),
            subject: selectedSubject,
            activity: 'Lecture',
            chapter: neetChapter.name,
            lecture: `L${lec.lecNo}`,
            topic: lec.topic,
            expectedMinutes: 60,
            lectureId: lecId,
            chapterId,
          });
          targetsAdded++;
        }
      }
    }

    if (showToast) {
      const parts: string[] = [`${chaptersAdded} chapters`, `${lecturesAdded} lectures`];
      if (targetsAdded > 0) parts.push(`${targetsAdded} today targets`);
      showToast(
        targetsAdded > 0 ? `✅ Syllabus built + ${targetsAdded} added to today` : '✅ Syllabus built',
        parts.join(' · ')
      );
    }

    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto scroll-area"
        style={selectedSubject ? { borderTop: `3px solid ${subjectColor(selectedSubject).hex}` } : undefined}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-teal-400" />
            <h2 className="text-lg font-bold">Build Syllabus</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn('h-1 flex-1 rounded-full transition', step >= s ? 'bg-teal-500' : 'bg-white/10')}
            />
          ))}
        </div>

        {/* STEP 1: Pick Subject */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-white/60 mb-2">STEP 1: PICK SUBJECT</p>
            <div className="space-y-2">
              {neetSubjects.map((subj) => {
                const c = subjectColor(subj);
                const exists = subjectExists(subj);
                const chapterCount = getChaptersForSubject(subj).length;
                return (
                  <motion.button
                    key={subj}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSubjectPick(subj)}
                    className="w-full p-3 rounded-xl flex items-center gap-3 transition"
                    style={{ background: `${c.hex}12`, border: `1px solid ${c.hex}30` }}
                  >
                    <div className="w-3 h-10 rounded" style={{ background: c.hex }} />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold" style={{ color: c.hex }}>{subj}</div>
                      <div className="text-[10px] text-white/40">
                        {chapterCount} chapters {exists && '· already in your syllabus'}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/30" />
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Pick Chapters */}
        {step === 2 && selectedSubject && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/60">
                STEP 2: PICK CHAPTERS · <span style={{ color: subjectColor(selectedSubject).hex }}>{selectedSubject}</span>
              </p>
              <button onClick={() => { setStep(1); setSelectedChapterIds(new Set()); }} className="text-[10px] text-white/40">
                ← Back
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapters..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-teal-400/50"
              />
            </div>

            <div className="text-[10px] text-white/40">
              Selected: <span className="font-bold text-teal-400 tabular">{selectedChapterIds.size}</span> chapters
            </div>

            {/* Chapter list grouped by category */}
            <div className="space-y-3 max-h-[45vh] overflow-y-auto scroll-area">
              {Object.entries(groupedChapters).map(([category, chs]) => (
                <div key={category}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-white/30 mb-1.5 px-1">{category}</div>
                  <div className="space-y-1">
                    {chs.map((ch) => {
                      const isSelected = selectedChapterIds.has(ch.id);
                      const c = subjectColor(selectedSubject);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChapter(ch.id)}
                          className={cn(
                            'w-full p-2.5 rounded-xl flex items-center gap-2.5 transition border',
                            isSelected ? 'border-2' : 'border border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'
                          )}
                          style={isSelected ? { background: `${c.hex}15`, borderColor: c.hex } : undefined}
                        >
                          <div
                            className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition', isSelected && 'border-0')}
                            style={isSelected ? { background: c.hex } : { borderColor: 'rgba(255,255,255,0.2)' }}
                          >
                            {isSelected && <Check size={12} className="text-black" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="text-xs font-medium truncate">{ch.name}</div>
                            <div className="text-[9px] text-white/30">{ch.lectures.length} lectures</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedChapterIds.size > 0 && (
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ background: subjectColor(selectedSubject).hex }}
              >
                Next: Pick Lectures ({selectedChapterIds.size} chapters) <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}

        {/* STEP 3: Pick Lectures */}
        {step === 3 && selectedSubject && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/60">
                STEP 3: PICK LECTURES · <span className="tabular">{selectedLectureCount}</span> selected
              </p>
              <button onClick={() => setStep(2)} className="text-[10px] text-white/40">← Back</button>
            </div>

            <p className="text-[10px] text-white/40 mb-2">
              Tap lectures to add them to today's targets. Skip this step to add all default lectures to syllabus only.
            </p>

            {/* Selected chapters with expandable lectures */}
            <div className="space-y-2 max-h-[45vh] overflow-y-auto scroll-area">
              {selectedChapters.map((ch) => {
                const isExpanded = expandedChapterId === ch.id;
                const selectedInChapter = ch.lectures.filter((l) => selectedLectureKeys.has(`${ch.id}-${l.lecNo}`)).length;
                const c = subjectColor(selectedSubject);
                return (
                  <div key={ch.id} className="glass rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedChapterId(isExpanded ? null : ch.id)}
                      className="w-full p-2.5 flex items-center gap-2"
                    >
                      <div className="w-1 h-6 rounded" style={{ background: c.hex }} />
                      <span className="text-xs font-medium flex-1 text-left truncate">{ch.name}</span>
                      {selectedInChapter > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${c.hex}25`, color: c.hex }}>
                          {selectedInChapter} selected
                        </span>
                      )}
                      <ChevronDown size={12} className={cn('text-white/40 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        className="px-2 pb-2 space-y-1"
                      >
                        <button
                          onClick={() => selectAllLecturesInChapter(ch.id)}
                          className="w-full text-[10px] text-teal-400 py-1 hover:text-teal-300"
                        >
                          {ch.lectures.every((l) => selectedLectureKeys.has(`${ch.id}-${l.lecNo}`)) ? 'Deselect All' : 'Select All'}
                        </button>
                        {ch.lectures.map((lec) => {
                          const key = `${ch.id}-${lec.lecNo}`;
                          const isSelected = selectedLectureKeys.has(key);
                          return (
                            <button
                              key={lec.lecNo}
                              onClick={() => toggleLecture(ch.id, lec.lecNo)}
                              className={cn(
                                'w-full p-2 rounded-lg flex items-center gap-2 transition',
                                isSelected ? 'bg-teal-500/15' : 'bg-white/[0.02] hover:bg-white/[0.05]'
                              )}
                            >
                              <div
                                className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0')}
                                style={isSelected ? { background: c.hex, borderColor: c.hex } : { borderColor: 'rgba(255,255,255,0.2)' }}
                              >
                                {isSelected && <Check size={10} className="text-black" strokeWidth={3} />}
                              </div>
                              <span className="text-[10px] font-bold text-white/40 tabular w-6">L{lec.lecNo}</span>
                              <span className={cn('text-xs truncate', isSelected ? 'text-white' : 'text-white/60')}>{lec.topic}</span>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add to today toggle */}
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold">Add selected to today</div>
                <div className="text-[10px] text-white/40">Creates today targets for selected lectures</div>
              </div>
              <button
                onClick={() => { setAddToToday(!addToToday); vibrate(8); }}
                className={cn('w-12 h-7 rounded-full transition relative', addToToday ? 'bg-teal-500' : 'bg-white/10')}
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={cn('absolute top-1 w-5 h-5 rounded-full bg-white', addToToday ? 'left-6' : 'left-1')}
                />
              </button>
            </div>

            {/* Live preview */}
            <div className="glass rounded-xl p-3 border border-teal-500/20">
              <div className="text-[10px] font-bold uppercase text-white/40 mb-1.5">Will add:</div>
              <div className="space-y-0.5 text-xs text-white/70">
                <div>• <strong className="text-white">{selectedChapterIds.size}</strong> chapters ({selectedSubject})</div>
                <div>• <strong className="text-white">{selectedLectureCount || 'all default'}</strong> lectures per chapter</div>
                {addToToday && selectedLectureCount > 0 && (
                  <div>• <strong className="text-teal-400">{selectedLectureCount}</strong> today targets</div>
                )}
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full py-3.5 rounded-xl text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: subjectColor(selectedSubject).hex }}
            >
              <Check size={16} /> Add to Syllabus
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
