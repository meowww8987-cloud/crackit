#!/usr/bin/env python3
"""Apply the Daily Vitals redesign to HomeTab.tsx (Section 1 of Home modernization).

Splices (bottom-up so line numbers stay valid):
  1. lines 693-761  SubjectHealthCard      -> SubjectPulseCard + SubjectIcon + ScheduleStrip
  2. lines 532-691  SleepAndDoubtCard      -> DailyVitalsCard
  3. lines 433-462  JSX usage zone         -> new Daily Vitals zone (Pulse -> Schedule -> Vitals)
  4. line 24-25     imports                -> add useNav, subjectColor, type imports
  5. line 5         lucide imports         -> keep only TrendingUp

Each boundary is verified before splicing. Run `npx tsc --noEmit` afterwards.
"""
import sys

PATH = '/home/z/my-project/src/components/tabs/HomeTab.tsx'

with open(PATH) as f:
    lines = f.readlines()

def expect(idx: int, text: str):
    """idx is 1-based line number; text is a substring that must be present."""
    if text not in lines[idx - 1]:
        print(f'BOUNDARY MISMATCH at line {idx}:')
        print(f'  expected substring: {text!r}')
        print(f'  actual: {lines[idx - 1]!r}')
        sys.exit(1)

# ---------------------------------------------------------------------------
# New component code blocks
# ---------------------------------------------------------------------------

SUBJECT_PULSE_AND_HELPERS = r'''/* =========================================================================
   SUBJECT PULSE (REDESIGNED — was flat "Subject Health" list)
   1. Teal halo hero header + formula hint + average chip
   2. Per-subject colored halo icons (geometric shapes, matches Study tab)
   3. Gradient glow bars in each subject's own color
   4. Status chips (Strong / Steady / Needs work) + crown/warn badges
   5. Smart insight footer about weakest subject -> tap opens Syllabus
   ========================================================================= */
function SubjectPulseCard() {
  const sessions = useHistory((s) => s.sessions);
  const lectures = useSyllabus((s) => s.lectures);
  const chapters = useSyllabus((s) => s.chapters);
  const subjects = useSyllabus((s) => s.subjects);
  const tests = useTests((s) => s.tests);
  const setTab = useNav((s) => s.setTab);

  const healthScores = useMemo(() => {
    const weightage: Record<string, number> = { Physics: 100, Chemistry: 100, Botany: 100, Zoology: 100, General: 0 };
    return getSubjectHealthScores(lectures, chapters, subjects, sessions, tests, weightage);
  }, [lectures, chapters, subjects, sessions, tests]);

  // Same visibility rule as the old card: scored subjects OR subjects with lectures
  const visible = useMemo(() => healthScores.filter(h => h.score > 0 || lectures.some(l => {
    const ch = chapters.find(c => c.id === l.chapterId);
    const subj = subjects.find(s => s.id === ch?.subjectId);
    return subj?.name === h.subject;
  })), [healthScores, lectures, chapters, subjects]);

  const scored = visible.filter(h => h.score > 0);
  const weakest = scored.length > 0 ? [...scored].sort((a, b) => a.score - b.score)[0] : null;
  const strongest = scored.length > 0 ? [...scored].sort((a, b) => b.score - a.score)[0] : null;
  const avg = scored.length > 0 ? Math.round(scored.reduce((a, h) => a + h.score, 0) / scored.length) : 0;

  const statusFor = (score: number) => {
    if (score >= 70) return { label: 'Strong', color: '#16a34a', bg: 'rgba(34,197,94,0.13)', border: 'rgba(34,197,94,0.30)' };
    if (score >= 40) return { label: 'Steady', color: '#d97706', bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.30)' };
    return { label: 'Needs work', color: '#dc2626', bg: 'rgba(239,68,68,0.13)', border: 'rgba(239,68,68,0.30)' };
  };

  const insight = (() => {
    if (weakest && weakest.score < 40) {
      return {
        emoji: '⚠️',
        text: `${weakest.subject} needs attention — your weakest subject (${weakest.score}). A focused session on it today would help.`,
        bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.22)',
      };
    }
    if (strongest && strongest.score >= 70) {
      return {
        emoji: '👑',
        text: `${strongest.subject} is leading with ${strongest.score} — keep the momentum.`,
        bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.22)',
      };
    }
    return {
      emoji: '📈',
      text: 'Scores update as you study, take tests and rate confidence.',
      bg: 'var(--muted)', border: 'var(--border)',
    };
  })();

  return (
    <div
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(20,184,166,0.08), transparent 55%), color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid rgba(20,184,166,0.30)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Hero header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0 text-[15px]"
          style={{
            background: 'radial-gradient(circle at 30% 25%, rgba(20,184,166,0.35), rgba(20,184,166,0.10))',
            boxShadow: '0 0 0 1px rgba(20,184,166,0.35), 0 4px 14px -4px rgba(20,184,166,0.4)',
          }}
        >
          🩺
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold" style={{ color: 'var(--foreground)' }}>Subject Pulse</div>
          <div className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>completion · confidence · time · tests</div>
        </div>
        {scored.length > 0 && (
          <span
            className="text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: 'rgba(20,184,166,0.12)', color: '#0d9488', border: '1px solid rgba(20,184,166,0.30)' }}
            suppressHydrationWarning
          >
            avg {avg}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        /* Empty hint — no lectures & nothing scored yet */
        <button
          onClick={() => { vibrate(8); setTab('syllabus'); }}
          className="w-full rounded-xl p-3 text-center active:scale-[0.99] transition"
          style={{ background: 'var(--muted)', border: '1px dashed var(--border)' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Add syllabus lectures to unlock your pulse</div>
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Tap to open the Syllabus tab</div>
        </button>
      ) : (
        <>
          {/* Subject rows */}
          <div className="space-y-2.5">
            {visible.map((h, i) => {
              const color = subjectColor(h.subject);
              const st = statusFor(h.score);
              const isWeakest = scored.length > 1 && weakest?.subject === h.subject;
              const isStrongest = scored.length > 1 && strongest?.subject === h.subject;
              return (
                <button
                  key={h.subject}
                  onClick={() => { vibrate(8); setTab('syllabus'); }}
                  className="w-full text-left active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color.hex}1f`, boxShadow: `0 0 0 1px ${color.hex}55` }}
                    >
                      <SubjectIcon subject={h.subject} color={color.hex} size={13} />
                    </div>
                    <span className="text-[11.5px] font-bold truncate" style={{ color: 'var(--foreground)' }}>{h.subject}</span>
                    {isWeakest && <span className="text-[10px] shrink-0">⚠️</span>}
                    {isStrongest && <span className="text-[10px] shrink-0">👑</span>}
                    <span
                      className="ml-auto text-[9px] font-extrabold px-2 py-[3px] rounded-full shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                      suppressHydrationWarning
                    >
                      {st.label} · {h.score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)', marginLeft: 34 }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${color.hex}, ${color.hex}cc)`,
                        boxShadow: h.score > 0 ? `0 0 8px ${color.hex}66` : 'none',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${h.score}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Smart insight footer */}
          <button
            onClick={() => { vibrate(8); setTab('syllabus'); }}
            className="mt-3 w-full rounded-xl p-2.5 flex items-start gap-2 text-left active:scale-[0.99] transition"
            style={{ background: insight.bg, border: `1px solid ${insight.border}` }}
          >
            <span className="text-[11px] leading-none mt-[2px] shrink-0">{insight.emoji}</span>
            <span className="flex-1 text-[10px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{insight.text}</span>
            <span className="text-[9px] font-bold shrink-0 self-center" style={{ color: 'var(--muted-foreground)' }}>→</span>
          </button>
        </>
      )}
    </div>
  );
}

/* === Subject shapes — same geometric language as the Study tab === */
function SubjectIcon({ subject, color, size = 13 }: { subject: Subject; color: string; size?: number }) {
  const shape = subject === 'Physics'
    ? <circle cx="8" cy="8" r="6" fill={color} />
    : subject === 'Chemistry'
      ? <rect x="2" y="2" width="12" height="12" rx="3" fill={color} />
      : subject === 'Botany'
        ? <path d="M8 2 L14 14 L2 14 Z" fill={color} />
        : subject === 'Zoology'
          ? <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color} />
          : <rect x="4" y="4" width="8" height="8" rx="1" fill={color} />;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0">
      {shape}
    </svg>
  );
}

/* =========================================================================
   SCHEDULE STRIP (REDESIGNED — was plain "Today's Schedule" text list)
   6. 6AM–12AM timeline rail with colored subject segments (matches Study tab)
      + pulsing "now" line
   7. Next-up row with gradient Start CTA that launches a real session
   ========================================================================= */
function ScheduleStrip({ slots }: { slots: TimetableSlot[] }) {
  const startSession = useSession((s) => s.startSession);
  const setFocusOpen = useSession((s) => s.setFocusOpen);
  const activeSession = useSession((s) => s.active);

  // 60s tick so the "now" line keeps moving
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      if (!document.hidden) tick(t => t + 1);
    }, 60000);
    return () => clearInterval(i);
  }, []);

  // 6 AM – 12 AM window (same as Study tab CurrentBlockCard)
  const DAY_START = 6;
  const DAY_HOURS = 18;
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const pct = (h: number) => ((h - DAY_START) / DAY_HOURS) * 100;
  const nowPct = pct(nowHour);

  const fmtTime = (h: number) => {
    const hr = ((h % 24) + 11) % 12 + 1;
    const ap = h < 12 || h >= 24 ? 'AM' : 'PM';
    return `${hr}:00 ${ap}`;
  };

  const current = slots.find(s => nowHour >= s.startHour && nowHour < s.endHour) || null;
  const next = slots.find(s => s.startHour > nowHour) || null;
  const featured = next || current;
  const featuredColor = featured ? subjectColor(featured.subject) : null;

  const handleStart = (slot: TimetableSlot) => {
    vibrate(12);
    startSession({
      targetId: null,
      subject: slot.subject,
      chapter: 'Timetable',
      topic: `${slot.subject} (scheduled)`,
      mode: 'focus',
      expectedMinutes: Math.round((slot.endHour - slot.startHour) * 60),
    });
    setFocusOpen(true);
  };

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: 'color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[13px]">📅</span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.8px]" style={{ color: 'var(--foreground)' }}>Today's Schedule</span>
        <span
          className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          {slots.length} block{slots.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline rail */}
      <div className="relative mx-1 mt-5 mb-1.5" suppressHydrationWarning>
        <div className="h-3.5 rounded-full relative overflow-hidden" style={{ background: 'var(--muted)' }}>
          {slots.map((slot) => {
            const color = subjectColor(slot.subject);
            const left = Math.max(0, pct(slot.startHour));
            const right = Math.min(100, pct(slot.endHour));
            const width = Math.max(0, right - left);
            if (width <= 0) return null;
            const isActive = current?.id === slot.id;
            return (
              <div
                key={slot.id}
                className="absolute top-0 h-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  borderRadius: 4,
                  background: `linear-gradient(180deg, ${color.hex}, ${color.hex}cc)`,
                  boxShadow: isActive ? `0 0 10px ${color.hex}` : 'none',
                }}
              />
            );
          })}
        </div>
        {/* Now line (inside window only) */}
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="absolute top-[-3px] bottom-[-3px] z-10"
            style={{ left: `${nowPct}%`, width: 2, background: 'var(--foreground)', boxShadow: '0 0 6px var(--foreground)', borderRadius: 1 }}
          >
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{ background: 'var(--foreground)', boxShadow: '0 0 8px var(--foreground)', animation: 'pulse-soft 1.6s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between px-1 text-[8px] font-bold" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
        <span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
      </div>

      {/* Next-up / now row */}
      {featured && featuredColor && (
        <div
          className="mt-3 rounded-xl p-2.5 flex items-center gap-2.5"
          style={{ background: 'var(--muted)', border: `1px solid ${featuredColor.hex}33` }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: featuredColor.hex,
              boxShadow: `0 0 6px ${featuredColor.hex}`,
              animation: current ? 'pulse-soft 1.6s ease-in-out infinite' : 'none',
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold leading-tight truncate" style={{ color: 'var(--foreground)' }} suppressHydrationWarning>
              {current ? 'Now: ' : 'Next: '}{featured.subject}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>
              {current
                ? `until ${fmtTime(featured.endHour)}`
                : `at ${fmtTime(featured.startHour)} · ${featured.endHour - featured.startHour}h`}
            </div>
          </div>
          {!current && !activeSession && (
            <button
              onClick={() => handleStart(featured)}
              className="px-3.5 py-1.5 rounded-full text-[10px] font-extrabold text-white shrink-0 active:scale-95 transition"
              style={{
                background: `linear-gradient(135deg, ${featuredColor.hex}, ${featuredColor.hex}cc)`,
                boxShadow: `0 4px 12px -2px ${featuredColor.hex}66`,
              }}
            >
              Start
            </button>
          )}
        </div>
      )}
    </div>
  );
}
'''

DAILY_VITALS = r'''/* =========================================================================
   DAILY VITALS (REDESIGNED — was the tall "Sleep & Energy + Doubts" card)
   8. Three compact tiles: Sleep / Energy / Doubts (~40% shorter)
   9. Zero functionality lost: tap sleep -> report (or log when no history),
      long-press -> report, NEET-logo sleep start untouched, energy inline
      picker, doubts navigation, Sleep Plan pill preserved.
   ========================================================================= */
function DailyVitalsCard({ onOpenSleepLog, onOpenReport, onOpenPlan }: {
  onOpenSleepLog: () => void;
  onOpenReport: () => void;
  onOpenPlan: () => void;
}) {
  // === HEAT FIX: Gate animations when tab hidden ===
  const isVisible = useVisibility();
  const reduceMotion = useReducedMotion();
  const animate = isVisible && !reduceMotion;

  const dailyLogState = useDailyLog((s) => s);
  const todayLog = useMemo(() => dailyLogState.getToday(), [dailyLogState]);
  const allDoubts = useDoubts((s) => s.doubts);
  const pendingDoubts = useMemo(() => allDoubts.filter(d => d.status === 'pending').length, [allDoubts]);
  const resolvedDoubts = useMemo(() => allDoubts.filter(d => d.status === 'resolved').length, [allDoubts]);
  const sleepHistory = useSleep((s) => s.history);
  const activeSleep = useSleep((s) => s.activeSleep);
  const setEnergy = useDailyLog((s) => s.setEnergy);
  const [showEnergyPicker, setShowEnergyPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todaySleepSec = useMemo(() => {
    const today = todayKey();
    return sleepHistory.filter(s => s.date === today).reduce((a, s) => a + (s.durationSec || 0), 0);
  }, [sleepHistory]);
  const avgSleepHours = useMemo(() => {
    if (sleepHistory.length === 0) return 0;
    const last7 = sleepHistory.slice(0, 7);
    return last7.reduce((a, s) => a + (s.durationSec || 0), 0) / 3600 / Math.min(7, last7.length);
  }, [sleepHistory]);

  const todaySleepHours = todaySleepSec / 3600;
  const hasTodaySleep = todaySleepSec > 0;
  const hasAnySleepHistory = sleepHistory.length > 0;
  const energyLevel = todayLog?.energyLevel ?? 0;
  const energyEmoji = energyLevel === 0 ? '➕' : energyLevel <= 1 ? '😫' : energyLevel === 2 ? '😦' : energyLevel === 3 ? '😐' : energyLevel === 4 ? '🙂' : '😄';
  const energyColor = energyLevel <= 2 ? '#dc2626' : energyLevel === 3 ? '#d97706' : '#16a34a';

  // Sleep tile tap = same semantics as the old sleep block
  const handleSleepTap = () => {
    if (activeSleep) return;
    if (hasAnySleepHistory) onOpenReport();
    else onOpenSleepLog();
  };

  // Sleep tile content by state
  const sleepTile = activeSleep
    ? { big: 'Sleeping', sub: 'logo to wake' }
    : hasTodaySleep
      ? { big: `${todaySleepHours.toFixed(1)}h`, sub: `avg ${avgSleepHours.toFixed(1)}h` }
      : todayLog
        ? { big: `${todayLog.sleepHours}h`, sub: 'manual' }
        : { big: '—', sub: hasAnySleepHistory ? 'tap for report' : 'tap to log' };

  return (
    <div
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(99,102,241,0.08), transparent 55%), color-mix(in oklch, var(--card) 80%, transparent)',
        border: '1px solid rgba(99,102,241,0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px]">🔋</span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.8px]" style={{ color: 'var(--foreground)' }}>Daily Vitals</span>
        <button
          onClick={() => onOpenPlan()}
          className="ml-auto text-[9px] px-2.5 py-1 rounded-full font-bold active:scale-95 transition"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}
        >
          Sleep Plan →
        </button>
      </div>

      {/* Three tiles */}
      <div className="grid grid-cols-3 gap-2">
        {/* Sleep tile */}
        <button
          onClick={handleSleepTap}
          onTouchStart={() => { longPressTimer.current = setTimeout(() => onOpenReport(), 500); }}
          onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          onTouchCancel={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">
            {activeSleep ? (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: animate ? Infinity : 0 }}
                className="inline-block"
              >
                💤
              </motion.span>
            ) : '😴'}
          </div>
          <div className="text-[13px] font-extrabold leading-none tabular-nums" style={{ color: '#818cf8' }} suppressHydrationWarning>
            {sleepTile.big}
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Sleep</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>{sleepTile.sub}</div>
        </button>

        {/* Energy tile */}
        <button
          onClick={() => { vibrate(8); setShowEnergyPicker(v => !v); }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: showEnergyPicker ? `1px solid ${energyColor}55` : '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">{energyEmoji}</div>
          <div
            className="text-[13px] font-extrabold leading-none"
            style={{ color: energyLevel > 0 ? energyColor : 'var(--muted-foreground)' }}
            suppressHydrationWarning
          >
            {energyLevel > 0 ? energyLevel : '?'}<span className="text-[9px] font-bold" style={{ color: 'var(--muted-foreground)' }}>/5</span>
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Energy</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{energyLevel > 0 ? 'tap to adjust' : 'tap to rate'}</div>
        </button>

        {/* Doubts tile */}
        <button
          onClick={() => { vibrate(8); window.dispatchEvent(new CustomEvent('navigate-doubts')); }}
          className="rounded-xl p-2.5 text-center active:scale-[0.97] transition"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div className="text-[14px] mb-0.5">❓</div>
          <div
            className="text-[13px] font-extrabold leading-none tabular-nums"
            style={{ color: pendingDoubts > 0 ? '#d97706' : 'var(--foreground)' }}
            suppressHydrationWarning
          >
            {pendingDoubts}
          </div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.8px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Doubts</div>
          <div className="text-[8px] mt-0.5" style={{ color: 'var(--muted-foreground)' }} suppressHydrationWarning>{resolvedDoubts} solved</div>
        </button>
      </div>

      {/* Inline energy picker (slides open on energy tile tap) */}
      <AnimatePresence>
        {showEnergyPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 pt-2.5">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const current = todayLog?.energyLevel ?? 0;
                const isFilled = lvl <= current;
                const fillColor = lvl <= 2 ? '#dc2626' : lvl === 3 ? '#d97706' : '#16a34a';
                return (
                  <button
                    key={lvl}
                    onClick={() => {
                      vibrate(6);
                      setEnergy(lvl);
                      setShowEnergyPicker(false);
                    }}
                    className="flex-1 py-2 rounded-lg text-base transition active:scale-95"
                    style={{
                      background: isFilled ? `${fillColor}20` : 'var(--muted)',
                      border: isFilled ? `1px solid ${fillColor}40` : '1px solid var(--border)',
                    }}
                  >
                    {lvl <= 1 ? '😫' : lvl === 2 ? '😦' : lvl === 3 ? '😐' : lvl === 4 ? '🙂' : '😄'}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
'''

JSX_ZONE = r'''      {/* === DAILY VITALS ZONE (redesigned) ===
          Order matches approved mockup: Subject Pulse -> Schedule timeline -> Vitals strip */}
      <motion.div {...cardEntrance} className="minimal-hide"><SubjectPulseCard /></motion.div>

      {todaySlots.length > 0 && (
        <motion.div {...cardEntrance} className="minimal-hide"><ScheduleStrip slots={todaySlots} /></motion.div>
      )}

      {/* Daily Vitals strip — sheets are rendered at top level to avoid transform positioning issues */}
      <motion.div {...cardEntrance} className="minimal-hide">
        <DailyVitalsCard
          onOpenSleepLog={() => setShowSleepLog(true)}
          onOpenReport={() => setShowSleepReport(true)}
          onOpenPlan={() => setShowSleepPlan(true)}
        />
      </motion.div>
'''

NEW_LUCIDE = "import { TrendingUp } from 'lucide-react';\n"

NEW_IMPORTS = (
    "import { useNav } from '@/lib/store/nav';\n"
    "import { subjectColor } from '@/lib/colors';\n"
    "import type { Subject, TimetableSlot } from '@/lib/types';\n"
)

# ---------------------------------------------------------------------------
# Splice 1: replace SubjectHealthCard (693-761) with SubjectPulseCard + helpers
# ---------------------------------------------------------------------------
expect(693, 'function SubjectHealthCard() {')
expect(761, '}')
lines[692:761] = [SUBJECT_PULSE_AND_HELPERS]

# ---------------------------------------------------------------------------
# Splice 2: replace SleepAndDoubtCard (532-691) with DailyVitalsCard
# ---------------------------------------------------------------------------
expect(532, 'function SleepAndDoubtCard(')
expect(691, '}')
lines[531:691] = [DAILY_VITALS]

# ---------------------------------------------------------------------------
# Splice 3: replace JSX usage zone (433-462)
# ---------------------------------------------------------------------------
expect(433, "{/* Today's Schedule */}")
expect(434, '{todaySlots.length > 0 && (')
expect(455, '{/* Sleep & Energy')
expect(457, '<SleepAndDoubtCard')
expect(462, '</motion.div>')
lines[432:462] = [JSX_ZONE]

# ---------------------------------------------------------------------------
# Splice 4: add new imports after line 23 (useTimetable import)
# ---------------------------------------------------------------------------
expect(23, "import { useTimetable } from '@/lib/store/timetable';")
lines[23:23] = [NEW_IMPORTS]

# ---------------------------------------------------------------------------
# Splice 5: replace lucide import (line 5, unchanged by splices above)
# ---------------------------------------------------------------------------
expect(5, "import { Target, TrendingUp, Calendar, FileText, Clock, Moon } from 'lucide-react';")
lines[4] = NEW_LUCIDE

with open(PATH, 'w') as f:
    f.writelines(lines)

print('Splices applied OK')
print(f'New file length: {len(lines)} lines')
