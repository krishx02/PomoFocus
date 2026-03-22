import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { peakFocusWindow } from './peak-window.js';

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
    focus_quality: 'decent',
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-20T09:00:00.000Z',
    ...overrides,
  };
}

describe('peakFocusWindow', () => {
  it('returns null for an empty sessions array', () => {
    expect(peakFocusWindow([])).toBeNull();
  });

  it('returns null when fewer than 5 sessions have focus_quality', () => {
    const sessions = [
      makeSession({ id: 's1', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', focus_quality: 'decent' }),
      makeSession({ id: 's3', focus_quality: 'struggled' }),
      makeSession({ id: 's4', focus_quality: 'locked_in' }),
    ];
    expect(peakFocusWindow(sessions)).toBeNull();
  });

  it('returns null when all sessions have null focus_quality', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ id: `s${String(i)}`, focus_quality: null }),
    );
    expect(peakFocusWindow(sessions)).toBeNull();
  });

  it('returns the bucket with the highest average quality', () => {
    // 5 sessions: 3 locked_in at 8-10am (bucket 4: hours 8-9), 2 struggled at 14-16 (bucket 7: hours 14-15)
    const sessions = [
      makeSession({ id: 's1', started_at: '2026-03-20T08:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', started_at: '2026-03-20T08:30:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's3', started_at: '2026-03-20T09:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's4', started_at: '2026-03-20T14:00:00.000Z', focus_quality: 'struggled' }),
      makeSession({ id: 's5', started_at: '2026-03-20T15:00:00.000Z', focus_quality: 'struggled' }),
    ];
    const result = peakFocusWindow(sessions);
    expect(result).toEqual({ hour: 8, avgQuality: 3 }); // locked_in = 3
  });

  it('uses 2-hour buckets (0-2, 2-4, ... 22-24)', () => {
    // Session at 1am and 0am should be in the same bucket (0-2 = bucket 0)
    // Session at 2am should be in bucket 1 (2-4)
    const sessions = [
      makeSession({ id: 's1', started_at: '2026-03-20T00:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', started_at: '2026-03-20T01:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's3', started_at: '2026-03-20T02:00:00.000Z', focus_quality: 'struggled' }),
      makeSession({ id: 's4', started_at: '2026-03-20T03:00:00.000Z', focus_quality: 'struggled' }),
      makeSession({ id: 's5', started_at: '2026-03-20T00:30:00.000Z', focus_quality: 'locked_in' }),
    ];
    const result = peakFocusWindow(sessions);
    // Bucket 0 (0-2): 3 locked_in = avg 3.0
    // Bucket 1 (2-4): 2 struggled = avg 1.0
    expect(result).toEqual({ hour: 0, avgQuality: 3 });
  });

  it('ignores sessions with null focus_quality for bucketing', () => {
    const sessions = [
      makeSession({ id: 's1', started_at: '2026-03-20T08:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', started_at: '2026-03-20T08:30:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's3', started_at: '2026-03-20T09:00:00.000Z', focus_quality: 'decent' }),
      makeSession({ id: 's4', started_at: '2026-03-20T09:30:00.000Z', focus_quality: 'decent' }),
      makeSession({ id: 's5', started_at: '2026-03-20T09:45:00.000Z', focus_quality: 'decent' }),
      // Null quality session in the same bucket -- should not affect average
      makeSession({ id: 's6', started_at: '2026-03-20T08:15:00.000Z', focus_quality: null }),
    ];
    const result = peakFocusWindow(sessions);
    // Bucket 4 (8-10): locked_in(3) + locked_in(3) + decent(2) + decent(2) + decent(2) = 12/5 = 2.4
    expect(result).toEqual({ hour: 8, avgQuality: 2.4 });
  });

  it('skips null focus_quality sessions when counting threshold', () => {
    // 4 with quality + 6 with null = only 4 qualify -> below threshold
    const sessions = [
      makeSession({ id: 's1', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', focus_quality: 'decent' }),
      makeSession({ id: 's3', focus_quality: 'struggled' }),
      makeSession({ id: 's4', focus_quality: 'locked_in' }),
      ...Array.from({ length: 6 }, (_, i) =>
        makeSession({ id: `null-${String(i)}`, focus_quality: null }),
      ),
    ];
    expect(peakFocusWindow(sessions)).toBeNull();
  });

  it('handles exactly 5 sessions at threshold', () => {
    const sessions = [
      makeSession({ id: 's1', started_at: '2026-03-20T10:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', started_at: '2026-03-20T10:30:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's3', started_at: '2026-03-20T11:00:00.000Z', focus_quality: 'decent' }),
      makeSession({ id: 's4', started_at: '2026-03-20T11:30:00.000Z', focus_quality: 'decent' }),
      makeSession({ id: 's5', started_at: '2026-03-20T10:15:00.000Z', focus_quality: 'struggled' }),
    ];
    const result = peakFocusWindow(sessions);
    expect(result).not.toBeNull();
    // All in bucket 5 (10-12): (3+3+2+2+1)/5 = 2.2
    expect(result).toEqual({ hour: 10, avgQuality: 2.2 });
  });

  it('when multiple buckets tie, returns the earlier bucket', () => {
    // Two buckets with same average
    const sessions = [
      makeSession({ id: 's1', started_at: '2026-03-20T08:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's2', started_at: '2026-03-20T09:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's3', started_at: '2026-03-20T14:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's4', started_at: '2026-03-20T15:00:00.000Z', focus_quality: 'locked_in' }),
      makeSession({ id: 's5', started_at: '2026-03-20T20:00:00.000Z', focus_quality: 'struggled' }),
    ];
    const result = peakFocusWindow(sessions);
    // Bucket 4 (8-10): 3.0, Bucket 7 (14-16): 3.0, Bucket 10 (20-22): 1.0
    // Tie goes to earlier bucket (8-10)
    expect(result).toEqual({ hour: 8, avgQuality: 3 });
  });
});
