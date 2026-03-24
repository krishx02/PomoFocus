import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { tierThreeMetrics } from './index.js';

/** Helper to create a minimal session with overrides. */
function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    user_id: 'user-1',
    process_goal_id: 'goal-1',
    intention_text: null,
    started_at: '2026-03-10T09:00:00Z',
    ended_at: '2026-03-10T09:25:00Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: 'locked_in',
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-10T09:00:00Z',
    ...overrides,
  };
}

describe('tierThreeMetrics', () => {
  it('returns null when cold-start threshold is not met (< 2 months)', () => {
    const marSession = makeSession({
      completed: true,
      started_at: '2026-03-10T09:00:00Z',
    });
    const allSessions = [marSession];

    const result = tierThreeMetrics(allSessions, [marSession], [], 31, 28);
    expect(result).toBeNull();
  });

  it('returns null when cold-start passes but current month has no completed sessions', () => {
    // Cold-start passes: 2 months with data (Feb + Mar)
    const febSession = makeSession({
      completed: true,
      started_at: '2026-02-10T09:00:00Z',
    });
    const marSession = makeSession({
      completed: true,
      started_at: '2026-03-10T09:00:00Z',
    });
    const allSessions = [febSession, marSession];
    // But we pass empty current month
    const result = tierThreeMetrics(allSessions, [], [febSession], 31, 28);
    expect(result).toBeNull();
  });

  it('returns null when cold-start passes but previous month has no completed sessions', () => {
    const febSession = makeSession({
      completed: true,
      started_at: '2026-02-10T09:00:00Z',
    });
    const marSession = makeSession({
      completed: true,
      started_at: '2026-03-10T09:00:00Z',
    });
    const allSessions = [febSession, marSession];
    const result = tierThreeMetrics(allSessions, [marSession], [], 31, 28);
    expect(result).toBeNull();
  });

  it('returns full MonthlyResponse when sufficient data exists', () => {
    const febSession = makeSession({
      id: 'feb-1',
      completed: true,
      started_at: '2026-02-10T09:00:00Z',
      ended_at: '2026-02-10T09:25:00Z',
      focus_quality: 'decent',
    });
    const marSession = makeSession({
      id: 'mar-1',
      completed: true,
      started_at: '2026-03-10T09:00:00Z',
      ended_at: '2026-03-10T09:25:00Z',
      focus_quality: 'locked_in',
    });

    const allSessions = [febSession, marSession];
    const result = tierThreeMetrics(
      allSessions,
      [marSession],
      [febSession],
      31,
      28,
    );

    expect(result).not.toBeNull();
    if (result === null) return;

    // Verify shape has all required fields
    expect(result.trends).toHaveProperty('consistency');
    expect(result.trends).toHaveProperty('completionRate');
    expect(result.trends).toHaveProperty('focusQuality');
    expect(result.trends).toHaveProperty('totalHours');
    expect(result).toHaveProperty('topDistraction');
    expect(result).toHaveProperty('perGoal');
  });

  it('computes correct trend values', () => {
    const febSessions = [
      makeSession({
        id: 'feb-1',
        completed: true,
        started_at: '2026-02-05T09:00:00Z',
        ended_at: '2026-02-05T09:30:00Z',
        focus_quality: 'locked_in',
      }),
    ];
    const marSessions = [
      makeSession({
        id: 'mar-1',
        completed: true,
        started_at: '2026-03-01T09:00:00Z',
        ended_at: '2026-03-01T09:30:00Z',
        focus_quality: 'locked_in',
      }),
      makeSession({
        id: 'mar-2',
        completed: true,
        started_at: '2026-03-02T09:00:00Z',
        ended_at: '2026-03-02T09:30:00Z',
        focus_quality: 'decent',
      }),
    ];

    const allSessions = [...febSessions, ...marSessions];
    const result = tierThreeMetrics(
      allSessions,
      marSessions,
      febSessions,
      31,
      28,
    );

    expect(result).not.toBeNull();
    if (result === null) return;

    // Consistency: Mar 2 days / 31, Feb 1 day / 28
    expect(result.trends.consistency.current).toBeCloseTo(2 / 31);
    expect(result.trends.consistency.previous).toBeCloseTo(1 / 28);

    // Completion: 2/2 = 1.0, 1/1 = 1.0
    expect(result.trends.completionRate.current).toBeCloseTo(1.0);
    expect(result.trends.completionRate.previous).toBeCloseTo(1.0);

    // Focus quality: Mar 1 locked_in / 2 = 0.5, Feb 1/1 = 1.0
    expect(result.trends.focusQuality.current).toBeCloseTo(0.5);
    expect(result.trends.focusQuality.previous).toBeCloseTo(1.0);

    // Total hours: Mar 30min + 30min = 1h, Feb 30min = 0.5h
    expect(result.trends.totalHours.current).toBeCloseTo(1.0);
    expect(result.trends.totalHours.previous).toBeCloseTo(0.5);
  });

  it('includes top distraction from current month', () => {
    const febSessions = [
      makeSession({
        id: 'feb-1',
        completed: true,
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
      }),
    ];
    const marSessions = [
      makeSession({
        id: 'mar-1',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        id: 'mar-2',
        completed: true,
        started_at: '2026-03-11T09:00:00Z',
        ended_at: '2026-03-11T09:25:00Z',
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        id: 'mar-3',
        completed: true,
        started_at: '2026-03-12T09:00:00Z',
        ended_at: '2026-03-12T09:25:00Z',
        focus_quality: 'struggled',
        distraction_type: 'thoughts_wandering',
      }),
    ];

    const allSessions = [...febSessions, ...marSessions];
    const result = tierThreeMetrics(
      allSessions,
      marSessions,
      febSessions,
      31,
      28,
    );

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.topDistraction).toEqual({ type: 'phone', count: 2 });
  });

  it('returns null topDistraction when no struggled sessions', () => {
    const febSessions = [
      makeSession({
        id: 'feb-1',
        completed: true,
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
        focus_quality: 'locked_in',
      }),
    ];
    const marSessions = [
      makeSession({
        id: 'mar-1',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
        focus_quality: 'locked_in',
      }),
    ];

    const allSessions = [...febSessions, ...marSessions];
    const result = tierThreeMetrics(
      allSessions,
      marSessions,
      febSessions,
      31,
      28,
    );

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.topDistraction).toBeNull();
  });

  it('includes per-goal breakdown from current month', () => {
    const febSessions = [
      makeSession({
        id: 'feb-1',
        completed: true,
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
      }),
    ];
    const marSessions = [
      makeSession({
        id: 'mar-1',
        process_goal_id: 'goal-a',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
      }),
      makeSession({
        id: 'mar-2',
        process_goal_id: 'goal-a',
        completed: true,
        started_at: '2026-03-11T09:00:00Z',
        ended_at: '2026-03-11T09:30:00Z',
      }),
      makeSession({
        id: 'mar-3',
        process_goal_id: 'goal-b',
        completed: true,
        started_at: '2026-03-12T09:00:00Z',
        ended_at: '2026-03-12T09:25:00Z',
      }),
    ];

    const allSessions = [...febSessions, ...marSessions];
    const result = tierThreeMetrics(
      allSessions,
      marSessions,
      febSessions,
      31,
      28,
    );

    expect(result).not.toBeNull();
    if (result === null) return;

    expect(result.perGoal).toHaveLength(2);

    const goalA = result.perGoal.find((g) => g.goalId === 'goal-a');
    expect(goalA).toEqual(
      expect.objectContaining({ sessions: 2 }),
    );
    expect(goalA?.focusMinutes).toBeCloseTo(55); // 25 + 30

    const goalB = result.perGoal.find((g) => g.goalId === 'goal-b');
    expect(goalB).toEqual(
      expect.objectContaining({ sessions: 1 }),
    );
    expect(goalB?.focusMinutes).toBeCloseTo(25);
  });

  it('works with non-consecutive months (Jan + Mar)', () => {
    const janSessions = [
      makeSession({
        id: 'jan-1',
        completed: true,
        started_at: '2026-01-15T09:00:00Z',
        ended_at: '2026-01-15T09:25:00Z',
      }),
    ];
    const marSessions = [
      makeSession({
        id: 'mar-1',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
      }),
    ];

    // allSessions includes Jan + Mar — non-consecutive, still passes cold-start
    const allSessions = [...janSessions, ...marSessions];

    // Comparing Mar (current) vs Jan (previous) — both have data
    const result = tierThreeMetrics(
      allSessions,
      marSessions,
      janSessions,
      31,
      31,
    );

    expect(result).not.toBeNull();
  });
});
