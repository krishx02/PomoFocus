import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { completionRate } from './completion-rate.js';

function makeSession(
  overrides: Partial<Session> = {},
): Session {
  return {
    id: 'session-1',
    user_id: 'user-1',
    process_goal_id: 'goal-1',
    intention_text: null,
    started_at: '2026-03-22T09:00:00Z',
    ended_at: '2026-03-22T09:25:00Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: null,
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-22T09:00:00Z',
    ...overrides,
  };
}

describe('completionRate', () => {
  it('returns 0 for empty sessions array', () => {
    expect(completionRate([])).toBe(0);
  });

  it('returns 1 when all sessions are completed', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: true }),
      makeSession({ id: 's3', completed: true }),
    ];
    expect(completionRate(sessions)).toBe(1);
  });

  it('returns 0 when no sessions are completed', () => {
    const sessions = [
      makeSession({ id: 's1', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'gave_up' }),
    ];
    expect(completionRate(sessions)).toBe(0);
  });

  it('excludes had_to_stop sessions from the denominator', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'had_to_stop' }),
      makeSession({ id: 's3', completed: false, abandonment_reason: 'gave_up' }),
    ];
    // denominator = 3 - 1 (had_to_stop) = 2
    // completed = 1
    // rate = 1/2 = 0.5
    expect(completionRate(sessions)).toBe(0.5);
  });

  it('treats NULL abandonment_reason as gave_up (counts against)', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: false, abandonment_reason: null }),
    ];
    // NULL reason is NOT had_to_stop, so it stays in denominator
    // denominator = 2, completed = 1, rate = 0.5
    expect(completionRate(sessions)).toBe(0.5);
  });

  it('returns 0 when all sessions are had_to_stop (denominator is 0)', () => {
    const sessions = [
      makeSession({ id: 's1', completed: false, abandonment_reason: 'had_to_stop' }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'had_to_stop' }),
    ];
    expect(completionRate(sessions)).toBe(0);
  });

  it('returns value in 0-1 range for mixed sessions', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: true }),
      makeSession({ id: 's3', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's4', completed: false, abandonment_reason: 'had_to_stop' }),
      makeSession({ id: 's5', completed: false, abandonment_reason: null }),
    ];
    // denominator = 5 - 1 (had_to_stop) = 4
    // completed = 2
    // rate = 2/4 = 0.5
    expect(completionRate(sessions)).toBe(0.5);
  });

  it('returns 1 when single completed session exists', () => {
    const sessions = [makeSession({ id: 's1', completed: true })];
    expect(completionRate(sessions)).toBe(1);
  });

  it('handles mix of had_to_stop and completed sessions', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: true }),
      makeSession({ id: 's3', completed: false, abandonment_reason: 'had_to_stop' }),
    ];
    // denominator = 3 - 1 = 2, completed = 2, rate = 1
    expect(completionRate(sessions)).toBe(1);
  });

  it('returns a number between 0 and 1 inclusive', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's3', completed: false, abandonment_reason: null }),
    ];
    const rate = completionRate(sessions);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});
