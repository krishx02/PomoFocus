import type { Session } from '@pomofocus/types';
import type { MonthlyResponse } from './types.js';
import { hasSufficientData } from '../cold-start.js';
import { monthlyTrends } from './trends.js';
import { distractionPatterns, perGoalBreakdown } from './distractions.js';

export type {
  TrendResult,
  DistractionPattern,
  GoalBreakdown,
  MonthlyResponse,
} from './types.js';
export {
  consistencyTrend,
  completionTrend,
  focusQualityTrend,
  totalTimeTrend,
  monthlyTrends,
} from './trends.js';
export { distractionPatterns, perGoalBreakdown } from './distractions.js';

/**
 * Compose all Tier 3 analytics into the MonthlyResponse shape.
 *
 * Returns null when cold-start conditions are not met:
 * requires >= 2 calendar months each with >= 1 completed session
 * (months need not be consecutive).
 *
 * The `allSessions` parameter is the user's full session history,
 * used for cold-start checking. `currentMonthSessions` and
 * `prevMonthSessions` are the filtered subsets for the two months
 * being compared.
 */
export function tierThreeMetrics(
  allSessions: readonly Session[],
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
  currentMonthDays: number,
  prevMonthDays: number,
): MonthlyResponse | null {
  if (!hasSufficientData(allSessions, 'tier3')) {
    return null;
  }

  const trends = monthlyTrends(
    currentMonthSessions,
    prevMonthSessions,
    currentMonthDays,
    prevMonthDays,
  );

  // monthlyTrends returns null when either month lacks completed sessions.
  // This is a stricter per-month check on top of the cold-start gate.
  if (trends === null) {
    return null;
  }

  return {
    trends,
    topDistraction: distractionPatterns(currentMonthSessions),
    perGoal: perGoalBreakdown(currentMonthSessions),
  };
}
