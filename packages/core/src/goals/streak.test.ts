import { describe, it, expect } from 'vitest';
import { currentStreak } from './streak.js';
import type { StreakSession } from './streak.js';

// ── Test helpers ──

// All timestamps are epoch ms. We use simple arithmetic from a known anchor.
// 2026-03-23T12:00:00Z = 1774267200000 (verified externally)
const MAR_23_NOON_UTC = 1774267200000;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

// Helper: epoch ms for noon UTC on a given day relative to 2026-03-23
function dayMs(daysBeforeMar23: number, hoursOffset = 0): number {
  return MAR_23_NOON_UTC - daysBeforeMar23 * MS_PER_DAY + hoursOffset * MS_PER_HOUR;
}

// Helper: create a session with a given epoch ms, completed by default
function session(startedAtMs: number, completed = true): StreakSession {
  return { startedAtMs, completed };
}

// UTC offset = 0 minutes for most tests
const UTC = 0;

describe('currentStreak', () => {
  it('returns 0 for empty sessions array', () => {
    const result = currentStreak([], UTC, dayMs(0));
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, gracePeriodActive: false });
  });

  it('returns 0 when no sessions are completed', () => {
    const sessions = [
      session(dayMs(0), false),
      session(dayMs(1), false),
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, gracePeriodActive: false });
  });

  it('returns 1 for a single completed session today', () => {
    const sessions = [session(dayMs(0))];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, gracePeriodActive: false });
  });

  it('counts consecutive days', () => {
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(1)), // Mar 22
      session(dayMs(2)), // Mar 21
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result).toEqual({ currentStreak: 3, longestStreak: 3, gracePeriodActive: false });
  });

  it('tolerates exactly 1 missed day (grace period)', () => {
    // Sessions on day 23, 21 (skipped 22), 20
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(2)), // Mar 21
      session(dayMs(3)), // Mar 20
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // Gap day 22 is tolerated, but does NOT count toward streak length
    expect(result.currentStreak).toBe(3);
    expect(result.gracePeriodActive).toBe(true);
  });

  it('resets streak after 2 consecutive missed days', () => {
    // Sessions on day 23, 20 (skipped 22 AND 21)
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(3)), // Mar 20
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(1);
  });

  it('gap days do NOT count toward streak length', () => {
    // Sessions on 23, 21, 19 — two gaps (22 and 20) each of 1 day
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(2)), // Mar 21
      session(dayMs(4)), // Mar 19
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // 3 active days, 2 gap days tolerated (each gap is exactly 1 day)
    expect(result.currentStreak).toBe(3);
    expect(result.gracePeriodActive).toBe(true);
  });

  it('only completed sessions count', () => {
    const sessions = [
      session(dayMs(0), false), // Mar 23 — abandoned
      session(dayMs(1), true),  // Mar 22
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // Today has no completed session, yesterday has one
    // Today is a gap day from yesterday — grace period
    expect(result.currentStreak).toBe(1);
    expect(result.gracePeriodActive).toBe(true);
  });

  it('handles multiple sessions on the same day (only needs one completed)', () => {
    const sessions = [
      session(dayMs(0, -4), false), // Mar 23 8am
      session(dayMs(0, -2), true),  // Mar 23 10am
      session(dayMs(0, 2), false),  // Mar 23 2pm
      session(dayMs(1), true),      // Mar 22
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(2);
  });

  it('streak accounts for internal grace period and double gap', () => {
    // 23, 22, (skip 21), 20, (skip 19 AND 18 — two gaps = reset), 17
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(1)), // Mar 22
      session(dayMs(3)), // Mar 20
      session(dayMs(6)), // Mar 17
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // 23, 22, (skip 21), 20 — then 19 and 18 are two consecutive misses
    expect(result.currentStreak).toBe(3);
  });

  it('streak can start from yesterday with grace period active for today', () => {
    // No session today (23), but session yesterday (22) and before
    const sessions = [
      session(dayMs(1)), // Mar 22
      session(dayMs(2)), // Mar 21
      session(dayMs(3)), // Mar 20
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // Today is missed, yesterday starts the streak backward
    expect(result.currentStreak).toBe(3);
    expect(result.gracePeriodActive).toBe(true);
  });

  it('returns 0 when the most recent session is 2+ days ago', () => {
    // No session on 23 or 22, only on 21
    const sessions = [
      session(dayMs(2)), // Mar 21
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    // Two consecutive missed days (22 and 23) — streak reset
    expect(result.currentStreak).toBe(0);
  });

  it('calculates longestStreak across all sessions', () => {
    const sessions = [
      // Current streak: 2 days (23, 22)
      session(dayMs(0)), // Mar 23
      session(dayMs(1)), // Mar 22
      // Gap of 2 days (21, 20) — reset
      // Older streak: 4 days (19, 18, 17, 16)
      session(dayMs(4)), // Mar 19
      session(dayMs(5)), // Mar 18
      session(dayMs(6)), // Mar 17
      session(dayMs(7)), // Mar 16
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(4);
  });

  it('longestStreak equals currentStreak when current is the longest', () => {
    const sessions = [
      session(dayMs(0)), // Mar 23
      session(dayMs(1)), // Mar 22
      session(dayMs(2)), // Mar 21
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('respects timezone offset for day boundaries', () => {
    // Session at 01:00 UTC on Mar 23
    // In UTC-5 (e.g., EST), that's still 8pm Mar 22
    const sessionAt1amUtc = MAR_23_NOON_UTC - 11 * MS_PER_HOUR; // 01:00 UTC Mar 23
    const sessions = [session(sessionAt1amUtc)];

    // utcOffsetMinutes = -300 (UTC-5, i.e., EST)
    const EST = -300;
    // "now" is 05:00 UTC Mar 23 = 00:00 EST Mar 23 (midnight just started)
    const nowAt5amUtc = MAR_23_NOON_UTC - 7 * MS_PER_HOUR;
    const result = currentStreak(sessions, EST, nowAt5amUtc);
    // In EST: session is on March 22, "now" is March 23 — session is yesterday, grace period
    expect(result.currentStreak).toBe(1);
    expect(result.gracePeriodActive).toBe(true);
  });

  it('handles timezone where session crosses midnight boundary', () => {
    // Two sessions:
    // 03:00 UTC = 10pm EST (Mar 22 in EST)
    // 06:00 UTC = 1am EST (Mar 23 in EST)
    const EST = -300;
    const sessionLateEvening = MAR_23_NOON_UTC - 9 * MS_PER_HOUR;  // 03:00 UTC Mar 23
    const sessionEarlyMorning = MAR_23_NOON_UTC - 6 * MS_PER_HOUR; // 06:00 UTC Mar 23
    const sessions = [
      session(sessionLateEvening),   // Mar 22 in EST
      session(sessionEarlyMorning),  // Mar 23 in EST
    ];
    // "now" is 15:00 UTC Mar 23 = 10am EST Mar 23
    const now = MAR_23_NOON_UTC + 3 * MS_PER_HOUR;
    const result = currentStreak(sessions, EST, now);
    // In EST: sessions on March 22 and March 23 — 2-day streak
    expect(result.currentStreak).toBe(2);
    expect(result.gracePeriodActive).toBe(false);
  });

  it('handles nowTimestamp as epoch milliseconds', () => {
    const sessions = [session(MAR_23_NOON_UTC)];
    const result = currentStreak(sessions, UTC, MAR_23_NOON_UTC);
    expect(result.currentStreak).toBe(1);
  });

  it('grace period not active when all days are consecutive', () => {
    const sessions = [
      session(dayMs(0)),
      session(dayMs(1)),
      session(dayMs(2)),
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.gracePeriodActive).toBe(false);
  });

  it('grace period active when today has no session but yesterday does', () => {
    const sessions = [session(dayMs(1))]; // yesterday only
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.gracePeriodActive).toBe(true);
  });

  it('grace period active when a gap day exists within the streak', () => {
    const sessions = [
      session(dayMs(0)), // Mar 23
      // gap on 22
      session(dayMs(2)), // Mar 21
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.gracePeriodActive).toBe(true);
    expect(result.currentStreak).toBe(2);
  });

  it('longest streak accounts for grace periods in historical streaks', () => {
    const sessions = [
      // Current streak: 1 (only today)
      session(dayMs(0)),  // Mar 23
      // 2 consecutive missed days (22, 21) — reset
      // Historical streak: 20, 19, (skip 18), 17, 16 = 4 active days with grace
      session(dayMs(3)),  // Mar 20
      session(dayMs(4)),  // Mar 19
      session(dayMs(6)),  // Mar 17
      session(dayMs(7)),  // Mar 16
    ];
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(4);
  });

  it('handles very long streak (30 consecutive days)', () => {
    const sessions: StreakSession[] = [];
    for (let i = 0; i < 30; i++) {
      sessions.push(session(dayMs(i)));
    }
    const result = currentStreak(sessions, UTC, dayMs(0));
    expect(result.currentStreak).toBe(30);
    expect(result.longestStreak).toBe(30);
  });

  it('positive UTC offset shifts day boundary earlier', () => {
    // UTC+5:30 (India) = 330 minutes
    const IST = 330;
    // Session at 18:00 UTC Mar 22 = 23:30 IST Mar 22
    const sessionEvening = MAR_23_NOON_UTC - 18 * MS_PER_HOUR;
    // Session at 19:00 UTC Mar 22 = 00:30 IST Mar 23
    const sessionAfterMidnight = MAR_23_NOON_UTC - 17 * MS_PER_HOUR;
    const sessions = [
      session(sessionEvening),        // Mar 22 in IST
      session(sessionAfterMidnight),  // Mar 23 in IST
    ];
    // "now" is 06:00 UTC Mar 23 = 11:30 IST Mar 23
    const now = MAR_23_NOON_UTC - 6 * MS_PER_HOUR;
    const result = currentStreak(sessions, IST, now);
    expect(result.currentStreak).toBe(2);
  });
});
