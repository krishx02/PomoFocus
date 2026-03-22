import { describe, it, expect } from 'vitest';
import { GOAL_STATUS, RECURRENCE_TYPE } from './types.js';
import type { GoalStatus, RecurrenceType, LongTermGoal, ProcessGoal } from './types.js';

describe('GOAL_STATUS', () => {
  it('has exactly 3 values matching ADR-005 goal_status enum', () => {
    expect(GOAL_STATUS.ACTIVE).toBe('active');
    expect(GOAL_STATUS.COMPLETED).toBe('completed');
    expect(GOAL_STATUS.RETIRED).toBe('retired');
    expect(Object.keys(GOAL_STATUS)).toHaveLength(3);
  });

  it('values are assignable to GoalStatus type', () => {
    const status: GoalStatus = GOAL_STATUS.ACTIVE;
    expect(status).toBe('active');
  });
});

describe('RECURRENCE_TYPE', () => {
  it('has exactly 2 values matching ADR-005 recurrence_type enum', () => {
    expect(RECURRENCE_TYPE.DAILY).toBe('daily');
    expect(RECURRENCE_TYPE.WEEKLY).toBe('weekly');
    expect(Object.keys(RECURRENCE_TYPE)).toHaveLength(2);
  });

  it('values are assignable to RecurrenceType type', () => {
    const recurrence: RecurrenceType = RECURRENCE_TYPE.DAILY;
    expect(recurrence).toBe('daily');
  });
});

describe('LongTermGoal type', () => {
  it('accepts a valid long-term goal shape', () => {
    const goal: LongTermGoal = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Get strong at calculus',
      description: 'Master integration and differentiation',
      status: GOAL_STATUS.ACTIVE,
      sortOrder: 0,
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    };
    expect(goal.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(goal.status).toBe('active');
  });

  it('accepts null description', () => {
    const goal: LongTermGoal = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Get strong at calculus',
      description: null,
      status: GOAL_STATUS.COMPLETED,
      sortOrder: 1,
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    };
    expect(goal.description).toBeNull();
  });
});

describe('ProcessGoal type', () => {
  it('accepts a valid process goal shape', () => {
    const goal: ProcessGoal = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      longTermGoalId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Study calculus 3 sessions/day',
      targetSessionsPerDay: 3,
      recurrence: RECURRENCE_TYPE.DAILY,
      status: GOAL_STATUS.ACTIVE,
      sortOrder: 0,
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    };
    expect(goal.targetSessionsPerDay).toBe(3);
    expect(goal.recurrence).toBe('daily');
    expect(goal.longTermGoalId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts weekly recurrence', () => {
    const goal: ProcessGoal = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      longTermGoalId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Weekly review session',
      targetSessionsPerDay: 1,
      recurrence: RECURRENCE_TYPE.WEEKLY,
      status: GOAL_STATUS.RETIRED,
      sortOrder: 2,
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
    };
    expect(goal.recurrence).toBe('weekly');
    expect(goal.status).toBe('retired');
  });
});
