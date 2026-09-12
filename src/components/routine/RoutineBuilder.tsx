'use client';

import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, Copy, X, Clock, MoreVertical, Edit3,
  CalendarDays, Calendar, CalendarRange,
} from 'lucide-react';
import { useRoutine, type RoutineBlock, ALL_DAYS, WEEKDAYS, WEEKENDS } from '@/lib/store/routine';
import { subjectColor } from '@/lib/colors';
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
 * RoutineBuilder — weekly schedule editor with long-press context menu.
 *
 * UX:
 * - Day selector (Sun-Sat) at top
 * - Selected day's blocks listed below
 * - LONG-PRESS on the day's card (or empty area) → context menu with:
 *   - Add block
 *   - Copy this day to... (all / weekdays / weekends / specific day)
 *   - Clear this day
 *   - Clear all days
 * - No always-visible buttons → prevents accidental taps
 * - Confirmations for destructive actions
 */
export function RoutineBuilder({ onClose }: Props) {
  const blocks = useRoutine((s) => s.blocks);
  const addBlock = useRoutine((s) => s.addBlock);
  const updateBlock = useRoutine((s) => s.updateBlock);
  const deleteBlock = useRoutine((s) => s.deleteBlock);
  const deleteBlocksForDay = useRoutine((s) => s.deleteBlocksForDay);
  const copyDayToAll = useRoutine((s) => s.copyDayToAll);
  const copyDayToWeekdays = useRoutine((s) => s.copyDayToWeekdays);
  const copyDayToWeekends = useRoutine((s) => s.copyDayToWeekends);
  const copyDayToDays = useRoutine((s) => s.copyDayToDays);
  const clearAll = useRoutine((s) => s.clearAll);

  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay());
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState<'day' | 'all' | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const dayBlocks = useMemo(() =>
    blocks
      .filter((b) => b.day === selectedDay)
      .sort((a, b) => a.startHour - b.startHour),
    [blocks, selectedDay]
  );

  const handleLongPressStart = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setShowContextMenu(true);
      vibrate(20);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
  };

  const handleCopyToAll = () => {
    setShowContextMenu(false);
    setShowCopyMenu(false);
    vibrate([10, 30, 10]);
    copyDayToAll(selectedDay);
  };

  const handleCopyToWeekdays = () => {
    setShowContextMenu(false);
    setShowCopyMenu(false);
    vibrate([10, 30, 10]);
    copyDayToWeekdays(selectedDay);
  };

  const handleCopyToWeekends = () => {
    setShowContextMenu(false);
    setShowCopyMenu(false);
    vibrate([10, 30, 10]);
    copyDayToWeekends(selectedDay);
  };

  const handleCopyToDay = (targetDay: number) => {
    setShowContextMenu(false);
    setShowCopyMenu(false);
    vibrate([10, 30, 10]);
    copyDayToDays(selectedDay, [targetDay]);
  };

  const handleClearDay = () => {
    setShowContextMenu(false);
    setShowClearConfirm(null);
    vibrate([10, 30, 10]);
    deleteBlocksForDay(selectedDay);
  };

  const handleClearAll = () => {
    setShowContextMenu(false);
    setShowClearConfirm(null);
    vibrate([10, 30, 10]);
    clearAll();
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

      {/* Day's blocks — long-pressable card */}
      <div
        onPointerDown={handleLongPressStart}
        onPointerUp={handleLongPressEnd}
        onPointerLeave={handleLongPressEnd}
        onPointerCancel={handleLongPressEnd}
        className="relative select-none"
      >
        {/* Day header */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold" style={{ color: 'var(--foreground)' }}>
            {DAY_FULL[selectedDay]}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">
              {dayBlocks.length} block{dayBlocks.length === 1 ? '' : 's'}
            </span>
            {/* ✏️ button — always available for quick menu access */}
            <button
              onClick={(e) => { e.stopPropagation(); vibrate(8); setShowContextMenu(true); }}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-foreground/10 transition active:scale-90"
              aria-label="More options"
            >
              <MoreVertical size={13} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Blocks list OR empty state */}
        <div className="space-y-2 min-h-[80px]">
          {dayBlocks.length === 0 ? (
            <div
              className="text-center py-6 px-3 rounded-xl border border-dashed"
              style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
            >
              <div className="text-[11px] text-muted-foreground mb-1">
                No blocks for {DAY_FULL[selectedDay]}
              </div>
              <div className="text-[9px] text-muted-foreground">
                Long-press here or tap ⋮ to add blocks
              </div>
            </div>
          ) : (
            dayBlocks.map((block) => {
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
                    onClick={(e) => { e.stopPropagation(); setEditingBlock(block); vibrate(8); }}
                    className="px-2 py-1 rounded-md text-[10px] font-semibold bg-foreground/10 hover:bg-foreground/15 transition active:scale-95"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); vibrate([10, 20, 10]); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 transition active:scale-90"
                    aria-label="Delete block"
                  >
                    <Trash2 size={12} className="text-red-500" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Long-press hint (only when blocks exist) */}
        {dayBlocks.length > 0 && (
          <div className="text-[9px] text-muted-foreground mt-1.5 text-center opacity-60">
            Long-press for copy / clear options
          </div>
        )}
      </div>

      {/* === Context Menu (long-press) === */}
      {showContextMenu && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-black/80"
            onClick={() => setShowContextMenu(false)}
          />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl pointer-events-auto overflow-hidden"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-foreground/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {DAY_FULL[selectedDay]}
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {dayBlocks.length} block{dayBlocks.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                {/* Add block */}
                <button
                  onClick={() => { setShowContextMenu(false); setShowAddNew(true); vibrate(10); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    <Plus size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Add block</div>
                    <div className="text-[10px] text-muted-foreground">Create a new study/break block</div>
                  </div>
                </button>

                {/* Copy submenu */}
                <button
                  onClick={() => { setShowCopyMenu(true); vibrate(10); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
                  disabled={dayBlocks.length === 0}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Copy size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Copy to...</div>
                    <div className="text-[10px] text-muted-foreground">
                      {dayBlocks.length === 0 ? 'No blocks to copy' : 'Copy this day\'s blocks to other days'}
                    </div>
                  </div>
                </button>

                {/* Clear this day */}
                <button
                  onClick={() => { setShowContextMenu(false); setShowClearConfirm('day'); vibrate(10); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 transition text-left"
                  disabled={dayBlocks.length === 0}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Trash2 size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-amber-600 dark:text-amber-400">Clear {DAY_FULL[selectedDay]}</div>
                    <div className="text-[10px] text-muted-foreground">Remove all blocks for this day only</div>
                  </div>
                </button>

                {/* Clear all */}
                <button
                  onClick={() => { setShowContextMenu(false); setShowClearConfirm('all'); vibrate(10); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                  disabled={blocks.length === 0}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-red-500/20 text-red-600 dark:text-red-400">
                    <Trash2 size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-red-600 dark:text-red-400">Clear ALL days</div>
                    <div className="text-[10px] text-muted-foreground">Remove every block from every day</div>
                  </div>
                </button>
              </div>

              {/* Cancel */}
              <div className="border-t border-foreground/10 p-2">
                <button
                  onClick={() => setShowContextMenu(false)}
                  className="w-full py-2 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-foreground/10 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Copy submenu === */}
      {showCopyMenu && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10003] bg-black/80"
            onClick={() => setShowCopyMenu(false)}
          />
          <div className="fixed inset-0 z-[10004] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl pointer-events-auto overflow-hidden"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-foreground/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Copy {DAY_FULL[selectedDay]}
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Choose target days
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Source day ({DAY_FULL[selectedDay]}) will keep its blocks.
                  Target days will be REPLACED.
                </div>
              </div>

              {/* Copy options */}
              <div className="py-1">
                {/* Copy to all */}
                <button
                  onClick={handleCopyToAll}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <CalendarDays size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>All 7 days</div>
                    <div className="text-[10px] text-muted-foreground">Sun → Sat (replace all)</div>
                  </div>
                </button>

                {/* Copy to weekdays */}
                <button
                  onClick={handleCopyToWeekdays}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    <CalendarRange size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Weekdays</div>
                    <div className="text-[10px] text-muted-foreground">Mon → Fri (replace)</div>
                  </div>
                </button>

                {/* Copy to weekends */}
                <button
                  onClick={handleCopyToWeekends}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/10 transition text-left"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-600 dark:text-purple-400">
                    <Calendar size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Weekends</div>
                    <div className="text-[10px] text-muted-foreground">Sat + Sun (replace)</div>
                  </div>
                </button>

                {/* Divider */}
                <div className="h-px bg-foreground/10 my-1" />

                {/* Copy to specific day */}
                <div className="px-4 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Copy to specific day
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {ALL_DAYS.map((d) => {
                      if (d === selectedDay) return null; // Can't copy to self
                      const hasBlocks = blocks.some((b) => b.day === d);
                      return (
                        <button
                          key={d}
                          onClick={() => handleCopyToDay(d)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold transition border active:scale-95',
                            'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10'
                          )}
                        >
                          {DAYS[d]}
                          {hasBlocks && <span className="ml-0.5 text-amber-500">●</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1">
                    ● = day already has blocks (will be replaced)
                  </div>
                </div>
              </div>

              {/* Cancel */}
              <div className="border-t border-foreground/10 p-2">
                <button
                  onClick={() => setShowCopyMenu(false)}
                  className="w-full py-2 rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-foreground/10 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Clear confirmation === */}
      {showClearConfirm && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10005] bg-black/80"
            onClick={() => setShowClearConfirm(null)}
          />
          <div className="fixed inset-0 z-[10006] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="w-full max-w-xs rounded-2xl border border-border shadow-2xl pointer-events-auto"
              style={{ background: 'var(--popover, rgba(20,22,30,0.96))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    showClearConfirm === 'all' ? 'bg-red-500/15' : 'bg-amber-500/15'
                  )}>
                    <Trash2 size={18} className={showClearConfirm === 'all' ? 'text-red-500' : 'text-amber-500'} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                      {showClearConfirm === 'all'
                        ? 'Clear ALL days?'
                        : `Clear ${DAY_FULL[selectedDay]}?`}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {showClearConfirm === 'all'
                        ? 'Every block on every day will be permanently removed. This cannot be undone.'
                        : `All ${dayBlocks.length} block${dayBlocks.length === 1 ? '' : 's'} for ${DAY_FULL[selectedDay]} will be removed. Other days are not affected.`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(null)}
                    className="flex-1 py-2 rounded-lg bg-foreground/5 text-foreground text-[12px] font-semibold hover:bg-foreground/10 active:scale-95 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showClearConfirm === 'all' ? handleClearAll : handleClearDay}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-[12px] font-bold text-white active:scale-95 transition',
                      showClearConfirm === 'all' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                    )}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* === Block editor (add/edit) === */}
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
