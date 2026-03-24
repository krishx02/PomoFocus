import type { StreakResult } from './types.js';

// ── Minimal session shape required for streak calculation ──

export type StreakSession = {
  readonly startedAtMs: number;
  readonly completed: boolean;
};

// ── Pure arithmetic day computation (no Date, no Intl — PKG-C04) ──

const MS_PER_DAY = 86_400_000;

function epochMsToDayNumber(epochMs: number, utcOffsetMinutes: number): number {
  // Shift epoch ms by the UTC offset to get "local" epoch ms,
  // then divide by ms-per-day and floor to get a day number.
  // Day 0 = 1970-01-01 in the given offset.
  const localMs = epochMs + utcOffsetMinutes * 60_000;
  return Math.floor(localMs / MS_PER_DAY);
}

// ── Streak computation (pure function) ──

function computeStreakFromDays(sortedDaysDesc: readonly number[], startDay: number): {
  readonly length: number;
  readonly usedGrace: boolean;
} {
  // sortedDaysDesc: unique day numbers with completed sessions, sorted descending (newest first)
  // startDay: the day number to start counting from

  if (sortedDaysDesc.length === 0) {
    return { length: 0, usedGrace: false };
  }

  let streakLength = 0;
  let usedGrace = false;
  let expectedDay = startDay;
  let dayIndex = 0;

  while (dayIndex < sortedDaysDesc.length) {
    const day = sortedDaysDesc[dayIndex];
    if (day === undefined) break;

    const gap = expectedDay - day;

    if (gap === 0) {
      // This day matches the expected day
      streakLength++;
      expectedDay = day - 1;
      dayIndex++;
    } else if (gap === 1) {
      // 1 day gap — use grace period
      usedGrace = true;
      // Skip the gap day and move expected to the day before
      expectedDay = expectedDay - 1;
      // Don't increment dayIndex — re-check this day against the new expected day
    } else {
      // Gap of 2+ days — streak broken
      break;
    }
  }

  return { length: streakLength, usedGrace };
}

function computeLongestStreak(sortedDaysDesc: readonly number[]): number {
  if (sortedDaysDesc.length === 0) return 0;

  let longest = 0;
  let i = 0;

  while (i < sortedDaysDesc.length) {
    const startDay = sortedDaysDesc[i];
    if (startDay === undefined) break;
    const result = computeStreakFromDays(sortedDaysDesc.slice(i), startDay);
    longest = Math.max(longest, result.length);
    // Skip past the days we just counted (at least 1 to avoid infinite loop)
    i += Math.max(result.length, 1);
  }

  return longest;
}

export function currentStreak(
  sessions: readonly StreakSession[],
  utcOffsetMinutes: number,
  nowTimestamp: number,
): StreakResult {
  // Filter to completed sessions only
  const completedSessions = sessions.filter((s) => s.completed);

  if (completedSessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0, gracePeriodActive: false };
  }

  // Convert each session's startedAtMs to a day number in the user's timezone
  const sessionDayNumbers = completedSessions.map((s) =>
    epochMsToDayNumber(s.startedAtMs, utcOffsetMinutes),
  );

  // Get unique days, sorted descending (newest first)
  const uniqueDays = [...new Set(sessionDayNumbers)].sort((a, b) => b - a);

  // Get today's day number
  const todayDay = epochMsToDayNumber(nowTimestamp, utcOffsetMinutes);

  // Determine the start day for current streak calculation
  const mostRecentDay = uniqueDays[0];
  if (mostRecentDay === undefined) {
    return { currentStreak: 0, longestStreak: 0, gracePeriodActive: false };
  }

  let startDay: number;
  let currentGraceUsed = false;

  if (mostRecentDay === todayDay) {
    startDay = todayDay;
  } else if (todayDay - mostRecentDay === 1) {
    // Most recent session was yesterday — grace period for today
    startDay = mostRecentDay;
    currentGraceUsed = true;
  } else {
    // Most recent session is 2+ days ago — no current streak
    const longestResult = computeLongestStreak(uniqueDays);
    return { currentStreak: 0, longestStreak: longestResult, gracePeriodActive: false };
  }

  // Compute current streak
  const current = computeStreakFromDays(uniqueDays, startDay);
  const currentGracePeriodActive = currentGraceUsed || current.usedGrace;

  // Compute longest streak across all historical data
  const longest = computeLongestStreak(uniqueDays);

  return {
    currentStreak: current.length,
    longestStreak: Math.max(current.length, longest),
    gracePeriodActive: currentGracePeriodActive,
  };
}
