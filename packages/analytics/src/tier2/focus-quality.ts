import type { Session } from '@pomofocus/types';

export type FocusQualityDistributionResult = {
  readonly lockedIn: number;
  readonly decent: number;
  readonly struggled: number;
};

/**
 * Focus quality distribution: count per focus_quality enum value.
 * Only includes completed sessions that have reflection data (focus_quality !== null).
 * Returns { lockedIn: 0, decent: 0, struggled: 0 } when no qualifying sessions exist.
 */
export function focusQualityDistribution(
  sessions: readonly Session[],
): FocusQualityDistributionResult {
  const result = { lockedIn: 0, decent: 0, struggled: 0 };

  for (const session of sessions) {
    if (!session.completed || session.focus_quality === null) {
      continue;
    }

    switch (session.focus_quality) {
      case 'locked_in':
        result.lockedIn++;
        break;
      case 'decent':
        result.decent++;
        break;
      case 'struggled':
        result.struggled++;
        break;
      default: {
        const _exhaustive: never = session.focus_quality;
        return _exhaustive;
      }
    }
  }

  return result;
}
