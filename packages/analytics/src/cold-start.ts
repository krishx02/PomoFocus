import type { Session } from '@pomofocus/types';

/**
 * Analytics tier identifiers for cold-start threshold checks.
 *
 * Using `as const` object + derived union per U-010.
 */
export const ANALYTICS_TIER = {
  TIER_1: 'tier1',
  TIER_2: 'tier2',
  TIER_3: 'tier3',
} as const;

export type AnalyticsTier =
  (typeof ANALYTICS_TIER)[keyof typeof ANALYTICS_TIER];

/**
 * Check whether the user has sufficient data for a given analytics tier.
 *
 * Thresholds (from ADR-014 + domain gap closures):
 * - Tier 1: always valid — glanceable metrics work from day zero.
 * - Tier 2: >= 1 completed session all-time.
 * - Tier 3: >= 2 distinct calendar months (UTC), each with >= 1 completed
 *   session. Months need not be consecutive (Jan + Mar is valid).
 */
export function hasSufficientData(
  sessions: readonly Session[],
  tier: AnalyticsTier,
): boolean {
  switch (tier) {
    case 'tier1':
      return true;

    case 'tier2':
      return sessions.some((s) => s.completed);

    case 'tier3': {
      const monthsWithData = new Set<string>();
      for (const s of sessions) {
        if (s.completed && s.started_at) {
          // Extract YYYY-MM from the ISO timestamp
          monthsWithData.add(s.started_at.slice(0, 7));
        }
      }
      return monthsWithData.size >= 2;
    }

    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}
