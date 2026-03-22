import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { totalFocusTime } from './total-time.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    user_id: 'user-1',
    process_goal_id: 'goal-1',
    intention_text: null,
    started_at: '2026-03-20T09:00:00.000Z',
    ended_at: '2026-03-20T09:25:00.000Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: null,
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-20T09:00:00.000Z',
    ...overrides,
  };
}

describe('totalFocusTime', () => {
  it('returns 0 for an empty sessions array', () => {
    expect(totalFocusTime([])).toBe(0);
  });

  it('sums duration of a single completed session in minutes', () => {
    const sessions = [
      makeSession({
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
    ];
    expect(totalFocusTime(sessions)).toBe(25);
  });

  it('sums durations of multiple completed sessions', () => {
    const sessions = [
      makeSession({
        id: 's1',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
      makeSession({
        id: 's2',
        started_at: '2026-03-20T10:00:00.000Z',
        ended_at: '2026-03-20T10:50:00.000Z',
        completed: true,
      }),
    ];
    // 25 + 50 = 75 minutes
    expect(totalFocusTime(sessions)).toBe(75);
  });

  it('excludes sessions where completed is false', () => {
    const sessions = [
      makeSession({
        id: 's1',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:25:00.000Z',
        completed: true,
      }),
      makeSession({
        id: 's2',
        started_at: '2026-03-20T10:00:00.000Z',
        ended_at: '2026-03-20T10:25:00.000Z',
        completed: false,
      }),
    ];
    expect(totalFocusTime(sessions)).toBe(25);
  });

  it('excludes sessions with null ended_at', () => {
    const sessions = [
      makeSession({
        id: 's1',
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: null,
        completed: true,
      }),
    ];
    expect(totalFocusTime(sessions)).toBe(0);
  });

  it('handles fractional minutes correctly', () => {
    const sessions = [
      makeSession({
        started_at: '2026-03-20T09:00:00.000Z',
        ended_at: '2026-03-20T09:00:30.000Z', // 30 seconds = 0.5 minutes
        completed: true,
      }),
    ];
    expect(totalFocusTime(sessions)).toBe(0.5);
  });

  it('ignores sessions where ended_at is before started_at', () => {
    const sessions = [
      makeSession({
        started_at: '2026-03-20T10:00:00.000Z',
        ended_at: '2026-03-20T09:00:00.000Z',
        completed: true,
      }),
    ];
    expect(totalFocusTime(sessions)).toBe(0);
  });
});
