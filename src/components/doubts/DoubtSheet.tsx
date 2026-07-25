'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, Trash2, HelpCircle } from 'lucide-react';
import { useDoubts } from '@/lib/store/doubts';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import type { Subject } from '@/lib/types';
import { cn, vibrate } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function DoubtSheet({ onClose }: Props) {
  const { doubts, addDoubt, resolveDoubt, deleteDoubt } = useDoubts();
  const syllabusChapters = useSyllabus((s) => s.chapters);
  const syllabusSubjects = useSyllabus((s) => s.subjects);
  const [showAdd, setShowAdd] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [subject, setSubject] = useState<Subject>('Physics');
  const [chapter, setChapter] = useState('');
  const [question, setQuestion] = useState('');
  const [source, setSource] = useState<'self' | 'class' | 'mock'>('self');
  const [solution, setSolution] = useState('');

  const pending = doubts.filter((d) => d.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
  const resolved = doubts.filter((d) => d.status === 'resolved').sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));

  const availableChapters = syllabusChapters.filter((c) => {
    const subj = syllabusSubjects.find((s) => s.id === c.subjectId);
    return subj?.name === subject;
  });

  const handleAdd = () => {
    if (!question.trim()) return;
    vibrate(12);
    addDoubt({ subject, chapter: chapter || undefined, question: question.trim(), source });
    setQuestion(''); setChapter(''); setShowAdd(false);
  };

  const handleResolve = () => {
    if (!solution.trim() || !resolvingId) return;
    vibrate(15);
    resolveDoubt(resolvingId, solution.trim());
    setSolution(''); setResolvingId(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }} onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass rounded-t-3xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-amber-400" />
              <h2 className="text-lg font-bold">Doubt Tracker</h2>
              {pending.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{pending.length}</span>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60"><X size={16} /></button>
          </div>
        </div>
        <div className="overflow-y-auto scroll-area px-5 py-4">
          {showAdd ? (
            <div className="glass rounded-xl p-3 mb-4 space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-white/40 block mb-1.5">SUBJECT</label>
                <div className="flex gap-1 flex-wrap">
                  {SUBJECTS.map((s) => (
                    <button key={s} onClick={() => { setSubject(s); setChapter(''); vibrate(6); }}
                      className={cn('px-2 py-1 rounded-md text-[10px] font-semibold', subject === s ? 'text-black' : 'bg-white/5 text-white/60')}
                      style={subject === s ? { background: subjectColor(s).hex } : undefined}>{s}</button>
                  ))}
                </div>
              </div>
              {availableChapters.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-white/40 block mb-1.5">CHAPTER</label>
                  <select value={chapter} onChange={(e) => setChapter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400/50">
                    <option value="">No chapter</option>
                    {availableChapters.map((ch) => (<option key={ch.id} value={ch.name}>{ch.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold text-white/40 block mb-1.5">QUESTION *</label>
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type your doubt here..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400/50 min-h-[60px]" autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-white/40 block mb-1.5">SOURCE</label>
                <div className="flex gap-1">
                  {(['self', 'class', 'mock'] as const).map((src) => (
                    <button key={src} onClick={() => { setSource(src); vibrate(6); }}
                      className={cn('px-2 py-1 rounded-md text-[10px] font-medium capitalize', source === src ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60')}>
                      {src === 'self' ? 'Self-study' : src}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleAdd} disabled={!question.trim()}
                className={cn('w-full py-2.5 rounded-lg font-bold text-xs transition', question.trim() ? 'bg-gradient-to-r from-teal-500 to-green-500 text-black' : 'bg-white/5 text-white/30')}>
                <Plus size={12} className="inline mr-1" /> Add Doubt
              </button>
            </div>
          ) : resolvingId ? (
            <div className="glass rounded-xl p-3 mb-4 space-y-3">
              <label className="text-[10px] font-semibold text-white/40 block mb-1.5">SOLUTION *</label>
              <textarea value={solution} onChange={(e) => setSolution(e.target.value)} placeholder="How was this doubt solved?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400/50 min-h-[80px]" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => { setResolvingId(null); setSolution(''); }} className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 text-xs font-semibold">Cancel</button>
                <button onClick={handleResolve} disabled={!solution.trim()} className={cn('flex-1 py-2 rounded-lg font-bold text-xs', solution.trim() ? 'bg-green-500 text-black' : 'bg-white/5 text-white/30')}>Resolve</button>
              </div>
            </div>
          ) : null}

          {!showAdd && !resolvingId && (
            <button onClick={() => { setShowAdd(true); vibrate(8); }}
              className="w-full py-2.5 rounded-xl border border-dashed border-teal-400/30 text-teal-400 text-xs font-semibold flex items-center justify-center gap-1.5 mb-4 hover:bg-teal-500/5">
              <Plus size={14} /> Add New Doubt
            </button>
          )}

          {pending.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[10px] font-bold uppercase text-white/40 mb-2">📌 Pending ({pending.length})</h3>
              <div className="space-y-2">
                {pending.map((d) => {
                  const c = subjectColor(d.subject);
                  return (
                    <div key={d.id} className="glass rounded-xl p-2.5" style={{ borderLeft: `2px solid ${c.hex}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${c.hex}22`, color: c.hex }}>{d.subject}</span>
                        {d.chapter && <span className="text-[9px] text-white/40">{d.chapter}</span>}
                        <span className="text-[9px] text-white/30 ml-auto">{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-xs text-white/80 mb-2">{d.question}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setResolvingId(d.id); setShowAdd(false); vibrate(8); }} className="flex-1 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[10px] font-bold flex items-center justify-center gap-1">
                          <Check size={10} /> Resolve
                        </button>
                        <button onClick={() => { deleteDoubt(d.id); vibrate(10); }} className="px-2 py-1.5 rounded-lg bg-red-500/15 text-red-400"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase text-white/40 mb-2">✅ Resolved ({resolved.length})</h3>
              <div className="space-y-2">
                {resolved.slice(0, 10).map((d) => {
                  const c = subjectColor(d.subject);
                  return (
                    <div key={d.id} className="glass rounded-xl p-2.5 opacity-70">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${c.hex}22`, color: c.hex }}>{d.subject}</span>
                        {d.chapter && <span className="text-[9px] text-white/40">{d.chapter}</span>}
                        <Check size={10} className="text-green-400 ml-auto" />
                      </div>
                      <p className="text-xs text-white/60 mb-1 line-through">{d.question}</p>
                      {d.solution && <p className="text-[10px] text-green-400/70">→ {d.solution}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {doubts.length === 0 && !showAdd && (
            <div className="text-center py-8">
              <HelpCircle size={32} className="text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/40">No doubts yet. Add any question you're stuck on!</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
