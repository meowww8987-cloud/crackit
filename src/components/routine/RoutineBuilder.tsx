'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Copy, X, Clock } from 'lucide-react';
import { useRoutine, type RoutineBlock } from '@/lib/store/routine';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject, ActivityType, RoutineBlockType } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUBJECTS_LIST: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology', 'General'];
const BLOCK_TYPES: { value: RoutineBlockType; label: string; emoji: string }[] = [
  { value: 'lecture', label: 'Lecture', emoji: '📺' },
  { value: 'self-study', label: 'Self Study', emoji: '📝' },
  { value: 'break', label: 'Break', emoji: '☕' },
];
const ALL_ACTIVITIES: ActivityType[] = ['Lecture', 'DPP', 'Notes', 'Revision', 'Custom'];

interface Props {
  onClose?: () => void;
}

/**
 * RoutineBuilder — weekly schedule editor.
 *
 * Embedded in Settings → Goals section (merged with goals).
 *
 * Features:
 * - Day selector (Sun-Sat)
 * - Add/edit/delete blocks per day
 * - Each block: time range (hour sliders) + subject + type
 * - For Self Study: checkbox list of allowed activities
 * - "Copy Monday to all days" button
 * - Clear all button
 */
export function RoutineBuilder({ onClose }: Props) {
  const blocks = useRoutine((s) => s.blocks);
  const addBlock = useRoutine((s) => s.addBlock);
  const updateBlock = useRoutine((s) => s.updateBlock);
  const deleteBlock = useRoutine((s) => s.deleteBlock);
  const copyDayToAll = useRoutine((s) => s.copyDayToAll);
  const clearAll = useRoutine((s) => s.clearAll);

  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay());
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);

  const dayBlocks = blocks
    .filter((b) => b.day === selectedDay)
    .sort((a, b) => a.startHour - b.startHour);

  const handleCopyToAll = () => {
    vibrate([10, 30, 10]);
    copyDayToAll(selectedDay);
  };

  const handleClearAll = () => {
    if (confirm('Clear ALL routine blocks for ALL days? This cannot be undone.')) {
      vibrate([10, 30, 10]);
      clearAll();
    }
  };

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Smart Study Routine
          </div>
          <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Plan your weekly schedule
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
            aria-label="Close"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Day selector */}
      <div className="flex gap-1 flex-wrap">
        {DAYS.map((d, i) => (
          <button
            key={i}
            onClick={() => { setSelectedDay(i); vibrate(5); }}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-bold transition border active:scale-95',
              selectedDay === i
                ? 'text-white border-transparent'
                : 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
            )}
            style={selectedDay === i ? { background: 'var(--foreground)' } : undefined}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Day's blocks */}
      <div className="space-y-2">
        {dayBlocks.length === 0 && (
          <div className="text-center py-6 text-[11px] text-muted-foreground">
            No blocks for {DAY_FULL[selectedDay]} yet.
            <br />
            Tap "Add block" below to create your first one.
          </div>
        )}
        {dayBlocks.map((block) => {
          const color = subjectColor(block.subject);
          const isBreak = block.type === 'break';
          return (
            <div
              key={block.id}
              className="flex items-center gap-2 p-2.5 rounded-xl border"
              style={{
                background: isBreak ? 'rgba(34,197,94,0.04)' : `${color.hex}08`,
                borderColor: isBreak ? 'rgba(34,197,94,0.2)' : `${color.hex}20`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  background: isBreak ? 'rgba(34,197,94,0.15)' : `${color.hex}20`,
                  color: isBreak ? '#22c55e' : color.hex,
                }}
              >
                {isBreak ? '☕' : block.subject[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>
                  {isBreak ? 'Break' : block.subject}{' '}
                  <span className="text-muted-foreground font-normal">
                    {block.type === 'lecture' ? 'Lecture' :
                     block.type === 'self-study' ? 'Self Study' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock size={9} />
                  {formatHour(block.startHour)} → {formatHour(block.endHour)}
                  {!isBreak && block.allowedActivities && block.allowedActivities.length > 0 && (
                    <span className="ml-1">· {block.allowedActivities.join('/')}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setEditingBlock(block); vibrate(8); }}
                className="px-2 py-1 rounded-md text-[10px] font-semibold bg-foreground/10 hover:bg-foreground/15 transition active:scale-95"
              >
                Edit
              </button>
              <button
                onClick={() => { deleteBlock(block.id); vibrate([10, 20, 10]); }}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 transition active:scale-90"
                aria-label="Delete block"
              >
                <Trash2 size={12} className="text-red-500" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setShowAddNew(true); vibrate(8); }}
          className="flex-1 min-w-[120px] py-2 rounded-xl text-[11px] font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}
        >
          <Plus size={13} /> Add block
        </button>
        <button
          onClick={handleCopyToAll}
          className="flex-1 min-w-[120px] py-2 rounded-xl text-[11px] font-semibold bg-foreground/5 hover:bg-foreground/10 transition active:scale-95 flex items-center justify-center gap-1.5 border border-border"
        >
          <Copy size={12} /> Copy {DAYS[selectedDay]} to all
        </button>
        {blocks.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-2 rounded-xl text-[11px] font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/15 transition active:scale-95"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Edit/Add modal */}
      <AnimatePresence>
        {(editingBlock || showAddNew) && (
          <BlockEditor
            block={editingBlock}
            day={selectedDay}
            onClose={() => { setEditingBlock(null); setShowAddNew(false); }}
            onSave={(data) => {
              if (editingBlock) {
                updateBlock(editingBlock.id, data);
              } else {
                addBlock({ ...data, day: selectedDay });
              }
              setEditingBlock(null);
              setShowAddNew(false);
              vibrate(12);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Block Editor Modal =====
function BlockEditor({
  block,
  day,
  onClose,
  onSave,
}: {
  block: RoutineBlock | null;
  day: number;
  onClose: () => void;
  onSave: (data: Omit<RoutineBlock, 'id' | 'day'>) => void;
}) {
  const [startHour, setStartHour] = useState(block?.startHour ?? 6);
  const [endHour, setEndHour] = useState(block?.endHour ?? 9);
  const [subject, setSubject] = useState<Subject>(block?.subject ?? 'Physics');
  const [type, setType] = useState<RoutineBlockType>(block?.type ?? 'lecture');
  const [allowedActivities, setAllowedActivities] = useState<ActivityType[]>(
    block?.allowedActivities ?? ['Revision', 'DPP', 'Notes']
  );

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
  };

  const toggleActivity = (a: ActivityType) => {
    setAllowedActivities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const handleSave = () => {
    // Validate: endHour > startHour
    if (endHour <= startHour) {
      alert('End time must be after start time.');
      return;
    }
    onSave({
      startHour,
      endHour,
      subject,
      type,
      allowedActivities: type === 'self-study' ? allowedActivities : undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-border shadow-2xl"
        style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-foreground/10 sticky top-0" style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              {block ? 'Edit block' : 'New block'} · {DAY_FULL[day]}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Time range */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
              Time range
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">Start</div>
                <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {formatHour(startHour)}
                </div>
                <input
                  type="range" min={0} max={23} step={1}
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">End</div>
                <div className="text-sm font-bold tabular" style={{ color: 'var(--foreground)' }}>
                  {formatHour(endHour)}
                </div>
                <input
                  type="range" min={1} max={24} step={1}
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
            </div>
            {endHour <= startHour && (
              <div className="text-[10px] text-red-500 mt-1">⚠ End must be after start</div>
            )}
          </div>

          {/* Block type */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
              Type
            </label>
            <div className="flex gap-1">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); vibrate(5); }}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[10px] font-bold transition border active:scale-95',
                    type === t.value
                      ? 'text-white border-transparent'
                      : 'border-border bg-foreground/5 text-muted-foreground'
                  )}
                  style={type === t.value ? { background: 'var(--foreground)' } : undefined}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (hidden for break) */}
          {type !== 'break' && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                Subject
              </label>
              <div className="flex gap-1 flex-wrap">
                {SUBJECTS_LIST.map((s) => {
                  const c = subjectColor(s);
                  return (
                    <button
                      key={s}
                      onClick={() => { setSubject(s); vibrate(5); }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-bold transition border active:scale-95',
                        subject === s
                          ? 'text-white border-transparent'
                          : 'border-border bg-foreground/5 text-muted-foreground'
                      )}
                      style={subject === s ? { background: c.hex } : undefined}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Allowed activities (only for self-study) */}
          {type === 'self-study' && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                Allowed activities (what counts as on-plan)
              </label>
              <div className="flex gap-1 flex-wrap">
                {ALL_ACTIVITIES.map((a) => (
                  <button
                    key={a}
                    onClick={() => { toggleActivity(a); vibrate(5); }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border active:scale-95',
                      allowedActivities.includes(a)
                        ? 'text-white border-transparent'
                        : 'border-border bg-foreground/5 text-muted-foreground'
                    )}
                    style={allowedActivities.includes(a) ? { background: 'var(--foreground)' } : undefined}
                  >
                    {allowedActivities.includes(a) ? '✓ ' : ''}{a}
                  </button>
                ))}
              </div>
              <div className="text-[9px] text-muted-foreground mt-1">
                Empty = any activity counts as on-plan.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-foreground/10 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[12px] font-semibold hover:bg-foreground/10 active:scale-95 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={endHour <= startHour}
            className="flex-1 py-2 rounded-lg text-[12px] font-bold text-white active:scale-95 transition disabled:opacity-50"
            style={{ background: 'var(--foreground)' }}
          >
            Save block
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
