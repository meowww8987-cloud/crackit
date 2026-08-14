'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Layers, ChevronRight, Clock } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { useSyllabus } from '@/lib/store/syllabus';
import { TestSyllabusPicker } from '@/components/tests/TestSyllabusPicker';
import { getChaptersForSubject, getNEETSubjects } from '@/lib/neetSyllabus';
import { pushToast } from '@/components/shared/Toast';
import type { TestType, CoachingSource, Subject } from '@/lib/types';
import { cn, todayKey, vibrate } from '@/lib/utils';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';

interface Props {
  onClose: () => void;
}

/**
 * Draft persistence: save form state to localStorage on every change, restore
 * on mount. This way if the user closes the app or exits the sheet, their
 * progress (name, date, type, coaching, duration, selected chapters) is
 * preserved and auto-restored when they reopen.
 */
const DRAFT_KEY = 'neet-add-test-draft';

interface AddTestDraft {
  name: string;
  date: string;
  type: TestType;
  coaching: CoachingSource;
  duration: number;
  selectedNeetChapterIds: string[];
}

function loadDraft(): Partial<AddTestDraft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveDraft(draft: AddTestDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

const TYPES: { value: TestType; label: string; desc: string; duration: number }[] = [
  { value: 'Part Test', label: 'Part Test', desc: 'Specific chapters · 1 hr', duration: 60 },
  { value: 'Full Syllabus', label: 'Full Syllabus', desc: 'All subjects · 3h 20m', duration: 200 },
  { value: 'AITS', label: 'AITS', desc: 'All India Test Series · 3h 20m', duration: 200 },
  { value: 'Rank Booster', label: 'Rank Booster', desc: 'High-difficulty mix · 3h', duration: 180 },
  { value: 'PYQ Mock', label: 'PYQ Mock', desc: 'Previous year questions · 3h 20m', duration: 200 },
  { value: 'Chapter Test', label: 'Chapter Test', desc: 'Single chapter · 30 min', duration: 30 },
  { value: 'Subject Test', label: 'Subject Test', desc: 'Single subject · 1h', duration: 60 },
  { value: 'Custom', label: 'Custom', desc: 'Define your own', duration: 120 },
];

const COACHING_SOURCES: CoachingSource[] = [
  'Self',
  'Allen',
  'Aakash',
  'PW (Physics Wallah)',
  'Vibrant',
  'Motion',
  'Narayana',
  'Sri Chaitanya',
  'Career Point',
  'Resonance',
  'Other',
];

export function AddTestSheet({ onClose }: Props) {
  const addTest = useTests((s) => s.addTest);
  const { subjects: userSubjects, chapters: userChapters, addSubject, addChapter } = useSyllabus();

  // Restore draft on mount — if user previously closed the sheet without
  // submitting, their form state is preserved.
  const draft = useMemo(() => loadDraft(), []);
  const [name, setName] = useState(draft?.name ?? '');
  const [date, setDate] = useState(draft?.date ?? todayKey());
  const [type, setType] = useState<TestType>(draft?.type ?? 'Part Test');
  const [coaching, setCoaching] = useState<CoachingSource>(draft?.coaching ?? 'Self');
  const [duration, setDuration] = useState<number>(draft?.duration ?? 60);
  const [selectedNeetChapterIds, setSelectedNeetChapterIds] = useState<string[]>(draft?.selectedNeetChapterIds ?? []);
  const [showPicker, setShowPicker] = useState(false);

  // Auto-save draft to localStorage on every form change
  useEffect(() => {
    saveDraft({ name, date, type, coaching, duration, selectedNeetChapterIds });
  }, [name, date, type, coaching, duration, selectedNeetChapterIds]);

  const isFullSyllabusType = type === 'Full Syllabus' || type === 'AITS' || type === 'PYQ Mock';
  const effectiveChapterIds = useMemo(() => {
    if (isFullSyllabusType && selectedNeetChapterIds.length === 0) {
      const all: string[] = [];
      for (const subj of getNEETSubjects()) {
        if (subj === 'General') continue;
        all.push(...getChaptersForSubject(subj as Subject).map((c) => c.id));
      }
      return all;
    }
    return selectedNeetChapterIds;
  }, [isFullSyllabusType, selectedNeetChapterIds]);

  const handleTypeChange = (t: TestType) => {
    setType(t);
    const typeConfig = TYPES.find((x) => x.value === t);
    if (typeConfig) setDuration(typeConfig.duration);
    vibrate(8);
  };

  const handleConfirmPicker = (neetIds: string[]) => {
    setSelectedNeetChapterIds(neetIds);
    setShowPicker(false);
    vibrate(10);
  };

  const resolveToUserChapterIds = (): string[] => {
    const userChapterIds: string[] = [];
    for (const neetId of effectiveChapterIds) {
      let neetChapter: { name: string; subject: Subject } | undefined;
      for (const subj of getNEETSubjects()) {
        if (subj === 'General') continue;
        const ch = getChaptersForSubject(subj as Subject).find((c) => c.id === neetId);
        if (ch) { neetChapter = { name: ch.name, subject: subj as Subject }; break; }
      }
      if (!neetChapter) continue;
      let subjectEntity = userSubjects.find((s) => s.name === neetChapter!.subject);
      if (!subjectEntity) {
        addSubject(neetChapter.subject);
        subjectEntity = useSyllabus.getState().subjects.find((s) => s.name === neetChapter!.subject);
      }
      if (!subjectEntity) continue;
      let userCh = userChapters.find(
        (c) => c.subjectId === subjectEntity!.id && c.name === neetChapter!.name,
      );
      if (!userCh) {
        userCh = useSyllabus.getState().chapters.find(
          (c) => c.subjectId === subjectEntity!.id && c.name === neetChapter!.name,
        );
        if (!userCh) {
          const newChId = addChapter(subjectEntity.id, neetChapter.name);
          userChapterIds.push(newChId);
          continue;
        }
      }
      userChapterIds.push(userCh.id);
    }
    return userChapterIds;
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    vibrate(15);
    const userChapterIds = effectiveChapterIds.length > 0 ? resolveToUserChapterIds() : [];
    addTest({
      name: name.trim(),
      date,
      type,
      coachingSource: coaching,
      duration,
      syllabus:
        userChapterIds.length > 0
          ? { chapterIds: userChapterIds, lectureIds: [] }
          : undefined,
    });
    pushToast(
      'Test added',
      `${type} · ${coaching} · ${duration} min`,
      'success',
    );
    clearDraft(); // Clear draft on successful submit
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto scroll-area"
        >
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Add Test</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {draft && (draft.name || draft.selectedNeetChapterIds?.length) && (
              <div className="text-[10px] text-teal-400/80 bg-teal-500/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                ↻ Draft restored — your previous entries are saved
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">TEST NAME *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Allen AITS #3, PW Full Mock #1"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">DATE</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">TEST TYPE</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTypeChange(t.value)}
                    className={cn(
                      'py-2 rounded-xl text-xs font-semibold transition text-left px-3',
                      type === t.value ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60',
                    )}
                  >
                    <div>{t.label}</div>
                    <div
                      className={cn(
                        'text-[9px] mt-0.5 leading-tight',
                        type === t.value ? 'text-black/60' : 'text-white/30',
                      )}
                    >
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">COACHING SOURCE</label>
              <div className="flex flex-wrap gap-1.5">
                {COACHING_SOURCES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCoaching(c); vibrate(6); }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium transition',
                      coaching === c
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block flex items-center gap-1">
                <Clock size={11} /> DURATION (MINUTES)
              </label>
              <div className="flex items-center gap-3">
                <ScrollAwareSlider>
                  <input
                    type="range"
                    min={15}
                    max={240}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1"
                  />
                </ScrollAwareSlider>
                <span className="text-sm font-bold tabular text-teal-400 w-16 text-right">
                  {Math.floor(duration / 60) > 0
                    ? `${Math.floor(duration / 60)}h ${duration % 60}m`
                    : `${duration}m`}
                </span>
              </div>
            </div>

            {/* Syllabus scope selector */}
            <div>
              <label className="text-xs font-semibold text-white/60 mb-2 block">
                SYLLABUS SCOPE
                {isFullSyllabusType && (
                  <span className="text-teal-400 ml-1.5">(auto: all chapters)</span>
                )}
              </label>
              <button
                onClick={() => { vibrate(8); setShowPicker(true); }}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left hover:bg-white/[0.07] transition flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                  <Layers size={16} className="text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {effectiveChapterIds.length > 0
                      ? `${effectiveChapterIds.length} chapters selected`
                      : isFullSyllabusType
                      ? 'All NEET chapters'
                      : 'Tap to select chapters'}
                  </div>
                  <div className="text-[10px] text-white/40">
                    {isFullSyllabusType
                      ? 'Full Syllabus default — edit to narrow scope'
                      : 'Defines what this test covers · drives Home readiness'}
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/30" />
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-sm transition active:scale-[0.98]',
                name.trim()
                  ? 'bg-gradient-to-r from-teal-500 to-green-500 text-black'
                  : 'bg-white/5 text-white/30 cursor-not-allowed',
              )}
            >
              Add Test
            </button>
          </div>
        </motion.div>
      </motion.div>

      {showPicker && (
        <TestSyllabusPicker
          onClose={() => setShowPicker(false)}
          onConfirm={handleConfirmPicker}
          initialSelected={selectedNeetChapterIds}
          title="Test Syllabus Scope"
          allowMultipleSubjects
        />
      )}
    </>
  );
}
