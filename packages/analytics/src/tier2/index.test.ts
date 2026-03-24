import { describe, it, expect } from 'vitest';
import type { ProcessGoal, Session } from '@pomofocus/types';
import type { TierTwoResult } from './index.js';
import { tierTwoMetrics } from './index.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
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

function assertNotNull(value: TierTwoResult | null): asserts value is TierTwoResult {
  expect(value).not.toBeNull();
}

describe('tierTwoMetrics', () => {
  it('returns null when sessions array is empty (cold start)', () => {
    const goals = [makeGoal()];
    expect(tierTwoMetrics([], goals)).toBeNull();
  });

  it('returns null when no sessions are completed (cold start)', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'had_to_stop' }),
    ];
    expect(tierTwoMetrics(sessions, goals)).toBeNull();
  });

  it('returns full WeeklyResponse shape for valid data', () => {
    const goals = [
      makeGoal({ id: 'goal-1', title: 'Study Calculus' }),
      makeGoal({ id: 'goal-2', title: 'Read Philosophy' }),
    ];
    const sessions = [
      makeSession({
        id: 's1',
        process_goal_id: 'goal-1',
        started_at: '2026-03-22T09:00:00Z',
        ended_at: '2026-03-22T09:25:00Z',
        completed: true,
        focus_quality: 'locked_in',
      }),
      makeSession({
        id: 's2',
        process_goal_id: 'goal-1',
        started_at: '2026-03-22T10:00:00Z',
        ended_at: '2026-03-22T10:25:00Z',
        completed: true,
        focus_quality: 'decent',
      }),
      makeSession({
        id: 's3',
        process_goal_id: 'goal-2',
        started_at: '2026-03-22T14:00:00Z',
        ended_at: '2026-03-22T14:50:00Z',
        completed: true,
        focus_quality: 'struggled',
      }),
    ];

    const result = tierTwoMetrics(sessions, goals);

    assertNotNull(result);
    expect(result).toEqual({
      completionRate: 1,
      focusQuality: { lockedIn: 1, decent: 1, struggled: 1 },
      totalFocusMinutes: 100, // 25 + 25 + 50
      peakFocusWindow: null, // < 5 sessions with quality data
      perGoal: [
        { goalId: 'goal-1', goalTitle: 'Study Calculus', sessions: 2, focusMinutes: 50 },
        { goalId: 'goal-2', goalTitle: 'Read Philosophy', sessions: 1, focusMinutes: 50 },
      ],
      sessionCount: 3,
    });
  });

  it('includes incomplete sessions in sessionCount', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({
        id: 's1',
        completed: true,
        started_at: '2026-03-22T09:00:00Z',
        ended_at: '2026-03-22T09:25:00Z',
      }),
      makeSession({
        id: 's2',
        completed: false,
        abandonment_reason: 'gave_up',
        started_at: '2026-03-22T10:00:00Z',
        ended_at: '2026-03-22T10:10:00Z',
      }),
    ];

    const result = tierTwoMetrics(sessions, goals);
    assertNotNull(result);
    expect(result.sessionCount).toBe(2);
  });

  it('returns peakFocusWindow when >= 5 sessions have focus quality', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({
        id: 's1',
        started_at: '2026-03-22T09:00:00Z',
        ended_at: '2026-03-22T09:25:00Z',
        completed: true,
        focus_quality: 'locked_in',
      }),
      makeSession({
        id: 's2',
        started_at: '2026-03-22T09:30:00Z',
        ended_at: '2026-03-22T09:55:00Z',
        completed: true,
        focus_quality: 'locked_in',
      }),
      makeSession({
        id: 's3',
        started_at: '2026-03-22T10:00:00Z',
        ended_at: '2026-03-22T10:25:00Z',
        completed: true,
        focus_quality: 'decent',
      }),
      makeSession({
        id: 's4',
        started_at: '2026-03-22T10:30:00Z',
        ended_at: '2026-03-22T10:55:00Z',
        completed: true,
        focus_quality: 'decent',
      }),
      makeSession({
        id: 's5',
        started_at: '2026-03-22T11:00:00Z',
        ended_at: '2026-03-22T11:25:00Z',
        completed: true,
        focus_quality: 'struggled',
      }),
    ];

    const result = tierTwoMetrics(sessions, goals);
    assertNotNull(result);
    // Bucket 4 (08-10): 2 locked_in sessions, avg = (3+3)/2 = 3.0
    // Bucket 5 (10-12): 3 sessions (decent, decent, struggled), avg = (2+2+1)/3 ≈ 1.667
    expect(result.peakFocusWindow).toEqual({ hour: 8, avgQuality: 3 });
  });

  it('returns peakFocusWindow as null when < 5 sessions have focus quality', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({
        id: 's1',
        completed: true,
        focus_quality: 'locked_in',
      }),
      makeSession({
        id: 's2',
        completed: true,
        focus_quality: 'decent',
      }),
    ];

    const result = tierTwoMetrics(sessions, goals);
    assertNotNull(result);
    expect(result.peakFocusWindow).toBeNull();
  });

  it('computes completionRate correctly with mixed completed/abandoned sessions', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({ id: 's1', completed: true }),
      makeSession({ id: 's2', completed: false, abandonment_reason: 'gave_up' }),
      makeSession({ id: 's3', completed: false, abandonment_reason: 'had_to_stop' }),
    ];

    const result = tierTwoMetrics(sessions, goals);
    assertNotNull(result);
    // denominator = 3 - 1 (had_to_stop) = 2, completed = 1, rate = 0.5
    expect(result.completionRate).toBe(0.5);
  });

  it('handles single completed session (minimum non-null case)', () => {
    const goals = [makeGoal()];
    const sessions = [
      makeSession({
        id: 's1',
        completed: true,
        started_at: '2026-03-22T09:00:00Z',
        ended_at: '2026-03-22T09:25:00Z',
        focus_quality: 'locked_in',
      }),
    ];

    const result = tierTwoMetrics(sessions, goals);
    assertNotNull(result);
    expect(result.completionRate).toBe(1);
    expect(result.focusQuality).toEqual({ lockedIn: 1, decent: 0, struggled: 0 });
    expect(result.totalFocusMinutes).toBe(25);
    expect(result.peakFocusWindow).toBeNull();
    expect(result.sessionCount).toBe(1);
    expect(result.perGoal).toHaveLength(1);
  });

  it('passes empty goals array without error', () => {
    const sessions = [
      makeSession({
        id: 's1',
        completed: true,
        process_goal_id: 'orphan-goal',
        started_at: '2026-03-22T09:00:00Z',
        ended_at: '2026-03-22T09:25:00Z',
      }),
    ];

    const result = tierTwoMetrics(sessions, []);
    assertNotNull(result);
    expect(result.perGoal).toEqual([
      { goalId: 'orphan-goal', goalTitle: 'orphan-goal', sessions: 1, focusMinutes: 25 },
    ]);
  });
});
