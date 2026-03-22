import type { FocusQuality, Session } from '@pomofocus/types';

/** Minimum sessions with focus_quality data required for a meaningful result. */
const MIN_SESSIONS_WITH_QUALITY = 5;

/** Number of 2-hour buckets in a day (0-2, 2-4, ..., 22-24). */
const BUCKET_COUNT = 12;

const QUALITY_SCORE = {
  locked_in: 3,
  decent: 2,
  struggled: 1,
} as const satisfies Record<FocusQuality, number>;

export type PeakFocusWindowResult = {
  readonly hour: number;
  readonly avgQuality: number;
};

/**
 * Finds the 2-hour time-of-day bucket with the highest average focus quality.
 *
 * Returns null if fewer than MIN_SESSIONS_WITH_QUALITY sessions have
 * focus_quality data overall (not per bucket).
 *
 * The returned `hour` is the start of the 2-hour bucket (0, 2, 4, ..., 22).
 */
export function peakFocusWindow(
  sessions: readonly Session[],
): PeakFocusWindowResult | null {
  const bucketTotals = new Array<number>(BUCKET_COUNT).fill(0);
  const bucketCounts = new Array<number>(BUCKET_COUNT).fill(0);
  let qualifiedSessionCount = 0;

  for (const session of sessions) {
    if (session.focus_quality === null) {
      continue;
    }

    qualifiedSessionCount++;
    const hour = new Date(session.started_at).getUTCHours();
    const bucketIndex = Math.floor(hour / 2);
    const score = QUALITY_SCORE[session.focus_quality];

    bucketTotals[bucketIndex] = (bucketTotals[bucketIndex] ?? 0) + score;
    bucketCounts[bucketIndex] = (bucketCounts[bucketIndex] ?? 0) + 1;
  }

  if (qualifiedSessionCount < MIN_SESSIONS_WITH_QUALITY) {
    return null;
  }

  let bestBucket = -1;
  let bestAvg = -1;

  for (let i = 0; i < BUCKET_COUNT; i++) {
    const count = bucketCounts[i] ?? 0;
    if (count === 0) {
      continue;
    }
    const avg = (bucketTotals[i] ?? 0) / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestBucket = i;
    }
  }

  if (bestBucket === -1) {
    return null;
  }

  return {
    hour: bestBucket * 2,
    avgQuality: bestAvg,
  };
}
