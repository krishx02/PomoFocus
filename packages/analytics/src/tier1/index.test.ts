import { describe, it, expect } from 'vitest';
import { tierOneMetrics } from './index.js';
import type { TierOneResult } from './index.js';
import { GOAL_STATUS, RECURRENCE_TYPE } from '@pomofocus/core';
import type { SessionData, ProcessGoal } from '@pomofocus/core';

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
    startedAt: '2026-03-18T10:00:00Z',
    endedAt: '2026-03-18T10:25:00Z',
    completed: true,
    abandonmentReason: null,
    deviceId: null,
    ...overrides,
  };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

// Reference week: Monday 2026-03-16 through Sunday 2026-03-22
// nowTimestamp = Wednesday 2026-03-18 12:00:00 UTC
const tz = 'UTC';
const wed = ms('2026-03-18T12:00:00Z');

describe('tierOneMetrics', () => {
  describe('cold-start (0 sessions)', () => {
    it('returns valid result with empty/zero values', () => {
      const result = tierOneMetrics([], [], tz, wed);

      expect(result.goalProgress).toEqual([]);
      expect(result.weeklyDots).toEqual([
        false, false, false, false, false, false, false,
      ]);
      expect(result.currentStreak).toBe(0);
    });

    it('returns zero completedToday when active goals exist but no sessions', () => {
      const goals = [makeGoal()];
      const result = tierOneMetrics([], goals, tz, wed);

      expect(result.goalProgress).toEqual([
        { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 0, targetToday: 3 },
      ]);
      expect(result.weeklyDots).toEqual([
        false, false, false, false, false, false, false,
      ]);
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('composes all three Tier 1 functions', () => {
    it('returns goal progress, weekly dots, and streak together', () => {
      const goals = [makeGoal()];
      // Sessions on Wednesday (today) and Tuesday (yesterday)
      const sessions = [
        makeSession({
          id: 's-1',
          startedAt: '2026-03-18T10:00:00Z',
          endedAt: '2026-03-18T10:25:00Z',
          completed: true,
        }),
        makeSession({
          id: 's-2',
          startedAt: '2026-03-17T10:00:00Z',
          endedAt: '2026-03-17T10:25:00Z',
          completed: true,
        }),
      ];

      const result = tierOneMetrics(sessions, goals, tz, wed);

      // Goal progress: 1 completed today out of 3 target
      expect(result.goalProgress).toEqual([
        { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 1, targetToday: 3 },
      ]);

      // Weekly dots: Tuesday and Wednesday should be true
      expect(result.weeklyDots).toEqual([
        false, true, true, false, false, false, false,
      ]);

      // Streak: 2 consecutive days (Tue + Wed)
      expect(result.currentStreak).toBe(2);
    });
  });

  describe('goal progress integration', () => {
    it('counts only sessions for active goals within today', () => {
      const goals = [
        makeGoal({ id: 'g-1', title: 'Goal A', targetSessionsPerDay: 2 }),
        makeGoal({ id: 'g-2', title: 'Goal B', targetSessionsPerDay: 1 }),
      ];
      const sessions = [
        // Session for Goal A today
        makeSession({
          id: 's-1',
          processGoalId: 'g-1',
          startedAt: '2026-03-18T09:00:00Z',
          completed: true,
        }),
        // Session for Goal A today
        makeSession({
          id: 's-2',
          processGoalId: 'g-1',
          startedAt: '2026-03-18T11:00:00Z',
          completed: true,
        }),
        // Session for Goal B yesterday (should not count for today)
        makeSession({
          id: 's-3',
          processGoalId: 'g-2',
          startedAt: '2026-03-17T10:00:00Z',
          completed: true,
        }),
      ];

      const result = tierOneMetrics(sessions, goals, tz, wed);

      expect(result.goalProgress).toEqual([
        { goalId: 'g-1', goalTitle: 'Goal A', completedToday: 2, targetToday: 2 },
        { goalId: 'g-2', goalTitle: 'Goal B', completedToday: 0, targetToday: 1 },
      ]);
    });

    it('filters out inactive goals', () => {
      const goals = [
        makeGoal({ id: 'g-1', title: 'Active', status: GOAL_STATUS.ACTIVE }),
        makeGoal({ id: 'g-2', title: 'Retired', status: GOAL_STATUS.RETIRED }),
      ];
      const sessions = [
        makeSession({
          id: 's-1',
          processGoalId: 'g-1',
          startedAt: '2026-03-18T10:00:00Z',
          completed: true,
        }),
      ];

      const result = tierOneMetrics(sessions, goals, tz, wed);

      expect(result.goalProgress).toEqual([
        { goalId: 'g-1', goalTitle: 'Active', completedToday: 1, targetToday: 3 },
      ]);
    });
  });

  describe('weekly dots integration', () => {
    it('marks correct days for completed sessions', () => {
      const sessions = [
        makeSession({
          id: 's-1',
          startedAt: '2026-03-16T10:00:00Z', // Monday
          completed: true,
        }),
        makeSession({
          id: 's-2',
          startedAt: '2026-03-20T14:00:00Z', // Friday
          completed: true,
        }),
      ];

      const result = tierOneMetrics(sessions, [], tz, wed);

      expect(result.weeklyDots).toEqual([
        true, false, false, false, true, false, false,
      ]);
    });

    it('ignores incomplete sessions for weekly dots', () => {
      const sessions = [
        makeSession({
          id: 's-1',
          startedAt: '2026-03-18T10:00:00Z', // Wednesday
          completed: false,
        }),
      ];

      const result = tierOneMetrics(sessions, [], tz, wed);

      expect(result.weeklyDots).toEqual([
        false, false, false, false, false, false, false,
      ]);
    });
  });

  describe('streak integration', () => {
    it('returns correct streak for consecutive days', () => {
      const sessions = [
        makeSession({ id: 's-1', startedAt: '2026-03-18T10:00:00Z', completed: true }), // Wed
        makeSession({ id: 's-2', startedAt: '2026-03-17T10:00:00Z', completed: true }), // Tue
        makeSession({ id: 's-3', startedAt: '2026-03-16T10:00:00Z', completed: true }), // Mon
      ];

      const result = tierOneMetrics(sessions, [], tz, wed);

      expect(result.currentStreak).toBe(3);
    });

    it('returns 0 for no completed sessions', () => {
      const sessions = [
        makeSession({ id: 's-1', startedAt: '2026-03-18T10:00:00Z', completed: false }),
      ];

      const result = tierOneMetrics(sessions, [], tz, wed);

      expect(result.currentStreak).toBe(0);
    });

    it('resets streak when gap exceeds grace period', () => {
      // Session today and 3 days ago (gap of 2 days = streak broken)
      const sessions = [
        makeSession({ id: 's-1', startedAt: '2026-03-18T10:00:00Z', completed: true }), // Wed
        makeSession({ id: 's-2', startedAt: '2026-03-15T10:00:00Z', completed: true }), // Sun (prev week)
      ];

      const result = tierOneMetrics(sessions, [], tz, wed);

      expect(result.currentStreak).toBe(1);
    });
  });

  describe('timezone handling', () => {
    it('uses timezone for all three sub-functions', () => {
      // 2026-03-18 at 03:00 UTC = 2026-03-17 at 23:00 US/Eastern (EDT, UTC-4)
      // In UTC this is Wednesday, but in US/Eastern it's still Tuesday
      const goals = [makeGoal()];
      const sessions = [
        makeSession({
          id: 's-1',
          startedAt: '2026-03-18T03:00:00Z',
          completed: true,
        }),
      ];

      // In US/Eastern: "today" for goal progress is determined by timezone
      // nowTimestamp is Wed noon UTC = Wed 8am ET
      const result = tierOneMetrics(sessions, goals, 'America/New_York', wed);

      // The session at 03:00 UTC is 23:00 ET on Tuesday = yesterday in ET
      // So goal progress for today (Wed in ET) should be 0
      expect(result.goalProgress).toEqual([
        { goalId: 'goal-1', goalTitle: 'Study calculus', completedToday: 0, targetToday: 3 },
      ]);

      // Weekly dots: session is on Tuesday in ET
      expect(result.weeklyDots[1]).toBe(true); // Tuesday
      expect(result.weeklyDots[2]).toBe(false); // Wednesday
    });
  });

  describe('return type shape', () => {
    it('satisfies TierOneResult type', () => {
      const result: TierOneResult = tierOneMetrics([], [], tz, wed);

      expect(result).toHaveProperty('goalProgress');
      expect(result).toHaveProperty('weeklyDots');
      expect(result).toHaveProperty('currentStreak');
      expect(Array.isArray(result.goalProgress)).toBe(true);
      expect(result.weeklyDots).toHaveLength(7);
      expect(typeof result.currentStreak).toBe('number');
    });
  });

  describe('pure function guarantee', () => {
    it('same inputs always produce same output', () => {
      const goals = [makeGoal()];
      const sessions = [
        makeSession({
          id: 's-1',
          startedAt: '2026-03-18T10:00:00Z',
          completed: true,
        }),
      ];

      const result1 = tierOneMetrics(sessions, goals, tz, wed);
      const result2 = tierOneMetrics(sessions, goals, tz, wed);

      expect(result1).toEqual(result2);
    });
  });
});
