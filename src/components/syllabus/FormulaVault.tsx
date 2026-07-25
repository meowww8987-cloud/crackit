'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, Plus, Trash2, Search, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useFormulaVault, type FormulaEntry } from '@/lib/coachData';
import { useSyllabus } from '@/lib/store/syllabus';
import { subjectColor, SUBJECTS } from '@/lib/colors';
import { cn, vibrate } from '@/lib/utils';
import { pushToast } from '@/components/shared/Toast';
import type { Subject } from '@/lib/types';

/**
 * FormulaVault — collapsible section in Syllabus tab.
 *
 * Features:
 *  - Add formula/concept (title + content + subject + chapter)
 *  - Search by title/content
 *  - Filter by subject
 *  - Flashcard mode: tap to reveal/hide content
 *  - Mark as reviewed (tracks review count)
 *  - Delete
 */
export function FormulaVault() {
  const { formulas, addFormula, deleteFormula, markReviewed } = useFormulaVault();
  const { chapters, subjects } = useSyllabus();
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState<Subject | 'all'>('all');
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Add form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<Subject>('Physics');
  const [chapter, setChapter] = useState('');

  const testSubjects = SUBJECTS.filter((s) => s !== 'General');

  const filtered = formulas.filter((f) => {
    if (filterSubject !== 'all' && f.subject !== filterSubject) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) &&
        !f.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    vibrate(15);
    addFormula({ subject, chapter: chapter || 'General', title: title.trim(), content: content.trim() });
    setTitle(''); setContent(''); setChapter('');
    setShowAdd(false);
    pushToast('Formula saved', 'Added to vault', 'success');
  };

  const toggleReveal = (id: string) => {
    vibrate(8);
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); markReviewed(id); }
      return next;
    });
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header — tap to expand/collapse */}
      <button
        onClick={() => { setExpanded(!expanded); vibrate(8); }}
        className="w-full p-3 flex items-center gap-2"
      >
        <BookMarked size={16} className="text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wide text-white/60">Formula Vault</span>
        <span className="text-[10px] text-white/40 ml-auto">{formulas.length} saved</span>
        <ChevronDown size={14} className={cn('text-white/40 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Search + add + flashcard toggle */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search formulas..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <button
                  onClick={() => { setFlashcardMode(!flashcardMode); vibrate(8); }}
                  className={cn('px-2 py-1.5 rounded-lg text-xs font-bold transition',
                    flashcardMode ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/60')}
                  title="Flashcard mode"
                >
                  {flashcardMode ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  onClick={() => { setShowAdd(!showAdd); vibrate(8); }}
                  className="px-2 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Subject filter */}
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setFilterSubject('all')}
                  className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                    filterSubject === 'all' ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/50')}
                >
                  All
                </button>
                {testSubjects.map((s) => {
                  const c = subjectColor(s);
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterSubject(s)}
                      className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                        filterSubject === s ? 'text-black' : 'bg-white/5 text-white/50')}
                      style={filterSubject === s ? { background: c.hex } : undefined}
                    >
                      {s.slice(0, 4)}
                    </button>
                  );
                })}
              </div>

              {/* Add form */}
              <AnimatePresence>
                {showAdd && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glass rounded-xl p-3 space-y-2">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Formula title (e.g. Ohm's Law)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400/50"
                      />
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Formula or concept (e.g. V = IR)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400/50 min-h-[60px] resize-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={subject}
                          onChange={(e) => setSubject(e.target.value as Subject)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                        >
                          {testSubjects.map((s) => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
                        </select>
                        <input
                          value={chapter}
                          onChange={(e) => setChapter(e.target.value)}
                          placeholder="Chapter (optional)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                      <button
                        onClick={handleAdd}
                        disabled={!title.trim() || !content.trim()}
                        className={cn('w-full py-2 rounded-lg text-xs font-bold',
                          title.trim() && content.trim() ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/30')}
                      >
                        Save Formula
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Formula list */}
              {filtered.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-white/40">
                    {formulas.length === 0 ? 'No formulas saved yet. Tap + to add.' : 'No results.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto scroll-area">
                  {filtered.map((f) => {
                    const c = subjectColor(f.subject);
                    const isRevealed = revealed.has(f.id);
                    return (
                      <div
                        key={f.id}
                        className="rounded-lg p-2 border"
                        style={{ background: `${c.hex}08`, borderColor: `${c.hex}20` }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: `${c.hex}25`, color: c.hex }}>
                            {f.subject.slice(0, 4)}
                          </span>
                          {f.reviewCount > 0 && (
                            <span className="text-[8px] text-white/30">×{f.reviewCount}</span>
                          )}
                          <span className="text-xs font-semibold flex-1 truncate">{f.title}</span>
                          <button
                            onClick={() => deleteFormula(f.id)}
                            className="text-white/20 hover:text-red-400"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        {flashcardMode ? (
                          <button
                            onClick={() => toggleReveal(f.id)}
                            className="w-full text-left"
                          >
                            {isRevealed ? (
                              <div className="text-xs text-white/80 font-mono">{f.content}</div>
                            ) : (
                              <div className="text-xs text-white/30 italic">Tap to reveal...</div>
                            )}
                          </button>
                        ) : (
                          <div className="text-xs text-white/70 font-mono">{f.content}</div>
                        )}
                        <div className="text-[8px] text-white/30 mt-0.5">{f.chapter}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
