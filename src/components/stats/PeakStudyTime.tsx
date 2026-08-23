'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import { Clock, Flame, X, ChevronRight, AlertTriangle, Calendar, BookOpen, Target, Sparkles } from 'lucide-react';
import { useHistory } from '@/lib/store/history';
import { bestHourDataV2, type HourStat, type TimeBlockStat } from '@/lib/analytics';
import { formatHM, vibrate } from '@/lib/utils';

/**
 * PeakStudyTime — redesigned "Best Study Hour" with 3 levels of detail.
 *
 * LEVEL 1 (main card in Stats tab):
 *   - Big headline: "Around 9 PM" (peak hour)
 *   - 6 time blocks (Dawn/Morning/Noon/Evening/Night/Late) with progress bars
 *   - Peak block highlighted with flame icon + glowing border
 *   - Tap card → opens Level 2 sheet
 *
 * LEVEL 2 (bottom sheet, 24-hour breakdown):
 *   - Bar chart of avg minutes per hour (0-23)
 *   - Day/night background color bands
 *   - Peak bar glows teal/gold; worst-wasted bar shows ⚠
 *   - 2 auto-generated insight lines
 *   - Tap any bar → opens Level 3 popup
 *
 * LEVEL 3 (per-hour detail popup, replaces Level 2 view):
 *   - Avg minutes / Total minutes / Sessions / Days studied
 *   - Wasted avg / Wasted total / Efficiency %
 *   - Smart insight based on data
 *
 * THEME COMPLIANCE:
 *   - All colors use CSS variables (var(--foreground), var(--muted-foreground), etc.)
 *   - NO hardcoded text-white or bg-white outside force-dark-ui scope
 *   - Sheet uses bg-card/95 + backdrop-blur — adapts to every theme
 *   - Chart axis labels use var(--muted-foreground) — visible in dark + light themes
 */

const PEAK_COLOR = '#14b8a6'; // teal — readable on both dark + light
const PEAK_GLOW = 'rgba(20, 184, 166, 0.45)';
const NORMAL_COLOR = 'rgba(20, 184, 166, 0.55)';
const WASTED_COLOR = '#ef4444';

export function PeakStudyTime() {
  const sessions = useHistory((s) => s.sessions);
  const analysis = useMemo(() => bestHourDataV2(sessions), [sessions]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  // Empty state — no sessions yet
  if (!analysis.peakHour && !analysis.peakBlock) {
    return (
      <div className="glass rounded-2xl p-4">
        <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Peak Study Time
        </h3>
        <div className="text-center py-4">
          <Clock size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Complete study sessions to discover your peak hours.
          </p>
        </div>
      </div>
    );
  }

  const peakHourLabel = analysis.peakHour ? analysis.peakHour.label : '—';
  const peakHourAvg = analysis.peakHour ? analysis.peakHour.avgMinutes : 0;
  const maxBlockMinutes = Math.max(...analysis.blocks.map((b) => b.totalMinutes), 1);

  return (
    <>
      {/* ============= LEVEL 1: Main card ============= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-4 cursor-pointer select-none active:scale-[0.99] transition-transform"
        onClick={() => {
          vibrate(8);
          setSheetOpen(true);
        }}
      >
        {/* Header with icon + title */}
        <div className="flex items-center gap-2 mb-3">
          <Flame size={14} className="text-amber-500" />
          <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
            Peak Study Time
          </h3>
          <ChevronRight size={14} className="ml-auto opacity-50" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        {/* Big headline */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            You study best around
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular" style={{ color: PEAK_COLOR }}>
              {peakHourLabel}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {peakHourAvg > 0 ? `~${peakHourAvg} min avg/day` : ''}
            </span>
          </div>
        </div>

        {/* Time blocks */}
        <div className="space-y-2">
          {analysis.blocks.map((block) => {
            const isPeak = analysis.peakBlock?.id === block.id && block.totalMinutes > 0;
            const widthPct = Math.max((block.totalMinutes / maxBlockMinutes) * 100, block.totalMinutes > 0 ? 6 : 0);
            return (
              <div key={block.id} className="flex items-center gap-2.5">
                <div className="w-7 text-center text-base leading-none">{block.icon}</div>
                <div className="w-16 shrink-0">
                  <div className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                    {block.name}
                  </div>
                  <div className="text-[9px] tabular" style={{ color: 'var(--muted-foreground)' }}>
                    {block.range}
                  </div>
                </div>
                <div className="flex-1 h-3.5 rounded-full overflow-hidden relative" style={{ background: 'var(--muted)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${widthPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: isPeak
                        ? `linear-gradient(90deg, ${PEAK_COLOR}, #fbbf24)`
                        : `linear-gradient(90deg, ${NORMAL_COLOR}, ${PEAK_COLOR})`,
                      boxShadow: isPeak ? `0 0 8px ${PEAK_GLOW}` : 'none',
                    }}
                  />
                </div>
                <div className="w-12 text-right text-[10px] tabular font-semibold" style={{ color: 'var(--foreground)' }}>
                  {block.totalMinutes > 0 ? formatHM(block.totalMinutes * 60) : '—'}
                </div>
                {isPeak && (
                  <Flame size={12} className="text-amber-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Tap hint */}
        <div className="text-center text-[10px] mt-3 pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          Tap to see 24-hour breakdown →
        </div>
      </motion.div>

      {/* ============= LEVEL 2: 24-hour detail sheet ============= */}
      <AnimatePresence>
        {sheetOpen && selectedHour === null && (
          <HourSheet
            analysis={analysis}
            onClose={() => setSheetOpen(false)}
            onSelectHour={(h) => {
              vibrate(10);
              setSelectedHour(h);
            }}
          />
        )}
      </AnimatePresence>

      {/* ============= LEVEL 3: Per-hour detail popup ============= */}
      <AnimatePresence>
        {sheetOpen && selectedHour !== null && (
          <HourDetailPopup
            hour={analysis.hours[selectedHour]}
            totalDaysTracked={analysis.totalDaysTracked}
            onClose={() => setSelectedHour(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// LEVEL 2: 24-hour bar chart sheet
// =====================================================

function HourSheet({
  analysis,
  onClose,
  onSelectHour,
}: {
  analysis: ReturnType<typeof bestHourDataV2>;
  onClose: () => void;
  onSelectHour: (hour: number) => void;
}) {
  // Chart data: 24 entries with avgMinutes
  const chartData = analysis.hours.map((h) => ({
    hour: h.shortLabel,
    fullLabel: h.label,
    avgMinutes: h.avgMinutes,
    totalMinutes: h.totalMinutes,
    sessionCount: h.sessionCount,
    dayCount: h.dayCount,
    hourNum: h.hour,
    isPeak: analysis.peakHour?.hour === h.hour,
    isWorstWasted: analysis.worstWastedHour?.hour === h.hour,
  }));

  const maxAvg = Math.max(...chartData.map((d) => d.avgMinutes), 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{ background: `linear-gradient(135deg, ${PEAK_GLOW}, transparent)`, border: `1px solid ${PEAK_COLOR}40` }}
          >
            <Clock size={24} style={{ color: PEAK_COLOR }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
            Your 24-Hour Pattern
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Average minutes studied per hour · tap any bar for details
          </p>
        </div>

        {/* Chart with day/night bands */}
        <div className="relative h-56 mb-3">
          {/* Day/Night background bands */}
          <div className="absolute inset-0 flex">
            {/* 12 AM - 6 AM : night */}
            <div className="h-full" style={{ width: '25%', background: 'rgba(99, 102, 241, 0.06)' }} />
            {/* 6 AM - 6 PM : day */}
            <div className="h-full" style={{ width: '50%', background: 'rgba(251, 191, 36, 0.06)' }} />
            {/* 6 PM - 12 AM : night */}
            <div className="h-full" style={{ width: '25%', background: 'rgba(99, 102, 241, 0.06)' }} />
          </div>

          {/* Day/Night labels */}
          <div className="absolute top-1 left-0 right-0 flex justify-between px-1 text-[8px] font-semibold uppercase tracking-wider pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <span>🌙 Night</span>
            <span>☀️ Day</span>
            <span>🌙 Night</span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 5, left: -22, bottom: 0 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  const hourNum = e.activePayload[0].payload.hourNum;
                  if (typeof hourNum === 'number' && analysis.hours[hourNum].sessionCount > 0) {
                    onSelectHour(hourNum);
                  }
                }
              }}
            >
              <XAxis
                dataKey="hour"
                tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--foreground)',
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                itemStyle={{ color: 'var(--foreground)' }}
                formatter={(value: any, _name: any, props: any) => {
                  const p = props?.payload;
                  if (!p) return [`${value} min`, 'Avg'];
                  return [
                    <div key="tip" style={{ color: 'var(--foreground)' }}>
                      <div style={{ fontWeight: 600 }}>{p.fullLabel}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        Avg: {p.avgMinutes}m · Total: {p.totalMinutes}m
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        {p.sessionCount} sessions · {p.dayCount} days
                      </div>
                    </div>,
                    '',
                  ];
                }}
                labelFormatter={() => ''}
              />
              <Bar dataKey="avgMinutes" radius={[2, 2, 0, 0]} cursor="pointer">
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isPeak ? PEAK_COLOR : d.sessionCount > 0 ? NORMAL_COLOR : 'var(--muted)'}
                    strokeWidth={d.isPeak ? 1 : 0}
                    stroke={d.isPeak ? '#fbbf24' : 'none'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 text-[9px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PEAK_COLOR, border: '1px solid #fbbf24' }} />
            Peak hour
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: NORMAL_COLOR }} />
            Studied
          </span>
          {analysis.worstWastedHour && (
            <span className="flex items-center gap-1">
              <AlertTriangle size={10} className="text-red-500" />
              Worst wasted
            </span>
          )}
        </div>

        {/* Insights */}
        <div className="space-y-2">
          {analysis.peakHour && (
            <InsightRow
              icon={<Flame size={14} className="text-amber-500" />}
              text={`Your peak is ${analysis.peakHour.label} — ${analysis.peakHour.avgMinutes} min avg on ${analysis.peakHour.dayCount} days.`}
            />
          )}
          {analysis.worstWastedHour && (
            <InsightRow
              icon={<AlertTriangle size={14} className="text-red-500" />}
              text={`Most wasted time at ${analysis.worstWastedHour.label} — ${analysis.worstWastedHour.wastedMinutes} min total.`}
            />
          )}
          {analysis.peakBlock && (
            <InsightRow
              icon={<Sparkles size={14} style={{ color: PEAK_COLOR }} />}
              text={`Best time block: ${analysis.peakBlock.icon} ${analysis.peakBlock.name} (${analysis.peakBlock.range}).`}
            />
          )}
        </div>

        {/* Helper */}
        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap any bar with data for full breakdown · Tap outside to close
        </p>
      </motion.div>
    </motion.div>
  );
}

function InsightRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      className="rounded-xl p-2.5 flex items-start gap-2 text-xs"
      style={{
        background: 'var(--muted)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1 leading-relaxed">{text}</span>
    </div>
  );
}

// =====================================================
// LEVEL 3: Per-hour detail popup
// =====================================================

function HourDetailPopup({
  hour,
  totalDaysTracked,
  onClose,
}: {
  hour: HourStat;
  totalDaysTracked: number;
  onClose: () => void;
}) {
  const efficiencyColor = hour.efficiency >= 80 ? '#22c55e' : hour.efficiency >= 60 ? '#f59e0b' : '#ef4444';
  const insight = generateInsight(hour);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
          aria-label="Back"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🕘</div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            {hour.label}
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Your study stats at this hour
          </p>
        </div>

        {/* Avg vs Total big cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-2xl p-3.5 text-center"
            style={{
              background: `linear-gradient(135deg, ${PEAK_GLOW}, transparent)`,
              border: `1px solid ${PEAK_COLOR}40`,
            }}
          >
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Average
            </div>
            <div className="text-2xl font-bold tabular" style={{ color: PEAK_COLOR }}>
              {hour.avgMinutes}m
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              per active day
            </div>
          </div>
          <div
            className="rounded-2xl p-3.5 text-center"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Total
            </div>
            <div className="text-2xl font-bold tabular" style={{ color: 'var(--foreground)' }}>
              {formatHM(hour.totalMinutes * 60)}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              all-time at this hour
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="space-y-2 mb-4">
          <DetailRow
            icon={<BookOpen size={14} style={{ color: 'var(--muted-foreground)' }} />}
            label="Sessions here"
            value={`${hour.sessionCount}`}
          />
          <DetailRow
            icon={<Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />}
            label="Days studied at this time"
            value={`${hour.dayCount} of ${totalDaysTracked}`}
          />
          <div className="h-px my-1" style={{ background: 'var(--border)' }} />
          <DetailRow
            icon={<Clock size={14} style={{ color: '#22c55e' }} />}
            label="Focused (avg / total)"
            value={`${hour.avgMinutes}m / ${formatHM(hour.totalMinutes * 60)}`}
            valueColor="#22c55e"
          />
          <DetailRow
            icon={<AlertTriangle size={14} style={{ color: '#ef4444' }} />}
            label="Wasted (avg / total)"
            value={`${hour.avgWasted}m / ${formatHM(hour.wastedMinutes * 60)}`}
            valueColor="#ef4444"
          />
          <div className="h-px my-1" style={{ background: 'var(--border)' }} />
          <DetailRow
            icon={<Target size={14} style={{ color: efficiencyColor }} />}
            label="Efficiency"
            value={`${hour.efficiency}%`}
            valueColor={efficiencyColor}
          />
        </div>

        {/* Smart insight */}
        <div
          className="rounded-2xl p-3 flex items-start gap-2"
          style={{
            background: 'var(--muted)',
            border: '1px solid var(--border)',
          }}
        >
          <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: PEAK_COLOR }} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
            <span className="font-semibold">Insight: </span>
            {insight}
          </div>
        </div>

        <p className="text-[9px] text-center mt-4" style={{ color: 'var(--muted-foreground)' }}>
          Tap outside to go back
        </p>
      </motion.div>
    </motion.div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs flex-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      <span className="text-xs font-bold tabular" style={{ color: valueColor || 'var(--foreground)' }}>
        {value}
      </span>
    </div>
  );
}

// =====================================================
// Smart insight generator
// =====================================================

function generateInsight(hour: HourStat): string {
  if (hour.dayCount === 0) {
    return 'No sessions at this hour yet. Try studying here to see your pattern.';
  }
  if (hour.dayCount < 3) {
    const remaining = 3 - hour.dayCount;
    return `Only ${hour.dayCount} day${hour.dayCount === 1 ? '' : 's'} of data — study at this time on ${remaining} more day${remaining === 1 ? '' : 's'} for reliable insights.`;
  }
  if (hour.efficiency >= 85) {
    return `You're highly focused at this hour — protect it from distractions and make it a fixed study slot.`;
  }
  if (hour.efficiency >= 70) {
    return `Solid focus here. A 5-min warmup before studying could push your efficiency even higher.`;
  }
  if (hour.efficiency >= 50) {
    return `Mixed focus — you waste about ${hour.avgWasted} min per session here. Try silencing your phone before starting.`;
  }
  return `Lots of wasted time at this hour. Consider shifting study to your peak time (${hour.label}) for better results.`;
}
