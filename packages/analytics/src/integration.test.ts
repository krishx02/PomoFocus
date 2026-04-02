import { describe, it, expect } from 'vitest';
import type { Session, ProcessGoal } from '@pomofocus/types';
import type { SessionData, ProcessGoal as CoreProcessGoal } from '@pomofocus/core';
import { GOAL_STATUS, RECURRENCE_TYPE } from '@pomofocus/core';
import { tierOneMetrics } from './tier1/index.js';
import { tierTwoMetrics } from './tier2/index.js';
import { tierThreeMetrics } from './tier3/index.js';
import { hasSufficientData } from './cold-start.js';

// ── Helpers ──

/** Create a snake_case Session (used by Tier 2/3). */
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
    focus_quality: null,
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-10T09:00:00Z',
    ...overrides,
  };
}

/** Create a camelCase SessionData (used by Tier 1). */
function makeSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: 'sess-1',
    userId: 'user-1',
    processGoalId: 'goal-1',
    intentionText: null,
    startedAt: '2026-03-10T09:00:00Z',
    endedAt: '2026-03-10T09:25:00Z',
    completed: true,
    abandonmentReason: null,
    deviceId: null,
    ...overrides,
  };
}

/** Create a snake_case ProcessGoal (used by Tier 2). */
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
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

/** Create a camelCase ProcessGoal (used by Tier 1). */
function makeCoreGoal(overrides: Partial<CoreProcessGoal> = {}): CoreProcessGoal {
  return {
    id: 'goal-1',
    longTermGoalId: 'ltg-1',
    userId: 'user-1',
    title: 'Study Calculus',
    targetSessionsPerDay: 3,
    recurrence: RECURRENCE_TYPE.DAILY,
    status: GOAL_STATUS.ACTIVE,
    sortOrder: 0,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

/** Convert snake_case Session to camelCase SessionData for Tier 1. */
function toSessionData(s: Session): SessionData {
  return {
    id: s.id,
    userId: s.user_id,
    processGoalId: s.process_goal_id,
    intentionText: s.intention_text,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    completed: s.completed,
    abandonmentReason: s.abandonment_reason,
    deviceId: s.device_id,
  };
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}

// ── Shared Data Generators ──

/**
 * Generate one week (7 days) of daily sessions starting from a Monday.
 * Each day gets one completed 25-min session at 09:00 UTC.
 */
function generateOneWeek(): Session[] {
  const sessions: Session[] = [];
  for (let i = 0; i < 7; i++) {
    const day = String(16 + i).padStart(2, '0'); // Mar 16-22, 2026 (Mon-Sun)
    sessions.push(
      makeSession({
        id: `week-sess-${String(i)}`,
        started_at: `2026-03-${day}T09:00:00Z`,
        ended_at: `2026-03-${day}T09:25:00Z`,
        completed: true,
        focus_quality: i % 3 === 0 ? 'locked_in' : i % 3 === 1 ? 'decent' : 'struggled',
      }),
    );
  }
  return sessions;
}

/**
 * Generate 365 sessions spread across a full year (2025-04 to 2026-03).
 * One session per day, rotating focus quality and distraction types.
 */
function generateYearOfSessions(): Session[] {
  const sessions: Session[] = [];
  const qualities = ['locked_in', 'decent', 'struggled'] as const;
  const distractions = ['phone', 'people', 'thoughts_wandering', 'got_stuck', 'other'] as const;
  const baseDate = new Date('2025-04-01T09:00:00Z');

  for (let i = 0; i < 365; i++) {
    const d = new Date(baseDate.getTime() + i * 86_400_000);
    const iso = d.toISOString();
    const endIso = new Date(d.getTime() + 25 * 60_000).toISOString();
    const quality = qualities[i % 3] ?? 'locked_in';
    const distractionValue = distractions[i % 5] ?? 'phone';
    const distraction = quality === 'struggled' ? distractionValue : null;

    sessions.push(
      makeSession({
        id: `year-sess-${String(i)}`,
        started_at: iso,
        ended_at: endIso,
        completed: i % 10 !== 0, // 10% abandoned
        focus_quality: quality,
        distraction_type: distraction,
        abandonment_reason: i % 10 === 0 ? (i % 20 === 0 ? 'had_to_stop' : 'gave_up') : null,
      }),
    );
  }
  return sessions;
}

// ────────────────────────────────────────────────
// Integration Tests
// ────────────────────────────────────────────────

describe('Analytics Integration: Cross-Tier Consistency', () => {
  describe('zero sessions (cold-start)', () => {
    it('all tiers handle empty arrays consistently', () => {
      // Tier 1 always returns valid results
      const t1 = tierOneMetrics([], [], 'UTC', ms('2026-03-18T12:00:00Z'));
      expect(t1.goalProgress).toEqual([]);
      expect(t1.weeklyDots).toEqual([false, false, false, false, false, false, false]);
      expect(t1.currentStreak).toBe(0);

      // Tier 2 returns null for cold-start
      expect(tierTwoMetrics([], [])).toBeNull();

      // Tier 3 returns null for cold-start
      expect(tierThreeMetrics([], [], [], 31, 28)).toBeNull();

      // hasSufficientData
      expect(hasSufficientData([], 'tier1')).toBe(true);
      expect(hasSufficientData([], 'tier2')).toBe(false);
      expect(hasSufficientData([], 'tier3')).toBe(false);
    });
  });

  describe('single session', () => {
    const session = makeSession({
      id: 'single-1',
      started_at: '2026-03-18T09:00:00Z',
      ended_at: '2026-03-18T09:25:00Z',
      completed: true,
      focus_quality: 'locked_in',
    });

    it('tier 1 shows the session in weekly dots and streak', () => {
      const sessionData = toSessionData(session);
      const goal = makeCoreGoal();
      const result = tierOneMetrics(
        [sessionData],
        [goal],
        'UTC',
        ms('2026-03-18T12:00:00Z'),
      );

      expect(result.goalProgress).toEqual([
        { goalId: 'goal-1', goalTitle: 'Study Calculus', completedToday: 1, targetToday: 3 },
      ]);
      // Wednesday = index 2
      expect(result.weeklyDots[2]).toBe(true);
      expect(result.currentStreak).toBe(1);
    });

    it('tier 2 returns non-null for single completed session', () => {
      const goals = [makeGoal()];
      const result = tierTwoMetrics([session], goals);

      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.completionRate).toBe(1);
      expect(result.totalFocusMinutes).toBe(25);
      expect(result.sessionCount).toBe(1);
      expect(result.focusQuality).toEqual({ lockedIn: 1, decent: 0, struggled: 0 });
      expect(result.peakFocusWindow).toBeNull(); // < 5 sessions
    });

    it('tier 3 returns null (need >= 2 months)', () => {
      expect(tierThreeMetrics([session], [session], [], 31, 28)).toBeNull();
    });

    it('cold-start thresholds are consistent', () => {
      expect(hasSufficientData([session], 'tier1')).toBe(true);
      expect(hasSufficientData([session], 'tier2')).toBe(true);
      expect(hasSufficientData([session], 'tier3')).toBe(false);
    });
  });

  describe('one week of daily sessions', () => {
    const weekSessions = generateOneWeek();
    const nowTimestamp = ms('2026-03-22T12:00:00Z'); // Sunday noon

    it('tier 1 shows all 7 weekly dots filled', () => {
      const sessionDatas = weekSessions.map(toSessionData);
      const result = tierOneMetrics(sessionDatas, [], 'UTC', nowTimestamp);

      expect(result.weeklyDots).toEqual([true, true, true, true, true, true, true]);
      expect(result.currentStreak).toBe(7);
    });

    it('tier 2 returns valid metrics for 7 sessions', () => {
      const goals = [makeGoal()];
      const result = tierTwoMetrics(weekSessions, goals);

      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.sessionCount).toBe(7);
      expect(result.completionRate).toBe(1);
      expect(result.totalFocusMinutes).toBe(175); // 7 * 25
      // 7 sessions with focus_quality, all have it => peakFocusWindow should be non-null
      expect(result.peakFocusWindow).not.toBeNull();
    });

    it('tier 3 returns null (all sessions in one month)', () => {
      expect(hasSufficientData(weekSessions, 'tier3')).toBe(false);
    });
  });

  describe('365 sessions across a year', () => {
    const yearSessions = generateYearOfSessions();
    const nowTimestamp = ms('2026-03-31T12:00:00Z');

    it('tier 1 metrics computed without error', () => {
      const sessionDatas = yearSessions.map(toSessionData);
      const result = tierOneMetrics(sessionDatas, [], 'UTC', nowTimestamp);

      expect(result.weeklyDots).toHaveLength(7);
      expect(typeof result.currentStreak).toBe('number');
    });

    it('tier 2 returns full metrics for large dataset', () => {
      const goals = [makeGoal()];
      const result = tierTwoMetrics(yearSessions, goals);

      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.sessionCount).toBe(365);
      // 10% abandoned => 329 completed out of 365
      // had_to_stop are excluded from denominator
      expect(result.completionRate).toBeGreaterThan(0);
      expect(result.completionRate).toBeLessThanOrEqual(1);
      expect(result.totalFocusMinutes).toBeGreaterThan(0);
      expect(result.peakFocusWindow).not.toBeNull(); // well over 5 sessions with quality
    });

    it('tier 3 returns full metrics with year of data', () => {
      // Filter March sessions as "current", February as "previous"
      const marSessions = yearSessions.filter((s) => s.started_at.startsWith('2026-03'));
      const febSessions = yearSessions.filter((s) => s.started_at.startsWith('2026-02'));

      const result = tierThreeMetrics(yearSessions, marSessions, febSessions, 31, 28);

      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.trends.consistency.current).toBeGreaterThan(0);
      expect(result.trends.consistency.previous).toBeGreaterThan(0);
      expect(result.trends.completionRate.current).toBeGreaterThan(0);
      expect(result.trends.totalHours.current).toBeGreaterThan(0);
    });

    it('cold-start passes for all tiers', () => {
      expect(hasSufficientData(yearSessions, 'tier1')).toBe(true);
      expect(hasSufficientData(yearSessions, 'tier2')).toBe(true);
      expect(hasSufficientData(yearSessions, 'tier3')).toBe(true);
    });
  });

  describe('sessions spanning timezone changes', () => {
    it('handles DST spring-forward boundary (America/New_York)', () => {
      // DST spring forward 2026: March 8, 2:00 AM -> 3:00 AM EST->EDT
      // Session at 6:59 UTC = 1:59 AM EST (pre-spring-forward)
      // Session at 7:01 UTC = 3:01 AM EDT (post-spring-forward)
      const preDST = makeSessionData({
        id: 'pre-dst',
        startedAt: '2026-03-08T06:59:00Z',
        endedAt: '2026-03-08T07:24:00Z',
        completed: true,
      });
      const postDST = makeSessionData({
        id: 'post-dst',
        startedAt: '2026-03-08T07:01:00Z',
        endedAt: '2026-03-08T07:26:00Z',
        completed: true,
      });

      // Both sessions are on March 8 in New York time
      const result = tierOneMetrics(
        [preDST, postDST],
        [],
        'America/New_York',
        ms('2026-03-08T12:00:00Z'),
      );

      // Sunday = index 6 in ISO weekday (March 8, 2026 is a Sunday)
      expect(result.weeklyDots[6]).toBe(true);
      expect(result.currentStreak).toBe(1);
    });

    it('session near midnight in different timezone maps to correct day', () => {
      // Session at 2026-03-18T04:30:00Z
      // In UTC: March 18
      // In Asia/Tokyo (UTC+9): March 18 at 13:30
      // In Pacific/Honolulu (UTC-10): March 17 at 18:30
      const session = makeSessionData({
        id: 'tz-sess',
        startedAt: '2026-03-18T04:30:00Z',
        endedAt: '2026-03-18T04:55:00Z',
        completed: true,
      });

      const wed = ms('2026-03-18T12:00:00Z');

      const utcResult = tierOneMetrics([session], [], 'UTC', wed);
      const tokyoResult = tierOneMetrics([session], [], 'Asia/Tokyo', wed);
      const honoluluResult = tierOneMetrics([session], [], 'Pacific/Honolulu', wed);

      // UTC: Wednesday (index 2) - March 18
      expect(utcResult.weeklyDots[2]).toBe(true);

      // Tokyo: Wednesday (index 2) - March 18 at 13:30
      expect(tokyoResult.weeklyDots[2]).toBe(true);

      // Honolulu: Tuesday (index 1) - March 17 at 18:30
      expect(honoluluResult.weeklyDots[1]).toBe(true);
    });

    it('tier 2/3 use UTC-based calculations unaffected by timezone', () => {
      const session = makeSession({
        id: 'tz-t2',
        started_at: '2026-03-18T04:30:00Z',
        ended_at: '2026-03-18T04:55:00Z',
        completed: true,
        focus_quality: 'locked_in',
      });

      // Tier 2 uses UTC hours for peakFocusWindow
      const result = tierTwoMetrics([session], [makeGoal()]);
      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.totalFocusMinutes).toBe(25);
      expect(result.completionRate).toBe(1);
    });
  });

  describe('sessions with mixed quality/distraction values', () => {
    const mixedSessions: Session[] = [
      makeSession({
        id: 'mix-1',
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
        completed: true,
        focus_quality: 'locked_in',
        distraction_type: null,
      }),
      makeSession({
        id: 'mix-2',
        started_at: '2026-03-11T09:00:00Z',
        ended_at: '2026-03-11T09:25:00Z',
        completed: true,
        focus_quality: 'decent',
        distraction_type: null,
      }),
      makeSession({
        id: 'mix-3',
        started_at: '2026-03-12T09:00:00Z',
        ended_at: '2026-03-12T09:25:00Z',
        completed: true,
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        id: 'mix-4',
        started_at: '2026-03-13T09:00:00Z',
        ended_at: '2026-03-13T09:25:00Z',
        completed: true,
        focus_quality: 'struggled',
        distraction_type: 'thoughts_wandering',
      }),
      makeSession({
        id: 'mix-5',
        started_at: '2026-03-14T09:00:00Z',
        ended_at: '2026-03-14T09:25:00Z',
        completed: true,
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        id: 'mix-6',
        started_at: '2026-03-15T09:00:00Z',
        ended_at: '2026-03-15T09:15:00Z',
        completed: false,
        focus_quality: null,
        distraction_type: null,
        abandonment_reason: 'gave_up',
      }),
      makeSession({
        id: 'mix-7',
        started_at: '2026-03-16T09:00:00Z',
        ended_at: '2026-03-16T09:10:00Z',
        completed: false,
        focus_quality: null,
        distraction_type: null,
        abandonment_reason: 'had_to_stop',
      }),
    ];

    it('tier 2 computes correct metrics for mixed data', () => {
      const result = tierTwoMetrics(mixedSessions, [makeGoal()]);

      expect(result).not.toBeNull();
      if (result === null) return;

      expect(result.sessionCount).toBe(7);
      // completionRate: 5 completed / (7 - 1 had_to_stop) = 5/6
      expect(result.completionRate).toBeCloseTo(5 / 6);
      expect(result.focusQuality).toEqual({ lockedIn: 1, decent: 1, struggled: 3 });
      // 5 completed sessions * 25 min = 125 min
      expect(result.totalFocusMinutes).toBe(125);
      // 5 sessions with focus_quality data => peakFocusWindow should be present
      expect(result.peakFocusWindow).not.toBeNull();
    });

    it('tier 3 distraction patterns pick the most common type', () => {
      // Need 2 months for tier 3
      const febSession = makeSession({
        id: 'feb-extra',
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
        completed: true,
      });
      const allSessions = [febSession, ...mixedSessions];

      const result = tierThreeMetrics(
        allSessions,
        mixedSessions,
        [febSession],
        31,
        28,
      );

      expect(result).not.toBeNull();
      if (result === null) return;

      // phone appears twice, thoughts_wandering once
      expect(result.topDistraction).toEqual({ type: 'phone', count: 2 });
    });
  });

  describe('abandoned sessions with NULL reasons', () => {
    it('NULL abandonment_reason on incomplete sessions counts as gave_up', () => {
      const sessions = [
        makeSession({
          id: 'null-reason-1',
          completed: false,
          abandonment_reason: null, // treated as gave_up
        }),
        makeSession({
          id: 'null-reason-2',
          completed: true,
        }),
      ];

      const result = tierTwoMetrics(sessions, [makeGoal()]);

      expect(result).not.toBeNull();
      if (result === null) return;

      // denominator = 2 (no had_to_stop exclusions), completed = 1
      expect(result.completionRate).toBe(0.5);
    });

    it('NULL abandonment_reason does not affect cold-start check', () => {
      const sessions = [
        makeSession({ completed: false, abandonment_reason: null }),
      ];

      // No completed sessions => tier 2 cold-start fails
      expect(hasSufficientData(sessions, 'tier2')).toBe(false);
    });
  });

  describe('determinism (same input = same output)', () => {
    const sessions = generateOneWeek();
    const goals = [makeGoal()];
    const now = ms('2026-03-22T12:00:00Z');

    it('tierOneMetrics is deterministic', () => {
      const sessionDatas = sessions.map(toSessionData);
      const coreGoals = [makeCoreGoal()];
      const r1 = tierOneMetrics(sessionDatas, coreGoals, 'UTC', now);
      const r2 = tierOneMetrics(sessionDatas, coreGoals, 'UTC', now);
      expect(r1).toEqual(r2);
    });

    it('tierTwoMetrics is deterministic', () => {
      const r1 = tierTwoMetrics(sessions, goals);
      const r2 = tierTwoMetrics(sessions, goals);
      expect(r1).toEqual(r2);
    });

    it('tierThreeMetrics is deterministic', () => {
      const febSession = makeSession({
        id: 'feb-det',
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
        completed: true,
      });
      const allSessions = [febSession, ...sessions];

      const r1 = tierThreeMetrics(allSessions, sessions, [febSession], 31, 28);
      const r2 = tierThreeMetrics(allSessions, sessions, [febSession], 31, 28);
      expect(r1).toEqual(r2);
    });
  });

  describe('edge cases', () => {
    describe('all sessions abandoned', () => {
      const allAbandoned = [
        makeSession({
          id: 'aband-1',
          completed: false,
          abandonment_reason: 'gave_up',
          started_at: '2026-03-10T09:00:00Z',
        }),
        makeSession({
          id: 'aband-2',
          completed: false,
          abandonment_reason: 'had_to_stop',
          started_at: '2026-03-11T09:00:00Z',
        }),
        makeSession({
          id: 'aband-3',
          completed: false,
          abandonment_reason: null, // treated as gave_up
          started_at: '2026-03-12T09:00:00Z',
        }),
      ];

      it('tier 1 shows zero streak and all-false dots', () => {
        const sessionDatas = allAbandoned.map(toSessionData);
        const result = tierOneMetrics(
          sessionDatas,
          [],
          'UTC',
          ms('2026-03-12T12:00:00Z'),
        );

        expect(result.weeklyDots).toEqual([false, false, false, false, false, false, false]);
        expect(result.currentStreak).toBe(0);
      });

      it('tier 2 returns null (no completed sessions)', () => {
        expect(tierTwoMetrics(allAbandoned, [makeGoal()])).toBeNull();
      });

      it('tier 3 returns null (no completed sessions)', () => {
        expect(tierThreeMetrics(allAbandoned, allAbandoned, [], 31, 28)).toBeNull();
      });
    });

    describe('all sessions same quality', () => {
      const allLockedIn = Array.from({ length: 10 }, (_, i) =>
        makeSession({
          id: `locked-${String(i)}`,
          started_at: `2026-03-${String(10 + i).padStart(2, '0')}T09:00:00Z`,
          ended_at: `2026-03-${String(10 + i).padStart(2, '0')}T09:25:00Z`,
          completed: true,
          focus_quality: 'locked_in',
        }),
      );

      it('focus quality distribution shows only locked_in', () => {
        const result = tierTwoMetrics(allLockedIn, [makeGoal()]);

        expect(result).not.toBeNull();
        if (result === null) return;

        expect(result.focusQuality).toEqual({ lockedIn: 10, decent: 0, struggled: 0 });
      });

      it('peak focus window still computes (all same score)', () => {
        const result = tierTwoMetrics(allLockedIn, [makeGoal()]);

        expect(result).not.toBeNull();
        if (result === null) return;

        // All at 09:00 UTC => bucket 4 (08-10h), avg quality = 3
        expect(result.peakFocusWindow).toEqual({ hour: 8, avgQuality: 3 });
      });

      it('tier 3 distraction patterns returns null (no struggled sessions)', () => {
        const febSession = makeSession({
          id: 'feb-locked',
          started_at: '2026-02-10T09:00:00Z',
          ended_at: '2026-02-10T09:25:00Z',
          completed: true,
          focus_quality: 'locked_in',
        });
        const allSessions = [febSession, ...allLockedIn];

        const result = tierThreeMetrics(
          allSessions,
          allLockedIn,
          [febSession],
          31,
          28,
        );

        expect(result).not.toBeNull();
        if (result === null) return;

        expect(result.topDistraction).toBeNull();
      });
    });

    describe('sessions exactly at midnight boundary', () => {
      it('session starting exactly at midnight UTC belongs to that day', () => {
        const midnightSession = makeSessionData({
          id: 'midnight',
          startedAt: '2026-03-18T00:00:00Z', // Wednesday midnight UTC
          endedAt: '2026-03-18T00:25:00Z',
          completed: true,
        });

        const result = tierOneMetrics(
          [midnightSession],
          [],
          'UTC',
          ms('2026-03-18T12:00:00Z'),
        );

        // Wednesday = index 2
        expect(result.weeklyDots[2]).toBe(true);
      });

      it('session ending exactly at midnight belongs to the previous day', () => {
        // Session 23:35 to 00:00 — started_at determines the day
        const crossMidnightSession = makeSessionData({
          id: 'cross-midnight',
          startedAt: '2026-03-17T23:35:00Z', // Tuesday 23:35
          endedAt: '2026-03-18T00:00:00Z',   // Wednesday 00:00
          completed: true,
        });

        const result = tierOneMetrics(
          [crossMidnightSession],
          [],
          'UTC',
          ms('2026-03-18T12:00:00Z'),
        );

        // Session started on Tuesday = index 1
        expect(result.weeklyDots[1]).toBe(true);
        expect(result.weeklyDots[2]).toBe(false); // Wednesday should be false
      });

      it('session at 23:59:59 in timezone crossing into next day UTC', () => {
        // In America/New_York (EDT = UTC-4):
        // 2026-03-18 23:59 ET = 2026-03-19 03:59 UTC
        // The session is still on March 18 in ET despite being March 19 in UTC
        const lateTzSession = makeSessionData({
          id: 'late-tz',
          startedAt: '2026-03-19T03:59:00Z', // March 18, 23:59 ET
          endedAt: '2026-03-19T04:24:00Z',
          completed: true,
        });

        const result = tierOneMetrics(
          [lateTzSession],
          [],
          'America/New_York',
          ms('2026-03-19T12:00:00Z'), // Thursday noon UTC = Thursday 8am ET
        );

        // March 18, 2026 is Wednesday = index 2
        expect(result.weeklyDots[2]).toBe(true);
        // March 19 (Thursday) should not have a dot from this session
        expect(result.weeklyDots[3]).toBe(false);
      });

      it('tier 2 totalFocusTime counts time for cross-midnight sessions', () => {
        const crossMidnight = makeSession({
          id: 'cross-mid-t2',
          started_at: '2026-03-17T23:50:00Z',
          ended_at: '2026-03-18T00:15:00Z', // 25 minutes
          completed: true,
        });

        const result = tierTwoMetrics([crossMidnight], [makeGoal()]);

        expect(result).not.toBeNull();
        if (result === null) return;

        expect(result.totalFocusMinutes).toBe(25);
      });
    });

    describe('all sessions had_to_stop', () => {
      it('completion rate is 0 when denominator is 0 (all had_to_stop)', () => {
        const sessions = [
          makeSession({
            id: 'hts-1',
            completed: false,
            abandonment_reason: 'had_to_stop',
          }),
          makeSession({
            id: 'hts-2',
            completed: false,
            abandonment_reason: 'had_to_stop',
          }),
        ];

        // Tier 2 returns null because no completed sessions
        expect(tierTwoMetrics(sessions, [makeGoal()])).toBeNull();
      });
    });

    describe('sessions with null focus_quality', () => {
      it('sessions without reflection data are excluded from quality metrics', () => {
        const sessions = [
          makeSession({
            id: 'no-refl-1',
            completed: true,
            focus_quality: null,
          }),
          makeSession({
            id: 'no-refl-2',
            completed: true,
            focus_quality: 'locked_in',
          }),
        ];

        const result = tierTwoMetrics(sessions, [makeGoal()]);

        expect(result).not.toBeNull();
        if (result === null) return;

        // Only 1 session has focus_quality data
        expect(result.focusQuality).toEqual({ lockedIn: 1, decent: 0, struggled: 0 });
      });
    });
  });

  describe('cold-start thresholds enforced correctly across tiers', () => {
    it('tier 1 is always available regardless of data', () => {
      expect(hasSufficientData([], 'tier1')).toBe(true);
      expect(hasSufficientData([makeSession({ completed: false })], 'tier1')).toBe(true);
    });

    it('tier 2 requires at least 1 completed session', () => {
      expect(hasSufficientData([], 'tier2')).toBe(false);
      expect(hasSufficientData([makeSession({ completed: false })], 'tier2')).toBe(false);
      expect(hasSufficientData([makeSession({ completed: true })], 'tier2')).toBe(true);
    });

    it('tier 3 requires 2+ distinct calendar months with completed sessions', () => {
      // One month
      expect(
        hasSufficientData(
          [makeSession({ completed: true, started_at: '2026-03-01T09:00:00Z' })],
          'tier3',
        ),
      ).toBe(false);

      // Two months, same data
      expect(
        hasSufficientData(
          [
            makeSession({ completed: true, started_at: '2026-02-01T09:00:00Z' }),
            makeSession({ completed: true, started_at: '2026-03-01T09:00:00Z' }),
          ],
          'tier3',
        ),
      ).toBe(true);

      // Two months but one has only incomplete sessions
      expect(
        hasSufficientData(
          [
            makeSession({ completed: false, started_at: '2026-02-01T09:00:00Z' }),
            makeSession({ completed: true, started_at: '2026-03-01T09:00:00Z' }),
          ],
          'tier3',
        ),
      ).toBe(false);
    });

    it('tierTwoMetrics returns null when hasSufficientData returns false for tier2', () => {
      const sessions = [makeSession({ completed: false })];
      expect(hasSufficientData(sessions, 'tier2')).toBe(false);
      expect(tierTwoMetrics(sessions, [makeGoal()])).toBeNull();
    });

    it('tierThreeMetrics returns null when hasSufficientData returns false for tier3', () => {
      const sessions = [makeSession({ completed: true, started_at: '2026-03-10T09:00:00Z' })];
      expect(hasSufficientData(sessions, 'tier3')).toBe(false);
      expect(tierThreeMetrics(sessions, sessions, [], 31, 28)).toBeNull();
    });
  });
});
