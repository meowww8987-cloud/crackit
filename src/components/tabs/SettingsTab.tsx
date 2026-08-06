'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { useSettings, applyTextSize, applyTheme } from '@/lib/store/settings';
import { cn, vibrate } from '@/lib/utils';
import type { Settings } from '@/lib/types';
import { TimetableEditor } from '@/components/timetable/TimetableEditor';

type SectionKey = 'goals' | 'focus' | 'appearance' | 'notifications' | 'timetable' | 'data';

const SECTIONS: { key: SectionKey; label: string; icon: typeof TargetIcon; color: string }[] = [
  { key: 'goals', label: 'Study Goals', icon: TargetIcon, color: '#22c55e' },
  { key: 'focus', label: 'Focus & Timer', icon: Timer, color: '#f59e0b' },
  { key: 'appearance', label: 'Appearance', icon: Palette, color: '#a855f7' },
  { key: 'notifications', label: 'Notifications', icon: Bell, color: '#14b8a6' },
  { key: 'timetable', label: 'Weekly Timetable', icon: Calendar, color: '#f97316' },
  { key: 'data', label: 'Data & Account', icon: Database, color: '#ef4444' },
];

export function SettingsTab() {
  const [open, setOpen] = useState<SectionKey>('goals');
  const s = useSettings();

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    s.set(key, value);
    if (key === 'textSize') applyTextSize(value as Settings['textSize']);
    if (key === 'appTheme') applyTheme(value as 'dark' | 'light');
  };

  return (
    <div className="pt-2 pb-4 space-y-3">
      {/* Header with Minimal Mode toggle */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Settings</h1>
        {/* Minimal Mode toggle — modern interactive button */}
        <button
          onClick={() => { vibrate(15); update('minimalMode', !s.minimalMode); }}
          className={cn(
            'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95',
            s.minimalMode
              ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30'
              : 'bg-white/5 text-t-secondary border border-white/10 hover:bg-white/10'
          )}
        >
          {s.minimalMode ? (
            <><EyeOff size={13} /> Minimal ON</>
          ) : (
            <><Eye size={13} /> Minimal</>
          )}
        </button>
      </div>

      {SECTIONS.map((sec) => {
        const Icon = sec.icon;
        const isOpen = open === sec.key;
        return (
          <div key={sec.key} className="glass rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : sec.key)}
              className="w-full p-3 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${sec.color}22`, color: sec.color }}
              >
                <Icon size={16} />
              </div>
              <span className="text-sm font-semibold flex-1 text-left">{sec.label}</span>
              <ChevronDown
                size={16}
                className={cn('text-white/40 transition-transform', isOpen && 'rotate-180')}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 pt-0 space-y-4">
                    {sec.key === 'goals' && <GoalsSection s={s} update={update} />}
                    {sec.key === 'focus' && <FocusSection s={s} update={update} />}
                    {sec.key === 'appearance' && <AppearanceSection s={s} update={update} />}
                    {sec.key === 'notifications' && <NotificationsSection s={s} update={update} />}
                    {sec.key === 'timetable' && <TimetableEditor />}
                    {sec.key === 'data' && <DataSection s={s} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Version info + expandable changelog */}
      <div className="glass rounded-2xl p-3 mt-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer text-xs">
            <span className="text-white/40">
              NEET 2027 Study Tracker · <span className="font-mono text-teal-400">v2.2.0</span>
            </span>
            <ChevronDown size={12} className="text-white/40 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-2 space-y-1.5 text-[10px] text-white/50 border-t border-white/5 pt-2">
            <div><strong className="text-white/70">v2.2.0</strong> — Minimal Mode, OLED Black, Adaptive Subject Glow, Glassmorphism, Gradient Text, Smart Borders</div>
            <div><strong className="text-white/70">v2.1.0</strong> — Landscape rotation, partner sync fixes, syllabus redesign</div>
            <div><strong className="text-white/70">v2.0.0</strong> — Study partner feature, modern UI overhaul, drag-to-reorder</div>
            <div><strong className="text-white/70">v1.5.0</strong> — Focus timer, burn protection, PWA support</div>
            <div><strong className="text-white/70">v1.0.0</strong> — Initial release: targets, syllabus, tests, history</div>
          </div>
        </details>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/60 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange, format }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div>
      {format && <div className="text-sm font-bold text-teal-400 mb-1 tabular">{format(value)}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => { onChange(!value); vibrate(8); }}
      className={cn(
        'w-12 h-7 rounded-full transition relative',
        value ? 'bg-teal-500' : 'bg-white/10'
      )}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn('absolute top-1 w-5 h-5 rounded-full bg-white', value ? 'left-6' : 'left-1')}
      />
    </button>
  );
}

function GoalsSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Row label="Daily Study Goal">
        <Slider
          value={s.dailyGoalHours}
          min={2}
          max={16}
          step={1}
          onChange={(v) => update('dailyGoalHours', v)}
          format={(v) => `${v} hours`}
        />
      </Row>
      <Row label="Target NEET Score">
        <Slider
          value={s.targetScore}
          min={400}
          max={720}
          step={5}
          onChange={(v) => update('targetScore', v)}
          format={(v) => `${v} / 720`}
        />
      </Row>
      <Row label="Exam Target Date">
        <input
          type="date"
          value={s.examDate}
          onChange={(e) => update('examDate', e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400/50"
        />
      </Row>
      <Row label="Prep Start Date">
        <input
          type="date"
          value={s.prepStartDate || ''}
          onChange={(e) => update('prepStartDate', e.target.value || null)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400/50 mb-2"
        />
        {!s.prepStartDate && <p className="text-[10px] text-white/40">Auto-detected from first study session</p>}
        {s.prepStartDate && (
          <button
            onClick={() => update('prepStartDate', null)}
            className="text-xs text-teal-400 hover:underline"
          >
            Reset to auto-detect
          </button>
        )}
      </Row>
    </>
  );
}

function FocusSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Row label="Pomodoro Work Duration">
        <Slider value={s.pomodoroWork} min={15} max={90} step={5} onChange={(v) => update('pomodoroWork', v)} format={(v) => `${v} min`} />
      </Row>
      <Row label="Pomodoro Break Duration">
        <Slider value={s.pomodoroBreak} min={5} max={30} step={5} onChange={(v) => update('pomodoroBreak', v)} format={(v) => `${v} min`} />
      </Row>
      <Row label="Screen Burn Protection">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Dim UI when idle</span>
          <Toggle value={s.burnProtection} onChange={(v) => update('burnProtection', v)} />
        </div>
      </Row>
      {s.burnProtection && (
        <Row label="Screen Dimming">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wide">When to dim (idle delay)</span>
              <Slider value={s.dimDelay} min={3} max={30} step={1} onChange={(v) => update('dimDelay', v)} format={(v) => `${v}s idle`} />
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Timer visibility when dimmed</span>
              <Slider value={s.screenDimOpacity} min={5} max={100} step={5} onChange={(v) => update('screenDimOpacity', v)} format={(v) => `${v}% visible`} />
            </div>
          </div>
        </Row>
      )}
      <Row label="Distraction Taunt Interval">
        <Slider value={s.distractionTauntInterval} min={0} max={15} step={1} onChange={(v) => update('distractionTauntInterval', v)} format={(v) => v === 0 ? 'Off' : `${v} min`} />
      </Row>
      <Row label="Auto-detect Wasted Time">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Detect tab switches as wasted</span>
          <Toggle value={s.autoDetectWasted} onChange={(v) => update('autoDetectWasted', v)} />
        </div>
      </Row>
      <Row label="Landscape Rotation">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Allow rotation in full-screen timer</span>
          <Toggle value={s.allowLandscape} onChange={(v) => update('allowLandscape', v)} />
        </div>
      </Row>
    </>
  );
}

function AppearanceSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Row label="App Theme">
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update('appTheme', t)}
              className={cn(
                'py-2 rounded-xl text-sm font-semibold capitalize',
                s.appTheme === t ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Focus Session Theme">
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update('focusTheme', t)}
              className={cn(
                'py-2 rounded-xl text-sm font-semibold capitalize',
                s.focusTheme === t ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Row>
      <Row label="OLED Black (Battery Saver)">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Pure black backgrounds in dark mode</span>
          <Toggle value={s.oledBlack} onChange={(v) => update('oledBlack', v)} />
        </div>
      </Row>
      <Row label="3D Background">
        <div className="space-y-2">
          <p className="text-[10px] text-white/40 leading-snug">
            Subject-aware 3D scene behind the app. Auto mode picks based on what
            you're studying (Physics→atoms, Zoology→DNA, Botany→cells, Chemistry→molecules).
            Object count auto-scales to your device tier.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: 'auto',      label: 'Auto',      emoji: '✨', tag: 'Recommended' },
              { v: 'atoms',     label: 'Atoms',     emoji: '⚛️', tag: 'Physics' },
              { v: 'dna',       label: 'DNA',       emoji: '🧬', tag: 'Zoology' },
              { v: 'molecules', label: 'Molecules', emoji: '🔬', tag: 'Chemistry' },
              { v: 'cells',     label: 'Cells',     emoji: '🌿', tag: 'Botany' },
              { v: 'hybrid',    label: 'Hybrid',    emoji: '🌌', tag: 'All subjects' },
              { v: 'off',       label: 'Off',       emoji: '⚫', tag: 'Aurora only' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => { update('bg3DMode', opt.v); vibrate(8); }}
                className={cn(
                  'py-2 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition relative',
                  s.bg3DMode === opt.v
                    ? 'bg-teal-500 text-black'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                <span className="text-base leading-none">{opt.emoji}</span>
                <span className="leading-tight">{opt.label}</span>
                {opt.v === 'auto' && s.bg3DMode !== 'auto' && (
                  <span className="text-[8px] text-teal-400 absolute -top-1 -right-1 bg-teal-500/15 px-1 rounded">
                    ★
                  </span>
                )}
              </button>
            ))}
          </div>
          {s.bg3DMode === 'auto' && (
            <p className="text-[10px] text-teal-400/80 flex items-center gap-1">
              <Sparkles size={10} /> Auto mode active — scene changes with your study subject
            </p>
          )}
        </div>
      </Row>
      <Row label="Animations">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/80">Reduce animations</div>
              <div className="text-[10px] text-white/40 leading-snug">
                Disables spring bounces, confetti, particle bursts. Use if motion
                bothers you or the app feels laggy on your device.
              </div>
            </div>
            <Toggle value={s.reduceAnimations} onChange={(v) => update('reduceAnimations', v)} />
          </div>
          {!s.reduceAnimations && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70">Animation intensity</span>
                <span className="text-xs tabular text-teal-400 font-bold">{s.animationIntensity}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={s.animationIntensity}
                onChange={(e) => update('animationIntensity', Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
                <span>Subtle</span>
                <span>Normal</span>
                <span>Lively</span>
              </div>
            </div>
          )}
          {s.reduceAnimations && (
            <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
              <Sparkles size={10} /> Animations reduced — transitions are instant
            </p>
          )}
        </div>
      </Row>
      <Row label="Tutorial Mode">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/80">Show feature tutorials</div>
              <div className="text-[10px] text-white/40 leading-snug">
                When ON, shows one-time coach marks for each tab explaining its features.
                Each tutorial shows once, then auto-dismisses.
              </div>
            </div>
            <Toggle value={s.tutorialMode ?? false} onChange={(v) => update('tutorialMode', v)} />
          </div>
          {(s.tutorialMode ?? false) && (
            <button
              onClick={() => {
                import('@/components/shared/Tutorial').then(({ resetAllTutorials }) => {
                  resetAllTutorials();
                  vibrate(15);
                  import('@/components/shared/Toast').then(({ pushToast }) =>
                    pushToast('Tutorials reset', 'Switch tabs to see them again', 'info')
                  );
                });
              }}
              className="w-full py-2 rounded-xl bg-teal-500/15 text-teal-400 text-xs font-semibold active:scale-95"
            >
              ↻ Replay All Tutorials
            </button>
          )}
        </div>
      </Row>
      <Row label="Text Size">
        <div className="grid grid-cols-4 gap-2">
          {(['S', 'M', 'L', 'XL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update('textSize', t)}
              className={cn(
                'py-2 rounded-xl text-sm font-bold',
                s.textSize === t ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Prefer 2D Graphs">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Flat bars over 3D for readability</span>
          <Toggle value={s.prefer2D} onChange={(v) => update('prefer2D', v)} />
        </div>
      </Row>
      <Row label="Haptic Feedback">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70 flex items-center gap-1.5"><Vibrate size={14} /> Vibration on actions</span>
          <div className="flex items-center gap-2">
            {s.haptics && (
              <button onClick={() => vibrate([10, 30, 10])} className="text-xs text-teal-400 hover:underline">
                Test
              </button>
            )}
            <Toggle value={s.haptics} onChange={(v) => update('haptics', v)} />
          </div>
        </div>
      </Row>
      <Row label="Confetti Effects">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Celebration confetti on milestones</span>
          <div className="flex items-center gap-2">
            {s.confettiEnabled && (
              <button
                onClick={() => { import('@/components/shared/Effects').then(({ triggerConfetti }) => triggerConfetti('big')); }}
                className="text-xs text-teal-400 hover:underline"
              >
                Test
              </button>
            )}
            <Toggle value={s.confettiEnabled} onChange={(v) => update('confettiEnabled', v)} />
          </div>
        </div>
      </Row>
      <Row label="Sound Effects">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Chimes on achievements</span>
          <div className="flex items-center gap-2">
            {s.soundEnabled && (
              <button
                onClick={() => { import('@/components/shared/Effects').then(({ playSound }) => playSound('success')); }}
                className="text-xs text-teal-400 hover:underline"
              >
                Test
              </button>
            )}
            <Toggle value={s.soundEnabled} onChange={(v) => update('soundEnabled', v)} />
          </div>
        </div>
      </Row>
      {s.soundEnabled && (
        <Row label="Sound Volume">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">Volume</span>
            <span className="text-sm font-bold tabular text-teal-400">{s.soundVolume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={s.soundVolume}
            onChange={(e) => update('soundVolume', Number(e.target.value))}
            className="w-full"
          />
        </Row>
      )}
    </>
  );
}

function NotificationsSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Row label="Test & Timetable Reminders">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Enable browser notifications</span>
          <Toggle
            value={s.notificationsEnabled}
            onChange={async (v) => {
              if (v && 'Notification' in window) {
                try {
                  const perm = await Notification.requestPermission();
                  update('notificationsEnabled', perm === 'granted');
                } catch {
                  update('notificationsEnabled', false);
                }
              } else {
                update('notificationsEnabled', v);
              }
            }}
          />
        </div>
      </Row>
      {s.notificationHistory.length > 0 && (
        <Row label={`Notification History (${s.notificationHistory.length})`}>
          <div className="space-y-1.5">
            {s.notificationHistory.map((n, i) => (
              <div key={i} className="glass rounded-lg p-2">
                <div className="text-xs font-semibold">{n.title}</div>
                <div className="text-[10px] text-white/50">{n.body}</div>
                <div className="text-[9px] text-white/30 mt-0.5">
                  {new Date(n.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
            <button
              onClick={() => s.clearNotifications()}
              className="w-full text-xs text-red-400 hover:underline mt-2"
            >
              Clear history
            </button>
          </div>
        </Row>
      )}
    </>
  );
}

function DataSection({ s }: { s: Settings }) {
  const [importPreview, setImportPreview] = useState<{ data: any; counts: Record<string, number> } | null>(null);
  const [hasUndoData, setHasUndoData] = useState(typeof window !== 'undefined' && !!localStorage.getItem('neet-pre-import-backup'));

  const exportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: s,
      targets: JSON.parse(localStorage.getItem('neet-targets') || '{}'),
      history: JSON.parse(localStorage.getItem('neet-history') || '{}'),
      syllabus: JSON.parse(localStorage.getItem('neet-syllabus') || '{}'),
      tests: JSON.parse(localStorage.getItem('neet-tests') || '{}'),
      recall: JSON.parse(localStorage.getItem('neet-recall') || '{}'),
      timetable: JSON.parse(localStorage.getItem('neet-timetable') || '{}'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const counts: Record<string, number> = {
          targets: data.targets?.byDate ? Object.values(data.targets.byDate).flat().length : 0,
          sessions: data.history?.sessions?.length || 0,
          subjects: data.syllabus?.subjects?.length || 0,
          chapters: data.syllabus?.chapters?.length || 0,
          lectures: data.syllabus?.lectures?.length || 0,
          tests: data.tests?.tests?.length || 0,
        };
        setImportPreview({ data, counts });
      } catch {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importPreview) return;
    // Save current data for undo
    const backup: Record<string, string> = {};
    ['neet-settings', 'neet-targets', 'neet-history', 'neet-syllabus', 'neet-tests', 'neet-recall', 'neet-timetable'].forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) backup[key] = val;
    });
    localStorage.setItem('neet-pre-import-backup', JSON.stringify(backup));

    // Write imported data
    const { data } = importPreview;
    if (data.settings) localStorage.setItem('neet-settings', JSON.stringify(data.settings));
    if (data.targets) localStorage.setItem('neet-targets', JSON.stringify(data.targets));
    if (data.history) localStorage.setItem('neet-history', JSON.stringify(data.history));
    if (data.syllabus) localStorage.setItem('neet-syllabus', JSON.stringify(data.syllabus));
    if (data.tests) localStorage.setItem('neet-tests', JSON.stringify(data.tests));
    if (data.recall) localStorage.setItem('neet-recall', JSON.stringify(data.recall));
    if (data.timetable) localStorage.setItem('neet-timetable', JSON.stringify(data.timetable));

    setHasUndoData(true);
    setImportPreview(null);
    alert('Backup imported successfully! Reloading...');
    window.location.reload();
  };

  const restorePreviousData = () => {
    const backupStr = localStorage.getItem('neet-pre-import-backup');
    if (!backupStr) return;
    const backup = JSON.parse(backupStr);
    // Clear current and restore backup
    ['neet-settings', 'neet-targets', 'neet-history', 'neet-syllabus', 'neet-tests', 'neet-recall', 'neet-timetable'].forEach((key) => {
      localStorage.removeItem(key);
      if (backup[key]) localStorage.setItem(key, backup[key]);
    });
    localStorage.removeItem('neet-pre-import-backup');
    setHasUndoData(false);
    alert('Previous data restored! Reloading...');
    window.location.reload();
  };

  const fixCorruptedData = () => {
    const history = JSON.parse(localStorage.getItem('neet-history') || '{"sessions":[]}');
    const corrupted = (history.sessions || []).filter((s: any) => s.studySeconds > 12 * 3600);
    if (corrupted.length === 0) {
      alert('No corrupted sessions found (sessions with >12h study time)');
      return;
    }
    if (confirm(`Found ${corrupted.length} corrupted sessions with >12h study time. Delete them?`)) {
      history.sessions = history.sessions.filter((s: any) => s.studySeconds <= 12 * 3600);
      localStorage.setItem('neet-history', JSON.stringify(history));
      alert('Fixed! Reloading...');
      window.location.reload();
    }
  };

  const softRefresh = () => {
    window.location.reload();
  };

  const hardRefresh = () => {
    if (confirm('This will clear the cache and reload. Continue?')) {
      if ('caches' in window) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
      }
      window.location.reload();
    }
  };

  return (
    <>
      <Row label="Export Backup">
        <button
          onClick={exportData}
          className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold active:scale-95 flex items-center justify-center gap-2"
        >
          <Download size={14} /> Download JSON Backup
        </button>
      </Row>

      <Row label="Import Backup">
        <input
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
          id="import-file"
        />
        <label
          htmlFor="import-file"
          className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Upload size={14} /> Choose Backup File
        </label>

        {importPreview && (
          <div className="mt-3 glass rounded-xl p-3 border border-teal-500/30">
            <div className="text-xs font-bold text-teal-300 mb-2">Backup Preview:</div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <PreviewStat label="Sessions" value={importPreview.counts.sessions} />
              <PreviewStat label="Targets" value={importPreview.counts.targets} />
              <PreviewStat label="Subjects" value={importPreview.counts.subjects} />
              <PreviewStat label="Chapters" value={importPreview.counts.chapters} />
              <PreviewStat label="Lectures" value={importPreview.counts.lectures} />
              <PreviewStat label="Tests" value={importPreview.counts.tests} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setImportPreview(null)}
                className="flex-1 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-2 rounded-lg bg-teal-500 text-black text-xs font-bold"
              >
                Import & Reload
              </button>
            </div>
          </div>
        )}

        {hasUndoData && (
          <button
            onClick={restorePreviousData}
            className="w-full mt-2 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-semibold"
          >
            Restore Previous Data (Undo Import)
          </button>
        )}
      </Row>

      <Row label="App Update">
        <div className="flex gap-2">
          <button
            onClick={softRefresh}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold active:scale-95"
          >
            Soft Refresh
          </button>
          <button
            onClick={hardRefresh}
            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold active:scale-95"
          >
            Hard Refresh
          </button>
        </div>
      </Row>

      <Row label="Install as App">
        <div className="glass rounded-xl p-3 text-xs text-white/60">
          <p className="mb-1.5 font-semibold text-white/80">Chrome / Edge:</p>
          <p>1. Tap menu (⋮) → <strong>Install app</strong> / <strong>Add to Home screen</strong></p>
          <p className="mt-1.5">Works offline after first load.</p>
        </div>
      </Row>

      <Row label="Fix Corrupted Data">
        <button
          onClick={fixCorruptedData}
          className="w-full py-2.5 rounded-xl bg-amber-500/15 text-amber-400 text-sm font-semibold active:scale-95"
        >
          Find & Delete Corrupted Sessions
        </button>
        <p className="text-[10px] text-white/40 mt-1">Detects sessions with &gt;12h study time</p>
      </Row>

      <Row label="Danger Zone">
        <div className="glass rounded-xl p-3 border border-red-500/30">
          <p className="text-xs text-white/60 mb-2">This will permanently delete all your data.</p>
          <button
            onClick={() => {
              const confirmText = prompt('Type RESET to confirm:');
              if (confirmText === 'RESET') {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold active:scale-95"
          >
            Reset Everything
          </button>
        </div>
      </Row>
    </>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular text-teal-400">{value}</div>
      <div className="text-[9px] text-white/40">{label}</div>
    </div>
  );
}
