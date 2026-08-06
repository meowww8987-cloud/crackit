// ===== Core Types for NEET 2027 Study Tracker =====

export type Subject = 'Physics' | 'Chemistry' | 'Botany' | 'Zoology' | 'General';

export type ActivityType = 'Lecture' | 'DPP' | 'Notes' | 'Revision' | 'Custom';

export type SessionMode = 'focus' | 'free';

export type Mood = 'confident' | 'okay' | 'struggling' | 'tired';

export type SessionStatus = 'studying' | 'paused' | 'wasting' | 'done';

export interface Target {
  id: string;
  date: string; // YYYY-MM-DD
  subject: Subject;
  activity: ActivityType;
  chapter: string;
  lecture?: string;
  topic: string;
  expectedMinutes: number;
  order: number;
  done: boolean;
  // linked syllabus lecture id (optional)
  lectureId?: string;
  // linked syllabus chapter id (optional — for chapter-level targets)
  chapterId?: string;
  // true if this is a chapter-level target (not a specific lecture)
  isChapterTarget?: boolean;
  createdAt: number;
}

export interface ActiveSession {
  targetId: string | null; // null = free study
  subject: Subject;
  chapter: string;
  lecture?: string;
  topic: string;
  mode: SessionMode;
  expectedMinutes?: number;
  studySeconds: number;
  wastedSeconds: number;
  paused: boolean;
  wasting: boolean;
  lastResumeAt: number | null; // ms timestamp
  lastWasteStart: number | null; // ms timestamp
  startedAt: number;
  lastWasteThreshold: number; // last 30s boundary crossed
  // Cumulative study/wasted seconds already logged for this target earlier today.
  // Used to continue the timer from where the user left off when restarting a session
  // for the same target on the same day. The current session's own time (studySeconds)
  // is added on top of this baseline for display only; saved sessions only record the delta.
  baselineStudySeconds?: number;
  baselineWastedSeconds?: number;
}

export interface SavedSession {
  id: string;
  targetId: string | null;
  subject: Subject;
  chapter: string;
  lecture?: string;
  topic: string;
  mode: SessionMode;
  studySeconds: number;
  wastedSeconds: number;
  mood: Mood | null;
  startedAt: number;
  endedAt: number;
  date: string; // YYYY-MM-DD
}

// ===== Syllabus =====

export interface Lecture {
  id: string;
  chapterId: string;
  lecNo: number; // 1, 2, 3... or -1 for custom
  isCustom: boolean;
  topic: string;
  date?: string;
  done: boolean; // lecture watched
  dppDone: boolean; // DPP solved
  notesDone: boolean; // notes made
  revisionDone: boolean; // revision done
  hardness: number; // 1-5
  pyqCount: number;
  // spaced repetition
  revisionStage: number; // -1 = not started, 0..4 = intervals index
  lastRevisedAt?: number;
  nextRevisionAt?: number;
  notes?: string;
  weightage?: number;
  createdAt: number;
  // Per-lecture study stats (accumulated from all sessions linked to this lecture)
  timeSpentSec?: number; // total study seconds
  timeWastedSec?: number; // total wasted seconds
  confidence?: number; // 1-5 (1=Very low, 5=Very high)
  doneDate?: number; // timestamp when lecture was marked done
}

export type LectureResource = 'lecture' | 'dpp' | 'notes' | 'revision';

export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  pyqCount: number;
  createdAt: number;
  order?: number; // for drag-to-reorder
}

export interface SubjectEntity {
  id: string;
  name: Subject;
  order: number;
  createdAt: number;
}

// ===== Tests =====

export type TestType =
  | 'Part Test'
  | 'Full Syllabus'
  | 'Rank Booster'
  | 'AITS'
  | 'PYQ Mock'
  | 'Chapter Test'
  | 'Subject Test'
  | 'Custom';

/**
 * Coaching source — which institute's test it was.
 * Used for filtering, leaderboard grouping, and PW/Allen/Aakash/Vibrant
 * students can track their institute's test series separately.
 */
export type CoachingSource =
  | 'Self'
  | 'Allen'
  | 'Aakash'
  | 'PW (Physics Wallah)'
  | 'Vibrant'
  | 'Motion'
  | 'Narayana'
  | 'Sri Chaitanya'
  | 'Career Point'
  | 'Resonance'
  | 'Other';

export interface SubjectAnalytics {
  attempted: number;
  correct: number;
  wrong: number;
  timeSpent: number; // minutes
  sillyMistakes: number;
  confidence: number; // 1-5
  marks: number; // out of 180
}

export interface Test {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: TestType;
  /** Which coaching institute's test (Allen, Aakash, PW, etc.) — 'Self' for self-mock. */
  coachingSource?: CoachingSource;
  totalMarks?: number; // out of 720
  subjectMarks?: Record<Subject, number>;
  strongTopics?: string;
  weakTopics?: string;
  notes?: string;
  analytics?: Record<Subject, SubjectAnalytics>;
  hasAnalytics: boolean;
  createdAt: number;
  // Syllabus covered by this test (chapters + lectures in user's syllabus).
  // For Full Syllabus type, this defaults to all chapters at add-time but
  // can be edited. Used for readiness calculations on Home tab.
  syllabus?: {
    chapterIds: string[]; // references syllabus store chapter IDs
    lectureIds: string[]; // optional lecture-level granularity
  };
  // When the user actually started taking the test (timestamp).
  // Used for behavior pattern detection (time-of-day effect on score).
  // Set when result is saved; if absent, falls back to date 00:00.
  takenAt?: number;
  // Per-chapter accuracy after results — populated by post-test syllabus sync.
  // Keyed by syllabus chapter ID. Value = correct/total questions in that chapter.
  chapterAccuracy?: Record<string, { correct: number; total: number }>;

  // === Test timer state ===
  /** Total test duration in minutes (default 200 = 3h20m for NEET). */
  duration?: number;
  /** Test timer state — 'not_started' | 'running' | 'paused' | 'completed'. */
  timerState?: 'not_started' | 'running' | 'paused' | 'completed';
  /** Timestamp when timer was started (most recent start/resume). */
  timerStartedAt?: number;
  /** Total elapsed seconds accumulated across pause/resume cycles. */
  timerElapsedSec?: number;
  /** Total pause time in seconds (used for analytics — too much pause = distraction). */
  timerPausedSec?: number;

  // === AI/Analytics fields ===
  /** Predicted NEET rank based on marks (computed from historical data). */
  predictedRank?: { rank: number; category: string };
  /** Auto-generated revision plan (7-day) keyed by day offset 0-6. */
  revisionPlan?: { day: number; targets: { subject: Subject; chapter: string; topic: string; minutes: number }[] }[];

  // === Paper Test Companion state ===
  // When a user takes a paper-based test, this tracks per-question timing,
  // answers, and flags. Activated via long-press on Tests tab.
  paperTest?: {
    /** Questions array (length = questionCount from config) */
    questions: PaperQuestion[];
    /** Current question index */
    currentIdx: number;
    /** Test start timestamp */
    startedAt: number;
    /** Test end timestamp (null while in progress) — set when endPaperTest is called.
        Critical: without this, the summary screen keeps computing growing elapsed time. */
    endedAt: number | null;
    /** Total paused time in seconds */
    pausedSec: number;
    /** Whether currently paused */
    isPaused: boolean;
    /** When pause started (timestamp) — null if not paused */
    pausedAt: number | null;
    /** Whether the paper test has been ended (summary shown) */
    ended: boolean;
    /** Configuration used to start this test */
    config?: PaperTestConfig;
    /** Extra time used in seconds (tracked separately from main duration) */
    extraTimeUsedSec?: number;
  };
}

/** Configurable paper test parameters — set before starting a test. */
export interface PaperTestConfig {
  /** Number of questions (default 180, NEET standard). Can be 60/100/180/custom. */
  questionCount: number;
  /** Test duration in minutes (default 200 = 3h20m for 180 Q) */
  durationMin: number;
  /**
   * Default time per question in seconds. Every question starts with this
   * timer. If a question needs more time, user taps "+30s" during the test
   * to extend THAT question only (tracked per-question, not carried over).
   * Default = Math.floor(durationMin * 60 / questionCount).
   */
  defaultSecPerQuestion: number;
  /** Marks per correct answer (default 4, NEET standard) */
  marksPerCorrect: number;
  /** Negative marks per wrong answer (default 1, NEET standard) */
  negativePerWrong: number;
  /** Whether subject sections are enabled (auto-alerts at section boundaries) */
  sectionsEnabled: boolean;
}

export interface PaperQuestion {
  /** Question number 1-180 */
  number: number;
  /** Subject — Physics (1-45), Chemistry (46-90), Botany (91-135), Zoology (136-180) */
  subject: Subject;
  /** User's answer — A/B/C/D, or null if skipped/not answered */
  answer: 'A' | 'B' | 'C' | 'D' | null;
  /** Correct answer (from answer key) — A/B/C/D, or null if not yet scored */
  correctAnswer: 'A' | 'B' | 'C' | 'D' | null;
  /** Flagged for review */
  flagged: boolean;
  /** Time spent on this question in seconds (accumulated across visits) */
  timeSpentSec: number;
  /** Timestamp when this question became current (for active timing) */
  startedAt: number | null;
  /** Extra seconds added on-demand by user for THIS question only (via +30s button) */
  extraSecAdded?: number;
  /** Optional question text — user can type or paste the question here for future reference */
  questionText?: string;
  /** Optional text note ("used formula X", "tricky concept", etc.) */
  note?: string;
  /** Optional photo of the question (base64 JPEG, compressed to max 800px) */
  photo?: string;
}

// ===== Active Recall =====

export type RecallRating = 'remembered' | 'forgot' | 'vague';

export interface RecallChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  topicIds: string[];
  results: Record<string, RecallRating>;
  retentionScore: number; // 0-100
  completedAt: number;
}

// ===== Partner =====

export interface Partner {
  code: string;
  name: string;
  pairedAt: number;
  shareChapter: boolean;
}

// ===== Settings =====

export interface Settings {
  dailyGoalHours: number; // 2-16
  targetScore: number; // 400-720
  examDate: string; // YYYY-MM-DD
  prepStartDate: string | null; // YYYY-MM-DD or null = auto
  pomodoroWork: number; // minutes 15-90
  pomodoroBreak: number; // minutes 5-30
  burnProtection: boolean;
  dimDelay: number; // seconds 3-30
  distractionTauntInterval: number; // minutes 0-15, 0 = off
  autoDetectWasted: boolean;
  appTheme: 'dark' | 'light' | 'warm' | 'ocean' | 'forest' | 'lavender' | 'rose' | 'gold';
  focusTheme: 'dark' | 'light' | 'warm' | 'ocean' | 'forest' | 'lavender' | 'rose' | 'gold';
  textSize: 'S' | 'M' | 'L' | 'XL';
  prefer2D: boolean;
  haptics: boolean;
  confettiEnabled: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0-100
  notificationsEnabled: boolean;
  notificationHistory: { title: string; body: string; timestamp: number }[];
  /**
   * 3D background mode.
   *  - 'auto'      : scene type auto-detected from active session subject + chapter (recommended)
   *  - 'atoms'     : Bohr-model atoms with orbiting electrons (Physics)
   *  - 'dna'       : rotating DNA double helix (Zoology)
   *  - 'molecules' : molecular structures — benzene, methane, water etc. (Chemistry)
   *  - 'cells'     : plant cells with organelles (Botany)
   *  - 'hybrid'    : mix of all four subject scenes (General / no session)
   *  - 'off'       : disable 3D, only the 2D aurora shows
   */
  bg3DMode: 'auto' | 'atoms' | 'dna' | 'molecules' | 'cells' | 'hybrid' | 'off';
  /**
   * Reduce animations — when true, disables spring bounces, particle bursts,
   * confetti, and uses instant transitions instead. Useful for users with
   * motion sensitivity, vestibular disorders, or low-end devices.
   * Also auto-enabled when the OS prefers-reduced-motion is set.
   */
  reduceAnimations: boolean;
  /**
   * Animation intensity 0-100. Controls how "loud" animations are:
   *  - 0-30  : subtle (minimal motion, quick transitions)
   *  - 31-70 : normal (default — balanced spring physics)
   *  - 71-100: lively (bouncier springs, longer durations, more particles)
   * Only applies when reduceAnimations is false.
   */
  animationIntensity: number;
  /**
   * Tutorial mode — when ON, shows one-time coach marks for every major
   * feature (study tab, tests tab, paper test, focus timer, etc.).
   * Each coach mark is shown once per session, tracked in localStorage.
   * Toggle in Settings → Appearance.
   */
  tutorialMode: boolean;
  /** Screen dimming opacity during focus timer (0-100). 0 = no dim, 100 = black. */
  screenDimOpacity: number;
  /** Allow landscape rotation in focus timer. */
  allowLandscape: boolean;
  /** Minimal mode — hides non-essential UI (streak, partner, coach, badges) */
  minimalMode: boolean;
  /** OLED Black — uses pure #000000 for dark mode backgrounds */
  oledBlack: boolean;
}

// ===== Timetable =====

export interface TimetableSlot {
  id: string;
  day: number; // 0=Sun, 6=Sat
  startHour: number; // 0-23
  endHour: number; // 1-24
  subject: Subject;
}

// ===== Smart Plan Suggestion =====

export interface SmartSuggestion {
  subject: Subject;
  activity: ActivityType;
  chapter: string;
  lecture?: string;
  topic: string;
  expectedMinutes: number;
  reason: string;
  lectureId?: string;
}
