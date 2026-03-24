import { describe, it, expect } from 'vitest';
import type { Session } from '@pomofocus/types';
import { hasSufficientData } from './cold-start.js';

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

describe('hasSufficientData', () => {
  describe('tier1', () => {
    it('always returns true even with no sessions', () => {
      expect(hasSufficientData([], 'tier1')).toBe(true);
    });

    it('returns true with sessions', () => {
      expect(hasSufficientData([makeSession()], 'tier1')).toBe(true);
    });
  });

  describe('tier2', () => {
    it('returns false with no sessions', () => {
      expect(hasSufficientData([], 'tier2')).toBe(false);
    });

    it('returns false when all sessions are incomplete', () => {
      const sessions = [
        makeSession({ completed: false }),
        makeSession({ completed: false }),
      ];
      expect(hasSufficientData(sessions, 'tier2')).toBe(false);
    });

    it('returns true with at least one completed session', () => {
      const sessions = [makeSession({ completed: true })];
      expect(hasSufficientData(sessions, 'tier2')).toBe(true);
    });

    it('returns true when mix of completed and incomplete', () => {
      const sessions = [
        makeSession({ completed: false }),
        makeSession({ completed: true }),
      ];
      expect(hasSufficientData(sessions, 'tier2')).toBe(true);
    });
  });

  describe('tier3', () => {
    it('returns false with no sessions', () => {
      expect(hasSufficientData([], 'tier3')).toBe(false);
    });

    it('returns false with only one month of data', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2026-03-01T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-15T09:00:00Z',
        }),
      ];
      expect(hasSufficientData(sessions, 'tier3')).toBe(false);
    });

    it('returns true with two consecutive months of completed sessions', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2026-02-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-10T09:00:00Z',
        }),
      ];
      expect(hasSufficientData(sessions, 'tier3')).toBe(true);
    });

    it('returns true with two non-consecutive months (Jan + Mar)', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2026-01-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-10T09:00:00Z',
        }),
      ];
      expect(hasSufficientData(sessions, 'tier3')).toBe(true);
    });

    it('ignores non-completed sessions', () => {
      const sessions = [
        makeSession({
          completed: false,
          started_at: '2026-01-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-10T09:00:00Z',
        }),
      ];
      // Only 1 month with completed sessions
      expect(hasSufficientData(sessions, 'tier3')).toBe(false);
    });

    it('counts distinct months correctly with multiple sessions per month', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2026-01-01T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-01-15T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-01-28T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-10T09:00:00Z',
        }),
      ];
      // 2 distinct months: Jan and Mar
      expect(hasSufficientData(sessions, 'tier3')).toBe(true);
    });

    it('returns true with more than 2 months of data', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2026-01-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-02-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-03-10T09:00:00Z',
        }),
      ];
      expect(hasSufficientData(sessions, 'tier3')).toBe(true);
    });

    it('handles sessions across different years', () => {
      const sessions = [
        makeSession({
          completed: true,
          started_at: '2025-12-10T09:00:00Z',
        }),
        makeSession({
          completed: true,
          started_at: '2026-01-10T09:00:00Z',
        }),
      ];
      // 2 distinct months: 2025-12 and 2026-01
      expect(hasSufficientData(sessions, 'tier3')).toBe(true);
    });
  });
});
