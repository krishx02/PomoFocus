// Component metrics: completion rate, focus quality, consistency, streaks, trends.
// Pure functions only — no IO, no React, no Supabase.
export { weeklyConsistency } from './tier1/index.js';
export { completionRate } from './tier2/completion-rate.js';
export { focusQualityDistribution } from './tier2/focus-quality.js';
export type { FocusQualityDistributionResult } from './tier2/focus-quality.js';
