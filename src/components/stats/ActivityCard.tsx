'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar } from 'lucide-react';
import { WeekStory } from './WeekStory';
import { HeatmapCalendar } from './HeatmapCalendar';
import { MonthStory } from './MonthStory';
import { vibrate } from '@/lib/utils';

/**
 * ActivityCard — combined "Activity" card with Week | Month | 30D segmented control.
 *
 * Groups three study-activity-over-time views into a single card at the top of
 * the Stats tab:
 *   - Week  → WeekStory (big total, 7 intensity tiles, trend, goal bar)
 *   - Month → HeatmapCalendar (monthly calendar grid with day cells + nav)
 *   - 30D   → MonthStory (30-day GitHub-style tiles + streak + trend + goal)
 *
 * All views support tap-to-drill-down into a Day Detail popup.
 *
 * The segmented control uses a sliding pill animation (iOS-style).
 * With 3 tabs, the pill width is calc(33.33% - 2px) and slides between
 * 3 positions.
 */

type Tab = 'week' | 'month' | '30d';

const TABS: { id: Tab; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: '30d', label: '30D' },
];

export function ActivityCard() {
  const [tab, setTab] = useState<Tab>('week');

  // Calculate pill position for 3 tabs (0%, 33.33%, 66.66%)
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const pillLeft = `calc(${tabIndex * 33.33}% + 2px)`;

  return (
    <div className="glass rounded-2xl p-4">
      {/* Header with title + segmented control */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
          <BarChart3 size={14} style={{ color: '#14b8a6' }} />
          Activity
        </h3>

        {/* Segmented control — iOS style, 3 tabs */}
        <div
          className="relative flex rounded-lg p-0.5"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          {/* Sliding pill background */}
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-md"
            style={{ width: 'calc(33.33% - 2px)' }}
            animate={{ left: pillLeft }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          >
            <div
              className="w-full h-full rounded-md"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                boxShadow: '0 1px 4px rgba(20, 184, 166, 0.3)',
              }}
            />
          </motion.div>

          {/* Tab buttons */}
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { vibrate(8); setTab(t.id); }}
              className="relative z-10 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition-colors rounded-md"
              style={{
                color: tab === t.id ? '#ffffff' : 'var(--muted-foreground)',
                minWidth: '52px',
                justifyContent: 'center',
              }}
            >
              <Calendar size={10} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area — animate on tab switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {tab === 'week' && <WeekStory embedded />}
          {tab === 'month' && <HeatmapCalendar embedded />}
          {tab === '30d' && <MonthStory embedded />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
