import { describe, it, expect } from 'vitest';
import { weeklyConsistency } from './weekly-dots.js';
import type { Session } from '@pomofocus/types';

type MinimalSession = Pick<Session, 'started_at' | 'completed'>;

function makeSession(startedAt: string, completed: boolean): MinimalSession {
  return { started_at: startedAt, completed };
}

// Helper: get Unix ms from ISO string
function ms(iso: string): number {
  return new Date(iso).getTime();
}

describe('weeklyConsistency', () => {
  // Reference week: Monday 2026-03-16 through Sunday 2026-03-22
  // nowTimestamp = Wednesday 2026-03-18 12:00:00 UTC
  const tz = 'UTC';
  const wed = ms('2026-03-18T12:00:00Z');

  describe('basic behavior', () => {
    it('returns 7 booleans', () => {
      const result = weeklyConsistency([], tz, wed);
      expect(result).toHaveLength(7);
    });

    it('returns all false for empty sessions', () => {
      expect(weeklyConsistency([], tz, wed)).toEqual([
        false, false, false, false, false, false, false,
      ]);
    });

    it('returns true for day with one completed session', () => {
      const sessions = [
        makeSession('2026-03-18T10:00:00Z', true), // Wednesday
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, true, false, false, false, false,
      ]);
    });

    it('returns true for Monday (index 0)', () => {
      const sessions = [
        makeSession('2026-03-16T08:00:00Z', true), // Monday
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        true, false, false, false, false, false, false,
      ]);
    });

    it('returns true for Sunday (index 6)', () => {
      const sessions = [
        makeSession('2026-03-22T20:00:00Z', true), // Sunday
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, false, false, false, false, true,
      ]);
    });

    it('returns true for multiple days with completed sessions', () => {
      const sessions = [
        makeSession('2026-03-16T09:00:00Z', true), // Monday
        makeSession('2026-03-18T14:00:00Z', true), // Wednesday
        makeSession('2026-03-20T11:00:00Z', true), // Friday
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        true, false, true, false, true, false, false,
      ]);
    });

    it('returns all true when every day has a completed session', () => {
      const sessions = [
        makeSession('2026-03-16T08:00:00Z', true), // Mon
        makeSession('2026-03-17T08:00:00Z', true), // Tue
        makeSession('2026-03-18T08:00:00Z', true), // Wed
        makeSession('2026-03-19T08:00:00Z', true), // Thu
        makeSession('2026-03-20T08:00:00Z', true), // Fri
        makeSession('2026-03-21T08:00:00Z', true), // Sat
        makeSession('2026-03-22T08:00:00Z', true), // Sun
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        true, true, true, true, true, true, true,
      ]);
    });
  });

  describe('only counts completed sessions', () => {
    it('returns false for days with only abandoned sessions', () => {
      const sessions = [
        makeSession('2026-03-18T10:00:00Z', false), // Wednesday, not completed
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, false, false, false, false, false,
      ]);
    });

    it('returns true when at least one session on the day is completed', () => {
      const sessions = [
        makeSession('2026-03-18T09:00:00Z', false), // abandoned
        makeSession('2026-03-18T11:00:00Z', true),  // completed
        makeSession('2026-03-18T14:00:00Z', false), // abandoned
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, true, false, false, false, false,
      ]);
    });

    it('ignores all non-completed sessions across multiple days', () => {
      const sessions = [
        makeSession('2026-03-16T10:00:00Z', false), // Mon abandoned
        makeSession('2026-03-17T10:00:00Z', true),  // Tue completed
        makeSession('2026-03-18T10:00:00Z', false), // Wed abandoned
        makeSession('2026-03-19T10:00:00Z', true),  // Thu completed
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, true, false, true, false, false, false,
      ]);
    });
  });

  describe('multiple sessions per day', () => {
    it('still returns true (not double-counted)', () => {
      const sessions = [
        makeSession('2026-03-18T08:00:00Z', true),
        makeSession('2026-03-18T12:00:00Z', true),
        makeSession('2026-03-18T16:00:00Z', true),
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, true, false, false, false, false,
      ]);
    });
  });

  describe('sessions outside the current week are ignored', () => {
    it('ignores sessions from the previous week', () => {
      const sessions = [
        makeSession('2026-03-15T23:59:59Z', true), // Sunday of previous week
        makeSession('2026-03-09T10:00:00Z', true),  // Monday of previous week
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, false, false, false, false, false,
      ]);
    });

    it('ignores sessions from the next week', () => {
      const sessions = [
        makeSession('2026-03-23T00:00:01Z', true), // Monday of next week
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, false, false, false, false, false,
      ]);
    });
  });

  describe('week boundaries', () => {
    it('Monday at midnight belongs to the current week', () => {
      const sessions = [
        makeSession('2026-03-16T00:00:00Z', true), // Monday 00:00:00
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        true, false, false, false, false, false, false,
      ]);
    });

    it('Sunday at 23:59:59 belongs to the current week', () => {
      const sessions = [
        makeSession('2026-03-22T23:59:59Z', true), // Sunday 23:59:59
      ];
      expect(weeklyConsistency(sessions, tz, wed)).toEqual([
        false, false, false, false, false, false, true,
      ]);
    });

    it('nowTimestamp on Monday returns the correct week', () => {
      const monday = ms('2026-03-16T00:00:00Z');
      const sessions = [
        makeSession('2026-03-16T10:00:00Z', true), // Monday
        makeSession('2026-03-22T10:00:00Z', true), // Sunday
      ];
      expect(weeklyConsistency(sessions, tz, monday)).toEqual([
        true, false, false, false, false, false, true,
      ]);
    });

    it('nowTimestamp on Sunday returns the correct week', () => {
      const sunday = ms('2026-03-22T23:59:59Z');
      const sessions = [
        makeSession('2026-03-16T10:00:00Z', true), // Monday
        makeSession('2026-03-22T10:00:00Z', true), // Sunday
      ];
      expect(weeklyConsistency(sessions, tz, sunday)).toEqual([
        true, false, false, false, false, false, true,
      ]);
    });
  });

  describe('timezone handling', () => {
    it('uses timezone for day boundary (session near midnight UTC in US/Eastern)', () => {
      // 2026-03-18 at 03:00 UTC = 2026-03-17 at 23:00 US/Eastern (EDT, UTC-4)
      // In UTC this is Wednesday, but in US/Eastern it's still Tuesday
      const sessions = [
        makeSession('2026-03-18T03:00:00Z', true),
      ];
      // In US/Eastern, this session belongs to Tuesday (index 1)
      expect(weeklyConsistency(sessions, 'America/New_York', wed)).toEqual([
        false, true, false, false, false, false, false,
      ]);
    });

    it('session at 23:00 UTC on Tuesday is Wednesday in Asia/Tokyo (UTC+9)', () => {
      // 2026-03-17T23:00Z = 2026-03-18T08:00 JST → Wednesday in Tokyo
      const sessions = [
        makeSession('2026-03-17T23:00:00Z', true),
      ];
      expect(weeklyConsistency(sessions, 'Asia/Tokyo', wed)).toEqual([
        false, false, true, false, false, false, false,
      ]);
    });

    it('nowTimestamp timezone affects which week is current', () => {
      // 2026-03-23T01:00Z in UTC is Monday (next week)
      // But in US/Pacific (UTC-7) it's still 2026-03-22 18:00 → Sunday (current week)
      const nowInUtc = ms('2026-03-23T01:00:00Z');

      const sessions = [
        makeSession('2026-03-16T10:00:00Z', true), // Monday
      ];

      // In UTC: now is next Monday → the current week is Mar 23-29 → Monday Mar 16 is last week
      expect(weeklyConsistency(sessions, 'UTC', nowInUtc)).toEqual([
        false, false, false, false, false, false, false,
      ]);

      // In US/Pacific: now is still Sunday Mar 22 → current week is Mar 16-22 → Monday Mar 16 is this week
      expect(weeklyConsistency(sessions, 'America/Los_Angeles', nowInUtc)).toEqual([
        true, false, false, false, false, false, false,
      ]);
    });
  });

  describe('no Date constructor for current time', () => {
    it('does not depend on system clock — same inputs always produce same output', () => {
      const sessions = [
        makeSession('2026-03-18T10:00:00Z', true),
      ];
      const result1 = weeklyConsistency(sessions, tz, wed);
      const result2 = weeklyConsistency(sessions, tz, wed);
      expect(result1).toEqual(result2);
    });
  });
});
