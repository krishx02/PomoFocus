import { describe, it, expect } from 'vitest';
import { goalProgress } from './progress.js';
import { GOAL_STATUS, RECURRENCE_TYPE } from './types.js';
import type { ProcessGoal } from './types.js';
import type { SessionData } from '../session/types.js';

// ── Helpers ──

function makeGoal(overrides: Partial<ProcessGoal> = {}): ProcessGoal {
  return {
    id: 'goal-1',
    longTermGoalId: 'lt-1',
    userId: 'user-1',
    title: 'Study calculus',
    targetSessionsPerDay: 3,
    recurrence: RECURRENCE_TYPE.DAILY,
    status: GOAL_STATUS.ACTIVE,
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: 'session-1',
    userId: 'user-1',
    processGoalId: 'goal-1',
    intentionText: null,
    startedAt: '2026-03-23T10:00:00Z',
    endedAt: '2026-03-23T10:25:00Z',
    completed: true,
    abandonmentReason: null,
    deviceId: null,
    ...overrides,
  };
}

// Today boundary: 2026-03-23 midnight UTC
const TODAY_START = '2026-03-23T00:00:00Z';
const TODAY_END = '2026-03-24T00:00:00Z';

describe('goalProgress', () => {
  it('returns progress for a single active goal with completed sessions today', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', startedAt: '2026-03-23T10:00:00Z' }),
      makeSession({ id: 's2', startedAt: '2026-03-23T14:00:00Z' }),
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 2, targetToday: 3 },
    ]);
  });

  it('returns 0 completedToday when no sessions exist for the goal', () => {
    const goals = [makeGoal()];
    const sessions: SessionData[] = [];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 0, targetToday: 3 },
    ]);
  });

  it('excludes non-completed sessions', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: false, abandonmentReason: 'gave_up' }),
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('excludes sessions outside today boundaries (before today)', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', startedAt: '2026-03-22T23:59:59Z' }), // yesterday
      makeSession({ id: 's2', startedAt: '2026-03-23T00:00:00Z' }), // today (inclusive)
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('excludes sessions outside today boundaries (at or after end)', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', startedAt: '2026-03-23T23:59:59Z' }), // today
      makeSession({ id: 's2', startedAt: '2026-03-24T00:00:00Z' }), // tomorrow (exclusive)
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('includes session at exactly today start boundary (inclusive)', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', startedAt: '2026-03-23T00:00:00Z' }),
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('only includes active goals', () => {
    const goals = [
      makeGoal({ id: 'g1', status: GOAL_STATUS.ACTIVE }),
      makeGoal({ id: 'g2', status: GOAL_STATUS.COMPLETED, title: 'Completed goal' }),
      makeGoal({ id: 'g3', status: GOAL_STATUS.RETIRED, title: 'Retired goal' }),
    ];
    const sessions: SessionData[] = [];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'g1', goalTitle: 'Study calculus', completedToday: 0, targetToday: 3 },
    ]);
  });

  it('handles multiple goals with sessions assigned to different goals', () => {
    const goals = [
      makeGoal({ id: 'g1', title: 'Study calculus', targetSessionsPerDay: 3 }),
      makeGoal({ id: 'g2', title: 'Read philosophy', targetSessionsPerDay: 2 }),
    ];
    const sessions = [
      makeSession({ id: 's1', processGoalId: 'g1', startedAt: '2026-03-23T10:00:00Z' }),
      makeSession({ id: 's2', processGoalId: 'g2', startedAt: '2026-03-23T11:00:00Z' }),
      makeSession({ id: 's3', processGoalId: 'g2', startedAt: '2026-03-23T15:00:00Z' }),
      makeSession({ id: 's4', processGoalId: 'g1', startedAt: '2026-03-23T16:00:00Z' }),
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'g1', goalTitle: 'Study calculus', completedToday: 2, targetToday: 3 },
      { goalId: 'g2', goalTitle: 'Read philosophy', completedToday: 2, targetToday: 2 },
    ]);
  });

  it('ignores sessions for goals not in the provided goals list', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const sessions = [
      makeSession({ id: 's1', processGoalId: 'g1', startedAt: '2026-03-23T10:00:00Z' }),
      makeSession({ id: 's2', processGoalId: 'g-unknown', startedAt: '2026-03-23T11:00:00Z' }),
    ];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'g1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('returns empty array when no goals are provided', () => {
    const sessions = [makeSession()];

    const result = goalProgress([], sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([]);
  });

  it('returns empty array when no active goals exist', () => {
    const goals = [
      makeGoal({ id: 'g1', status: GOAL_STATUS.COMPLETED }),
      makeGoal({ id: 'g2', status: GOAL_STATUS.RETIRED }),
    ];
    const sessions = [makeSession({ processGoalId: 'g1' })];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([]);
  });

  it('works with timezone-shifted day boundaries (e.g., US Eastern = UTC-4)', () => {
    // Eastern time: today is 2026-03-23 00:00 ET = 2026-03-23 04:00 UTC
    //               tomorrow is 2026-03-24 00:00 ET = 2026-03-24 04:00 UTC
    const easternStart = '2026-03-23T04:00:00Z';
    const easternEnd = '2026-03-24T04:00:00Z';

    const goals = [makeGoal()];
    const sessions = [
      // 2026-03-23 03:30 UTC = still "yesterday" in Eastern time
      makeSession({ id: 's1', startedAt: '2026-03-23T03:30:00Z' }),
      // 2026-03-23 05:00 UTC = "today" in Eastern time
      makeSession({ id: 's2', startedAt: '2026-03-23T05:00:00Z' }),
    ];

    const result = goalProgress(goals, sessions, easternStart, easternEnd);

    expect(result).toEqual([
      { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
    ]);
  });

  it('preserves goal order from input', () => {
    const goals = [
      makeGoal({ id: 'g-b', title: 'Goal B', sortOrder: 1 }),
      makeGoal({ id: 'g-a', title: 'Goal A', sortOrder: 0 }),
    ];
    const sessions: SessionData[] = [];

    const result = goalProgress(goals, sessions, TODAY_START, TODAY_END);

    expect(result).toEqual([
      { goalId: 'g-b', goalTitle: 'Goal B', completedToday: 0, targetToday: 3 },
      { goalId: 'g-a', goalTitle: 'Goal A', completedToday: 0, targetToday: 3 },
    ]);
  });
});
