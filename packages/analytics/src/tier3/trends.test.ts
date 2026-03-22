import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import {
  consistencyTrend,
  completionTrend,
  focusQualityTrend,
  totalTimeTrend,
  monthlyTrends,
} from './trends.js';

/** Helper to create a minimal session with overrides. */
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
    focus_quality: 'locked_in',
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-10T09:00:00Z',
    ...overrides,
  };
}

describe('consistencyTrend', () => {
  it('returns ratio of days with completed sessions', () => {
    const current = [
      makeSession({ started_at: '2026-03-01T09:00:00Z' }),
      makeSession({ started_at: '2026-03-02T09:00:00Z' }),
      makeSession({ started_at: '2026-03-02T14:00:00Z' }), // same day
    ];
    const previous = [
      makeSession({ started_at: '2026-02-05T09:00:00Z' }),
    ];

    const result = consistencyTrend(current, previous, 31, 28);
    expect(result.current).toBeCloseTo(2 / 31);
    expect(result.previous).toBeCloseTo(1 / 28);
  });

  it('returns 0 for months with no sessions', () => {
    const result = consistencyTrend([], [], 31, 28);
    expect(result).toEqual({ current: 0, previous: 0 });
  });

  it('excludes non-completed sessions from day count', () => {
    const current = [
      makeSession({ started_at: '2026-03-01T09:00:00Z', completed: false }),
      makeSession({ started_at: '2026-03-02T09:00:00Z', completed: true }),
    ];
    const result = consistencyTrend(current, [], 31, 28);
    expect(result.current).toBeCloseTo(1 / 31);
  });

  it('handles 0 total days without division error', () => {
    const result = consistencyTrend([], [], 0, 0);
    expect(result).toEqual({ current: 0, previous: 0 });
  });
});

describe('completionTrend', () => {
  it('computes completion rate excluding had_to_stop sessions', () => {
    const current = [
      makeSession({ completed: true }),
      makeSession({ completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ completed: false, abandonment_reason: 'had_to_stop' }),
    ];
    // had_to_stop excluded: 1 completed / (3 - 1 had_to_stop) = 1/2
    const previous = [
      makeSession({ completed: true }),
      makeSession({ completed: true }),
    ];
    // 2 completed / 2 total = 1.0

    const result = completionTrend(current, previous);
    expect(result.current).toBeCloseTo(0.5);
    expect(result.previous).toBeCloseTo(1.0);
  });

  it('returns 0 when all sessions are had_to_stop', () => {
    const sessions = [
      makeSession({ completed: false, abandonment_reason: 'had_to_stop' }),
    ];
    const result = completionTrend(sessions, []);
    expect(result.current).toBe(0);
    expect(result.previous).toBe(0);
  });

  it('returns 0 for empty sessions', () => {
    const result = completionTrend([], []);
    expect(result).toEqual({ current: 0, previous: 0 });
  });

  it('treats null abandonment_reason as gave_up (not excluded)', () => {
    const sessions = [
      makeSession({ completed: false, abandonment_reason: null }),
      makeSession({ completed: true }),
    ];
    // 1 completed / (2 total - 0 had_to_stop) = 0.5
    const result = completionTrend(sessions, []);
    expect(result.current).toBeCloseTo(0.5);
  });
});

describe('focusQualityTrend', () => {
  it('computes percentage of locked_in among completed sessions', () => {
    const current = [
      makeSession({ completed: true, focus_quality: 'locked_in' }),
      makeSession({ completed: true, focus_quality: 'decent' }),
      makeSession({ completed: true, focus_quality: 'struggled' }),
    ];
    const previous = [
      makeSession({ completed: true, focus_quality: 'locked_in' }),
      makeSession({ completed: true, focus_quality: 'locked_in' }),
    ];

    const result = focusQualityTrend(current, previous);
    expect(result.current).toBeCloseTo(1 / 3);
    expect(result.previous).toBeCloseTo(1.0);
  });

  it('returns 0 when no completed sessions', () => {
    const sessions = [makeSession({ completed: false })];
    const result = focusQualityTrend(sessions, []);
    expect(result.current).toBe(0);
    expect(result.previous).toBe(0);
  });

  it('ignores non-completed sessions', () => {
    const sessions = [
      makeSession({ completed: true, focus_quality: 'locked_in' }),
      makeSession({ completed: false, focus_quality: 'locked_in' }),
    ];
    const result = focusQualityTrend(sessions, []);
    // 1 locked_in / 1 completed = 1.0
    expect(result.current).toBeCloseTo(1.0);
  });
});

describe('totalTimeTrend', () => {
  it('computes total hours from completed sessions', () => {
    const current = [
      makeSession({
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:30:00Z',
      }),
      makeSession({
        completed: true,
        started_at: '2026-03-11T10:00:00Z',
        ended_at: '2026-03-11T10:30:00Z',
      }),
    ];
    const previous = [
      makeSession({
        completed: true,
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T10:00:00Z',
      }),
    ];

    const result = totalTimeTrend(current, previous);
    expect(result.current).toBeCloseTo(1.0); // 30min + 30min = 1h
    expect(result.previous).toBeCloseTo(1.0); // 60min = 1h
  });

  it('excludes non-completed sessions', () => {
    const sessions = [
      makeSession({
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:30:00Z',
      }),
      makeSession({
        completed: false,
        started_at: '2026-03-11T10:00:00Z',
        ended_at: '2026-03-11T11:00:00Z',
      }),
    ];
    const result = totalTimeTrend(sessions, []);
    expect(result.current).toBeCloseTo(0.5); // only 30min
  });

  it('excludes sessions without ended_at', () => {
    const sessions = [
      makeSession({
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: null,
      }),
    ];
    const result = totalTimeTrend(sessions, []);
    expect(result.current).toBe(0);
  });

  it('returns 0 for empty sessions', () => {
    const result = totalTimeTrend([], []);
    expect(result).toEqual({ current: 0, previous: 0 });
  });
});

describe('monthlyTrends', () => {
  it('returns all trends when both months have completed sessions', () => {
    const current = [
      makeSession({
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
        focus_quality: 'locked_in',
      }),
    ];
    const previous = [
      makeSession({
        completed: true,
        started_at: '2026-02-10T09:00:00Z',
        ended_at: '2026-02-10T09:25:00Z',
        focus_quality: 'decent',
      }),
    ];

    const result = monthlyTrends(current, previous, 31, 28);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('consistency');
    expect(result).toHaveProperty('completionRate');
    expect(result).toHaveProperty('focusQuality');
    expect(result).toHaveProperty('totalHours');
  });

  it('returns null when current month has no completed sessions (cold-start)', () => {
    const current: Session[] = [];
    const previous = [makeSession({ completed: true })];

    const result = monthlyTrends(current, previous, 31, 28);
    expect(result).toBeNull();
  });

  it('returns null when previous month has no completed sessions (cold-start)', () => {
    const current = [makeSession({ completed: true })];
    const previous: Session[] = [];

    const result = monthlyTrends(current, previous, 31, 28);
    expect(result).toBeNull();
  });

  it('returns null when both months have no completed sessions', () => {
    const result = monthlyTrends([], [], 31, 28);
    expect(result).toBeNull();
  });

  it('returns null when sessions exist but none are completed', () => {
    const current = [makeSession({ completed: false })];
    const previous = [makeSession({ completed: false })];

    const result = monthlyTrends(current, previous, 31, 28);
    expect(result).toBeNull();
  });

  it('trend values are correct for known inputs', () => {
    const current = [
      makeSession({
        completed: true,
        started_at: '2026-03-01T09:00:00Z',
        ended_at: '2026-03-01T09:30:00Z',
        focus_quality: 'locked_in',
      }),
      makeSession({
        completed: true,
        started_at: '2026-03-02T09:00:00Z',
        ended_at: '2026-03-02T09:30:00Z',
        focus_quality: 'decent',
      }),
    ];
    const previous = [
      makeSession({
        completed: true,
        started_at: '2026-02-15T09:00:00Z',
        ended_at: '2026-02-15T10:00:00Z',
        focus_quality: 'locked_in',
      }),
    ];

    const result = monthlyTrends(current, previous, 31, 28);
    if (result === null) {
      expect.unreachable('expected non-null result');
      return;
    }

    // consistency: current 2 days / 31, previous 1 day / 28
    expect(result.consistency.current).toBeCloseTo(2 / 31);
    expect(result.consistency.previous).toBeCloseTo(1 / 28);

    // completion: current 2/2 = 1.0, previous 1/1 = 1.0
    expect(result.completionRate.current).toBeCloseTo(1.0);
    expect(result.completionRate.previous).toBeCloseTo(1.0);

    // focus quality: current 1 locked_in / 2 completed = 0.5, previous 1/1 = 1.0
    expect(result.focusQuality.current).toBeCloseTo(0.5);
    expect(result.focusQuality.previous).toBeCloseTo(1.0);

    // total hours: current 30+30 = 60min = 1h, previous 60min = 1h
    expect(result.totalHours.current).toBeCloseTo(1.0);
    expect(result.totalHours.previous).toBeCloseTo(1.0);
  });
});
