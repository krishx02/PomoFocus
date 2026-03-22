import type { Session } from '@pomofocus/types';

/**
 * Returns the day-of-week index (0=Monday .. 6=Sunday, ISO 8601) and
 * the calendar date string (YYYY-MM-DD) for a given UTC-millisecond
 * timestamp, interpreted in the supplied IANA timezone.
 */
function dayInfoInTimezone(
  timestampMs: number,
  timezone: string,
): { dayIndex: number; dateKey: string } {
  const d = new Date(timestampMs);

  // Get year, month, day in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const dateKey = `${year}-${month}-${day}`;

  // Get the JS weekday (0=Sunday .. 6=Saturday) in the target timezone
  const weekdayPart = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(d);

  const jsWeekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const jsWeekday = jsWeekdayMap[weekdayPart] ?? 0;

  // Convert JS weekday (0=Sun) to ISO weekday index (0=Mon .. 6=Sun)
  const isoIndex = jsWeekday === 0 ? 6 : jsWeekday - 1;

  return { dayIndex: isoIndex, dateKey };
}

/**
 * Returns the Monday 00:00 date-key for the ISO week containing
 * the given timestamp in the supplied timezone.
 */
function mondayDateKeyForWeek(
  timestampMs: number,
  timezone: string,
): string {
  const { dayIndex, dateKey } = dayInfoInTimezone(timestampMs, timezone);
  // Subtract dayIndex days from the current date to get Monday
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const utcDate = Date.UTC(y, m - 1, d);
  const mondayMs = utcDate - dayIndex * 86_400_000;
  const mondayDate = new Date(mondayMs);
  const my = mondayDate.getUTCFullYear();
  const mm = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
  const md = String(mondayDate.getUTCDate()).padStart(2, '0');
  return `${String(my)}-${mm}-${md}`;
}

/**
 * Weekly continuity dots — Tier 1 analytics (ADR-014).
 *
 * Returns `boolean[7]` for Monday through Sunday (ISO 8601 week).
 * `true` at index N means at least one **completed** session exists
 * on that day (midnight-to-midnight in the given timezone).
 *
 * Index mapping: 0=Monday, 1=Tuesday, ... 6=Sunday.
 *
 * Pure function — receives the current time as `nowTimestamp` (Unix ms),
 * never reads `Date.now()`.
 */
export function weeklyConsistency(
  sessions: readonly Pick<Session, 'started_at' | 'completed'>[],
  timezone: string,
  nowTimestamp: number,
): [boolean, boolean, boolean, boolean, boolean, boolean, boolean] {
  const result: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] =
    [false, false, false, false, false, false, false];

  const mondayKey = mondayDateKeyForWeek(nowTimestamp, timezone);

  // Build the set of date keys for each day of the current week (Mon-Sun)
  const [my, mm, md] = mondayKey.split('-').map(Number) as [number, number, number];
  const mondayMs = Date.UTC(my, mm - 1, md);
  const weekDateKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dayMs = mondayMs + i * 86_400_000;
    const dayDate = new Date(dayMs);
    const dy = dayDate.getUTCFullYear();
    const dm = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getUTCDate()).padStart(2, '0');
    weekDateKeys.push(`${String(dy)}-${dm}-${dd}`);
  }

  // Build a Set of date keys that have at least one completed session
  const completedDateKeys = new Set<string>();
  for (const session of sessions) {
    if (!session.completed) {
      continue;
    }
    const sessionMs = new Date(session.started_at).getTime();
    const { dateKey } = dayInfoInTimezone(sessionMs, timezone);
    completedDateKeys.add(dateKey);
  }

  // Map completed date keys to the boolean array
  for (let i = 0; i < 7; i++) {
    const key = weekDateKeys[i];
    if (key !== undefined && completedDateKeys.has(key)) {
      result[i] = true;
    }
  }

  return result;
}
