'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Calendar } from 'lucide-react';
import { WeekStory } from './WeekStory';
import { HeatmapCalendar } from './HeatmapCalendar';
import { vibrate } from '@/lib/utils';

/**
 * ActivityCard — combined "Activity" card with Week | Month segmented control.
 *
 * Groups two study-activity-over-time views into a single card:
 *   - Week  → WeekStory (7-day detail: big total, tiles, trend, goal bar)
 *   - Month → HeatmapCalendar (calendar grid + month summary: total, trend,
 *             streak, goal, days, avg — all merged in)
 *
 * The Month tab now includes all the stats that were previously in the
 * separate "Month Story / 30D" card (total, trend, streak, goal progress,
 * days studied, daily average) — integrated directly above the calendar grid.
 * No more separate 30D tab needed.
 *
 * Both views support tap-to-drill-down into a Day Detail popup.
 * Segmented control uses iOS-style sliding pill animation.
 */

type Tab = 'week' | 'month';

export function ActivityCard() {
  const [tab, setTab] = useState<Tab>('week');

  return (
    <div className="glass rounded-2xl p-4">
      {/* Header with title + segmented control */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
          <BarChart3 size={14} style={{ color: '#14b8a6' }} />
          Activity
        </h3>

        {/* Segmented control — iOS style, 2 tabs */}
        <div
          className="relative flex rounded-lg p-0.5"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          {/* Sliding pill background */}
          <motion.div
            className="absolute top-0.5 bottom-0.5 rounded-md"
            style={{ width: 'calc(50% - 2px)' }}
            animate={{ left: tab === 'week' ? '2px' : 'calc(50% + 0px)' }}
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

          {/* Week button */}
          <button
            onClick={() => { vibrate(8); setTab('week'); }}
            className="relative z-10 flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold transition-colors rounded-md"
            style={{ color: tab === 'week' ? '#ffffff' : 'var(--muted-foreground)' }}
          >
            <Calendar size={11} />
            Week
          </button>

          {/* Month button */}
          <button
            onClick={() => { vibrate(8); setTab('month'); }}
            className="relative z-10 flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold transition-colors rounded-md"
            style={{ color: tab === 'month' ? '#ffffff' : 'var(--muted-foreground)' }}
          >
            <Calendar size={11} />
            Month
          </button>
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
          {tab === 'week' ? <WeekStory embedded /> : <HeatmapCalendar embedded />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
