'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Target as TargetIcon,
 Timer,
 Palette,
 Bell,
 Database,
 ChevronDown,
 Vibrate,
 Calendar,
 Download,
 Upload,
 Sparkles,
 Eye,
 EyeOff,
 HelpCircle,
} from 'lucide-react';
import { useSettings, applyTextSize, applyTheme } from '@/lib/store/settings';
import { cn, vibrate } from '@/lib/utils';
import type { Settings } from '@/lib/types';
import { ConcentricRings } from '@/components/ui/concentric-rings';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import { triggerTutorialOnboarding } from '@/components/app/AppShell';
import { pushToast } from '@/components/shared/Toast';

type SectionKey = 'goals' | 'focus' | 'appearance' | 'notifications' | 'data';

const SECTIONS: { key: SectionKey; label: string; icon: typeof TargetIcon; color: string; emoji: string }[] = [
  { key: 'goals', label: 'Goals', icon: TargetIcon, color: '#0d9488', emoji: '🎯' },
  { key: 'focus', label: 'Focus', icon: Timer, color: '#d97706', emoji: '⏱️' },
  { key: 'appearance', label: 'Appearance', icon: Palette, color: '#7c3aed', emoji: '🎨' },
  { key: 'notifications', label: 'Alerts', icon: Bell, color: '#2563eb', emoji: '🔔' },
  { key: 'data', label: 'Data', icon: Database, color: '#dc2626', emoji: '💾' },
];

export function SettingsTab() {
  const [activeSection, setActiveSection] = useState<SectionKey>('goals');
  const s = useSettings();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    s.set(key, value);
    if (key === 'textSize') applyTextSize(value as Settings['textSize']);
    if (key === 'appTheme') applyTheme(value as Settings['appTheme']);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    // Stop propagation so AppShell's tab-swipe doesn't fire
    e.stopPropagation();
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    // Stop propagation so AppShell's tab-swipe doesn't fire
    e.stopPropagation();
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = SECTIONS.findIndex(sec => sec.key === activeSection);
    if (dx > 0 && idx > 0) { vibrate(8); setActiveSection(SECTIONS[idx - 1].key); }
    else if (dx < 0 && idx < SECTIONS.length - 1) { vibrate(8); setActiveSection(SECTIONS[idx + 1].key); }
  };

  return (
    <div className="pt-2 pb-4 space-y-3" data-card onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { vibrate(15); update('tutorialMode', !(s.tutorialMode ?? false)); if (!(s.tutorialMode ?? false)) triggerTutorialOnboarding(); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            style={{ background: (s.tutorialMode ?? false) ? '#7c3aed' : 'var(--muted)', color: (s.tutorialMode ?? false) ? '#ffffff' : 'var(--muted-foreground)', border: (s.tutorialMode ?? false) ? 'none' : '1px solid var(--border)' }}
          >
            {(s.tutorialMode ?? false) ? <><HelpCircle size={13} /> Tutorial ON</> : <><HelpCircle size={13} /> Tutorial</>}
          </button>
          <button
            onClick={() => { vibrate(15); const newVal = !s.minimalMode; update('minimalMode', newVal); if (newVal) pushToast('⚡ Minimal Mode', '3D disabled, tabs hidden, optimized', 'success'); else pushToast('✨ Full Mode', 'All features enabled', 'info'); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            style={{ background: s.minimalMode ? '#0d9488' : 'var(--muted)', color: s.minimalMode ? '#ffffff' : 'var(--muted-foreground)', border: s.minimalMode ? 'none' : '1px solid var(--border)' }}
          >
            {s.minimalMode ? <><EyeOff size={13} /> Minimal ON</> : <><Eye size={13} /> Minimal</>}
          </button>
        </div>
      </div>

      {/* Horizontal scrollable category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: 'none' }}>
        {SECTIONS.map((sec) => {
          const isActive = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              onClick={() => { vibrate(8); setActiveSection(sec.key); }}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              style={{
                background: isActive ? sec.color : 'var(--muted)',
                color: isActive ? '#ffffff' : 'var(--muted-foreground)',
                border: isActive ? 'none' : '1px solid var(--border)',
                boxShadow: isActive ? `0 2px 8px ${sec.color}40` : 'none',
              }}
            >
              <span className="text-sm">{sec.emoji}</span>
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* Swipeable content */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="glass rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
              {activeSection === 'goals' && <GoalsSection s={s} update={update} />}
              {activeSection === 'focus' && <FocusSection s={s} update={update} />}
              {activeSection === 'appearance' && <AppearanceSection s={s} update={update} />}
              {activeSection === 'notifications' && <NotificationsSection s={s} update={update} />}
              {activeSection === 'data' && <DataSection s={s} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-center text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
        ← swipe between categories →
      </div>


 </div>
 );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
 return (
 <div>
 {/* Section header — visually distinct pill so users can scan settings easily.
 Previous design used a flat text-xs label which looked
 identical to body copy and was easy to skip past. */}
 <div className="flex items-center gap-2 mb-2">
 <span className="inline-block w-1 h-3.5 rounded-full" style={{ background: 'linear-gradient(180deg, #0d9488, #14b8a6)' }} />
 <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>{label}</label>
 </div>
 {children}
 </div>
 );
}

function Slider({ value, min, max, step = 1, onChange, format, labels }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
  labels?: { value: number; text: string }[];
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      {format && (
        <div className="mb-2">
          <span className="text-xl font-bold tabular" style={{ color: '#0d9488' }}>{format(value)}</span>
        </div>
      )}
      <ScrollAwareSlider>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full modern-slider"
          style={{
            '--slider-pct': `${pct}%`,
            '--slider-fill': 'linear-gradient(90deg, #0d9488, #14b8a6)',
            '--slider-track': 'var(--border)',
          } as React.CSSProperties}
        />
      </ScrollAwareSlider>
      {labels && labels.length > 0 && (
        <div className="flex justify-between mt-1.5">
          {labels.map((label, i) => (
            <span
              key={i}
              className="text-[8px] font-semibold uppercase tracking-wide"
              style={{
                color: value >= label.value ? '#0d9488' : 'var(--muted-foreground)',
                opacity: value >= label.value ? 1 : 0.5,
              }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
 return (
 <button
 onClick={() => { onChange(!value); vibrate(8); }}
 className="w-12 h-7 rounded-full transition-colors duration-200 relative shrink-0"
 style={{
   background: value ? '#0d9488' : 'var(--border)',
   border: value ? 'none' : '1px solid var(--border)',
 }}
 aria-pressed={value}
 >
 <motion.div
 animate={{ x: value ? 20 : 0 }}
 transition={{ type: 'spring', stiffness: 500, damping: 32 }}
 className="absolute top-1 left-1 w-5 h-5 rounded-full"
 style={{
   background: value ? '#ffffff' : 'var(--muted-foreground)',
   boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
 }}
 />
 </button>
 );
}

function GoalsSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const goalPresets = [4, 6, 8, 10, 12];
  const scorePresets = [450, 550, 600, 650, 700];
  const examDateObj = s.examDate ? new Date(s.examDate + 'T00:00:00') : null;
  const prepDateObj = s.prepStartDate ? new Date(s.prepStartDate + 'T00:00:00') : null;

  return (
    <>
      <Row label="Daily Study Goal">
        <Slider
          value={s.dailyGoalHours}
          min={2}
          max={16}
          step={1}
          onChange={(v) => update('dailyGoalHours', v)}
          format={(v) => `${v}h / day`}
          labels={[
            { value: 2, text: 'Light' },
            { value: 6, text: 'Moderate' },
            { value: 8, text: 'Recommended' },
            { value: 12, text: 'Intense' },
            { value: 16, text: 'Max' },
          ]}
        />
        <div className="flex gap-1.5 mt-2.5">
          {goalPresets.map((p) => (
            <button
              key={p}
              onClick={() => { vibrate(8); update('dailyGoalHours', p); }}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold tabular transition active:scale-95"
              style={{
                background: s.dailyGoalHours === p ? '#0d9488' : 'var(--muted)',
                color: s.dailyGoalHours === p ? '#ffffff' : 'var(--muted-foreground)',
                border: s.dailyGoalHours === p ? 'none' : '1px solid var(--border)',
              }}
            >
              {p}h
            </button>
          ))}
        </div>
      </Row>

      <Row label="Target NEET Score">
        <Slider
          value={s.targetScore}
          min={400}
          max={720}
          step={5}
          onChange={(v) => update('targetScore', v)}
          format={(v) => `${v} / 720`}
          labels={[
            { value: 400, text: 'Pass' },
            { value: 550, text: 'Good' },
            { value: 650, text: 'Great' },
            { value: 720, text: 'Perfect' },
          ]}
        />
        <div className="flex gap-1.5 mt-2.5">
          {scorePresets.map((p) => (
            <button
              key={p}
              onClick={() => { vibrate(8); update('targetScore', p); }}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold tabular transition active:scale-95"
              style={{
                background: s.targetScore === p ? '#0d9488' : 'var(--muted)',
                color: s.targetScore === p ? '#ffffff' : 'var(--muted-foreground)',
                border: s.targetScore === p ? 'none' : '1px solid var(--border)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </Row>

      {/* Exam + Prep dates — modern with readable format */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--muted-foreground)' }}>Exam Date</label>
          <div className="relative">
            <input
              type="date"
              value={s.examDate}
              onChange={(e) => update('examDate', e.target.value)}
              className="w-full rounded-xl px-2 py-2 text-xs focus:outline-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            {examDateObj && (
              <div className="text-[9px] mt-1 tabular" style={{ color: '#0d9488' }}>
                {examDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--muted-foreground)' }}>Prep Start</label>
          <div className="relative">
            <input
              type="date"
              value={s.prepStartDate || ''}
              onChange={(e) => update('prepStartDate', e.target.value || null)}
              className="w-full rounded-xl px-2 py-2 text-xs focus:outline-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            {prepDateObj && (
              <div className="text-[9px] mt-1 tabular" style={{ color: '#0d9488' }}>
                {prepDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between -mt-1">
        {!s.prepStartDate ? (
          <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Auto-detected from first study session</p>
        ) : (
          <button
            onClick={() => update('prepStartDate', null)}
            className="text-[10px] hover:underline"
            style={{ color: '#0d9488' }}
          >
            ↻ Reset to auto-detect
          </button>
        )}
      </div>
    </>
  );
}

function FocusSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const WORK_COLOR = '#0d9488';
  const BREAK_COLOR = '#d97706';
  const OUTER_R = 65;
  const INNER_R = 30;
  const STROKE = 8;

  const workPresets = [25, 45, 50, 60, 90];
  const breakPresets = [5, 10, 15, 20, 30];

  return (
    <div className="space-y-4">
      {/* === GROUP 1: Pomodoro Cycle === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⏱️</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Pomodoro Cycle</span>
        </div>

        {/* Concentric rings */}
        <div className="flex flex-col items-center gap-2 mb-3">
          <ConcentricRings
            outer={{
              value: s.pomodoroWork, min: 15, max: 90, step: 5,
              radius: OUTER_R, strokeWidth: STROKE, color: WORK_COLOR,
              ariaLabel: 'Work duration', onChange: (v) => update('pomodoroWork', v),
            }}
            inner={{
              value: s.pomodoroBreak, min: 5, max: 30, step: 5,
              radius: INNER_R, strokeWidth: STROKE, color: BREAK_COLOR,
              ariaLabel: 'Break duration', onChange: (v) => update('pomodoroBreak', v),
            }}
            centerLabel={
              <>
                <div className="text-lg font-bold tabular leading-none">
                  <span style={{ color: WORK_COLOR }}>{s.pomodoroWork}</span>
                  <span className="mx-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>/</span>
                  <span style={{ color: BREAK_COLOR }}>{s.pomodoroBreak}</span>
                </div>
                <div className="text-[8px] leading-none mt-1 uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>min</div>
              </>
            }
          />
        </div>

        {/* Work presets */}
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: WORK_COLOR }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: WORK_COLOR }}>Work Duration</span>
          </div>
          <div className="flex gap-1.5">
            {workPresets.map((p) => (
              <button
                key={p}
                onClick={() => { vibrate(8); update('pomodoroWork', p); }}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold tabular transition active:scale-95"
                style={{
                  background: s.pomodoroWork === p ? WORK_COLOR : 'var(--card)',
                  color: s.pomodoroWork === p ? '#ffffff' : 'var(--muted-foreground)',
                  border: s.pomodoroWork === p ? 'none' : '1px solid var(--border)',
                }}
              >
                {p}m
              </button>
            ))}
          </div>
        </div>

        {/* Break presets */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: BREAK_COLOR }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: BREAK_COLOR }}>Break Duration</span>
          </div>
          <div className="flex gap-1.5">
            {breakPresets.map((p) => (
              <button
                key={p}
                onClick={() => { vibrate(8); update('pomodoroBreak', p); }}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-bold tabular transition active:scale-95"
                style={{
                  background: s.pomodoroBreak === p ? BREAK_COLOR : 'var(--card)',
                  color: s.pomodoroBreak === p ? '#ffffff' : 'var(--muted-foreground)',
                  border: s.pomodoroBreak === p ? 'none' : '1px solid var(--border)',
                }}
              >
                {p}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* === GROUP 2: Screen Burn Protection === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🛡️</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Screen Burn Protection</span>
          <div className="ml-auto">
            <Toggle value={s.burnProtection} onChange={(v) => update('burnProtection', v)} />
          </div>
        </div>

        {s.burnProtection && (
          <div className="space-y-3">
            {/* Idle delay */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Idle delay before dimming</span>
                <span className="text-sm font-bold tabular" style={{ color: BREAK_COLOR }}>{s.dimDelay}s</span>
              </div>
              <ScrollAwareSlider>
                <input
                  type="range" min={3} max={30} step={1} value={s.dimDelay}
                  onChange={(e) => update('dimDelay', Number(e.target.value))}
                  className="w-full modern-slider"
                  style={{
                    '--slider-pct': `${((s.dimDelay - 3) / 27) * 100}%`,
                    '--slider-fill': `linear-gradient(90deg, ${BREAK_COLOR}, #f59e0b)`,
                    '--slider-track': 'var(--border)',
                  } as React.CSSProperties}
                />
              </ScrollAwareSlider>
            </div>
            {/* Dim opacity */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Timer visibility when dimmed</span>
                <span className="text-sm font-bold tabular" style={{ color: WORK_COLOR }}>{s.screenDimOpacity}%</span>
              </div>
              <ScrollAwareSlider>
                <input
                  type="range" min={5} max={100} step={5} value={s.screenDimOpacity}
                  onChange={(e) => update('screenDimOpacity', Number(e.target.value))}
                  className="w-full modern-slider"
                  style={{
                    '--slider-pct': `${((s.screenDimOpacity - 5) / 95) * 100}%`,
                    '--slider-fill': `linear-gradient(90deg, ${WORK_COLOR}, #14b8a6)`,
                    '--slider-track': 'var(--border)',
                  } as React.CSSProperties}
                />
              </ScrollAwareSlider>
            </div>
          </div>
        )}
      </div>

      {/* === GROUP 3: Distraction Control === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🚫</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Distraction Control</span>
        </div>

        {/* Distraction taunt */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Taunt interval</span>
            <span className="text-sm font-bold tabular" style={{ color: '#0d9488' }}>
              {s.distractionTauntInterval === 0 ? 'Off' : `${s.distractionTauntInterval} min`}
            </span>
          </div>
          <ScrollAwareSlider>
            <input
              type="range" min={0} max={15} step={1} value={s.distractionTauntInterval}
              onChange={(e) => update('distractionTauntInterval', Number(e.target.value))}
              className="w-full modern-slider"
              style={{
                '--slider-pct': `${(s.distractionTauntInterval / 15) * 100}%`,
                '--slider-fill': 'linear-gradient(90deg, #0d9488, #14b8a6)',
                '--slider-track': 'var(--border)',
              } as React.CSSProperties}
            />
          </ScrollAwareSlider>
          <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
            <span>Off</span><span>5m</span><span>10m</span><span>15m</span>
          </div>
        </div>

        {/* Auto-detect wasted */}
        <div className="flex items-center justify-between py-1">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Auto-detect wasted time</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Detect tab switches as wasted</div>
          </div>
          <Toggle value={s.autoDetectWasted} onChange={(v) => update('autoDetectWasted', v)} />
        </div>
      </div>

      {/* === GROUP 4: Timer Display === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📱</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Timer Display</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Landscape rotation</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Allow rotation in full-screen timer</div>
          </div>
          <Toggle value={s.allowLandscape} onChange={(v) => update('allowLandscape', v)} />
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const THEMES = [
    { v: 'dark', label: 'Dark', emoji: '🌙', desc: 'Deep navy', color: '#0a0b15' },
    { v: 'light', label: 'Light', emoji: '☀️', desc: 'Bright white', color: '#f0f2f5' },
    { v: 'warm', label: 'Warm', emoji: '🔥', desc: 'Sepia cream', color: '#faf3e8' },
    { v: 'ocean', label: 'Ocean', emoji: '🌊', desc: 'Deep blue', color: '#0c1929' },
    { v: 'forest', label: 'Forest', emoji: '🌲', desc: 'Deep green', color: '#0a1410' },
    { v: 'rose', label: 'Rose', emoji: '🌸', desc: 'Rosy pink', color: '#FFD6E8' },
    { v: 'sage', label: 'Sage', emoji: '🌿', desc: 'Eye comfort', color: '#E8EBE4' },
    { v: 'gold', label: 'Gold', emoji: '✨', desc: 'Black + gold', color: '#000000' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* === GROUP 1: Theme === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🎨</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>App Theme</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.v}
              onClick={() => { vibrate(8); update('appTheme', t.v); }}
              className="py-2.5 rounded-xl text-sm font-semibold flex flex-col items-center gap-0.5 transition active:scale-95"
              style={{
                border: s.appTheme === t.v ? '2px solid #0d9488' : '1px solid var(--border)',
                background: s.appTheme === t.v ? 'rgba(13,148,136,0.1)' : 'var(--card)',
                boxShadow: s.appTheme === t.v ? '0 0 8px rgba(13,148,136,0.2)' : 'none',
              }}
            >
              <span className="text-lg">{t.emoji}</span>
              <span style={{ color: s.appTheme === t.v ? '#0d9488' : 'var(--foreground)' }}>{t.label}</span>
              <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* === GROUP 2: Display === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🖥️</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Display</span>
        </div>

        {/* OLED Black */}
        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>OLED Black</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Pure black backgrounds (battery saver)</div>
          </div>
          <Toggle value={s.oledBlack} onChange={(v) => update('oledBlack', v)} />
        </div>

        <div className="h-px my-1" style={{ background: 'var(--border)' }} />

        {/* Text Size */}
        <div className="py-1.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Text Size</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['S', 'M', 'L', 'XL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { vibrate(8); update('textSize', t); }}
                className="py-2 rounded-xl text-sm font-bold transition active:scale-95"
                style={{
                  background: s.textSize === t ? '#0d9488' : 'var(--card)',
                  color: s.textSize === t ? '#ffffff' : 'var(--muted-foreground)',
                  border: s.textSize === t ? 'none' : '1px solid var(--border)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px my-1" style={{ background: 'var(--border)' }} />

        {/* Prefer 2D */}
        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>2D Graphs</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Flat bars over 3D for readability</div>
          </div>
          <Toggle value={s.prefer2D} onChange={(v) => update('prefer2D', v)} />
        </div>
      </div>

      {/* === GROUP 3: 3D Background === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🌌</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>3D Background</span>
        </div>
        <p className="text-[10px] leading-snug mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Subject-aware 3D scene. Auto picks based on what you're studying.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { v: 'auto', label: 'Auto', emoji: '✨' },
            { v: 'atoms', label: 'Atoms', emoji: '⚛️' },
            { v: 'dna', label: 'DNA', emoji: '🧬' },
            { v: 'molecules', label: 'Mols', emoji: '🔬' },
            { v: 'cells', label: 'Cells', emoji: '🌿' },
            { v: 'hybrid', label: 'Hybrid', emoji: '🌌' },
            { v: 'off', label: 'Off', emoji: '⚫' },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => { vibrate(8); update('bg3DMode', opt.v); }}
              className="py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center gap-0.5 transition active:scale-95 relative"
              style={{
                background: s.bg3DMode === opt.v ? '#0d9488' : 'var(--card)',
                color: s.bg3DMode === opt.v ? '#ffffff' : 'var(--muted-foreground)',
                border: s.bg3DMode === opt.v ? 'none' : '1px solid var(--border)',
              }}
            >
              <span className="text-base leading-none">{opt.emoji}</span>
              <span className="leading-tight">{opt.label}</span>
              {opt.v === 'auto' && s.bg3DMode !== 'auto' && (
                <span className="text-[7px] absolute -top-1 -right-1 px-1 rounded" style={{ background: 'rgba(13,148,136,0.2)', color: '#0d9488' }}>★</span>
              )}
            </button>
          ))}
        </div>
        {s.bg3DMode === 'auto' && (
          <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#0d9488' }}>
            <Sparkles size={10} /> Auto active — scene changes with subject
          </p>
        )}
      </div>

      {/* === GROUP 4: Animations === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">✨</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Animations</span>
        </div>

        {/* === Low-End Device Mode — one-tap performance boost === */}
        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl mb-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div>
            <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>🔥 Low-End Device Mode</span>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Disables 3D, blur, animations, glows — keeps phone cool</div>
          </div>
          <Toggle value={s.reduceAnimations} onChange={(v) => {
            update('reduceAnimations', v);
            if (v) {
              // Also disable 3D + set OLED black for maximum savings
              update('bg3DMode', 'off');
              update('prefer2D', true);
              vibrate([10, 20, 10]);
            }
          }} />
        </div>

        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Reduce animations</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Disable bounces, confetti, particles</div>
          </div>
          <Toggle value={s.reduceAnimations} onChange={(v) => update('reduceAnimations', v)} />
        </div>

        {!s.reduceAnimations && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Intensity</span>
              <span className="text-sm font-bold tabular" style={{ color: '#0d9488' }}>{s.animationIntensity}</span>
            </div>
            <ScrollAwareSlider>
              <input
                type="range" min={0} max={100} value={s.animationIntensity}
                onChange={(e) => update('animationIntensity', Number(e.target.value))}
                className="w-full modern-slider"
                style={{
                  '--slider-pct': `${s.animationIntensity}%`,
                  '--slider-fill': 'linear-gradient(90deg, #0d9488, #14b8a6)',
                  '--slider-track': 'var(--border)',
                } as React.CSSProperties}
              />
            </ScrollAwareSlider>
            <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              <span>Subtle</span><span>Normal</span><span>Lively</span>
            </div>
          </div>
        )}
      </div>

      {/* === GROUP 5: Feedback === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📳</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Feedback</span>
        </div>

        {/* Haptics */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-1.5">
            <Vibrate size={14} style={{ color: 'var(--muted-foreground)' }} />
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Haptic feedback</span>
              <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Vibration on actions</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {s.haptics && (
              <button onClick={() => vibrate([10, 30, 10])} className="text-xs hover:underline" style={{ color: '#0d9488' }}>Test</button>
            )}
            <Toggle value={s.haptics} onChange={(v) => update('haptics', v)} />
          </div>
        </div>

        <div className="h-px my-1" style={{ background: 'var(--border)' }} />

        {/* Confetti */}
        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Confetti</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Celebration on milestones</div>
          </div>
          <div className="flex items-center gap-2">
            {s.confettiEnabled && (
              <button onClick={() => { import('@/components/shared/Effects').then(({ triggerConfetti }) => triggerConfetti('big')); }} className="text-xs hover:underline" style={{ color: '#0d9488' }}>Test</button>
            )}
            <Toggle value={s.confettiEnabled} onChange={(v) => update('confettiEnabled', v)} />
          </div>
        </div>

        <div className="h-px my-1" style={{ background: 'var(--border)' }} />

        {/* Sound */}
        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sound effects</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Chimes on achievements</div>
          </div>
          <div className="flex items-center gap-2">
            {s.soundEnabled && (
              <button onClick={() => { import('@/components/shared/Effects').then(({ playSound }) => playSound('success')); }} className="text-xs hover:underline" style={{ color: '#0d9488' }}>Test</button>
            )}
            <Toggle value={s.soundEnabled} onChange={(v) => update('soundEnabled', v)} />
          </div>
        </div>

        {/* Volume */}
        {s.soundEnabled && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Volume</span>
              <span className="text-sm font-bold tabular" style={{ color: '#0d9488' }}>{s.soundVolume}%</span>
            </div>
            <ScrollAwareSlider>
              <input
                type="range" min={0} max={100} step={5} value={s.soundVolume}
                onChange={(e) => update('soundVolume', Number(e.target.value))}
                className="w-full modern-slider"
                style={{
                  '--slider-pct': `${s.soundVolume}%`,
                  '--slider-fill': 'linear-gradient(90deg, #0d9488, #14b8a6)',
                  '--slider-track': 'var(--border)',
                } as React.CSSProperties}
              />
            </ScrollAwareSlider>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <div className="space-y-4">
      {/* === GROUP 1: Browser Notifications === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔔</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Notifications</span>
        </div>

        <div className="flex items-center justify-between py-1.5">
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Test & timetable reminders</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Browser push notifications</div>
          </div>
          <Toggle
            value={s.notificationsEnabled}
            onChange={async (v) => {
              if (v && 'Notification' in window) {
                try {
                  const perm = await Notification.requestPermission();
                  update('notificationsEnabled', perm === 'granted');
                } catch { update('notificationsEnabled', false); }
              } else { update('notificationsEnabled', v); }
            }}
          />
        </div>

        <div className="h-px my-1" style={{ background: 'var(--border)' }} />

        <div className="flex items-center justify-between gap-3 py-1.5">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Persistent study notification</span>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              Live stats · NEET countdown · Sleep/Wake in shade
            </div>
          </div>
          <Toggle
            value={s.persistentNotification}
            onChange={async (v) => {
              if (v && 'Notification' in window) {
                try {
                  const perm = Notification.permission !== 'default' ? Notification.permission : await Notification.requestPermission();
                  update('persistentNotification', perm === 'granted');
                } catch { update('persistentNotification', false); }
              } else { update('persistentNotification', v); }
            }}
          />
        </div>
      </div>

      {/* === GROUP 2: Notification History === */}
      {s.notificationHistory.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📋</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>History ({s.notificationHistory.length})</span>
            <button
              onClick={() => s.clearNotifications()}
              className="ml-auto text-[10px] font-semibold"
              style={{ color: '#dc2626' }}
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1.5">
            {s.notificationHistory.map((n, i) => (
              <div key={i} className="rounded-lg p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{n.title}</div>
                <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{n.body}</div>
                <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(n.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DataSection({ s }: { s: Settings }) {
  const [importPreview, setImportPreview] = useState<{ data: any; counts: Record<string, number> } | null>(null);
  const [hasUndoData, setHasUndoData] = useState(typeof window !== 'undefined' && !!localStorage.getItem('neet-pre-import-backup'));
  const [reinstalling, setReinstalling] = useState(false);

  const exportData = () => {
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('neet-'));
    const data: Record<string, any> = {
      _meta: { version: 2, exportedAt: new Date().toISOString(), appVersion: 'NEET 2027 Study Tracker', storeCount: allKeys.length },
    };
    for (const key of allKeys) {
      try { data[key] = JSON.parse(localStorage.getItem(key) || 'null'); } catch { data[key] = localStorage.getItem(key); }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `neet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const counts: Record<string, number> = {
          targets: data['neet-targets']?.state?.byDate ? Object.values(data['neet-targets'].state.byDate).flat().length : 0,
          sessions: data['neet-history']?.state?.sessions?.length || 0,
          subjects: data['neet-syllabus']?.state?.subjects?.length || 0,
          chapters: data['neet-syllabus']?.state?.chapters?.length || 0,
          lectures: data['neet-syllabus']?.state?.lectures?.length || 0,
          tests: data['neet-tests']?.state?.tests?.length || 0,
          sleep: data['neet-sleep']?.state?.history?.length || 0,
          storeCount: Object.keys(data).filter((k) => k.startsWith('neet-')).length,
        };
        setImportPreview({ data, counts });
      } catch { alert('Invalid backup file'); }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importPreview) return;
    const backup: Record<string, string> = {};
    Object.keys(localStorage).filter((k) => k.startsWith('neet-')).forEach((key) => { const val = localStorage.getItem(key); if (val) backup[key] = val; });
    localStorage.setItem('neet-pre-import-backup', JSON.stringify(backup));
    const { data } = importPreview;
    Object.keys(data).filter((k) => k.startsWith('neet-')).forEach((key) => { if (data[key] !== null && data[key] !== undefined) localStorage.setItem(key, JSON.stringify(data[key])); });
    setHasUndoData(true); setImportPreview(null);
    alert('Backup imported! Reloading...'); window.location.reload();
  };

  const restorePreviousData = () => {
    const backupStr = localStorage.getItem('neet-pre-import-backup'); if (!backupStr) return;
    const backup = JSON.parse(backupStr);
    Object.keys(localStorage).filter((k) => k.startsWith('neet-') && k !== 'neet-pre-import-backup').forEach((key) => localStorage.removeItem(key));
    Object.keys(backup).forEach((key) => { if (backup[key]) localStorage.setItem(key, backup[key]); });
    localStorage.removeItem('neet-pre-import-backup'); setHasUndoData(false);
    alert('Previous data restored! Reloading...'); window.location.reload();
  };

  const fixCorruptedData = () => {
    const history = JSON.parse(localStorage.getItem('neet-history') || '{"sessions":[]}');
    const corrupted = (history.sessions || []).filter((s: any) => s.studySeconds > 12 * 3600);
    if (corrupted.length === 0) { alert('No corrupted sessions found'); return; }
    if (confirm(`Found ${corrupted.length} corrupted sessions. Delete them?`)) {
      history.sessions = history.sessions.filter((s: any) => s.studySeconds <= 12 * 3600);
      localStorage.setItem('neet-history', JSON.stringify(history));
      alert('Fixed! Reloading...'); window.location.reload();
    }
  };

  const reinstallPWA = async () => {
    if (!confirm('Reinstall PWA? Your data is safe.')) return;
    setReinstalling(true);
    try {
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); }
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
      try { sessionStorage.clear(); } catch {}
      window.location.href = window.location.origin + window.location.pathname + '?reinstalled=' + Date.now();
    } catch { setReinstalling(false); alert('Reinstall failed. Try Hard Refresh instead.'); }
  };

  // Version changelog — only last 10 entries
  const CHANGELOG = [
    { v: 'v3.0.0', text: 'Complete redesign: Study/Syllabus/Stats tabs, Lock-In Timer, nav overhaul, performance optimization' },
    { v: 'v2.20.0', text: 'Sage Mist theme, sleep health redesign, peak study time, partner sync fixes' },
    { v: 'v2.19.0', text: 'Remove fullscreen calls, ScrollAwareSlider, sleep history redesign' },
    { v: 'v2.18.0', text: 'Sleep History long-press, SleepAnalysisSheet with weekly/monthly tabs' },
    { v: 'v2.17.0', text: 'SleepLockScreen rebuild: 6 time-of-day scenes, quality picker after wake' },
    { v: 'v2.16.0', text: 'Sleep & Energy hub, SleepPlanSheet with science-based schedule' },
    { v: 'v2.15.0', text: 'Sleep health scoring (0-100), SleepReportSheet with recommendations' },
    { v: 'v2.14.0', text: 'Persistent study notification with sleep/wake scenes' },
    { v: 'v2.13.0', text: 'Rose Quartz rebuild, force-dark-ui for Focus/Splash/Sleep' },
    { v: 'v2.12.0', text: 'Per-theme 3D palettes, rose/ocean/forest/gold theme rebuilds' },
  ];

  return (
    <div className="space-y-4">
      {/* === GROUP 1: Backup === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">💾</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Backup & Restore</span>
        </div>

        <button onClick={exportData} className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 mb-2" style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
          <Download size={14} /> Export Backup
        </button>

        <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" id="import-file" />
        <label htmlFor="import-file" className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 cursor-pointer" style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
          <Upload size={14} /> Import Backup
        </label>

        {importPreview && (
          <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid rgba(13,148,136,0.3)' }}>
            <div className="text-xs font-bold mb-2" style={{ color: '#0d9488' }}>Backup Preview:</div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <PreviewStat label="Sessions" value={importPreview.counts.sessions} />
              <PreviewStat label="Targets" value={importPreview.counts.targets} />
              <PreviewStat label="Lectures" value={importPreview.counts.lectures} />
              <PreviewStat label="Tests" value={importPreview.counts.tests} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImportPreview(null)} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={confirmImport} className="flex-1 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#0d9488' }}>Import & Reload</button>
            </div>
          </div>
        )}

        {hasUndoData && (
          <button onClick={restorePreviousData} className="w-full mt-2 py-2 rounded-xl text-xs font-semibold" style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
            ↩ Restore Previous Data
          </button>
        )}
      </div>

      {/* === GROUP 2: App Update === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔄</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>App Update</span>
        </div>
        <div className="flex gap-2 mb-2">
          <button onClick={() => window.location.reload()} className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95" style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Soft Refresh</button>
          <button onClick={() => { if (confirm('Clear cache and reload?')) { if ('caches' in window) caches.keys().then((n) => n.forEach((k) => caches.delete(k))); window.location.reload(); } }} className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95" style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Hard Refresh</button>
        </div>
        <button onClick={reinstallPWA} disabled={reinstalling} className="w-full py-2.5 rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: 'rgba(37,99,235,0.15)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.3)' }}>
          {reinstalling ? (<><span className="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> Reinstalling…</>) : (<>🔄 Reinstall PWA (Keep Data)</>)}
        </button>
        <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Clears cache + service worker. <strong style={{ color: 'var(--foreground)' }}>Data is safe.</strong>
        </p>
      </div>

      {/* === GROUP 3: Data Tools === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🔧</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Data Tools</span>
        </div>
        <button onClick={fixCorruptedData} className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 mb-2" style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
          Find & Delete Corrupted Sessions
        </button>
        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Detects sessions with &gt;12h study time</p>
      </div>

      {/* === GROUP 4: Install === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📱</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Install as App</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Chrome/Edge: Tap menu (⋮) → <strong style={{ color: 'var(--foreground)' }}>Install app</strong>
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>Works offline after first load</p>
      </div>

      {/* === GROUP 5: Version + Changelog === */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>Version</span>
          </div>
          <span className="font-mono text-xs font-bold" style={{ color: '#0d9488' }}>v3.0.0</span>
        </div>
        <div className="space-y-1.5">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="text-[10px] flex items-start gap-1.5">
              <span className="font-bold tabular shrink-0" style={{ color: 'var(--foreground)' }}>{entry.v}</span>
              <span style={{ color: 'var(--muted-foreground)' }}>— {entry.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* === GROUP 6: Danger Zone === */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⚠️</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#dc2626' }}>Danger Zone</span>
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>This will permanently delete all your data.</p>
        <button
          onClick={() => {
            if (prompt('Type RESET to confirm:') === 'RESET') { localStorage.clear(); window.location.reload(); }
          }}
          className="w-full py-2 rounded-xl text-sm font-semibold active:scale-95"
          style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}
        >
          Reset Everything
        </button>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular" style={{ color: '#0d9488' }}>{value}</div>
      <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
    </div>
  );
}

