import { describe, it, expect } from 'vitest';
import type { ProcessGoal, Session } from '@pomofocus/types';
import { perGoalBreakdown } from './per-goal.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    user_id: 'user-1',
    process_goal_id: 'goal-1',
    intention_text: null,
    started_at: '2026-03-20T09:00:00.000Z',
    ended_at: '2026-03-20T09:25:00.000Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: null,
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-20T09:00:00.000Z',
    ...overrides,
  };
}

function makeGoal(overrides: Partial<ProcessGoal> = {}): ProcessGoal {
  return {
    id: 'goal-1',
    long_term_goal_id: 'ltg-1',
    user_id: 'user-1',
    title: 'Study Calculus',
    target_sessions_per_day: 3,
    recurrence: 'daily',
    status: 'active',
    sort_order: 0,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('perGoalBreakdown', () => {
  it('returns an empty array for no sessions', () => {
    const goals = [makeGoal()];
    expect(perGoalBreakdown([], goals)).toEqual([]);
  });

  it('groups sessions by goal and computes correct counts and focus minutes', () => {
    const goals = [
      makeGoal({ id: 'goal-1', title: 'Study Calculus' }),
      makeGoal({ id: 'goal-2', title: 'Read Philosophy' }),
    ];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'goal-1',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
      makeSession({
        id: 's2',
        process_goal_id: 'goal-1',
        started_at: '2026-03-20T10:00:00.000Z',
        ended_at: '2026-03-20T10:25:00.000Z',
        completed: true,
      }),
      makeSession({
        id: 's3',
        process_goal_id: 'goal-2',
        started_at: '2026-03-20T14:00:00.000Z',
        ended_at: '2026-03-20T14:50:00.000Z',
        completed: true,
      }),
    ];

    const result = perGoalBreakdown(sessions, goals);
    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study Calculus', sessions: 2, focusMinutes: 50 },
      { goalId: 'goal-2', goalTitle: 'Read Philosophy', sessions: 1, focusMinutes: 50 },
    ]);
  });

  it('counts incomplete sessions in session count but not in focusMinutes', () => {
    const goals = [makeGoal({ id: 'goal-1', title: 'Study Calculus' })];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'goal-1',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
      makeSession({
        id: 's2',
        process_goal_id: 'goal-1',
        started_at: '2026-03-20T10:00:00.000Z',
        ended_at: '2026-03-20T10:15:00.000Z',
        completed: false,
      }),
    ];

    const result = perGoalBreakdown(sessions, goals);
    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study Calculus', sessions: 2, focusMinutes: 25 },
    ]);
  });

  it('omits goals with zero matching sessions', () => {
    const goals = [
      makeGoal({ id: 'goal-1', title: 'Study Calculus' }),
      makeGoal({ id: 'goal-2', title: 'Read Philosophy' }),
    ];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'goal-1',
        completed: true,
      }),
    ];

    const result = perGoalBreakdown(sessions, goals);
    expect(result).toHaveLength(1);
    expect(result[0]?.goalId).toBe('goal-1');
  });

  it('handles sessions referencing a goal not in the goals array (uses goalId as title)', () => {
    const goals: ProcessGoal[] = [];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'unknown-goal',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
    ];

    const result = perGoalBreakdown(sessions, goals);
    expect(result).toEqual([
      { goalId: 'unknown-goal', goalTitle: 'unknown-goal', sessions: 1, focusMinutes: 25 },
    ]);
  });

  it('handles sessions with null ended_at (not counted in focusMinutes)', () => {
    const goals = [makeGoal({ id: 'goal-1', title: 'Study Calculus' })];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'goal-1',
        ended_at: null,
        completed: true,
      }),
    ];

    const result = perGoalBreakdown(sessions, goals);
    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study Calculus', sessions: 1, focusMinutes: 0 },
    ]);
  });

  it('returns an empty array for empty sessions and empty goals', () => {
    expect(perGoalBreakdown([], [])).toEqual([]);
  });
});
