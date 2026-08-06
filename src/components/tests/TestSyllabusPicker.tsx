'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ChevronRight, ChevronDown, Search, Layers } from 'lucide-react';
import { subjectColor } from '@/lib/colors';
import { getChaptersForSubject, getNEETSubjects, type NEETChapter } from '@/lib/neetSyllabus';
import { useSyllabus } from '@/lib/store/syllabus';
import type { Subject } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  onClose: () => void;
  onConfirm: (chapterIds: string[]) => void;
  initialSelected?: string[];
  title?: string;
  allowMultipleSubjects?: boolean;
}

/**
 * Multi-subject chapter picker for tests.
 *
 * Shows chapters from TWO sources merged together:
 *  1. NEET catalog (pre-defined 94 chapters with weightage)
 *  2. User's custom chapters (added via Syllabus tab — may have names not
 *     in the NEET catalog)
 *
 * This fixes the bug where custom chapters were invisible in the picker.
 *
 * `chapterIds` returned are a mix of:
 *  - NEET catalog IDs (e.g. "phy-01") — resolved by name in the caller
 *  - User syllabus chapter IDs (uid strings) — used directly by the caller
 *
 * Draft persistence: selections are saved to localStorage so if the user
 * closes and reopens, their selections are restored.
 */
const DRAFT_KEY = 'neet-test-syllabus-picker-draft';

export function TestSyllabusPicker({
  onClose,
  onConfirm,
  initialSelected = [],
  title = 'Select Test Syllabus',
  allowMultipleSubjects = true,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [expandedSubject, setExpandedSubject] = useState<Subject | null>(null);
  const [search, setSearch] = useState('');

  // Read user's syllabus store for custom chapters
  const userSubjects = useSyllabus((s) => s.subjects);
  const userChapters = useSyllabus((s) => s.chapters);

  // Restore draft from localStorage on mount (if no initialSelected)
  useEffect(() => {
    if (initialSelected.length === 0) {
      try {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
          const draftIds = JSON.parse(draft) as string[];
          if (Array.isArray(draftIds) && draftIds.length > 0) {
            setSelected(new Set(draftIds));
          }
        }
      } catch {}
    }
  }, []);

  // Save draft to localStorage whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(Array.from(selected)));
    } catch {}
  }, [selected]);

  // Build merged chapter list: NEET catalog + user's custom chapters
  const allChapters = useMemo(() => {
    const map = new Map<string, { subject: Subject; chapter: NEETChapter; isCustom: boolean }>();

    // 1. NEET catalog chapters
    for (const subj of getNEETSubjects()) {
      if (subj === 'General') continue;
      for (const ch of getChaptersForSubject(subj)) {
        map.set(ch.id, { subject: subj as Subject, chapter: ch, isCustom: false });
      }
    }

    // 2. User's custom chapters (from syllabus store)
    // These may have names that match NEET catalog (already added via BuildSyllabus)
    // or completely custom names (added via AddChapter). We merge by name — if a
    // user chapter's name matches a NEET catalog chapter, we skip it (already shown).
    // If it's a new name, we add it as a custom entry.
    const neetNames = new Set<string>();
    for (const subj of getNEETSubjects()) {
      if (subj === 'General') continue;
      for (const ch of getChaptersForSubject(subj)) {
        neetNames.add(ch.name.toLowerCase());
      }
    }
    for (const ch of userChapters) {
      const subjectEntity = userSubjects.find((s) => s.id === ch.subjectId);
      if (!subjectEntity) continue;
      const subj = subjectEntity.name;
      if (subj === 'General') continue;
      // Skip if this chapter name is already in the NEET catalog
      if (neetNames.has(ch.name.toLowerCase())) continue;
      // Add as custom chapter with a synthetic ID (user chapter ID)
      map.set(ch.id, {
        subject: subj as Subject,
        chapter: {
          id: ch.id,
          name: ch.name,
          lectures: [],
          weightage: 4,
        },
        isCustom: true,
      });
    }

    return map;
  }, [userChapters, userSubjects]);

  const selectedCount = selected.size;
  const selectedBySubject = useMemo(() => {
    const map: Record<string, { subject: Subject; chapter: NEETChapter; isCustom: boolean }[]> = {};
    for (const id of selected) {
      const entry = allChapters.get(id);
      if (!entry) continue;
      if (!map[entry.subject]) map[entry.subject] = [];
      map[entry.subject].push(entry);
    }
    return map;
  }, [selected, allChapters]);

  const totalWeightage = useMemo(() => {
    let sum = 0;
    for (const id of selected) {
      const entry = allChapters.get(id);
      if (entry) sum += entry.chapter.weightage ?? 4;
    }
    return sum;
  }, [selected, allChapters]);

  const toggleChapter = (id: string) => {
    vibrate(8);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubjectAll = (subject: Subject) => {
    vibrate(10);
    // Get all chapter IDs for this subject (both NEET catalog + custom)
    const subjectChapterIds: string[] = [];
    for (const [id, entry] of allChapters) {
      if (entry.subject === subject) subjectChapterIds.push(id);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = subjectChapterIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of subjectChapterIds) next.delete(id);
      } else {
        for (const id of subjectChapterIds) next.add(id);
      }
      if (!allowMultipleSubjects) {
        for (const id of Array.from(next)) {
          const entry = allChapters.get(id);
          if (entry && entry.subject !== subject) next.delete(id);
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    vibrate(12);
    setSelected(new Set(allChapters.keys()));
  };

  const clearAll = () => {
    vibrate(8);
    setSelected(new Set());
  };

  const handleConfirm = () => {
    vibrate(15);
    // Clear draft on confirm
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onConfirm(Array.from(selected));
  };

  // Get the list of subjects to display — merge NEET subjects + any user custom subjects
  const displaySubjects = useMemo(() => {
    const neetSubs = getNEETSubjects().filter((s) => s !== 'General') as Subject[];
    // Check if user has any chapters in subjects not in the NEET list
    for (const ch of userChapters) {
      const subjectEntity = userSubjects.find((s) => s.id === ch.subjectId);
      if (subjectEntity && !neetSubs.includes(subjectEntity.name) && subjectEntity.name !== 'General') {
        neetSubs.push(subjectEntity.name as Subject);
      }
    }
    return neetSubs;
  }, [userChapters, userSubjects]);

  // Get chapters for a subject (merged NEET + custom)
  const getChaptersForDisplay = (subj: Subject): { id: string; name: string; weightage: number; isCustom: boolean }[] => {
    const result: { id: string; name: string; weightage: number; isCustom: boolean }[] = [];
    for (const [id, entry] of allChapters) {
      if (entry.subject === subj) {
        result.push({
          id,
          name: entry.chapter.name,
          weightage: entry.chapter.weightage ?? 4,
          isCustom: entry.isCustom,
        });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  };

  const searchLower = search.toLowerCase();

  // Initialize: expand first subject that has chapters
  useEffect(() => {
    if (initialSelected.length === 0 && !expandedSubject) {
      setExpandedSubject(displaySubjects[0] || null);
    }
  }, [initialSelected, expandedSubject, displaySubjects]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl p-5 pb-8 max-h-[90vh] flex flex-col"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-teal-400" />
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + quick actions */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chapters..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-teal-400/50"
          />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-white/40">
            Selected: <span className="font-bold text-teal-400 tabular">{selectedCount}</span> chapters
            {totalWeightage > 0 && (
              <span className="ml-2">· ~{totalWeightage} marks weight</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] text-teal-400 hover:text-teal-300">
              All
            </button>
            <span className="text-white/20">·</span>
            <button onClick={clearAll} className="text-[10px] text-white/40 hover:text-white/60">
              Clear
            </button>
          </div>
        </div>

        {/* Chapter list — merged NEET catalog + custom chapters */}
        <div className="flex-1 overflow-y-auto scroll-area space-y-2 min-h-0">
          {displaySubjects.map((subj) => {
            const c = subjectColor(subj);
            const allChs = getChaptersForDisplay(subj);
            const filtered = searchLower
              ? allChs.filter((ch) => ch.name.toLowerCase().includes(searchLower))
              : allChs;
            if (filtered.length === 0) return null;

            const isExpanded = searchLower ? true : expandedSubject === subj;
            const selectedInSubject = allChs.filter((ch) => selected.has(ch.id)).length;

            return (
              <div key={subj} className="glass rounded-xl overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedSubject(isExpanded ? null : subj)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedSubject(isExpanded ? null : subj);
                    }
                  }}
                  className="w-full p-2.5 flex items-center gap-2 cursor-pointer"
                >
                  <div className="w-1.5 h-7 rounded" style={{ background: c.hex }} />
                  <span className="text-xs font-bold flex-1 text-left" style={{ color: c.hex }}>
                    {subj}
                  </span>
                  {selectedInSubject > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${c.hex}25`, color: c.hex }}
                    >
                      {selectedInSubject}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSubjectAll(subj); }}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20"
                  >
                    {selectedInSubject === allChs.length && selectedInSubject > 0 ? 'None' : 'All'}
                  </button>
                  <ChevronDown
                    size={12}
                    className={cn('text-white/40 transition-transform', isExpanded && 'rotate-180')}
                  />
                </div>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    className="px-2 pb-2 space-y-1"
                  >
                    {filtered.map((ch) => {
                      const isSelected = selected.has(ch.id);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChapter(ch.id)}
                          className={cn(
                            'w-full p-2 rounded-lg flex items-center gap-2 transition',
                            isSelected ? 'bg-teal-500/15' : 'bg-white/[0.02] hover:bg-white/[0.05]',
                          )}
                        >
                          <div
                            className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0')}
                            style={isSelected ? { background: c.hex, borderColor: c.hex } : { borderColor: 'rgba(255,255,255,0.2)' }}
                          >
                            {isSelected && <Check size={10} className="text-black" strokeWidth={3} />}
                          </div>
                          <span
                            className={cn(
                              'text-xs truncate flex-1 text-left',
                              isSelected ? 'text-white' : 'text-white/70',
                            )}
                          >
                            {ch.name}
                            {ch.isCustom && (
                              <span className="ml-1.5 text-[8px] text-amber-400 font-bold">CUSTOM</span>
                            )}
                          </span>
                          {(ch.weightage ?? 0) >= 6 && (
                            <span
                              className="text-[8px] px-1 py-0.5 rounded font-bold"
                              style={{ background: `${c.hex}30`, color: c.hex }}
                            >
                              ⭐ {ch.weightage}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-sm active:scale-[0.98] mt-3 flex items-center justify-center gap-2 transition',
            selectedCount > 0
              ? 'bg-gradient-to-r from-teal-500 to-green-500 text-black'
              : 'bg-white/5 text-white/30 cursor-not-allowed',
          )}
        >
          {selectedCount === 0 ? (
            'Select at least 1 chapter'
          ) : (
            <>
              <Check size={16} /> Confirm {selectedCount} chapter{selectedCount === 1 ? '' : 's'}
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}
