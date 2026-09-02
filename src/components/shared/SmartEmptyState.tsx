'use client';

import { motion } from 'framer-motion';
import { BookOpen, BarChart3, FileText, History as HistoryIcon, TrendingUp } from 'lucide-react';

interface Props {
  tab: 'stats' | 'history' | 'tests' | 'syllabus';
  onAction?: () => void;
}

export function SmartEmptyState({ tab, onAction }: Props) {
  const configs = {
    stats: {
      icon: <BarChart3 size={40} />,
      title: 'No analytics yet',
      desc: 'Complete a few study sessions to unlock detailed analytics, charts, and insights.',
      cta: 'Go to Study',
      color: '#14b8a6',
    },
    history: {
      icon: <HistoryIcon size={40} />,
      title: 'No history yet',
      desc: 'Your completed study sessions will appear here with time, mood, and subject details.',
      cta: 'Start Studying',
      color: '#22c55e',
    },
    tests: {
      icon: <FileText size={40} />,
      title: 'No tests added',
      desc: 'Add your mock tests to track scores, analyze weak areas, and predict your NEET score.',
      cta: 'Add First Test',
      color: '#a855f7',
    },
    syllabus: {
      icon: <BookOpen size={40} />,
      title: 'No syllabus yet',
      desc: 'Build your NEET syllabus by selecting subjects and chapters. Track lectures, DPPs, notes, and revisions.',
      cta: 'Build Syllabus',
      color: '#f59e0b',
    },
  };

  const config = configs[tab];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-8 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: `${config.color}15`, color: config.color }}
      >
        {config.icon}
      </div>
      <h3 className="text-base font-bold mb-2">{config.title}</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">{config.desc}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-black active:scale-95 transition"
          style={{ background: config.color }}
        >
          {config.cta}
        </button>
      )}
    </motion.div>
  );
}
