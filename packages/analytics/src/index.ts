// Component metrics: completion rate, focus quality, consistency, streaks, trends.
// Pure functions only — no IO, no React, no Supabase.
export { weeklyConsistency, tierOneMetrics } from './tier1/index.js';
export type { TierOneResult } from './tier1/index.js';
export { completionRate } from './tier2/completion-rate.js';
export { focusQualityDistribution } from './tier2/focus-quality.js';
export type { FocusQualityDistributionResult } from './tier2/focus-quality.js';
export { totalFocusTime } from './tier2/index.js';
export { peakFocusWindow } from './tier2/index.js';
export type { PeakFocusWindowResult } from './tier2/index.js';
export { perGoalBreakdown } from './tier2/index.js';
export type { GoalBreakdownEntry } from './tier2/index.js';

// ── Tier 3: Monthly trends ──
export type { TrendResult, DistractionPattern, GoalBreakdown } from './tier3/index.js';
export {
  consistencyTrend,
  completionTrend,
  focusQualityTrend,
  totalTimeTrend,
  monthlyTrends,
  distractionPatterns,
  perGoalBreakdown as perGoalMonthlyBreakdown,
} from './tier3/index.js';
