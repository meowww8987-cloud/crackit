'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { useRoutine } from '@/lib/store/routine';
import { useHistory } from '@/lib/store/history';
import { subjectColor } from '@/lib/colors';
import { cn, formatHM, todayKey, dateKey, addDays } from '@/lib/utils';

type ViewMode = 'daily' | 'weekly';

/**
 * AdherenceCard — "Plan vs Actual" report for Stats tab.
 *
 * Shows:
 * - Planned vs actual study time
 * - On-plan vs off-plan study
 * - Schedule adherence %
 * - Per-block breakdown table
 * - Simple timeline visualization
 *
 * Breaks are excluded from the adherence denominator.
 */
export function AdherenceCard() {
  const blocks = useRoutine((s) => s.blocks);
  const sessions = useHistory((s) => s.sessions);
  const [mode, setMode] = useState<ViewMode>('daily');

  const report = useMemo(() => {
    const today = todayKey();
    const weekAgo = dateKey(addDays(new Date(), -6));

    const targetDate = mode === 'daily' ? today : weekAgo;
    const endDate = today;

    // Filter sessions for the period
    const periodSessions = sessions.filter((s) =>
      s.date >= targetDate && s.date <= endDate
    );

    // Filter blocks for the period
    const periodDays = mode === 'daily' ? [new Date().getDay()] : [0, 1, 2, 3, 4, 5, 6];
    const periodBlocks = blocks.filter((b) => periodDays.includes(b.day));

    // Group blocks by subject+type+time for weekly aggregation
    const blockMap = new Map<string, {
      subject: string;
      type: string;
      startHour: number;
      endHour: number;
      plannedMin: number;
      actualSec: number;
      isBreak: boolean;
    }>();

    for (const block of periodBlocks) {
      const key = `${block.subject}-${block.type}-${block.startHour}-${block.endHour}`;
      const existing = blockMap.get(key) || {
        subject: block.subject,
        type: block.type,
        startHour: block.startHour,
        endHour: block.endHour,
        plannedMin: (block.endHour - block.startHour) * 60,
        actualSec: 0,
        isBreak: block.type === 'break',
      };
      // For weekly, multiply planned by number of days that have this block
      if (mode === 'weekly') {
        const daysWithBlock = periodBlocks.filter(
          (b) => b.subject === block.subject && b.type === block.type &&
          b.startHour === block.startHour && b.endHour === block.endHour
        ).length;
        existing.plannedMin = (block.endHour - block.startHour) * 60 * daysWithBlock;
      }
      blockMap.set(key, existing);
    }

    // Match sessions to blocks
    let totalPlannedMin = 0;
    let totalActualSec = 0;
    let totalOnPlanSec = 0;
    let totalOffPlanSec = 0;
    let totalBreakMin = 0;

    for (const [key, blockInfo] of blockMap) {
      if (blockInfo.isBreak) {
        totalBreakMin += blockInfo.plannedMin;
        continue;
      }
      totalPlannedMin += blockInfo.plannedMin;

      // Find sessions that match this block (by plannedSlotId OR by subject+time overlap)
      const matchingSessions = periodSessions.filter((s) => {
        // Direct match via plannedSlotId
        if (s.plannedSlotId) {
          const block = blocks.find((b) => b.id === s.plannedSlotId);
          if (block && block.subject === blockInfo.subject &&
              block.type === blockInfo.type &&
              block.startHour === blockInfo.startHour) {
            return true;
          }
        }
        // Fallback: subject match + session started during block's time range
        const sessionDate = new Date(s.startedAt);
        const sessionHour = sessionDate.getHours();
        if (s.subject === blockInfo.subject &&
            sessionHour >= blockInfo.startHour && sessionHour < blockInfo.endHour) {
          return true;
        }
        return false;
      });

      const blockActualSec = matchingSessions.reduce((acc, s) => acc + s.studySeconds, 0);
      blockInfo.actualSec = blockActualSec;
      totalActualSec += blockActualSec;
      totalOnPlanSec += blockActualSec;
    }

    // Off-plan = sessions not matched to any block
    const onPlanSessionIds = new Set<string>();
    for (const [key, blockInfo] of blockMap) {
      if (blockInfo.isBreak) continue;
      const matchingSessions = periodSessions.filter((s) => {
        if (s.plannedSlotId) {
          const block = blocks.find((b) => b.id === s.plannedSlotId);
          if (block && block.subject === blockInfo.subject &&
              block.type === blockInfo.type &&
              block.startHour === blockInfo.startHour) {
            onPlanSessionIds.add(s.id);
            return true;
          }
        }
        const sessionDate = new Date(s.startedAt);
        const sessionHour = sessionDate.getHours();
        if (s.subject === blockInfo.subject &&
            sessionHour >= blockInfo.startHour && sessionHour < blockInfo.endHour) {
          onPlanSessionIds.add(s.id);
          return true;
        }
        return false;
      });
    }

    for (const s of periodSessions) {
      if (!onPlanSessionIds.has(s.id)) {
        totalOffPlanSec += s.studySeconds;
      }
    }

    const focusedSec = periodSessions.reduce((acc, s) => acc + s.studySeconds, 0);
    const wastedSec = periodSessions.reduce((acc, s) => acc + s.wastedSeconds, 0);
    const adherencePct = totalPlannedMin > 0
      ? Math.round((totalOnPlanSec / 60 / totalPlannedMin) * 100)
      : 0;

    return {
      blocks: Array.from(blockMap.values()).filter((b) => !b.isBreak),
      totalPlannedMin,
      totalActualSec,
      totalOnPlanSec,
      totalOffPlanSec,
      totalBreakMin,
      focusedSec,
      wastedSec,
      adherencePct,
    };
  }, [blocks, sessions, mode]);

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00`;
  };

  const adherenceColor = report.adherencePct >= 80 ? '#22c55e' :
                         report.adherencePct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-teal-500" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Plan vs Actual
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Schedule Adherence
            </div>
          </div>
        </div>
        {/* Mode toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-foreground/5">
          {(['daily', 'weekly'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); }}
              className={cn(
                'px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition',
                mode === m
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground'
              )}
            >
              {m === 'daily' ? 'Today' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Adherence % */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold tabular shrink-0"
          style={{
            background: `${adherenceColor}15`,
            color: adherenceColor,
            border: `2px solid ${adherenceColor}40`,
          }}
        >
          {report.adherencePct}%
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Planned study</span>
            <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>
              {formatHM(report.totalPlannedMin * 60)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Actually studied</span>
            <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>
              {formatHM(report.totalActualSec)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">On-plan / Off-plan</span>
            <span className="font-bold tabular">
              <span className="text-green-500">{formatHM(report.totalOnPlanSec)}</span>
              {' / '}
              <span className="text-amber-500">{formatHM(report.totalOffPlanSec)}</span>
            </span>
          </div>
          {report.wastedSec > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Wasted</span>
              <span className="font-bold tabular text-red-500">{formatHM(report.wastedSec)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-block breakdown */}
      {report.blocks.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-foreground/5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Block breakdown
          </div>
          {report.blocks.map((block, i) => {
            const color = subjectColor(block.subject as any);
            const actualMin = Math.round(block.actualSec / 60);
            const pct = block.plannedMin > 0
              ? Math.min(100, Math.round((actualMin / block.plannedMin) * 100))
              : 0;
            const blockColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.hex }} />
                <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                  {block.subject} {block.type === 'lecture' ? 'Lec' : 'Self'}
                </span>
                <span className="text-muted-foreground tabular">
                  {formatHour(block.startHour)}-{formatHour(block.endHour)}
                </span>
                <span className="tabular font-semibold" style={{ color: blockColor }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {report.blocks.length === 0 && (
        <div className="text-center py-4 text-[11px] text-muted-foreground">
          <AlertTriangle size={20} className="mx-auto mb-1 opacity-50" />
          No routine blocks configured.
          <br />
          Set up your schedule in Settings → Goals → Routine.
        </div>
      )}
    </div>
  );
}
