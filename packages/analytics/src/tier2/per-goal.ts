import type { ProcessGoal, Session } from '@pomofocus/types';

export type GoalBreakdownEntry = {
  readonly goalId: string;
  readonly goalTitle: string;
  readonly sessions: number;
  readonly focusMinutes: number;
};

/**
 * Groups sessions by process_goal_id and computes per-goal session count
 * and total focus minutes. Only completed sessions with ended_at contribute
 * to focusMinutes; all sessions (completed or not) count toward sessions.
 *
 * Goals with zero matching sessions are omitted from the result.
 */
export function perGoalBreakdown(
  sessions: readonly Session[],
  goals: readonly ProcessGoal[],
): readonly GoalBreakdownEntry[] {
  const goalMap = new Map<string, { title: string; count: number; ms: number }>();

  for (const goal of goals) {
    goalMap.set(goal.id, { title: goal.title, count: 0, ms: 0 });
  }

  for (const session of sessions) {
    let entry = goalMap.get(session.process_goal_id);

    if (entry === undefined) {
      entry = { title: session.process_goal_id, count: 0, ms: 0 };
      goalMap.set(session.process_goal_id, entry);
    }

    entry.count++;

    if (session.completed && session.ended_at !== null) {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.ended_at).getTime();
      const diff = end - start;

      if (diff > 0) {
        entry.ms += diff;
      }
    }
  }

  const result: GoalBreakdownEntry[] = [];

  for (const [goalId, entry] of goalMap) {
    if (entry.count === 0) {
      continue;
    }

    result.push({
      goalId,
      goalTitle: entry.title,
      sessions: entry.count,
      focusMinutes: entry.ms / 60_000,
    });
  }

  return result;
}
