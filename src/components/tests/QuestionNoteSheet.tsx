'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Trash2, Check } from 'lucide-react';
import { useTests } from '@/lib/store/tests';
import { subjectColor } from '@/lib/colors';
import { cn, vibrate } from '@/lib/utils';
import { pushToast } from '@/components/shared/Toast';
import type { Subject } from '@/lib/types';

interface Props {
  testId: string;
  questionIdx: number;
  questionNumber: number;
  subject: Subject;
  onClose: () => void;
}

/**
 * QuestionNoteSheet — add a text note and/or photo to a paper test question.
 *
 * Photo: captured via device camera or uploaded from gallery, then compressed
 * to max 800px JPEG at 0.7 quality (keeps localStorage usage reasonable —
 * ~50-100KB per photo, so ~50-100 photos before hitting the 5MB quota).
 *
 * Note: free text — "used formula X", "tricky concept", "guessed", etc.
 *
 * Both are stored on the PaperQuestion and surface in the test summary for
 * post-test review.
 */
export function QuestionNoteSheet({ testId, questionIdx, questionNumber, subject, onClose }: Props) {
  const test = useTests((s) => s.tests.find((t) => t.id === testId));
  const setQuestionNote = useTests((s) => s.setQuestionNote);
  const setQuestionPhoto = useTests((s) => s.setQuestionPhoto);
  const setQuestionText = useTests((s) => s.setQuestionText);

  const question = test?.paperTest?.questions[questionIdx];
  const [questionText, setQuestionTextState] = useState(question?.questionText || '');
  const [note, setNote] = useState(question?.note || '');
  const [photo, setPhoto] = useState<string | undefined>(question?.photo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const c = subjectColor(subject);

  if (!question) return null;

  /** Compress an image file to max 800px JPEG at 0.7 quality via canvas. */
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          } else if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      vibrate(10);
    } catch {
      pushToast('Photo error', 'Could not process image', 'error');
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleSave = () => {
    vibrate(15);
    setQuestionText(testId, questionIdx, questionText);
    setQuestionNote(testId, questionIdx, note);
    setQuestionPhoto(testId, questionIdx, photo);
    pushToast('Saved', `Q${questionNumber} updated`, 'success');
    onClose();
  };

  const handleRemovePhoto = () => {
    vibrate(8);
    setPhoto(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl p-5 pb-8 max-h-[88vh] overflow-y-auto scroll-area"
      >
        <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: `${c.hex}25`, color: c.hex }}
            >
              {subject}
            </span>
            <h2 className="text-base font-bold">Q{questionNumber} Note</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Question text section — type or paste the actual question */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            QUESTION TEXT (OPTIONAL)
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionTextState(e.target.value)}
            placeholder="Type or paste the question text here for future reference..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50 min-h-[80px] resize-none"
          />
          <p className="text-[10px] text-white/40 mt-1">
            Useful for reviewing wrong answers later — you can see the exact question
            without needing the photo or paper.
          </p>
        </div>

        {/* Photo section */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            QUESTION PHOTO
          </label>
          {photo ? (
            <div className="relative">
              <img
                src={photo}
                alt="Question"
                className="w-full rounded-xl max-h-64 object-contain bg-black/30"
              />
              <button
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-red-500/80 text-white flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="py-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-1 text-xs text-white/70 hover:bg-white/10 transition"
              >
                <Camera size={18} className="text-teal-400" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-1 text-xs text-white/70 hover:bg-white/10 transition"
              >
                <Camera size={18} className="text-purple-400" />
                Upload
              </button>
            </div>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-[10px] text-white/40 mt-1.5 leading-snug">
            Snap a photo of the question paper so you can review it later.
            Auto-compressed to ~50KB.
          </p>
        </div>

        {/* Note section */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-white/60 mb-2 block">
            NOTE
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Used formula v² = u² + 2as · Tricky concept · Guessed · Revision needed"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400/50 min-h-[80px] resize-none"
            autoFocus
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-green-500 text-black font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> Save Note
        </button>
      </motion.div>
    </motion.div>
  );
}
