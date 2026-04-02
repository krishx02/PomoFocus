import type { SessionData } from '@pomofocus/core';
import type { ProcessGoal, GoalProgress } from '@pomofocus/core';
import { goalProgress, currentStreak } from '@pomofocus/core';
import { weeklyConsistency } from './weekly-dots.js';

export { weeklyConsistency } from './weekly-dots.js';

export type TierOneResult = {
  readonly goalProgress: readonly GoalProgress[];
  readonly weeklyDots: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  readonly currentStreak: number;
};

/**
 * Returns the UTC offset in minutes for the given IANA timezone at the given
 * timestamp. Positive = east of UTC, negative = west of UTC.
 *
 * Uses Intl.DateTimeFormat to extract the hour/minute offset without relying
 * on getTimezoneOffset() (which only works for the system timezone).
 */
function utcOffsetMinutes(nowTimestamp: number, timezone: string): number {
  const fmt = (tz: string): { year: number; month: number; day: number; hour: number; minute: number } => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(nowTimestamp));

    const get = (t: string): number =>
      Number(parts.find((p) => p.type === t)?.value ?? '0');

    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour') === 24 ? 0 : get('hour'),
      minute: get('minute'),
    };
  };

  const local = fmt(timezone);
  const utc = fmt('UTC');

  const toMinutes = (v: { year: number; month: number; day: number; hour: number; minute: number }): number => {
    const ms = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute);
    return Math.floor(ms / 60_000);
  };

  return toMinutes(local) - toMinutes(utc);
}

/**
 * Returns the start-of-day (inclusive) and start-of-next-day (exclusive) ISO
 * strings in UTC for the given timestamp in the given IANA timezone.
 *
 * The returned strings represent the UTC moments corresponding to midnight
 * and next-midnight in the target timezone. This is needed because
 * `goalProgress()` uses string comparison on ISO timestamps, so the
 * boundaries must be expressed as UTC ISO strings.
 *
 * Pure helper — no side effects, no Date.now().
 */
function todayBoundaries(
  nowTimestamp: number,
  timezone: string,
): { todayStart: string; todayEnd: string } {
  const d = new Date(nowTimestamp);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  // Get the UTC offset at this moment in the target timezone
  const offset = utcOffsetMinutes(nowTimestamp, timezone);

  // Midnight in the target timezone, expressed as UTC ms
  const y = Number(year);
  const m = Number(month);
  const dd = Number(day);
  const localMidnightUtcMs = Date.UTC(y, m - 1, dd) - offset * 60_000;
  const nextLocalMidnightUtcMs = Date.UTC(y, m - 1, dd + 1) - offset * 60_000;

  const todayStart = new Date(localMidnightUtcMs).toISOString();
  const todayEnd = new Date(nextLocalMidnightUtcMs).toISOString();

  return { todayStart, todayEnd };
}

/**
 * Tier 1 aggregate — composes all Tier 1 metrics into a single response.
 *
 * Tier 1 metrics are "glanceable" — goal progress, weekly dots, streak.
 * Available on all platforms including BLE device (ADR-014).
 *
 * Pure function — no IO, no Date.now(). Receives current time as
 * `nowTimestamp` (Unix ms) and the user's IANA timezone string.
 *
 * Cold-start: 0 sessions = empty goalProgress, all-false weeklyDots,
 * currentStreak 0. Still a valid result — never returns null.
 */
export function tierOneMetrics(
  sessions: readonly SessionData[],
  goals: readonly ProcessGoal[],
  timezone: string,
  nowTimestamp: number,
): TierOneResult {
  // ── Goal Progress ──
  const { todayStart, todayEnd } = todayBoundaries(nowTimestamp, timezone);
  const progress = goalProgress(goals, sessions, todayStart, todayEnd);

  // ── Weekly Dots ──
  // weeklyConsistency expects Pick<Session, 'started_at' | 'completed'>
  // Convert SessionData (camelCase) to the snake_case shape
  const weeklyDotsSessions = sessions.map((s) => ({
    started_at: s.startedAt,
    completed: s.completed,
  }));
  const dots = weeklyConsistency(weeklyDotsSessions, timezone, nowTimestamp);

  // ── Current Streak ──
  // currentStreak expects StreakSession[] with startedAtMs (number) + completed
  const streakSessions = sessions.map((s) => ({
    startedAtMs: new Date(s.startedAt).getTime(),
    completed: s.completed,
  }));
  const offset = utcOffsetMinutes(nowTimestamp, timezone);
  const streak = currentStreak(streakSessions, offset, nowTimestamp);

  return {
    goalProgress: progress,
    weeklyDots: dots,
    currentStreak: streak.currentStreak,
  };
}
