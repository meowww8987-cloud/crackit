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
import { ConcentricRings } from '@/components/ui/concentric-rings';
import { ScrollAwareSlider } from '@/components/shared/ScrollAwareSlider';
import { triggerTutorialOnboarding } from '@/components/app/AppShell';
import { pushToast } from '@/components/shared/Toast';

type SectionKey = 'goals' | 'focus' | 'appearance' | 'notifications' | 'data';

const SECTIONS: { key: SectionKey; label: string; icon: typeof TargetIcon; color: string }[] = [
 { key: 'goals', label: 'Study Goals', icon: TargetIcon, color: '#22c55e' },
 { key: 'focus', label: 'Focus & Timer', icon: Timer, color: '#f59e0b' },
 { key: 'appearance', label: 'Appearance', icon: Palette, color: '#a855f7' },
 { key: 'notifications', label: 'Notifications', icon: Bell, color: '#14b8a6' },
 { key: 'data', label: 'Data & Account', icon: Database, color: '#ef4444' },
];

export function SettingsTab() {
 const [open, setOpen] = useState<SectionKey>('goals');
 const s = useSettings();

 const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
 s.set(key, value);
 if (key === 'textSize') applyTextSize(value as Settings['textSize']);
 if (key === 'appTheme') applyTheme(value as Settings['appTheme']);
 };

 return (
 <div className="pt-2 pb-4 space-y-3">
 {/* Header with Tutorial + Minimal Mode toggles */}
 <div className="flex items-center justify-between mb-2">
 <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Settings</h1>
 <div className="flex items-center gap-2">
 {/* Tutorial Mode toggle */}
 <button
 onClick={() => {
 vibrate(15);
 update('tutorialMode', !(s.tutorialMode ?? false));
 if (!(s.tutorialMode ?? false)) {
 triggerTutorialOnboarding();
 }
 }}
 className={cn(
 'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95',
 )}
 style={{
 background: (s.tutorialMode ?? false) ? '#7c3aed' : 'var(--muted)',
 color: (s.tutorialMode ?? false) ? '#ffffff' : 'var(--muted-foreground)',
 border: (s.tutorialMode ?? false) ? 'none' : '1px solid var(--border)',
 }}
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
 onClick={() => {
 vibrate(15);
 const newVal = !s.minimalMode;
 update('minimalMode', newVal);
 if (newVal) {
 pushToast(
 '⚡ Minimal Mode Activated',
 '• 3D background disabled (saves battery)\n• Gradient mesh disabled (saves GPU)\n• Non-essential tabs hidden\n• Partner sync every 30s (saves network)\n• Focus timer optimized for low-end devices\n• Animations reduced for smoother UX',
 'success'
 );
 } else {
 pushToast(
 '✨ Full Mode Restored',
 '• 3D background enabled\n• Gradient mesh enabled\n• All tabs visible\n• Full partner sync speed',
 'info'
 );
 }
 }}
 className={cn(
 'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95',
 )}
 style={{
 background: s.minimalMode ? '#0d9488' : 'var(--muted)',
 color: s.minimalMode ? '#ffffff' : 'var(--muted-foreground)',
 border: s.minimalMode ? 'none' : '1px solid var(--border)',
 }}
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
 <span className="text-sm font-semibold flex-1 text-left" style={{ color: 'var(--foreground)' }}>{sec.label}</span>
 <ChevronDown
 size={16}
 style={{ color: 'var(--muted-foreground)' }}
 className={cn('transition-transform', isOpen && 'rotate-180')}
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
 {sec.key === 'data' && <DataSection s={s} />}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
 })}

 {/* Version info + expandable changelog */}
 <div className="glass rounded-2xl p-3 mt-4" style={{ border: '1px solid var(--border)' }}>
 <details className="group">
 <summary className="flex items-center justify-between cursor-pointer text-xs" style={{ color: 'var(--muted-foreground)' }}>
 <span>
 NEET 2027 Study Tracker · <span className="font-mono" style={{ color: '#0d9488' }}>v2.20.0</span>
 </span>
 <ChevronDown size={12} style={{ color: 'var(--muted-foreground)' }} className="group-open:rotate-180 transition-transform" />
 </summary>
 <div className="mt-2 space-y-1.5 text-[10px] border-t pt-2" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
 <div><strong style={{ color: "var(--foreground)" }}>v2.20.0</strong> — New "Sage Mist" 🌿 eye-comfort theme. Built on vision science: low luminance contrast (7:1 WCAG AAA, not pure black/white), warm color temperature (zero pure blue/white), desaturated earth tones (~40% less saturated). Palette: Warm Mist bg #E8EBE4, Cream Linen cards #F2F0E8, Deep Forest text #2D3A2E, Muted Sage accent #7A9B76, Dusty Gold #C9A961, Warm Terracotta #C2856B. Hidden all visual noise (grid+vignette+aurora). Subject colors desaturated: Soft Slate/Dusty Lilac/Sage Green/Warm Clay/Stone Gray. Solid cards (no glassmorphism). For long study sessions with zero eye strain.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.19.2</strong> — ScrollAwareSlider Option C: when slider is being dragged (horizontal), lock page scroll (touch-action: none) so vertical movement doesn&apos;t leak through. Prevents &apos;slider jumps + page also scrolls&apos; double-action.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.19.1</strong> — Fix accidental slider changes during scroll. New ScrollAwareSlider wrapper detects swipe angle (vertical &gt; 60° = scroll, horizontal &lt; 30° = drag). Applied to all 11 range sliders.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.19.0</strong> — Remove ALL requestFullscreen() calls (8 total). Was triggering the &quot;To exit full screen, press Esc&quot; toast. Now relies on manifest display:fullscreen (works on installed Android PWA, no JS, no toast, status bar hidden). Bumped SW cache v4→v5.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.18.1</strong> — Fix: Sleep History moved from Tests long-press → History tab long-press (alongside Test History, 2 options). Tests long-press reverted to CBT Mode + Practice Mode (2 options). Stats long-press order fixed: Weekly Report (top) → Monthly Report (middle) → Sleep Report (bottom). Sleep History + Sleep Analysis sheets redesigned with distinct dark indigo night-sky theme.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.18.0</strong> — Sleep History → long-press menu. Sleep Reports (Weekly + Monthly) → Stats long-press. TabLongPressOverlay supports 3 actions. SleepAnalysisSheet with Weekly/Monthly tabs: score + stats + best/worst night + advantages/disadvantages/improvements. SleepHistorySheet with all sleep entries grouped by date.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.17.0</strong> — SleepLockScreen rebuild: time-of-day aware scenery (6 scenes: night/dawn/morning/noon/dusk/evening) with matching gradients + celestial body. Quality picker now appears AFTER waking from the lock screen. Flow: double-tap → math → sunrise/brighten → 5 emoji quality picker → wakeUp(quality).</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.16.0</strong> — Rebuild Home Sleep card as proper Sleep & Energy hub: shows live sleep status, 1-5 energy emoji picker (red→green), Sleep Plan button (full daily schedule + 4 rules + science), long-press for sleep report. SleepPlanSheet: 5:30 AM wake, 10:30 PM bedtime, 20-min nap window, no screens 30 min before bed, caffeine cutoff 2 PM, why 7-7.5h is the sweet spot.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.15.0</strong> — Sleep Health: app now classifies each sleep as night/late-night/noon-nap/evening-nap/power-nap, computes a 0-100 health score (duration 40% + bedtime consistency 25% + bedtime timing 20% + quality rating 15%). Wake flow already asks 1-5 quality rating. New SleepReportSheet (long-press Sleep Health card in Stats, or any sleep entry in History) shows: score, last 7 nights breakdown, avg bedtime, consistency %, avg quality, personalized recommendations.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.14.2</strong> — Fix: tapping Pause button on studying notification was starting sleep mode (action handling bug). Removed Pause action entirely — notification now has only ONE action button per state (Sleep when awake, Wake Up when sleeping). Also redesigned notification: shorter single-line body, no redundant info, no cluttered multi-line text. Studying: "32m done · 28m left". Idle: "4h 12m / 6h today · Last studied 2h ago".</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.14.1</strong> — Fix client-side crash — PersistentNotificationManager was using useSession((s) =&gt; ({"{pause, stop}"})) which returns a new object every render → Zustand infinite re-render loop → &quot;Application error&quot; on page load. Split into individual scalar selectors.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.14.0</strong> — Persistent Study Notification: lives in notification shade showing today's stats + NEET countdown + target progress + Sleep button. When sleeping → time-of-day themed scene (night/dawn/morning/noon/dusk/evening) with shooting stars + "Wake Up" button. Tap notification → opens app → existing double-tap + math wake flow. Fixes default Chrome "tap to copy URL" notification by replacing it with our custom one.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.13.3</strong> — Remove "Focus Session Theme" setting entirely (was unused — Focus Timer already always pure black via .force-dark-ui). Removed from Settings type, store, and SettingsTab UI.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.13.2</strong> — Rose cards now Pale Pink #FFF0F5 (very light but noticeable, was too subtle #FFFAFC), primary text now Dark Rose #8B2F4C (rosy pink, was Dark Raspberry which looked berry/wine). Full pink opacity ladder: Dark Rose → China Rose → Old Rose → Rosy Brown → Light Pink.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.13.1</strong> — Make Rose VISIBLY pink (was too subtle, looked like Light): bg Pink Lace #FFD6E8 (was Misty Rose), cards faint pink #FFFAFC (was pure white), 3D opacity 1.0 (was 0.78) — full-strength pink animation now unmistakably distinct from Light mode.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.13.0</strong> — Rose Quartz rebuild: Misty Rose bg, Dark Raspberry text (was brown), 5 named pinks (Rose Pink / Mauve / Salmon Pink / Raspberry Rose / Blush), China Rose + Rose Gold accents. Focus Timer + Splash + Sleep Lock now have .force-dark-ui class so they stay pure-black + white-text regardless of theme.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.12.9</strong> — Per-theme 3D background palettes: dark=pure black + vivid, light=pure white + soft, rose=pink-tinted bg + 5 shades of pink, ocean=blue/cyan, forest=greens, gold=amber. Electrons dark on light themes (were invisible white). Rose now visibly distinct from Light.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.12.8</strong> — Rebuild Rose as soothing light "Rose Quartz" theme: pure white cards + deep warm charcoal text (was unreadable faded pink on dark), flat soft off-white bg, hidden aurora canvas noise, dusty rose + muted sage accents — calm for long study</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.12.7</strong> — Remove Lavender (Rose Glow) theme entirely (was unused / invisible); auto-migrate existing users to Dark</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.11.0</strong> — 3-step Add Target wizard (subject→chapter+lecture→confirm); expected time slider with preset snap points; activity color-coded icons; smart default subject (last studied); auto-scroll to current chapter; drag-from-Syllabus-to-Study-tab creates target with learned time</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.5</strong> — PWA fullscreen: manifest display='fullscreen' + display_override. Install (Add to Home Screen) for true fullscreen with NO browser banner. Updated install prompt + fullscreen hint.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.4</strong> — Remove ALL requestFullscreen() calls (browser 'To exit full screen, press Esc' banner is gone). App still looks fullscreen via CSS viewport-fit:cover.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.3</strong> — Fix fullscreen: request on first user gesture (browsers block it on load), early inline script in layout.tsx, address bar hidden on load via scrollTo</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.2</strong> — Remove hand animation (just pulsing ring); visible X close button on long-press overlay; disable text selection globally (no more Android copy popup); true fullscreen (hide status bar, re-enter on notification panel return)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.1</strong> — Fix tutorial hand position (measure actual tab DOM position); overlay doesn't cover bottom nav (tabs tappable); only dismissable via 'I understood' or long-pressing correct tab; long-press progress ring</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.7.0</strong> — Long-press ALL tabs for full-screen overlay (top 50% / bottom 50% actions + ? tutorial); removed always-visible ? button; moved Tutorial toggle to header (left of Minimal); tutorial onboarding with hand animation + timer</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.7</strong> — Fix 90°/270° rotation swap (gamma mapping was backwards); adapt landscape layout (row flexDirection so controls visible); add orientation lock (long-press = persistent, double-tap = temporary)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.6</strong> — Fill TopBar empty space (reduced paddingTop to safe-area only); move Build Syllabus + Formula Vault to Syllabus tab long-press; add TabInfoButton (tutorial + hidden features) to all tabs except Settings</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.5</strong> — Fix rotation frame overflow at 90°/270° (use vmin/vmax + flexbox centering instead of vh/vw which swap with orientation); fix Android auto-rotate (lock screen to portrait on mount so gravity sensor handles rotation without OS double-rotating)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.4</strong> — Fix Focus Timer rotation: gravity-based orientation detection (DeviceOrientationEvent + iOS permission), deadzone threshold, fixed content going out of frame at 180°/270° (swapped width/height for landscape + centered with margin offsets)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.3</strong> — Removed the green 'N' logo + 'NEET 2027' text from the top-left corner (redundant with Home tab header)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.2</strong> — Focus session now auto-detects device orientation in all 4 directions (0°/90°/180°/270°) using Screen Orientation API. Rotate button cycles through all 4 orientations. Always-on (no setting gate).</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.1</strong> — Tap NEET 2027 logo to start sleep (removed extra sleep banner); removed Daily Recall card from Home (now in Study tab long-press menu); Study tab long-press now shows action sheet with Free Study + Daily Recall options</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.6.0</strong> — Rebuild Pomodoro as single ConcentricRings (fixes outer ring definitively); immersive Sleep Lock Screen (full-screen bluish night scenery + double-tap + math problem to wake); remove BreakExercise + Study Pact</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.5.2</strong> — Really fix outer Pomodoro ring: wrapper DIV (not just SVG) was intercepting pointer events over the outer ring. Added pointer-events: none to the div; hit-zone circles still receive events.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.5.1</strong> — Fix outer Pomodoro ring not sliding (inner ring's SVG was intercepting pointer events on its empty center, blocking the outer ring below)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.5.0</strong> — Sleep tracking with persistent banner + drag-to-wake + browser notification; Micro-break exercises (box breathing, 20-20-20, stretch); Study Pact with partner</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.4.3</strong> — Fix concentric rings having different centers (each ring computed its own canvas size from its own radius → misaligned). Now both rings share the same canvasSize so they're perfectly concentric.</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.4.2</strong> — Widen Pomodoro ring gap: outer 65 / inner 30 (no overlap), tighten hit-zones so both rings are independently slidable</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.4.1</strong> — Rebuild Pomodoro widget: full 360° circles (no chopped arcs), big Work ring + small Break ring, vertical layout, compact legend below</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.4.0</strong> — Rebuilt TargetCard (cleaner info hierarchy, activity icons, remaining time), fixed drag-and-drop with dedicated drag handle, sister-card indicators (1/N badge + left-edge bar)</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.3.5</strong> — Fix light mode text visibility (all text-white/N opacity levels), compact Pomodoro widget, fix concentric ring overlap + pointer pass-through</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.3.4</strong> — Slidable concentric Pomodoro rings (drag around the ring, not a straight slider), theme-aware range slider track + thumb</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.3.3</strong> — Pomodoro concentric rings, side-by-side date inputs, dim settings, Focus Timer labels, distinct section headers, bar visibility</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.3.2</strong> — Theme polish (Gold/Rose rebuild), bar visibility, 5 partner status states, Toggle fix</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.3.0</strong> — 5 new themes (Ocean, Forest, Lavender, Rose, Gold), card-solid light mode fix</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.2.0</strong> — Minimal Mode, OLED Black, Adaptive Subject Glow, Glassmorphism, Gradient Text, Smart Borders</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.1.0</strong> — Landscape rotation, partner sync fixes, syllabus redesign</div>
 <div><strong style={{ color: "var(--foreground)" }}>v2.0.0</strong> — Study partner feature, modern UI overhaul, drag-to-reorder</div>
 <div><strong style={{ color: "var(--foreground)" }}>v1.5.0</strong> — Focus timer, burn protection, PWA support</div>
 <div><strong style={{ color: "var(--foreground)" }}>v1.0.0</strong> — Initial release: targets, syllabus, tests, history</div>
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
 className={cn(
 'w-12 h-7 rounded-full transition-colors duration-200 relative shrink-0'
 )}
 style={{ background: value ? '#0d9488' : 'var(--muted)' }}
 aria-pressed={value}
 >
 <motion.div
 animate={{ x: value ? 20 : 0 }}
 transition={{ type: 'spring', stiffness: 500, damping: 32 }}
 className="absolute top-1 left-1 w-5 h-5 rounded-full shadow-sm"
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
 // Pomodoro visualization: TWO CONCENTRIC FULL-CIRCLE SLIDERS.
 // Outer ring = Work duration (teal) — LARGE radius (the main focus)
 // Inner ring = Break duration (amber) — SMALL radius (clearly nested inside)
 // Both are full 360° circles (no gap, no chopped arcs). The big size
 // difference (Work 60, Break 36 — gap = 24px) makes it instantly obvious
 // which ring is which without reading the label.
 const WORK_COLOR = '#14b8a6'; // teal — focus
 const BREAK_COLOR = '#f59e0b'; // amber — rest

 // Ring geometry — BIG Work ring (radius 65), SMALL Break ring (radius 30).
 // Gap = 35px (was 24px) so the two rings NEVER overlap and their thumbs can
 // be grabbed independently even when both arcs end in the same quadrant.
 // Stroke 8, canvas = (65 + 4 + 8) * 2 = 154.
 const OUTER_R = 65;
 const INNER_R = 30;
 const STROKE = 8;
 const CANVAS = (OUTER_R + STROKE / 2 + 8) * 2; // = 154

 return (
 <>
 {/* === Pomodoro Cycle — vertical layout, ring on top, legend below === */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="inline-block w-1 h-3.5 rounded-full" style={{ background: 'linear-gradient(180deg, #0d9488, #14b8a6)' }} />
 <label className="text-xs font-bold uppercase tracking-wide">Pomodoro Cycle</label>
 </div>
 <div className="rounded-2xl border p-3 flex flex-col items-center gap-2">
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
 <span className="mx-0.5 text-sm">/</span>
 <span style={{ color: BREAK_COLOR }}>{s.pomodoroBreak}</span>
 </div>
 <div className="text-[8px] leading-none mt-1 uppercase tracking-widest">min</div>
 </>
 }
 />

 {/* Compact legend — single horizontal row below the ring */}
 <div className="flex items-center justify-center gap-4 w-full">
 <div className="flex items-center gap-1.5">
 <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: WORK_COLOR }} />
 <span className="text-[10px] uppercase tracking-wide font-semibold">Work</span>
 <span className="text-[11px] font-bold tabular" style={{ color: WORK_COLOR }}>{s.pomodoroWork}m</span>
 </div>
 <div className="w-px h-3 " />
 <div className="flex items-center gap-1.5">
 <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: BREAK_COLOR }} />
 <span className="text-[10px] uppercase tracking-wide font-semibold">Break</span>
 <span className="text-[11px] font-bold tabular" style={{ color: BREAK_COLOR }}>{s.pomodoroBreak}m</span>
 </div>
 </div>
 </div>
 </div>

 {/* === Screen Burn Protection (master toggle) === */}
 <Row label="Screen Burn Protection">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Dim UI when idle</span>
 <Toggle value={s.burnProtection} onChange={(v) => update('burnProtection', v)} />
 </div>
 </Row>

 {/* === When to dim + Timer visibility when dimmed — side by side === */}
 {s.burnProtection && (
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">When to dim</label>
 <div className="rounded-xl border p-2.5">
 <div className="flex items-center justify-between mb-1">
 <span className="text-[10px] ">Idle delay</span>
 <span className="text-xs tabular font-bold ">{s.dimDelay}s</span>
 </div>
 <ScrollAwareSlider>
 <input
 type="range" min={3} max={30} step={1} value={s.dimDelay}
 onChange={(e) => update('dimDelay', Number(e.target.value))}
 className="w-full"
 style={{ accentColor: '#f59e0b' }}
 />
 </ScrollAwareSlider>
 <div className="flex justify-between text-[8px] mt-0.5">
 <span>3s</span><span>30s</span>
 </div>
 </div>
 </div>
 <div>
 <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block">Timer visibility</label>
 <div className="rounded-xl border p-2.5">
 <div className="flex items-center justify-between mb-1">
 <span className="text-[10px] ">When dimmed</span>
 <span className="text-xs tabular font-bold ">{s.screenDimOpacity}%</span>
 </div>
 <ScrollAwareSlider>
 <input
 type="range" min={5} max={100} step={5} value={s.screenDimOpacity}
 onChange={(e) => update('screenDimOpacity', Number(e.target.value))}
 className="w-full"
 style={{ accentColor: '#14b8a6' }}
 />
 </ScrollAwareSlider>
 <div className="flex justify-between text-[8px] mt-0.5">
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
 <span className="text-sm font-medium">Detect tab switches as wasted</span>
 <Toggle value={s.autoDetectWasted} onChange={(v) => update('autoDetectWasted', v)} />
 </div>
 </Row>
 <Row label="Landscape Rotation">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Allow rotation in full-screen timer</span>
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
 { v: 'rose', label: 'Rose Quartz', emoji: '🌸', desc: 'Rosy pink', color: '#FFD6E8' },
 { v: 'sage', label: 'Sage Mist', emoji: '🌿', desc: 'Eye comfort', color: '#E8EBE4' },
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
 className="py-2.5 rounded-xl text-sm font-semibold flex flex-col items-center gap-0.5 transition"
 style={{
 border: s.appTheme === t.v ? '2px solid #0d9488' : '2px solid var(--border)',
 background: s.appTheme === t.v ? 'rgba(13,148,136,0.1)' : 'var(--muted)',
 }}
 >
 <span className="text-lg">{t.emoji}</span>
 <span style={{ color: s.appTheme === t.v ? '#0d9488' : 'var(--foreground)' }}>{t.label}</span>
 <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{t.desc}</span>
 </button>
 ))}
 </div>
 </Row>
 <Row label="OLED Black (Battery Saver)">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Pure black backgrounds in dark mode</span>
 <Toggle value={s.oledBlack} onChange={(v) => update('oledBlack', v)} />
 </div>
 </Row>
 <Row label="3D Background">
 <div className="space-y-2">
 <p className="text-[10px] leading-snug">
 Subject-aware 3D scene behind the app. Auto mode picks based on what
 you're studying (Physics→atoms, Zoology→DNA, Botany→cells, Chemistry→molecules).
 Object count auto-scales to your device tier.
 </p>
 <div className="grid grid-cols-3 gap-1.5">
 {([
 { v: 'auto', label: 'Auto', emoji: '✨', tag: 'Recommended' },
 { v: 'atoms', label: 'Atoms', emoji: '⚛️', tag: 'Physics' },
 { v: 'dna', label: 'DNA', emoji: '🧬', tag: 'Zoology' },
 { v: 'molecules', label: 'Molecules', emoji: '🔬', tag: 'Chemistry' },
 { v: 'cells', label: 'Cells', emoji: '🌿', tag: 'Botany' },
 { v: 'hybrid', label: 'Hybrid', emoji: '🌌', tag: 'All subjects' },
 { v: 'off', label: 'Off', emoji: '⚫', tag: 'Aurora only' },
 ] as const).map((opt) => (
 <button
 key={opt.v}
 onClick={() => { update('bg3DMode', opt.v); vibrate(8); }}
 className={cn(
 'py-2 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition relative',
 s.bg3DMode === opt.v
 ? 'bg-teal-500 text-white'
 : ' hover:'
 )}
 >
 <span className="text-base leading-none">{opt.emoji}</span>
 <span className="leading-tight">{opt.label}</span>
 {opt.v === 'auto' && s.bg3DMode !== 'auto' && (
 <span className="text-[8px] absolute -top-1 -right-1 px-1 rounded">
 ★
 </span>
 )}
 </button>
 ))}
 </div>
 {s.bg3DMode === 'auto' && (
 <p className="text-[10px] /80 flex items-center gap-1">
 <Sparkles size={10} /> Auto mode active — scene changes with your study subject
 </p>
 )}
 </div>
 </Row>
 <Row label="Animations">
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex-1 min-w-0 pr-3">
 <div className="text-sm font-semibold">Reduce animations</div>
 <div className="text-[11px] leading-snug mt-0.5">
 Disables spring bounces, confetti, particle bursts. Use if motion
 bothers you or the app feels laggy on your device.
 </div>
 </div>
 <Toggle value={s.reduceAnimations} onChange={(v) => update('reduceAnimations', v)} />
 </div>
 {!s.reduceAnimations && (
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs font-semibold">Animation intensity</span>
 <span className="text-xs tabular font-bold">{s.animationIntensity}</span>
 </div>
 <ScrollAwareSlider>
 <input
 type="range"
 min={0}
 max={100}
 value={s.animationIntensity}
 onChange={(e) => update('animationIntensity', Number(e.target.value))}
 className="w-full"
 />
 </ScrollAwareSlider>
 <div className="flex justify-between text-[9px] mt-0.5">
 <span>Subtle</span>
 <span>Normal</span>
 <span>Lively</span>
 </div>
 </div>
 )}
 {s.reduceAnimations && (
 <p className="text-[10px] /80 flex items-center gap-1">
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
 s.textSize === t ? 'bg-teal-500 text-white' : ' '
 )}
 >
 {t}
 </button>
 ))}
 </div>
 </Row>
 <Row label="Prefer 2D Graphs">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Flat bars over 3D for readability</span>
 <Toggle value={s.prefer2D} onChange={(v) => update('prefer2D', v)} />
 </div>
 </Row>
 <Row label="Haptic Feedback">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium flex items-center gap-1.5"><Vibrate size={14} /> Vibration on actions</span>
 <div className="flex items-center gap-2">
 {s.haptics && (
 <button onClick={() => vibrate([10, 30, 10])} className="text-xs hover:underline" style={{ color: "#0d9488" }}>
 Test
 </button>
 )}
 <Toggle value={s.haptics} onChange={(v) => update('haptics', v)} />
 </div>
 </div>
 </Row>
 <Row label="Confetti Effects">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Celebration confetti on milestones</span>
 <div className="flex items-center gap-2">
 {s.confettiEnabled && (
 <button
 onClick={() => { import('@/components/shared/Effects').then(({ triggerConfetti }) => triggerConfetti('big')); }}
 className="text-xs hover:underline" style={{ color: "#0d9488" }}
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
 <span className="text-sm font-medium">Chimes on achievements</span>
 <div className="flex items-center gap-2">
 {s.soundEnabled && (
 <button
 onClick={() => { import('@/components/shared/Effects').then(({ playSound }) => playSound('success')); }}
 className="text-xs hover:underline" style={{ color: "#0d9488" }}
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
 <span className="text-[11px] font-medium">Volume</span>
 <span className="text-sm font-bold tabular ">{s.soundVolume}%</span>
 </div>
 <ScrollAwareSlider>
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
 </ScrollAwareSlider>
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
 <span className="text-sm font-medium">Enable browser notifications</span>
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
 <Row label="Persistent Study Notification">
 <div className="flex items-center justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium">Study companion in notification shade</div>
 <div className="text-[10px] mt-0.5">
 Live stats · NEET countdown · Tap Sleep → night sky scene · Tap Wake Up → double-tap + math
 </div>
 </div>
 <Toggle
 value={s.persistentNotification}
 onChange={async (v) => {
 if (v && 'Notification' in window) {
 try {
 const perm = Notification.permission !== 'default' ? Notification.permission : await Notification.requestPermission();
 update('persistentNotification', perm === 'granted');
 if (perm !== 'granted') {
 // Permission denied — show a hint
 try {
 const n = new Notification('Permission needed', {
 body: 'Enable notifications in your browser settings to use the persistent study companion.',
 });
 setTimeout(() => n.close(), 4000);
 } catch {}
 }
 } catch {
 update('persistentNotification', false);
 }
 } else {
 update('persistentNotification', v);
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
 <div className="text-[10px] ">{n.body}</div>
 <div className="text-[9px] mt-0.5">
 {new Date(n.timestamp).toLocaleString()}
 </div>
 </div>
 ))}
 <button
 onClick={() => s.clearNotifications()}
 className="w-full text-xs hover:underline mt-2" style={{ color: "#dc2626" }}
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
 // Export ALL localStorage keys starting with 'neet-' (16 stores total)
 const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('neet-'));
 const data: Record<string, any> = {
 _meta: {
 version: 2,
 exportedAt: new Date().toISOString(),
 appVersion: 'NEET 2027 Study Tracker',
 storeCount: allKeys.length,
 },
 };
 for (const key of allKeys) {
 try {
 data[key] = JSON.parse(localStorage.getItem(key) || 'null');
 } catch {
 data[key] = localStorage.getItem(key);
 }
 }
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
 } catch {
 alert('Invalid backup file');
 }
 };
 reader.readAsText(file);
 };

 const confirmImport = () => {
 if (!importPreview) return;
 // Save current data for undo (ALL neet-* keys)
 const backup: Record<string, string> = {};
 Object.keys(localStorage).filter((k) => k.startsWith('neet-')).forEach((key) => {
 const val = localStorage.getItem(key);
 if (val) backup[key] = val;
 });
 localStorage.setItem('neet-pre-import-backup', JSON.stringify(backup));

 // Write imported data — restore ALL neet-* keys from backup file
 const { data } = importPreview;
 Object.keys(data).filter((k) => k.startsWith('neet-')).forEach((key) => {
 if (data[key] !== null && data[key] !== undefined) {
 localStorage.setItem(key, JSON.stringify(data[key]));
 }
 });

 setHasUndoData(true);
 setImportPreview(null);
 alert('Backup imported successfully! Reloading...');
 window.location.reload();
 };

 const restorePreviousData = () => {
 const backupStr = localStorage.getItem('neet-pre-import-backup');
 if (!backupStr) return;
 const backup = JSON.parse(backupStr);
 // Clear current neet-* and restore backup
 Object.keys(localStorage).filter((k) => k.startsWith('neet-') && k !== 'neet-pre-import-backup').forEach((key) => {
 localStorage.removeItem(key);
 });
 Object.keys(backup).forEach((key) => {
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

 /** Reinstall PWA — clears SW + all caches (preserves localStorage data).
 * Use this when the app manifest or core assets have changed and the
 * installed PWA is using stale cached versions. After reinstall, the
 * browser fetches fresh HTML + JS + manifest on next load.
 *
 * CRITICAL: localStorage is NOT touched — all your data (sessions,
 * settings, history, syllabus, etc.) stays intact. */
 const [reinstalling, setReinstalling] = useState(false);
 const reinstallPWA = async () => {
 const confirmed = confirm(
 'Reinstall PWA (keep data)?\n\n' +
 'This will:\n' +
 '• Unregister the service worker\n' +
 '• Clear all cached files\n' +
 '• Reload the page (fresh assets + manifest)\n\n' +
 'Your DATA is safe — sessions, settings, history, syllabus all preserved (stored in localStorage, not touched).\n\n' +
 'After reload, you may need to "Add to Home Screen" again if the old install is stale.'
 );
 if (!confirmed) return;
 setReinstalling(true);
 try {
 // 1. Unregister all service workers
 if ('serviceWorker' in navigator) {
 const registrations = await navigator.serviceWorker.getRegistrations();
 for (const reg of registrations) {
 await reg.unregister();
 }
 }
 // 2. Clear all caches (HTTP caches, NOT localStorage)
 if ('caches' in window) {
 const keys = await caches.keys();
 await Promise.all(keys.map((k) => caches.delete(k)));
 }
 // 3. Clear sessionStorage (transient, not user data)
 try { sessionStorage.clear(); } catch {}
 // 4. Don't touch localStorage — that's where user data lives!
 // 5. Reload with cache-busting to force fresh fetch
 const url = window.location.origin + window.location.pathname + '?reinstalled=' + Date.now();
 window.location.href = url;
 } catch (e) {
 console.warn('[reinstall] error:', e);
 setReinstalling(false);
 alert('Reinstall failed. Try closing all app tabs and reopening, or use "Hard Refresh" instead.');
 }
 };


 return (
 <>
 <Row label="Export Backup">
 <button
 onClick={exportData}
 className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-2" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
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
 className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 cursor-pointer" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
 >
 <Upload size={14} /> Choose Backup File
 </label>

 {importPreview && (
 <div className="mt-3 glass rounded-xl p-3 border ">
 <div className="text-xs font-bold mb-2">Backup Preview:</div>
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
 className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
 >
 Cancel
 </button>
 <button
 onClick={confirmImport}
 className="flex-1 py-2 rounded-lg bg-teal-500 text-white text-xs font-bold"
 >
 Import & Reload
 </button>
 </div>
 </div>
 )}

 {hasUndoData && (
 <button
 onClick={restorePreviousData}
 className="w-full mt-2 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(217,119,6,0.15)", color: "#d97706", border: "1px solid rgba(217,119,6,0.3)" }}
 >
 Restore Previous Data (Undo Import)
 </button>
 )}
 </Row>

 <Row label="App Update">
 <div className="flex gap-2">
 <button
 onClick={softRefresh}
 className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
 >
 Soft Refresh
 </button>
 <button
 onClick={hardRefresh}
 className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
 >
 Hard Refresh
 </button>
 </div>
 <button
 onClick={reinstallPWA}
 disabled={reinstalling}
 className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: "rgba(37,99,235,0.15)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.3)" }}
 >
 {reinstalling ? (
 <><span className="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> Reinstalling…</>
 ) : (
 <>🔄 Reinstall PWA (Keep Data)</>
 )}
 </button>
 <p className="text-[10px] mt-1">
 Use this if landscape mode, theme, or other features aren't updating.
 Clears cached files + service worker, reloads with fresh assets.
 <strong style={{ color: "var(--foreground)" }}> Your data is safe.</strong>
 </p>
 </Row>

 <Row label="Install as App">
 <div className="glass rounded-xl p-3 text-xs ">
 <p className="mb-1.5 font-semibold ">Chrome / Edge:</p>
 <p>1. Tap menu (⋮) → <strong>Install app</strong> / <strong>Add to Home screen</strong></p>
 <p className="mt-1.5">Works offline after first load.</p>
 </div>
 </Row>

 <Row label="Fix Corrupted Data">
 <button
 onClick={fixCorruptedData}
 className="w-full py-2.5 rounded-xl text-sm font-semibold active:scale-95" style={{ background: "rgba(217,119,6,0.15)", color: "#d97706", border: "1px solid rgba(217,119,6,0.3)" }}
 >
 Find & Delete Corrupted Sessions
 </button>
 <p className="text-[10px] mt-1">Detects sessions with &gt;12h study time</p>
 </Row>

 <Row label="Danger Zone">
 <div className="glass rounded-xl p-3 border ">
 <p className="text-xs mb-2">This will permanently delete all your data.</p>
 <button
 onClick={() => {
 const confirmText = prompt('Type RESET to confirm:');
 if (confirmText === 'RESET') {
 localStorage.clear();
 window.location.reload();
 }
 }}
 className="w-full py-2 rounded-xl text-sm font-semibold active:scale-95" style={{ background: "rgba(220,38,38,0.15)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}
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
 <div className="text-lg font-bold tabular ">{value}</div>
 <div className="text-[9px] ">{label}</div>
 </div>
 );
}

