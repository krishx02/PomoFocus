import type { SessionData } from '../session/types.js';
import { GOAL_STATUS } from './types.js';
import type { GoalProgress, ProcessGoal } from './types.js';

/**
 * Computes goal progress for active process goals.
 *
 * Pure function — no IO, no Date (PKG-C04). Day boundaries are provided
 * by the caller as ISO-8601 timestamps already adjusted to the user's timezone.
 *
 * @param goals - All process goals (active and inactive; inactive are filtered out).
 * @param sessions - All sessions (completed and incomplete; incomplete are filtered out).
 * @param todayStart - Inclusive lower bound (ISO-8601, start of day in user timezone).
 * @param todayEnd - Exclusive upper bound (ISO-8601, start of next day in user timezone).
 * @returns GoalProgress[] for each active goal, preserving input order.
 */
export function goalProgress(
  goals: readonly ProcessGoal[],
  sessions: readonly SessionData[],
  todayStart: string,
  todayEnd: string,
): readonly GoalProgress[] {
  const activeGoals = goals.filter((g) => g.status === GOAL_STATUS.ACTIVE);

  if (activeGoals.length === 0) {
    return [];
  }

  // Build a set of active goal IDs for fast lookup
  const activeGoalIds = new Set(activeGoals.map((g) => g.id));

  // Count completed sessions per goal within today's boundaries
  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (!session.completed) {
      continue;
    }
    if (!activeGoalIds.has(session.processGoalId)) {
      continue;
    }
    if (session.startedAt < todayStart || session.startedAt >= todayEnd) {
      continue;
    }

    const current = counts.get(session.processGoalId) ?? 0;
    counts.set(session.processGoalId, current + 1);
  }

  return activeGoals.map((goal) => ({
    goalId: goal.id,
    goalTitle: goal.title,
    completedToday: counts.get(goal.id) ?? 0,
    targetToday: goal.targetSessionsPerDay,
  }));
}
