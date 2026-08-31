'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Star } from 'lucide-react';
import { useSyllabus } from '@/lib/store/syllabus';
import type { Lecture } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  lecture: Lecture;
  onClose: () => void;
}

export function LectureEditModal({ lecture, onClose }: Props) {
  const updateLecture = useSyllabus((s) => s.updateLecture);
  const [topic, setTopic] = useState(lecture.topic);
  const [date, setDate] = useState(lecture.date || '');
  const [hardness, setHardness] = useState(lecture.hardness);

  const handleSave = () => {
    vibrate(12);
    updateLecture(lecture.id, {
      topic: topic.trim() || lecture.topic,
      date: date || undefined,
      hardness,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm glass rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Lecture</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/60 mb-2 block">TOPIC</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50"
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
            <label className="text-xs font-semibold text-white/60 mb-2 block">HARDNESS</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => { setHardness(level); vibrate(8); }}
                  className="p-2"
                >
                  <Star
                    size={20}
                    className={cn(level <= hardness ? 'text-amber-400' : 'text-white/15')}
                    fill={level <= hardness ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98]"
        >
          Save Changes
        </button>
      </motion.div>
    </motion.div>
  );
}
