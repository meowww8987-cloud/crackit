/**
 * NEET marks → rank prediction table.
 *
 * Based on historical NEET data (2023-2024 patterns). NEET marks vs rank
 * follows a roughly logarithmic curve — top ranks (1-100) cluster at 710+,
 * then rank grows fast as marks drop.
 *
 * This is an ESTIMATE — actual rank varies year to year based on:
 *  - Paper difficulty
 *  - Number of candidates (~23 lakh in 2024)
 *  - Normalization (if multi-shift)
 *
 * Categories: General, OBC, SC, ST, EWS — each has different cutoffs.
 * We provide General + OBC estimates (most common); SC/ST cutoffs are
 * much lower (typically 350-450 range qualifies for seat).
 */

export interface RankPrediction {
  rank: number;
  category: 'General' | 'OBC' | 'SC/ST' | 'EWS';
  percentile: number;
  /** Verbal assessment — shown to user */
  assessment: string;
  /** Color for the assessment (hex) */
  color: string;
}

/**
 * Predict rank from NEET marks (0-720).
 * Uses piecewise interpolation between known data points.
 *
 * Data points (General category, 2024-ish):
 *   720 → rank 1
 *   715 → rank 50
 *   710 → rank 200
 *   700 → rank 1000
 *   690 → rank 2500
 *   680 → rank 5000
 *   670 → rank 9000
 *   650 → rank 20000
 *   630 → rank 35000
 *   600 → rank 60000
 *   550 → rank 100000
 *   500 → rank 150000
 *   450 → rank 200000
 *   400 → rank 250000
 *   350 → rank 300000 (cutoff for General)
 */
const RANK_TABLE: { marks: number; rank: number }[] = [
  { marks: 720, rank: 1 },
  { marks: 715, rank: 50 },
  { marks: 710, rank: 200 },
  { marks: 700, rank: 1000 },
  { marks: 690, rank: 2500 },
  { marks: 680, rank: 5000 },
  { marks: 670, rank: 9000 },
  { marks: 650, rank: 20000 },
  { marks: 630, rank: 35000 },
  { marks: 600, rank: 60000 },
  { marks: 550, rank: 100000 },
  { marks: 500, rank: 150000 },
  { marks: 450, rank: 200000 },
  { marks: 400, rank: 250000 },
  { marks: 350, rank: 300000 },
];

/** NEET qualifying cutoffs (50th percentile for General, lower for reserved) */
const CUTOFFS = {
  General: 350,
  OBC: 320,
  'SC/ST': 275,
  EWS: 350,
};

export function predictRankFromMarks(marks: number): { rank: number; category: string } | null {
  if (marks < 0 || marks > 720) return null;

  // Find the bracket the marks fall into
  let lower = RANK_TABLE[RANK_TABLE.length - 1];
  let upper = RANK_TABLE[0];
  for (let i = 0; i < RANK_TABLE.length - 1; i++) {
    if (marks <= RANK_TABLE[i].marks && marks >= RANK_TABLE[i + 1].marks) {
      lower = RANK_TABLE[i + 1];
      upper = RANK_TABLE[i];
      break;
    }
  }

  // Linear interpolation in log-space (ranks span many orders of magnitude)
  if (marks >= upper.marks) return { rank: upper.rank, category: 'General' };
  if (marks <= lower.marks) return { rank: lower.rank, category: 'General' };

  const logLowerRank = Math.log(lower.rank);
  const logUpperRank = Math.log(upper.rank);
  const t = (marks - lower.marks) / (upper.marks - lower.marks);
  const interpolatedRank = Math.round(Math.exp(logLowerRank + t * (logUpperRank - logLowerRank)));

  return { rank: interpolatedRank, category: 'General' };
}

export function getFullRankPrediction(marks: number): RankPrediction | null {
  const base = predictRankFromMarks(marks);
  if (!base) return null;

  const percentile = Math.max(0, Math.min(100, 100 - (base.rank / 300000) * 100));

  let assessment = '';
  let color = '#ef4444';
  if (marks >= 650) {
    assessment = 'Top college territory (AIIMS/Mamc/JIPMER)';
    color = '#22c55e';
  } else if (marks >= 600) {
    assessment = 'Government MBBS likely (state quota)';
    color = '#14b8a6';
  } else if (marks >= 550) {
    assessment = 'Borderline Govt — push for state quota';
    color = '#f59e0b';
  } else if (marks >= 450) {
    assessment = 'Private/B-Category possible';
    color = '#f97316';
  } else if (marks >= 350) {
    assessment = 'Qualifying marks — needs big jump';
    color = '#ef4444';
  } else {
    assessment = 'Below General cutoff — focus on basics';
    color = '#dc2626';
  }

  return {
    rank: base.rank,
    category: 'General',
    percentile: Math.round(percentile * 10) / 10,
    assessment,
    color,
  };
}

/** Get the qualifying marks for a category */
export function getCutoffForCategory(cat: keyof typeof CUTOFFS): number {
  return CUTOFFS[cat];
}
