import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { distractionPatterns, perGoalBreakdown } from './distractions.js';

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

describe('distractionPatterns', () => {
  it('returns the most common distraction type among struggled sessions', () => {
    const sessions = [
      makeSession({
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        focus_quality: 'struggled',
        distraction_type: 'phone',
      }),
      makeSession({
        focus_quality: 'struggled',
        distraction_type: 'thoughts_wandering',
      }),
    ];

    const result = distractionPatterns(sessions);
    expect(result).toEqual({ type: 'phone', count: 2 });
  });

  it('returns null when no struggled sessions exist', () => {
    const sessions = [
      makeSession({ focus_quality: 'locked_in', distraction_type: null }),
      makeSession({ focus_quality: 'decent', distraction_type: null }),
    ];

    const result = distractionPatterns(sessions);
    expect(result).toBeNull();
  });

  it('returns null for empty sessions', () => {
    const result = distractionPatterns([]);
    expect(result).toBeNull();
  });

  it('ignores struggled sessions with null distraction_type', () => {
    const sessions = [
      makeSession({
        focus_quality: 'struggled',
        distraction_type: null,
      }),
    ];

    const result = distractionPatterns(sessions);
    expect(result).toBeNull();
  });

  it('ignores non-struggled sessions even with distraction_type', () => {
    const sessions = [
      makeSession({
        focus_quality: 'decent',
        distraction_type: 'phone',
      }),
      makeSession({
        focus_quality: 'struggled',
        distraction_type: 'people',
      }),
    ];

    const result = distractionPatterns(sessions);
    expect(result).toEqual({ type: 'people', count: 1 });
  });

  it('picks the type with highest count when multiple exist', () => {
    const sessions = [
      makeSession({ focus_quality: 'struggled', distraction_type: 'phone' }),
      makeSession({ focus_quality: 'struggled', distraction_type: 'got_stuck' }),
      makeSession({ focus_quality: 'struggled', distraction_type: 'got_stuck' }),
      makeSession({ focus_quality: 'struggled', distraction_type: 'got_stuck' }),
      makeSession({ focus_quality: 'struggled', distraction_type: 'phone' }),
    ];

    const result = distractionPatterns(sessions);
    expect(result).toEqual({ type: 'got_stuck', count: 3 });
  });
});

describe('perGoalBreakdown', () => {
  it('groups completed sessions by goal with time in minutes', () => {
    const sessions = [
      makeSession({
        process_goal_id: 'goal-a',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z', // 25 min
      }),
      makeSession({
        process_goal_id: 'goal-a',
        completed: true,
        started_at: '2026-03-11T09:00:00Z',
        ended_at: '2026-03-11T09:30:00Z', // 30 min
      }),
      makeSession({
        process_goal_id: 'goal-b',
        completed: true,
        started_at: '2026-03-10T14:00:00Z',
        ended_at: '2026-03-10T14:25:00Z', // 25 min
      }),
    ];

    const result = perGoalBreakdown(sessions);
    expect(result).toHaveLength(2);

    const goalA = result.find((g) => g.goalId === 'goal-a');
    expect(goalA).toEqual(
      expect.objectContaining({ sessions: 2 }),
    );
    expect(goalA?.focusMinutes).toBeCloseTo(55);

    const goalB = result.find((g) => g.goalId === 'goal-b');
    expect(goalB).toEqual(
      expect.objectContaining({ sessions: 1 }),
    );
    expect(goalB?.focusMinutes).toBeCloseTo(25);
  });

  it('excludes non-completed sessions', () => {
    const sessions = [
      makeSession({
        process_goal_id: 'goal-a',
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: '2026-03-10T09:25:00Z',
      }),
      makeSession({
        process_goal_id: 'goal-a',
        completed: false,
        started_at: '2026-03-11T09:00:00Z',
        ended_at: '2026-03-11T09:30:00Z',
      }),
    ];

    const result = perGoalBreakdown(sessions);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ sessions: 1 }),
    );
  });

  it('excludes sessions without ended_at', () => {
    const sessions = [
      makeSession({
        completed: true,
        started_at: '2026-03-10T09:00:00Z',
        ended_at: null,
      }),
    ];

    const result = perGoalBreakdown(sessions);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const result = perGoalBreakdown([]);
    expect(result).toEqual([]);
  });
});
