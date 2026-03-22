import type { Session } from '@pomofocus/types';
import type { TrendResult } from './types.js';

/**
 * Count distinct calendar days (YYYY-MM-DD in UTC) that have at least one
 * completed session.
 */
function daysWithSessions(sessions: readonly Session[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.completed && s.started_at) {
      days.add(s.started_at.slice(0, 10));
    }
  }
  return days.size;
}

/**
 * Consistency trend: proportion of days with sessions in each month.
 *
 * Returns `{ current, previous }` where each value is 0-1 representing
 * days_with_sessions / total_days_in_month.
 */
export function consistencyTrend(
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
  currentMonthDays: number,
  prevMonthDays: number,
): TrendResult {
  const current = currentMonthDays > 0
    ? daysWithSessions(currentMonthSessions) / currentMonthDays
    : 0;
  const previous = prevMonthDays > 0
    ? daysWithSessions(prevMonthSessions) / prevMonthDays
    : 0;
  return { current, previous };
}

/**
 * Compute the completion rate for a set of sessions.
 *
 * Formula: completed / (total - had_to_stop). Returns 0 when denominator is 0.
 * Sessions with abandonment_reason = null are treated as gave_up (not excluded).
 */
function completionRate(sessions: readonly Session[]): number {
  const hadToStopCount = sessions.filter(
    (s) => s.abandonment_reason === 'had_to_stop',
  ).length;
  const denominator = sessions.length - hadToStopCount;
  if (denominator === 0) return 0;
  const completedCount = sessions.filter((s) => s.completed).length;
  return completedCount / denominator;
}

/**
 * Completion trend: completion rate for current month vs previous month.
 *
 * Returns `{ current, previous }` where each value is 0-1.
 */
export function completionTrend(
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
): TrendResult {
  return {
    current: completionRate(currentMonthSessions),
    previous: completionRate(prevMonthSessions),
  };
}

/**
 * Compute the percentage of completed sessions with focus_quality = 'locked_in'.
 */
function lockedInPercentage(sessions: readonly Session[]): number {
  const completed = sessions.filter((s) => s.completed);
  if (completed.length === 0) return 0;
  const lockedIn = completed.filter(
    (s) => s.focus_quality === 'locked_in',
  ).length;
  return lockedIn / completed.length;
}

/**
 * Focus quality trend: percentage of locked_in sessions, current vs previous month.
 *
 * Returns `{ current, previous }` where each value is 0-1.
 */
export function focusQualityTrend(
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
): TrendResult {
  return {
    current: lockedInPercentage(currentMonthSessions),
    previous: lockedInPercentage(prevMonthSessions),
  };
}

/**
 * Compute total focus time in hours for completed sessions.
 */
function totalHours(sessions: readonly Session[]): number {
  let totalMs = 0;
  for (const s of sessions) {
    if (s.completed && s.started_at && s.ended_at) {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at).getTime();
      totalMs += end - start;
    }
  }
  return totalMs / (1000 * 60 * 60);
}

/**
 * Total time trend: total focus hours, current vs previous month.
 *
 * Returns `{ current, previous }` where each value is in hours.
 */
export function totalTimeTrend(
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
): TrendResult {
  return {
    current: totalHours(currentMonthSessions),
    previous: totalHours(prevMonthSessions),
  };
}

/**
 * Aggregate all monthly trends. Returns null when cold-start conditions
 * are not met (requires >= 2 calendar months with data).
 *
 * Cold-start check: both currentMonthSessions and prevMonthSessions must
 * contain at least one completed session each.
 */
export function monthlyTrends(
  currentMonthSessions: readonly Session[],
  prevMonthSessions: readonly Session[],
  currentMonthDays: number,
  prevMonthDays: number,
): {
  consistency: TrendResult;
  completionRate: TrendResult;
  focusQuality: TrendResult;
  totalHours: TrendResult;
} | null {
  const currentHasData = currentMonthSessions.some((s) => s.completed);
  const prevHasData = prevMonthSessions.some((s) => s.completed);

  if (!currentHasData || !prevHasData) {
    return null;
  }

  return {
    consistency: consistencyTrend(
      currentMonthSessions,
      prevMonthSessions,
      currentMonthDays,
      prevMonthDays,
    ),
    completionRate: completionTrend(currentMonthSessions, prevMonthSessions),
    focusQuality: focusQualityTrend(
      currentMonthSessions,
      prevMonthSessions,
    ),
    totalHours: totalTimeTrend(currentMonthSessions, prevMonthSessions),
  };
}
