import type { ProcessGoal, Session } from '@pomofocus/types';
import { completionRate } from './completion-rate.js';
import { focusQualityDistribution } from './focus-quality.js';
import type { FocusQualityDistributionResult } from './focus-quality.js';
import { totalFocusTime } from './total-time.js';
import { peakFocusWindow } from './peak-window.js';
import type { PeakFocusWindowResult } from './peak-window.js';
import { perGoalBreakdown } from './per-goal.js';
import type { GoalBreakdownEntry } from './per-goal.js';

export { completionRate } from './completion-rate.js';
export { focusQualityDistribution } from './focus-quality.js';
export type { FocusQualityDistributionResult } from './focus-quality.js';
export { totalFocusTime } from './total-time.js';
export { peakFocusWindow } from './peak-window.js';
export type { PeakFocusWindowResult } from './peak-window.js';
export { perGoalBreakdown } from './per-goal.js';
export type { GoalBreakdownEntry } from './per-goal.js';

export type TierTwoResult = {
  readonly completionRate: number;
  readonly focusQuality: FocusQualityDistributionResult;
  readonly totalFocusMinutes: number;
  readonly peakFocusWindow: PeakFocusWindowResult | null;
  readonly perGoal: readonly GoalBreakdownEntry[];
  readonly sessionCount: number;
};

/**
 * Compose all Tier 2 metrics into a single WeeklyResponse shape.
 *
 * Cold-start: returns null when 0 completed sessions all-time
 * (Tier 2 threshold per ADR-014).
 *
 * Individual metrics handle sparse data independently — e.g.,
 * peakFocusWindow needs >= 5 sessions with focus_quality data.
 */
export function tierTwoMetrics(
  sessions: readonly Session[],
  goals: readonly ProcessGoal[],
): TierTwoResult | null {
  const hasCompletedSession = sessions.some((s) => s.completed);

  if (!hasCompletedSession) {
    return null;
  }

  return {
    completionRate: completionRate(sessions),
    focusQuality: focusQualityDistribution(sessions),
    totalFocusMinutes: totalFocusTime(sessions),
    peakFocusWindow: peakFocusWindow(sessions),
    perGoal: perGoalBreakdown(sessions, goals),
    sessionCount: sessions.length,
  };
}
