import type { Session } from '@pomofocus/types';

/**
 * Sum of (ended_at - started_at) for completed sessions, in minutes.
 * Only includes sessions where completed === true and ended_at is not null.
 */
export function totalFocusTime(sessions: readonly Session[]): number {
  let totalMs = 0;

  for (const session of sessions) {
    if (!session.completed || session.ended_at === null) {
      continue;
    }

    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const diff = end - start;

    if (diff > 0) {
      totalMs += diff;
    }
  }

  return totalMs / 60_000;
}
