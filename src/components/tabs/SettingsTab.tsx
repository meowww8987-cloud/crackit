'use client';

import { useState, useEffect } from 'react';
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
import { TimetableEditor } from '@/components/timetable/TimetableEditor';
import { ConcentricRings } from '@/components/ui/concentric-rings';
import { triggerTutorialOnboarding } from '@/components/app/AppShell';

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
    if (key === 'appTheme') applyTheme(value as Settings['appTheme']);
    if (key === 'focusTheme') applyTheme(value as Settings['focusTheme']);
  };

  return (
    <div className="pt-2 pb-4 space-y-3">
      {/* Header with Tutorial + Minimal Mode toggles */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Settings</h1>
        <div className="flex items-center gap-2">
          {/* Tutorial Mode toggle — just LEFT of Minimal Mode.
              When tapped, shows an onboarding overlay that teaches the user
              to long-press tabs to find the ? tutorial button. */}
          <button
            onClick={() => {
              vibrate(15);
              update('tutorialMode', !(s.tutorialMode ?? false));
              if (!(s.tutorialMode ?? false)) {
                // Just turned ON → trigger the global tutorial onboarding overlay
                triggerTutorialOnboarding();
              }
            }}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95',
              (s.tutorialMode ?? false)
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-t-secondary border border-white/10 hover:bg-white/10'
            )}
            title="Tutorial mode — long-press any tab to see its info"
          >
            {(s.tutorialMode ?? false) ? (
              <><HelpCircle size={13} /> Tutorial ON</>
            ) : (
              <><HelpCircle size={13} /> Tutorial</>
            )}
          </button>
          {/* Minimal Mode toggle */}
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
              NEET 2027 Study Tracker · <span className="font-mono text-teal-400">v2.7.4</span>
            </span>
            <ChevronDown size={12} className="text-white/40 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-2 space-y-1.5 text-[10px] text-white/50 border-t border-white/5 pt-2">
            <div><strong className="text-white/70">v2.7.4</strong> — Remove ALL requestFullscreen() calls (browser 'To exit full screen, press Esc' banner is gone). App still looks fullscreen via CSS viewport-fit:cover.</div>
            <div><strong className="text-white/70">v2.7.3</strong> — Fix fullscreen: request on first user gesture (browsers block it on load), early inline script in layout.tsx, address bar hidden on load via scrollTo</div>
            <div><strong className="text-white/70">v2.7.2</strong> — Remove hand animation (just pulsing ring); visible X close button on long-press overlay; disable text selection globally (no more Android copy popup); true fullscreen (hide status bar, re-enter on notification panel return)</div>
            <div><strong className="text-white/70">v2.7.1</strong> — Fix tutorial hand position (measure actual tab DOM position); overlay doesn't cover bottom nav (tabs tappable); only dismissable via 'I understood' or long-pressing correct tab; long-press progress ring</div>
            <div><strong className="text-white/70">v2.7.0</strong> — Long-press ALL tabs for full-screen overlay (top 50% / bottom 50% actions + ? tutorial); removed always-visible ? button; moved Tutorial toggle to header (left of Minimal); tutorial onboarding with hand animation + timer</div>
            <div><strong className="text-white/70">v2.6.7</strong> — Fix 90°/270° rotation swap (gamma mapping was backwards); adapt landscape layout (row flexDirection so controls visible); add orientation lock (long-press = persistent, double-tap = temporary)</div>
            <div><strong className="text-white/70">v2.6.6</strong> — Fill TopBar empty space (reduced paddingTop to safe-area only); move Build Syllabus + Formula Vault to Syllabus tab long-press; add TabInfoButton (tutorial + hidden features) to all tabs except Settings</div>
            <div><strong className="text-white/70">v2.6.5</strong> — Fix rotation frame overflow at 90°/270° (use vmin/vmax + flexbox centering instead of vh/vw which swap with orientation); fix Android auto-rotate (lock screen to portrait on mount so gravity sensor handles rotation without OS double-rotating)</div>
            <div><strong className="text-white/70">v2.6.4</strong> — Fix Focus Timer rotation: gravity-based orientation detection (DeviceOrientationEvent + iOS permission), deadzone threshold, fixed content going out of frame at 180°/270° (swapped width/height for landscape + centered with margin offsets)</div>
            <div><strong className="text-white/70">v2.6.3</strong> — Removed the green 'N' logo + 'NEET 2027' text from the top-left corner (redundant with Home tab header)</div>
            <div><strong className="text-white/70">v2.6.2</strong> — Focus session now auto-detects device orientation in all 4 directions (0°/90°/180°/270°) using Screen Orientation API. Rotate button cycles through all 4 orientations. Always-on (no setting gate).</div>
            <div><strong className="text-white/70">v2.6.1</strong> — Tap NEET 2027 logo to start sleep (removed extra sleep banner); removed Daily Recall card from Home (now in Study tab long-press menu); Study tab long-press now shows action sheet with Free Study + Daily Recall options</div>
            <div><strong className="text-white/70">v2.6.0</strong> — Rebuild Pomodoro as single ConcentricRings (fixes outer ring definitively); immersive Sleep Lock Screen (full-screen bluish night scenery + double-tap + math problem to wake); remove BreakExercise + Study Pact</div>
            <div><strong className="text-white/70">v2.5.2</strong> — Really fix outer Pomodoro ring: wrapper DIV (not just SVG) was intercepting pointer events over the outer ring. Added pointer-events: none to the div; hit-zone circles still receive events.</div>
            <div><strong className="text-white/70">v2.5.1</strong> — Fix outer Pomodoro ring not sliding (inner ring's SVG was intercepting pointer events on its empty center, blocking the outer ring below)</div>
            <div><strong className="text-white/70">v2.5.0</strong> — Sleep tracking with persistent banner + drag-to-wake + browser notification; Micro-break exercises (box breathing, 20-20-20, stretch); Study Pact with partner</div>
            <div><strong className="text-white/70">v2.4.3</strong> — Fix concentric rings having different centers (each ring computed its own canvas size from its own radius → misaligned). Now both rings share the same canvasSize so they're perfectly concentric.</div>
            <div><strong className="text-white/70">v2.4.2</strong> — Widen Pomodoro ring gap: outer 65 / inner 30 (no overlap), tighten hit-zones so both rings are independently slidable</div>
            <div><strong className="text-white/70">v2.4.1</strong> — Rebuild Pomodoro widget: full 360° circles (no chopped arcs), big Work ring + small Break ring, vertical layout, compact legend below</div>
            <div><strong className="text-white/70">v2.4.0</strong> — Rebuilt TargetCard (cleaner info hierarchy, activity icons, remaining time), fixed drag-and-drop with dedicated drag handle, sister-card indicators (1/N badge + left-edge bar)</div>
            <div><strong className="text-white/70">v2.3.5</strong> — Fix light mode text visibility (all text-white/N opacity levels), compact Pomodoro widget, fix concentric ring overlap + pointer pass-through</div>
            <div><strong className="text-white/70">v2.3.4</strong> — Slidable concentric Pomodoro rings (drag around the ring, not a straight slider), theme-aware range slider track + thumb</div>
            <div><strong className="text-white/70">v2.3.3</strong> — Pomodoro concentric rings, side-by-side date inputs, dim settings, Focus Timer labels, distinct section headers, bar visibility</div>
            <div><strong className="text-white/70">v2.3.2</strong> — Theme polish (Gold/Rose rebuild), bar visibility, 5 partner status states, Toggle fix</div>
            <div><strong className="text-white/70">v2.3.0</strong> — 5 new themes (Ocean, Forest, Lavender, Rose, Gold), card-solid light mode fix</div>
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
      {/* Section header — visually distinct pill so users can scan settings easily.
          Previous design used a flat text-xs text-white/60 label which looked
          identical to body copy and was easy to skip past. */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-1 h-3.5 rounded-full bg-gradient-to-b from-teal-400 to-teal-500/60" />
        <label className="text-xs font-bold text-white/85 uppercase tracking-wide">{label}</label>
      </div>
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
        'w-12 h-7 rounded-full transition-colors duration-200 relative shrink-0',
        value ? 'bg-teal-500' : 'bg-white/15'
      )}
      aria-pressed={value}
    >
      <motion.div
        animate={{ x: value ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm"
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
      {/* Exam Target Date + Prep Start Date — compact, side-by-side to save vertical space */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1.5 block">Exam Target Date</label>
          <input
            type="date"
            value={s.examDate}
            onChange={(e) => update('examDate', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1.5 block">Prep Start Date</label>
          <input
            type="date"
            value={s.prepStartDate || ''}
            onChange={(e) => update('prepStartDate', e.target.value || null)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400/50"
          />
        </div>
      </div>
      <div className="flex items-center justify-between -mt-1">
        {!s.prepStartDate ? (
          <p className="text-[10px] text-white/40">Auto-detected from first study session</p>
        ) : (
          <button
            onClick={() => update('prepStartDate', null)}
            className="text-[10px] text-teal-400 hover:underline"
          >
            ↻ Reset prep date to auto-detect
          </button>
        )}
      </div>
    </>
  );
}

function FocusSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  // Pomodoro visualization: TWO CONCENTRIC FULL-CIRCLE SLIDERS.
  //   Outer ring = Work duration (teal)    — LARGE radius (the main focus)
  //   Inner ring = Break duration (amber)  — SMALL radius (clearly nested inside)
  // Both are full 360° circles (no gap, no chopped arcs). The big size
  // difference (Work 60, Break 36 — gap = 24px) makes it instantly obvious
  // which ring is which without reading the label.
  const WORK_COLOR = '#14b8a6';   // teal — focus
  const BREAK_COLOR = '#f59e0b';  // amber — rest

  // Ring geometry — BIG Work ring (radius 65), SMALL Break ring (radius 30).
  // Gap = 35px (was 24px) so the two rings NEVER overlap and their thumbs can
  // be grabbed independently even when both arcs end in the same quadrant.
  // Stroke 8, canvas = (65 + 4 + 8) * 2 = 154.
  const OUTER_R = 65;
  const INNER_R = 30;
  const STROKE = 8;
  const CANVAS = (OUTER_R + STROKE / 2 + 8) * 2;  // = 154

  return (
    <>
      {/* === Pomodoro Cycle — vertical layout, ring on top, legend below === */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1 h-3.5 rounded-full bg-gradient-to-b from-teal-400 to-teal-500/60" />
          <label className="text-xs font-bold text-white/85 uppercase tracking-wide">Pomodoro Cycle</label>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col items-center gap-2">
          {/* Single ConcentricRings component — both rings in ONE SVG.
              No more pointer-event layering issues: hit-testing is done
              manually in onPointerDown (distance from center → which ring). */}
          <ConcentricRings
            outer={{
              value: s.pomodoroWork,
              min: 15,
              max: 90,
              step: 5,
              radius: OUTER_R,
              strokeWidth: STROKE,
              color: WORK_COLOR,
              ariaLabel: 'Work duration',
              onChange: (v) => update('pomodoroWork', v),
            }}
            inner={{
              value: s.pomodoroBreak,
              min: 5,
              max: 30,
              step: 5,
              radius: INNER_R,
              strokeWidth: STROKE,
              color: BREAK_COLOR,
              ariaLabel: 'Break duration',
              onChange: (v) => update('pomodoroBreak', v),
            }}
            centerLabel={
              <>
                <div className="text-lg font-bold tabular leading-none">
                  <span style={{ color: WORK_COLOR }}>{s.pomodoroWork}</span>
                  <span className="text-white/30 mx-0.5 text-sm">/</span>
                  <span style={{ color: BREAK_COLOR }}>{s.pomodoroBreak}</span>
                </div>
                <div className="text-[8px] text-white/45 leading-none mt-1 uppercase tracking-widest">min</div>
              </>
            }
          />

          {/* Compact legend — single horizontal row below the ring */}
          <div className="flex items-center justify-center gap-4 w-full">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: WORK_COLOR }} />
              <span className="text-[10px] uppercase tracking-wide text-white/55 font-semibold">Work</span>
              <span className="text-[11px] font-bold tabular" style={{ color: WORK_COLOR }}>{s.pomodoroWork}m</span>
            </div>
            <div className="w-px h-3 bg-white/15" />
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: BREAK_COLOR }} />
              <span className="text-[10px] uppercase tracking-wide text-white/55 font-semibold">Break</span>
              <span className="text-[11px] font-bold tabular" style={{ color: BREAK_COLOR }}>{s.pomodoroBreak}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* === Screen Burn Protection (master toggle) === */}
      <Row label="Screen Burn Protection">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85 font-medium">Dim UI when idle</span>
          <Toggle value={s.burnProtection} onChange={(v) => update('burnProtection', v)} />
        </div>
      </Row>

      {/* === When to dim + Timer visibility when dimmed — side by side === */}
      {s.burnProtection && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-white/55 uppercase tracking-wide mb-1.5 block">When to dim</label>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/65">Idle delay</span>
                <span className="text-xs tabular font-bold text-amber-400">{s.dimDelay}s</span>
              </div>
              <input
                type="range" min={3} max={30} step={1} value={s.dimDelay}
                onChange={(e) => update('dimDelay', Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#f59e0b' }}
              />
              <div className="flex justify-between text-[8px] text-white/35 mt-0.5">
                <span>3s</span><span>30s</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/55 uppercase tracking-wide mb-1.5 block">Timer visibility</label>
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/65">When dimmed</span>
                <span className="text-xs tabular font-bold text-teal-400">{s.screenDimOpacity}%</span>
              </div>
              <input
                type="range" min={5} max={100} step={5} value={s.screenDimOpacity}
                onChange={(e) => update('screenDimOpacity', Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#14b8a6' }}
              />
              <div className="flex justify-between text-[8px] text-white/35 mt-0.5">
                <span>5%</span><span>100%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Row label="Distraction Taunt Interval">
        <Slider value={s.distractionTauntInterval} min={0} max={15} step={1} onChange={(v) => update('distractionTauntInterval', v)} format={(v) => v === 0 ? 'Off' : `${v} min`} />
      </Row>
      <Row label="Auto-detect Wasted Time">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85 font-medium">Detect tab switches as wasted</span>
          <Toggle value={s.autoDetectWasted} onChange={(v) => update('autoDetectWasted', v)} />
        </div>
      </Row>
      <Row label="Landscape Rotation">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85 font-medium">Allow rotation in full-screen timer</span>
          <Toggle value={s.allowLandscape} onChange={(v) => update('allowLandscape', v)} />
        </div>
      </Row>
    </>
  );
}

function AppearanceSection({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const THEMES = [
    { v: 'dark', label: 'Dark', emoji: '🌙', desc: 'Deep navy', color: '#0a0b15' },
    { v: 'light', label: 'Light', emoji: '☀️', desc: 'Bright white', color: '#f0f2f5' },
    { v: 'warm', label: 'Warm', emoji: '🔥', desc: 'Sepia cream', color: '#faf3e8' },
    { v: 'ocean', label: 'Ocean', emoji: '🌊', desc: 'Deep blue', color: '#0c1929' },
    { v: 'forest', label: 'Forest', emoji: '🌿', desc: 'Deep green', color: '#0a1410' },
    { v: 'lavender', label: 'Lavender', emoji: '💜', desc: 'Deep purple', color: '#0f0a14' },
    { v: 'rose', label: 'Rose', emoji: '🌸', desc: 'Dark pink', color: '#140a0e' },
    { v: 'gold', label: 'Gold', emoji: '✨', desc: 'Black + gold', color: '#000000' },
  ] as const;

  return (
    <>
      <Row label="App Theme">
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.v}
              onClick={() => update('appTheme', t.v)}
              className={cn(
                'py-2.5 rounded-xl text-sm font-semibold flex flex-col items-center gap-0.5 transition border-2',
                s.appTheme === t.v ? 'border-teal-500 bg-teal-500/10' : 'border-transparent bg-white/5'
              )}
            >
              <span className="text-lg">{t.emoji}</span>
              <span className={s.appTheme === t.v ? 'text-teal-400' : 'text-white/70'}>{t.label}</span>
              <span className={cn('text-[9px]', s.appTheme === t.v ? 'text-teal-400/60' : 'text-white/30')}>{t.desc}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label="Focus Session Theme">
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: 'dark', label: 'Dark', emoji: '🌙' },
            { v: 'light', label: 'Light', emoji: '☀️' },
          ] as const).map((t) => (
            <button
              key={t.v}
              onClick={() => update('focusTheme', t.v)}
              className={cn(
                'py-2 rounded-xl text-sm font-semibold capitalize flex items-center justify-center gap-1.5 transition',
                s.focusTheme === t.v ? 'bg-teal-500 text-black' : 'bg-white/5 text-white/60'
              )}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="OLED Black (Battery Saver)">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85 font-medium">Pure black backgrounds in dark mode</span>
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
            <div className="flex-1 min-w-0 pr-3">
              <div className="text-sm text-white/90 font-semibold">Reduce animations</div>
              <div className="text-[11px] text-white/55 leading-snug mt-0.5">
                Disables spring bounces, confetti, particle bursts. Use if motion
                bothers you or the app feels laggy on your device.
              </div>
            </div>
            <Toggle value={s.reduceAnimations} onChange={(v) => update('reduceAnimations', v)} />
          </div>
          {!s.reduceAnimations && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/80 font-semibold">Animation intensity</span>
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
      {/* Old Tutorial Mode section removed — tutorial toggle is now in the
          header (just left of the Minimal Mode toggle). Long-press any tab
          to access the ? tutorial button. */}
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
          <span className="text-sm text-white/85 font-medium">Flat bars over 3D for readability</span>
          <Toggle value={s.prefer2D} onChange={(v) => update('prefer2D', v)} />
        </div>
      </Row>
      <Row label="Haptic Feedback">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/85 font-medium flex items-center gap-1.5"><Vibrate size={14} /> Vibration on actions</span>
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
          <span className="text-sm text-white/85 font-medium">Celebration confetti on milestones</span>
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
          <span className="text-sm text-white/85 font-medium">Chimes on achievements</span>
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
            <span className="text-[11px] text-white/70 font-medium">Volume</span>
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
            style={{ accentColor: '#14b8a6' }}
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
          <span className="text-sm text-white/85 font-medium">Enable browser notifications</span>
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

