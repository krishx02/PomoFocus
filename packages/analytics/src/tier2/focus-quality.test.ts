import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { focusQualityDistribution } from './focus-quality.js';

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

describe('focusQualityDistribution', () => {
  it('returns all zeros for empty sessions array', () => {
    expect(focusQualityDistribution([])).toEqual({
      lockedIn: 0,
      decent: 0,
      struggled: 0,
    });
  });

  it('returns all zeros when no sessions are completed', () => {
    const sessions = [
      makeSession({ id: 's1', completed: false, abandonment_reason: 'gave_up', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'gave_up', focus_quality: 'decent' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 0,
      decent: 0,
      struggled: 0,
    });
  });

  it('returns all zeros when completed sessions have no reflection data', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: null }),
      makeSession({ id: 's2', completed: true, focus_quality: null }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 0,
      decent: 0,
      struggled: 0,
    });
  });

  it('counts locked_in sessions correctly', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: true, focus_quality: 'locked_in' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 2,
      decent: 0,
      struggled: 0,
    });
  });

  it('counts decent sessions correctly', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'decent' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 0,
      decent: 1,
      struggled: 0,
    });
  });

  it('counts struggled sessions correctly', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'struggled' }),
      makeSession({ id: 's2', completed: true, focus_quality: 'struggled' }),
      makeSession({ id: 's3', completed: true, focus_quality: 'struggled' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 0,
      decent: 0,
      struggled: 3,
    });
  });

  it('distributes across all quality levels', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: true, focus_quality: 'decent' }),
      makeSession({ id: 's3', completed: true, focus_quality: 'struggled' }),
      makeSession({ id: 's4', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's5', completed: true, focus_quality: 'decent' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 2,
      decent: 2,
      struggled: 1,
    });
  });

  it('excludes incomplete sessions even with focus_quality data', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'gave_up', focus_quality: 'struggled' }),
      makeSession({ id: 's3', completed: true, focus_quality: 'decent' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 1,
      decent: 1,
      struggled: 0,
    });
  });

  it('excludes completed sessions without reflection data (focus_quality null)', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: true, focus_quality: null }),
      makeSession({ id: 's3', completed: true, focus_quality: 'decent' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 1,
      decent: 1,
      struggled: 0,
    });
  });

  it('handles mixed scenario with had_to_stop, gave_up, null reason, and completed', () => {
    const sessions = [
      makeSession({ id: 's1', completed: true, focus_quality: 'locked_in' }),
      makeSession({ id: 's2', completed: true, focus_quality: 'decent' }),
      makeSession({ id: 's3', completed: true, focus_quality: null }),
      makeSession({ id: 's4', completed: false, abandonment_reason: 'had_to_stop' }),
      makeSession({ id: 's5', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's6', completed: false, abandonment_reason: null }),
      makeSession({ id: 's7', completed: true, focus_quality: 'struggled' }),
    ];
    expect(focusQualityDistribution(sessions)).toEqual({
      lockedIn: 1,
      decent: 1,
      struggled: 1,
    });
  });
});
