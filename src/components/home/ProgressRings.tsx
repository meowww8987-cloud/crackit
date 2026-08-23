'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Activity, X, Clock, Target, Zap } from 'lucide-react';
import { NumberMorph } from '@/components/shared/NumberMorph';
import { useHistory } from '@/lib/store/history';
import { useSession, getLiveStudySeconds } from '@/lib/store/session';
import { usePractice } from '@/lib/store/practice';
import { formatHM, vibrate, cn, todayKey, dateKey, addDays } from '@/lib/utils';

/**
 * ProgressRings — ADVANCED animated dual-ring progress card.
 *
 * Features:
 *  - Dual animated SVG rings with FLOWING GRADIENT strokes
 *  - Neon GLOW filters (blurred halo behind rings)
 *  - PARTICLE emissions when goal is hit (confetti burst)
 *  - NumberMorph for time display (odometer roll)
 *  - LIVE indicator with breathing pulse when studying
 *  - Goal celebration animation (ring flashes + particles)
 *  - Rotating gradient animation on ring stroke
 *  - Depth layering (multiple ring shadows)
 *  - Touch feedback (scale on tap)
 *  - Tap → session detail popup
 *
 * Ring 1: TODAY (inner=today, outer=yesterday)
 * Ring 2: WEEK (inner=this week, outer=last week)
 *
 * Theme-aware with vibrant accent colors.
 */

interface Props {
  todaySec: number;
  yestSec: number;
  todayPct: number;
  yestPct: number;
  trendToday: number;
  thisWeek: number;
  lastWeek: number;
  weekPct: number;
  lastWeekPct: number;
  trendWeek: number;
  dailyGoalHours: number;
}

export function ProgressRings({
  todaySec,
  yestSec,
  todayPct,
  yestPct,
  trendToday,
  thisWeek,
  lastWeek,
  weekPct,
  lastWeekPct,
  trendWeek,
  dailyGoalHours,
}: Props) {
  const [showTodayDetail, setShowTodayDetail] = useState(false);
  const [showWeekDetail, setShowWeekDetail] = useState(false);
  const [celebrateToday, setCelebrateToday] = useState(false);
  const [celebrateWeek, setCelebrateWeek] = useState(false);
  const prevTodayPctRef = useRef(todayPct);
  const prevWeekPctRef = useRef(weekPct);

  // Live studying check
  const activeSession = useSession((s) => s.active);
  const activePractice = usePractice((s) => s.activePractice);
  const isLive = (!!activeSession && !activeSession.paused) || !!activePractice;

  // Wasted time today
  const sessions = useHistory((s) => s.sessions);
  const today = todayKey();
  const wastedToday = useMemo(() => {
    return sessions
      .filter((s) => s.date === today)
      .reduce((a, s) => a + s.wastedSeconds, 0);
  }, [sessions, today]);

  // Goal celebration — fires when crossing 100%
  useEffect(() => {
    if (todayPct >= 100 && prevTodayPctRef.current < 100) {
      setCelebrateToday(true);
      vibrate([10, 30, 10, 30, 10]);
      setTimeout(() => setCelebrateToday(false), 2500);
    }
    prevTodayPctRef.current = todayPct;
  }, [todayPct]);

  useEffect(() => {
    if (weekPct >= 100 && prevWeekPctRef.current < 100) {
      setCelebrateWeek(true);
      vibrate([10, 30, 10, 30, 10]);
      setTimeout(() => setCelebrateWeek(false), 2500);
    }
    prevWeekPctRef.current = weekPct;
  }, [weekPct]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass rounded-2xl p-4 relative overflow-hidden"
      >
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(20,184,166,0.15), transparent 50%), radial-gradient(circle at 70% 50%, rgba(34,197,94,0.15), transparent 50%)',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <motion.div
              animate={isLive ? { rotate: 360 } : {}}
              transition={isLive ? { duration: 3, repeat: Infinity, ease: 'linear' } : {}}
            >
              <Activity size={16} style={{ color: isLive ? '#16a34a' : '#0d9488' }} />
            </motion.div>
            <h3 className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
              Progress
            </h3>
          </div>

          {/* Live indicator */}
          <AnimatePresence>
            {isLive && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#16a34a', boxShadow: '0 0 6px rgba(22,163,74,0.6)' }}
                />
                <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#16a34a' }}>
                  Live
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Two rings side by side */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          {/* TODAY ring */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { vibrate(8); setShowTodayDetail(true); }}
            className="flex flex-col items-center"
          >
            <AdvancedRing
              innerPct={todayPct}
              outerPct={yestPct}
              timeSec={todaySec}
              label="TODAY"
              goalPct={todayPct}
              isLive={isLive}
              celebrate={celebrateToday}
              colorScheme="teal"
            />
            {/* Trend badge */}
            <TrendBadge trend={trendToday} />
            <div className="text-[9px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Yesterday: {formatHM(yestSec)}
            </div>
          </motion.button>

          {/* WEEK ring */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { vibrate(8); setShowWeekDetail(true); }}
            className="flex flex-col items-center"
          >
            <AdvancedRing
              innerPct={weekPct}
              outerPct={lastWeekPct}
              timeSec={thisWeek}
              label="WEEK"
              goalPct={weekPct}
              isLive={isLive}
              celebrate={celebrateWeek}
              colorScheme="green"
            />
            {/* Trend badge */}
            <TrendBadge trend={trendWeek} />
            <div className="text-[9px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Last: {formatHM(lastWeek)}
            </div>
          </motion.button>
        </div>

        {/* Wasted time footer */}
        {wastedToday > 60 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-1.5 mt-3 pt-2 text-[10px] relative z-10"
            style={{ borderTop: '1px solid var(--border)', color: '#dc2626' }}
          >
            <Zap size={10} />
            <span className="font-semibold">{formatHM(wastedToday)} wasted today</span>
          </motion.div>
        )}

        {/* Goal hint */}
        <div className="text-center text-[9px] mt-2 relative z-10" style={{ color: 'var(--muted-foreground)' }}>
          Goal: {dailyGoalHours}h/day · Tap rings for details
        </div>
      </motion.div>

      {/* Detail popups */}
      <AnimatePresence>
        {showTodayDetail && (
          <DayDetailPopup date={today} title="Today" onClose={() => setShowTodayDetail(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWeekDetail && (
          <WeekDetailPopup onClose={() => setShowWeekDetail(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// =====================================================
// Advanced Ring — flowing gradient + glow + particles
// =====================================================

function AdvancedRing({
  innerPct,
  outerPct,
  timeSec,
  label,
  goalPct,
  isLive,
  celebrate,
  colorScheme,
}: {
  innerPct: number;
  outerPct: number;
  timeSec: number;
  label: string;
  goalPct: number;
  isLive: boolean;
  celebrate: boolean;
  colorScheme: 'teal' | 'green';
}) {
  const size = 110;
  const center = size / 2;
  const outerRadius = 48;
  const innerRadius = 36;
  const strokeWidth = 6;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Darker colors for visibility on BOTH dark and light themes
  const colors = colorScheme === 'teal'
    ? { primary: '#0d9488', secondary: '#14b8a6', glow: 'rgba(13,148,136,0.5)', gradId: 'grad-teal' }
    : { primary: '#16a34a', secondary: '#22c55e', glow: 'rgba(22,163,74,0.5)', gradId: 'grad-green' };

  // Goal-based color (darker for light-theme visibility)
  const ringColor = goalPct >= 100 ? '#16a34a' : goalPct >= 75 ? colors.secondary : goalPct >= 25 ? colors.primary : '#c2410c';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Glow halo */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        animate={{
          opacity: isLive ? [0.4, 0.7, 0.4] : [0.3, 0.5, 0.3],
          scale: isLive ? [1, 1.05, 1] : [1, 1.02, 1],
        }}
        transition={{ duration: isLive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* SVG Rings */}
      <svg width={size} height={size} className="relative z-10 -rotate-90">
        <defs>
          {/* Flowing gradient for inner ring */}
          <linearGradient id={colors.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary}>
              <animate attributeName="stop-color" values={`${colors.primary};${colors.secondary};${colors.primary}`} dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={colors.secondary}>
              <animate attributeName="stop-color" values={`${colors.secondary};${colors.primary};${colors.secondary}`} dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          {/* Glow filter */}
          <filter id={`glow-${colors.gradId}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ring track (yesterday/last week) */}
        <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth - 1} opacity="0.5" />
        {/* Outer ring progress (faded comparison) */}
        <motion.circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={strokeWidth - 1}
          strokeLinecap="round"
          opacity="0.4"
          strokeDasharray={outerCircumference}
          initial={{ strokeDashoffset: outerCircumference }}
          animate={{ strokeDashoffset: outerCircumference - (outerPct / 100) * outerCircumference }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* Inner ring track */}
        <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
        {/* Inner ring progress (animated gradient) */}
        <motion.circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={`url(#${colors.gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={innerCircumference}
          initial={{ strokeDashoffset: innerCircumference }}
          animate={{
            strokeDashoffset: innerCircumference - (innerPct / 100) * innerCircumference,
            filter: celebrate ? 'brightness(1.5)' : 'brightness(1)',
          }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          filter={`url(#glow-${colors.gradId})`}
        />

        {/* Goal marker at 100% */}
        <circle cx={center} cy={center - innerRadius} r="2" fill={ringColor} opacity={goalPct >= 100 ? 1 : 0.3} />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </div>
        <div className="text-sm font-bold tabular" style={{ color: ringColor }}>
          {formatHM(timeSec)}
        </div>
        <div className="text-[8px] tabular" style={{ color: goalPct >= 100 ? '#16a34a' : 'var(--muted-foreground)' }}>
          {Math.round(goalPct)}%
        </div>
      </div>

      {/* Celebration particles */}
      <AnimatePresence>
        {celebrate && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 z-30 pointer-events-none"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: ['#d97706', '#16a34a', '#0d9488', '#2563eb'][i % 4],
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: (Math.random() - 0.5) * 80,
                  y: (Math.random() - 0.5) * 80,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 1.5, delay: i * 0.05, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Live pulse ring */}
      {isLive && (
        <motion.div
          className="absolute inset-0 rounded-full z-0"
          style={{ border: `2px solid ${colors.primary}` }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}

// =====================================================
// Trend Badge
// =====================================================

function TrendBadge({ trend }: { trend: number }) {
  const isUp = trend >= 5;
  const isDown = trend <= -5;
  const color = isUp ? '#16a34a' : isDown ? '#dc2626' : '#c2410c';
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full mt-1.5"
      style={{ background: `${color}20` }}
    >
      <Icon size={9} style={{ color }} />
      <span className="text-[9px] font-bold tabular" style={{ color }}>
        {trend > 0 ? '+' : ''}{trend}%
      </span>
    </motion.div>
  );
}

// =====================================================
// Day Detail Popup (Today)
// =====================================================

function DayDetailPopup({ date, title, onClose }: { date: string; title: string; onClose: () => void }) {
  const sessions = useHistory((s) => s.sessions);
  const daySessions = useMemo(
    () => sessions
      .filter((s) => s.date === date)
      .sort((a, b) => a.startedAt - b.startedAt),
    [sessions, date]
  );

  const totalStudy = daySessions.reduce((a, s) => a + s.studySeconds, 0);
  const totalWasted = daySessions.reduce((a, s) => a + s.wastedSeconds, 0);

  const dateLabel = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, [date]);

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
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{dateLabel}</p>
          <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
            <span style={{ color: '#0d9488' }}>📚 {formatHM(totalStudy)}</span>
            {totalWasted > 60 && <span style={{ color: '#dc2626' }}>⚠ {formatHM(totalWasted)}</span>}
            <span style={{ color: 'var(--muted-foreground)' }}>{daySessions.length} sessions</span>
          </div>
        </div>

        {/* Session list */}
        <div className="space-y-2">
          {daySessions.map((session, i) => {
            const subjColors: Record<string, string> = {
              Physics: '#2563eb', Chemistry: '#16a34a', Botany: '#d97706', Zoology: '#9333ea', General: '#0d9488',
            };
            const subjColor = subjColors[session.subject] || '#0d9488';
            const startTime = new Date(session.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTime = new Date(session.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderLeft: `3px solid ${subjColor}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${subjColor}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: subjColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {session.subject}{session.chapter ? ` · ${session.chapter}` : ''}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {session.topic || 'Free study'}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {startTime} → {endTime}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular" style={{ color: '#0d9488' }}>{formatHM(session.studySeconds)}</div>
                  {session.wastedSeconds > 60 && (
                    <div className="text-[9px] tabular" style={{ color: '#dc2626' }}>⚠ {formatHM(session.wastedSeconds)}</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {daySessions.length === 0 && (
          <div className="text-center py-6">
            <Clock size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No sessions yet today.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// Week Detail Popup (last 7 days mini)
// =====================================================

function WeekDetailPopup({ onClose }: { onClose: () => void }) {
  const sessions = useHistory((s) => s.sessions);

  const weekData = useMemo(() => {
    const days: { key: string; dayName: string; dateNum: number; studySec: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const key = dateKey(d);
      const daySessions = sessions.filter((s) => s.date === key);
      const study = daySessions.reduce((a, s) => a + s.studySeconds, 0);
      days.push({
        key,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateNum: d.getDate(),
        studySec: study,
        isToday: i === 0,
      });
    }
    return days;
  }, [sessions]);

  const totalWeek = weekData.reduce((a, d) => a + d.studySec, 0);
  const maxSec = Math.max(...weekData.map((d) => d.studySec), 1);

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
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--muted)' }} />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>This Week</h2>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Last 7 days</p>
          <div className="text-2xl font-bold tabular mt-1" style={{ color: '#16a34a' }}>
            {formatHM(totalWeek)}
          </div>
        </div>

        {/* 7-day bar chart — proper grid layout with baseline */}
        <div className="rounded-xl p-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          {/* Times row (aligned above chart) */}
          <div className="flex justify-between gap-1.5 mb-2">
            {weekData.map((day, i) => (
              <div key={i} className="flex-1 text-center text-[8px] tabular font-bold" style={{ color: day.studySec > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', opacity: day.studySec > 0 ? 1 : 0.3 }}>
                {day.studySec > 0 ? formatHM(day.studySec).replace(' ', '') : '—'}
              </div>
            ))}
          </div>

          {/* Chart area with grid lines + baseline */}
          <div className="relative h-28 mb-2">
            {/* Grid lines (horizontal) */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-t" style={{ borderColor: 'var(--border)', opacity: 0.5 }} />
              ))}
            </div>

            {/* Bars (aligned to bottom baseline) */}
            <div className="absolute inset-0 flex items-end justify-between gap-1.5">
              {weekData.map((day, i) => {
                const heightPct = maxSec > 0 ? (day.studySec / maxSec) * 100 : 0;
                return (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(3, heightPct)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                    className="flex-1 rounded-t-md relative"
                    style={{
                      background: day.isToday
                        ? 'linear-gradient(180deg, #d97706, #b45309)'
                        : day.studySec > 0
                          ? 'linear-gradient(180deg, #16a34a, #15803d)'
                          : 'var(--border)',
                      minHeight: 3,
                      boxShadow: day.isToday ? '0 0 8px rgba(217,119,6,0.4)' : 'none',
                      border: day.studySec > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {/* Today indicator dot */}
                    {day.isToday && day.studySec > 0 && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Day names + date numbers (aligned below chart) */}
          <div className="flex justify-between gap-1.5">
            {weekData.map((day, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-[8px] font-bold uppercase" style={{ color: day.isToday ? '#d97706' : 'var(--muted-foreground)' }}>
                  {day.dayName.slice(0, 3)}
                </div>
                <div className="text-[7px] tabular" style={{ color: 'var(--muted-foreground)' }}>
                  {day.dateNum}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary footer */}
        <div className="flex items-center justify-between mt-3 pt-2 text-[10px]" style={{ borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--muted-foreground)' }}>
            Daily avg: <span className="font-bold tabular" style={{ color: 'var(--foreground)' }}>{formatHM(Math.round(totalWeek / 7))}</span>
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}>
            Best: <span className="font-bold tabular" style={{ color: '#16a34a' }}>{formatHM(Math.max(...weekData.map((d) => d.studySec)))}</span>
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
