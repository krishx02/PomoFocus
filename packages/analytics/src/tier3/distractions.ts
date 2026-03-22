import type { DistractionType, Session } from '@pomofocus/types';
import type { DistractionPattern, GoalBreakdown } from './types.js';

/**
 * Find the most common distraction type among struggled sessions.
 *
 * Only considers sessions where focus_quality = 'struggled' and
 * distraction_type is not null. Returns null when no such sessions exist.
 */
export function distractionPatterns(
  sessions: readonly Session[],
): DistractionPattern {
  const counts = new Map<DistractionType, number>();

  for (const s of sessions) {
    if (s.focus_quality === 'struggled' && s.distraction_type !== null) {
      const current = counts.get(s.distraction_type) ?? 0;
      counts.set(s.distraction_type, current + 1);
    }
  }

  if (counts.size === 0) {
    return null;
  }

  let topEntry: { type: DistractionType; count: number } | null = null;

  for (const [type, count] of counts) {
    if (topEntry === null || count > topEntry.count) {
      topEntry = { type, count };
    }
  }

  return topEntry;
}

/**
 * Per-goal breakdown: sessions count and total focus minutes per process goal.
 *
 * Only counts completed sessions with both started_at and ended_at.
 */
export function perGoalBreakdown(
  sessions: readonly Session[],
): readonly GoalBreakdown[] {
  const goalMap = new Map<string, { sessions: number; focusMs: number }>();

  for (const s of sessions) {
    if (s.completed && s.started_at && s.ended_at) {
      const existing = goalMap.get(s.process_goal_id) ?? {
        sessions: 0,
        focusMs: 0,
      };
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at).getTime();
      goalMap.set(s.process_goal_id, {
        sessions: existing.sessions + 1,
        focusMs: existing.focusMs + (end - start),
      });
    }
  }

  const result: GoalBreakdown[] = [];
  for (const [goalId, data] of goalMap) {
    result.push({
      goalId,
      sessions: data.sessions,
      focusMinutes: data.focusMs / (1000 * 60),
    });
  }

  return result;
}
