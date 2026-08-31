'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Sparkles, Lightbulb, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabKey = 'home' | 'study' | 'syllabus' | 'history' | 'tests' | 'stats';

interface InfoSection {
  title: string;
  items: { icon: string; text: string }[];
}

export const TAB_INFO: Record<TabKey, { title: string; subtitle: string; sections: InfoSection[] }> = {
  home: {
    title: 'Home Tab',
    subtitle: 'Your daily mission control',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '🌙', text: 'Tap the NEET 2027 logo to start sleep mode — the app locks with a night scene + math problem to wake up.' },
          { icon: '🔥', text: 'The streak flame shows your consecutive study days. Don\'t break the chain!' },
          { icon: '📊', text: 'Today vs Yesterday rings show if you\'re improving. Inner ring = today, outer = yesterday.' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '✨', text: 'Tap any card title (Countdown, Score Prediction) for more details.' },
          { icon: '🤝', text: 'Study with Friend: pair with a partner to see live study comparison + status (studying/paused/wasting).' },
          { icon: '🧠', text: 'AI Coach analyzes your patterns and suggests what to study next.' },
        ],
      },
    ],
  },
  study: {
    title: 'Study Tab',
    subtitle: 'Daily targets + focus sessions',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '⏱️', text: 'Tap the ▶ button on any target card to start a focus session.' },
          { icon: '✓', text: 'Tap the ✓ button to mark a target done (triggers celebration + confetti).' },
          { icon: '＋', text: 'Tap "Add Target" at the bottom to create a new study target.' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '🖐️', text: 'Long-press the Study tab (bottom nav) to open Quick Actions: Free Study + Daily Recall Challenge.' },
          { icon: '🎚️', text: 'Drag the grip handle (⋮) on any card to reorder targets within a chapter.' },
          { icon: '👭', text: 'Cards under the same chapter show a "1/3" badge — sister cards for the same chapter.' },
          { icon: '🔄', text: 'Full-screen focus session auto-rotates with your phone (all 4 directions). Long-press rotate button to lock orientation.' },
        ],
      },
    ],
  },
  syllabus: {
    title: 'Syllabus Tab',
    subtitle: 'Track your full NEET syllabus',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '🔍', text: 'Use the filter pills to filter by subject or progress status (Active, Next Up, Done, Overdue).' },
          { icon: '📚', text: 'Tap any chapter to expand its lectures + resources.' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '🖐️', text: 'Long-press the Syllabus tab (bottom nav) to open: Build Syllabus + Formula Vault.' },
          { icon: '🔄', text: 'Tap the reorder icon (⋮) to drag-and-drop chapters into your preferred order.' },
          { icon: '📝', text: 'Formula Vault stores important formulas for quick review before exams.' },
          { icon: '🎯', text: 'Mark lectures as "done" to track syllabus completion percentage.' },
        ],
      },
    ],
  },
  history: {
    title: 'History Tab',
    subtitle: 'Your study journey over time',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '📅', text: 'Tap any day to see detailed session breakdown for that day.' },
          { icon: '📊', text: 'Scroll down for weekly + monthly summaries.' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '🔥', text: 'The heatmap shows your study intensity over the last 12 weeks. Darker green = more study.' },
          { icon: '📈', text: 'Subject distribution shows which subjects you\'ve studied most/least.' },
          { icon: '⚠️', text: 'Red cells in the heatmap = days you wasted time (distractions detected).' },
        ],
      },
    ],
  },
  tests: {
    title: 'Tests Tab',
    subtitle: 'Mock tests + paper analysis',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '＋', text: 'Tap "Add Test" to log a mock test with your score.' },
          { icon: '🎯', text: 'Tap any test to see detailed analysis (subject-wise marks, mistakes).' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '📄', text: 'Long-press the Tests tab (bottom nav) to open Paper Test mode — practice with a real exam paper + timer.' },
          { icon: '📈', text: 'Score trend chart shows if you\'re improving over time.' },
          { icon: '⚠️', text: 'Negative marking trainer helps you decide when to guess vs skip.' },
        ],
      },
    ],
  },
  stats: {
    title: 'Stats Tab',
    subtitle: 'Deep analytics + insights',
    sections: [
      {
        title: 'Quick Actions',
        items: [
          { icon: '📊', text: 'Switch between Week / Month / All-time views.' },
          { icon: '🎓', text: 'Subject sunburst shows your study distribution across all subjects.' },
        ],
      },
      {
        title: 'Hidden Features',
        items: [
          { icon: '📅', text: 'Calendar view shows daily study time — tap any day for details.' },
          { icon: '📉', text: 'Subject Weekly Breakdown shows which subjects you studied each day of the week.' },
          { icon: '🎯', text: 'Score Prediction uses your study patterns to estimate your NEET score range.' },
        ],
      },
    ],
  },
};

/**
 * TabInfoSheet — bottom sheet showing tab-specific info + hidden features.
 * Shown when the user taps the ? (tutorial) button in the long-press overlay.
 */
export function TabInfoSheet({ tab, onClose }: { tab: TabKey; onClose: () => void }) {
  const info = TAB_INFO[tab];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md glass-strong rounded-t-3xl max-h-[85vh] flex flex-col"
      >
        <div className="sticky top-0 z-10 px-5 pt-4 pb-3 glass-strong rounded-t-3xl" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-teal-400" />
              <div>
                <h2 className="text-lg font-bold">{info.title}</h2>
                <p className="text-[10px] text-t-muted">{info.subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto scroll-area px-5 py-4 space-y-5">
          {info.sections.map((section, si) => (
            <div key={si}>
              <div className="flex items-center gap-1.5 mb-2.5">
                {si === 0 ? <Sparkles size={12} className="text-teal-400" /> : <Lightbulb size={12} className="text-amber-400" />}
                <h3 className={cn('text-xs font-bold uppercase tracking-wide', si === 0 ? 'text-teal-400' : 'text-amber-400')}>
                  {section.title}
                </h3>
              </div>
              <div className="space-y-2">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5">
                    <span className="text-base shrink-0 mt-0.5">{item.icon.trim()}</span>
                    <p className="text-xs text-t-secondary leading-snug">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-3 flex items-center gap-2">
            <ChevronRight size={14} className="text-teal-400 shrink-0" />
            <p className="text-[10px] text-teal-300/80">
              Tip: Long-press tabs in the bottom nav for quick actions (Study → Free Study/Recall, Syllabus → Build/Vault, Tests → Paper Test).
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
