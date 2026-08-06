'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ChevronDown, BookOpen } from 'lucide-react';
import { useTargets } from '@/lib/store/targets';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject, ActivityType, Target } from '@/lib/types';
import { cn, todayKey, vibrate } from '@/lib/utils';

interface Props {
  editing?: Target | null;
  onClose: () => void;
}

const ACTIVITIES: ActivityType[] = ['Lecture', 'DPP', 'Notes', 'Revision', 'Custom'];

export function AddTargetSheet({ editing, onClose }: Props) {
  const addTarget = useTargets((s) => s.addTarget);
  const updateTarget = useTargets((s) => s.updateTarget);
  const isAlreadyAdded = useTargets((s) => s.isAlreadyAddedToday);

  // Syllabus data (user's existing subjects/chapters/lectures)
  const syllabusSubjects = useSyllabus((s) => s.subjects);
  const syllabusChapters = useSyllabus((s) => s.chapters);
  const syllabusLectures = useSyllabus((s) => s.lectures);

  // Form state
  const [subject, setSubject] = useState<Subject>(editing?.subject || (syllabusSubjects[0]?.name as Subject) || 'Physics');
  const [activity, setActivity] = useState<ActivityType>(editing?.activity || 'Lecture');
  const [expectedMinutes, setExpectedMinutes] = useState(editing?.expectedMinutes || 60);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(editing?.chapterId || '');
  const [selectedLectureIds, setSelectedLectureIds] = useState<Set<string>>(
    new Set(editing?.lectureId ? [editing.lectureId] : [])
  );
  const [customTopic, setCustomTopic] = useState(
    editing?.isChapterTarget ? '' : (editing?.topic && !editing.lectureId ? editing.topic : '')
  );

  // Chapters for selected subject (from user's syllabus)
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

  const selectedChapter = syllabusChapters.find((c) => c.id === selectedChapterId);

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

  const canSubmit = selectedChapterId && (selectedLectureIds.size > 0 || customTopic.trim() || activity !== 'Lecture');

  const handleSubmit = () => {
    if (!selectedChapterId || !selectedChapter) return;
    vibrate(15);

    const targetsToAdd: Parameters<typeof addTarget>[0][] = [];

    if (selectedLectureIds.size > 0) {
      // Add one target per selected lecture
      for (const lecId of selectedLectureIds) {
        const lec = syllabusLectures.find((l) => l.id === lecId);
        if (!lec) continue;
        targetsToAdd.push({
          date: todayKey(),
          subject,
          activity,
          chapter: selectedChapter.name,
          lecture: `L${lec.lecNo}`,
          topic: lec.topic,
          expectedMinutes,
          lectureId: lec.id,
          chapterId: selectedChapterId,
        });
      }
    } else if (customTopic.trim()) {
      // Custom topic target linked to chapter
      targetsToAdd.push({
        date: todayKey(),
        subject,
        activity,
        chapter: selectedChapter.name,
        topic: customTopic.trim(),
        expectedMinutes,
        chapterId: selectedChapterId,
        isChapterTarget: true,
      });
    } else if (activity !== 'Lecture') {
      // Activity-based target (DPP, Notes, etc.) linked to chapter
      targetsToAdd.push({
        date: todayKey(),
        subject,
        activity,
        chapter: selectedChapter.name,
        topic: `${activity}: ${selectedChapter.name}`,
        expectedMinutes,
        chapterId: selectedChapterId,
        isChapterTarget: true,
      });
    }

    if (editing) {
      // Edit mode: update single target
      if (targetsToAdd.length > 0) {
        updateTarget(editing.id, targetsToAdd[0]);
      }
    } else {
      // Add mode: add all targets
      targetsToAdd.forEach((t) => addTarget(t));
    }
    onClose();
  };

  const color = subjectColor(subject);

  // Check which lectures are already added today
  const isLectureAdded = (lecId: string) => {
    if (editing) return false;
    const lec = syllabusLectures.find((l) => l.id === lecId);
    if (!lec || !selectedChapter) return false;
    return isAlreadyAdded(subject, selectedChapter.name, 'Lecture', `L${lec.lecNo}`);
  };

  return (
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
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col"
        style={{ borderTop: `3px solid ${color.hex}` }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Target' : 'Add Target'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto scroll-area px-5 py-4 pb-4">
        {/* Subject picker */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">SUBJECT</label>
          <div className="grid grid-cols-3 gap-2">
            {SUBJECTS.map((s) => {
              const c = subjectColor(s);
              const sel = subject === s;
              const hasSyllabus = syllabusSubjects.some((sub) => sub.name === s);
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSubject(s);
                    setSelectedChapterId('');
                    setSelectedLectureIds(new Set());
                    vibrate(8);
                  }}
                  className={cn(
                    'py-2 rounded-xl text-xs font-semibold transition border relative',
                    sel ? 'text-white' : 'text-white/60 border-white/10 bg-white/5'
                  )}
                  style={sel ? { background: c.hex, borderColor: c.hex, color: '#000' } : undefined}
                >
                  {s}
                  {hasSyllabus && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chapter picker (from user's syllabus) */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block flex items-center gap-1">
            <BookOpen size={11} /> CHAPTER *
          </label>
          {availableChapters.length === 0 ? (
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-xs text-white/50 mb-2">No {subject} chapters in your syllabus yet.</p>
              <p className="text-[10px] text-teal-400">Go to Syllabus tab → Build Syllabus to add chapters.</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto scroll-area">
              {availableChapters.map((ch) => {
                const sel = selectedChapterId === ch.id;
                const chLecCount = syllabusLectures.filter((l) => l.chapterId === ch.id).length;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setSelectedChapterId(ch.id);
                      setSelectedLectureIds(new Set());
                      setCustomTopic('');
                      vibrate(8);
                    }}
                    className={cn(
                      'w-full p-2.5 rounded-xl flex items-center gap-2 transition border',
                      sel ? 'border-2' : 'border border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'
                    )}
                    style={sel ? { background: `${color.hex}15`, borderColor: color.hex } : undefined}
                  >
                    <div className="w-1 h-6 rounded" style={{ background: color.hex }} />
                    <span className="text-xs font-medium flex-1 text-left truncate">{ch.name}</span>
                    <span className="text-[9px] text-white/30 tabular">{chLecCount} lec</span>
                    {sel && <Check size={14} style={{ color: color.hex }} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lecture picker (if chapter selected) */}
        {selectedChapterId && availableLectures.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/60">LECTURES (select for today)</label>
              <button
                onClick={selectAllLectures}
                className="text-[10px] text-teal-400 hover:text-teal-300"
              >
                {selectedLectureIds.size === availableLectures.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
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
                      sel ? 'bg-teal-500/15' : 'bg-white/[0.02] hover:bg-white/[0.05]',
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
                    <span className="text-[10px] font-bold text-white/40 tabular w-6">L{lec.lecNo}</span>
                    <span className={cn('text-xs truncate flex-1 text-left', sel ? 'text-white' : 'text-white/60')}>
                      {lec.topic}
                    </span>
                    {already && <span className="text-[9px] text-green-400 font-bold">ADDED</span>}
                  </button>
                );
              })}
            </div>
            {selectedLectureIds.size > 0 && (
              <p className="text-[10px] text-teal-400 mt-1.5">
                Will add {selectedLectureIds.size} target{selectedLectureIds.size > 1 ? 's' : ''} to today
              </p>
            )}
          </div>
        )}

        {/* Activity type */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">ACTIVITY</label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {ACTIVITIES.map((a) => {
              const sel = activity === a;
              return (
                <button
                  key={a}
                  onClick={() => { setActivity(a); vibrate(8); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition',
                    sel ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
                  )}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expected time */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-white/60">EXPECTED TIME</label>
            <span className="text-sm font-bold tabular text-teal-400">{expectedMinutes} min</span>
          </div>
          <input
            type="range"
            min={15}
            max={180}
            step={5}
            value={expectedMinutes}
            onChange={(e) => setExpectedMinutes(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Custom topic (optional, for non-lecture activities) */}
        {activity !== 'Lecture' && selectedLectureIds.size === 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-white/60 mb-2 block">TOPIC (optional)</label>
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder={`e.g. ${activity} practice`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
            />
          </div>
        )}

        </div>

        {/* Sticky footer with submit button — always visible above nav */}
        <div className="sticky bottom-0 z-10 px-5 py-3 glass rounded-b-3xl" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98]',
              canSubmit ? 'text-black' : 'bg-white/5 text-white/30 cursor-not-allowed'
            )}
            style={canSubmit ? { background: color.hex } : undefined}
          >
            {editing
              ? 'Update Target'
              : selectedLectureIds.size > 0
              ? `Add ${selectedLectureIds.size} Target${selectedLectureIds.size > 1 ? 's' : ''} to Today`
              : 'Add Target to Today'}
          </button>
          {!canSubmit && availableChapters.length > 0 && (
            <p className="text-[10px] text-white/30 text-center mt-2">
              Select a chapter and at least one lecture
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
