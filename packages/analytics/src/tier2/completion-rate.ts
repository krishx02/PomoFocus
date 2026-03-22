import type { Session } from '@pomofocus/types';

/**
 * Completion rate: completed / (total - had_to_stop).
 * Returns 0 when denominator is 0 (cold start or all had_to_stop).
 * NULL abandonment_reason on incomplete sessions is treated as gave_up
 * (counts against completion rate).
 * Range: 0-1.
 */
export function completionRate(sessions: readonly Session[]): number {
  const hadToStopCount = sessions.filter(
    (s) => s.abandonment_reason === 'had_to_stop',
  ).length;

  const denominator = sessions.length - hadToStopCount;

  if (denominator <= 0) {
    return 0;
  }

  const completedCount = sessions.filter((s) => s.completed).length;

  return completedCount / denominator;
}
