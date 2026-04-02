// Component metrics: completion rate, focus quality, consistency, streaks, trends.
// Pure functions only — no IO, no React, no Supabase.
export { weeklyConsistency } from './tier1/index.js';
export { completionRate } from './tier2/completion-rate.js';
export { focusQualityDistribution } from './tier2/focus-quality.js';
export type { FocusQualityDistributionResult } from './tier2/focus-quality.js';
export { totalFocusTime } from './tier2/index.js';
export { peakFocusWindow } from './tier2/index.js';
export type { PeakFocusWindowResult } from './tier2/index.js';
export { perGoalBreakdown } from './tier2/index.js';
export type { GoalBreakdownEntry } from './tier2/index.js';
export { tierTwoMetrics } from './tier2/index.js';
export type { TierTwoResult } from './tier2/index.js';

// ── Tier 3: Monthly trends ──
export type { TrendResult, DistractionPattern, GoalBreakdown, MonthlyResponse } from './tier3/index.js';
export {
  consistencyTrend,
  completionTrend,
  focusQualityTrend,
  totalTimeTrend,
  monthlyTrends,
  distractionPatterns,
  perGoalBreakdown as perGoalMonthlyBreakdown,
  tierThreeMetrics,
} from './tier3/index.js';

// ── Cold-start thresholds ──
export { hasSufficientData, ANALYTICS_TIER } from './cold-start.js';
export type { AnalyticsTier } from './cold-start.js';
