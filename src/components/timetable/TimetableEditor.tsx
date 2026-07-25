'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, X, Clock, Trash2 } from 'lucide-react';
import { useTimetable } from '@/lib/store/timetable';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

const DAYS = [
  { num: 0, name: 'Sun', full: 'Sunday' },
  { num: 1, name: 'Mon', full: 'Monday' },
  { num: 2, name: 'Tue', full: 'Tuesday' },
  { num: 3, name: 'Wed', full: 'Wednesday' },
  { num: 4, name: 'Thu', full: 'Thursday' },
  { num: 5, name: 'Fri', full: 'Friday' },
  { num: 6, name: 'Sat', full: 'Saturday' },
];

export function TimetableEditor() {
  const slots = useTimetable((s) => s.slots);
  const addSlot = useTimetable((s) => s.addSlot);
  const deleteSlot = useTimetable((s) => s.deleteSlot);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [showAdd, setShowAdd] = useState(false);
  const [newStart, setNewStart] = useState(6);
  const [newEnd, setNewEnd] = useState(8);
  const [newSubject, setNewSubject] = useState<Subject>('Physics');

  const daySlots = slots
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => a.startHour - b.startHour);

  const handleAdd = () => {
    if (newEnd <= newStart) {
      alert('End time must be after start time');
      return;
    }
    vibrate(12);
    addSlot({ day: selectedDay, startHour: newStart, endHour: newEnd, subject: newSubject });
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={16} className="text-amber-400" />
        <span className="text-sm font-semibold">Weekly Timetable</span>
      </div>

      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {DAYS.map((d) => (
          <button
            key={d.num}
            onClick={() => { setSelectedDay(d.num); vibrate(6); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition shrink-0',
              selectedDay === d.num ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/60'
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Day name */}
      <div className="text-xs text-white/50">
        {DAYS.find((d) => d.num === selectedDay)?.full}
        {selectedDay === new Date().getDay() && (
          <span className="ml-2 text-amber-400">· Today</span>
        )}
      </div>

      {/* Slots for selected day */}
      <div className="space-y-1.5">
        {daySlots.length === 0 && (
          <div className="glass rounded-xl p-4 text-center text-xs text-white/40">
            No slots for this day
          </div>
        )}
        {daySlots.map((slot) => {
          const color = subjectColor(slot.subject);
          return (
            <div
              key={slot.id}
              className="glass rounded-xl p-2.5 flex items-center gap-2"
              style={{ borderLeft: `3px solid ${color.hex}` }}
            >
              <Clock size={14} className="text-white/40 shrink-0" />
              <span className="text-xs tabular text-white/70">
                {slot.startHour}:00 - {slot.endHour}:00
              </span>
              <span className="text-xs font-medium" style={{ color: color.hex }}>
                {slot.subject}
              </span>
              <button
                onClick={() => { deleteSlot(slot.id); vibrate(8); }}
                className="ml-auto text-white/30 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add slot button */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-white/60 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/5"
        >
          <Plus size={14} /> Add Time Slot
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass rounded-xl p-3 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/70">New Time Slot</span>
            <button onClick={() => setShowAdd(false)} className="text-white/40">
              <X size={14} />
            </button>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">SUBJECT</label>
            <div className="flex gap-1 flex-wrap">
              {SUBJECTS.map((s) => {
                const c = subjectColor(s);
                return (
                  <button
                    key={s}
                    onClick={() => { setNewSubject(s); vibrate(6); }}
                    className={cn(
                      'px-2 py-1 rounded-md text-[10px] font-semibold',
                      newSubject === s ? 'text-black' : 'text-white/60'
                    )}
                    style={newSubject === s ? { background: c.hex } : { background: 'rgba(255,255,255,0.05)' }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start hour */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">START HOUR: {newStart}:00</label>
            <input
              type="range"
              min={0}
              max={23}
              value={newStart}
              onChange={(e) => setNewStart(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* End hour */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">END HOUR: {newEnd}:00</label>
            <input
              type="range"
              min={1}
              max={24}
              value={newEnd}
              onChange={(e) => setNewEnd(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            onClick={handleAdd}
            className="w-full py-2 rounded-xl bg-amber-500 text-black text-xs font-bold active:scale-95"
          >
            Add Slot
          </button>
        </motion.div>
      )}

      {/* Summary */}
      {slots.length > 0 && (
        <div className="text-[10px] text-white/40 text-center pt-1">
          {slots.length} total slots across all days
        </div>
      )}
    </div>
  );
}
