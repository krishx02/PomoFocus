import { describe, it, expect } from 'vitest';
import {
  isIdempotent,
  resolveConflict,
  CONFLICT_RESOLUTION,
} from './conflict.js';
import type { ConflictRecord, ConflictResolution } from './conflict.js';

// ── isIdempotent ──

describe('isIdempotent', () => {
  it('returns true for sessions (append-only)', () => {
    expect(isIdempotent('sessions')).toBe(true);
  });

  it('returns true for breaks (append-only)', () => {
    expect(isIdempotent('breaks')).toBe(true);
  });

  it('returns true for encouragement_taps (append-only)', () => {
    expect(isIdempotent('encouragement_taps')).toBe(true);
  });

  it('returns false for user_preferences (updatable)', () => {
    expect(isIdempotent('user_preferences')).toBe(false);
  });

  it('returns false for long_term_goals (updatable)', () => {
    expect(isIdempotent('long_term_goals')).toBe(false);
  });

  it('returns false for process_goals (updatable)', () => {
    expect(isIdempotent('process_goals')).toBe(false);
  });
});

// ── resolveConflict — append-only entities ──

describe('resolveConflict — append-only entities', () => {
  it('returns SKIP for sessions regardless of version', () => {
    const local: ConflictRecord = {
      entityType: 'sessions',
      entityId: 'session-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'sessions',
      entityId: 'session-abc',
      version: 1,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.SKIP });
  });

  it('returns SKIP for breaks', () => {
    const local: ConflictRecord = {
      entityType: 'breaks',
      entityId: 'break-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'breaks',
      entityId: 'break-abc',
      version: 1,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.SKIP });
  });

  it('returns SKIP for encouragement_taps', () => {
    const local: ConflictRecord = {
      entityType: 'encouragement_taps',
      entityId: 'tap-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'encouragement_taps',
      entityId: 'tap-abc',
      version: 1,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.SKIP });
  });
});

// ── resolveConflict — updatable entities ──

describe('resolveConflict — updatable entities', () => {
  it('returns APPLY when local version matches server version', () => {
    const local: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 3,
    };
    const server: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 3,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.APPLY });
  });

  it('returns REFETCH_AND_RETRY when server version is ahead of local', () => {
    const local: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 2,
    };
    const server: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 3,
    };

    const result: ConflictResolution = resolveConflict(local, server);

    expect(result).toEqual({
      type: CONFLICT_RESOLUTION.REFETCH_AND_RETRY,
      serverVersion: 3,
    });
  });

  it('returns REFETCH_AND_RETRY when server version is far ahead', () => {
    const local: ConflictRecord = {
      entityType: 'long_term_goals',
      entityId: 'goal-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'long_term_goals',
      entityId: 'goal-abc',
      version: 5,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({
      type: CONFLICT_RESOLUTION.REFETCH_AND_RETRY,
      serverVersion: 5,
    });
  });

  it('returns REFETCH_AND_RETRY when local version is ahead of server (stale server state)', () => {
    const local: ConflictRecord = {
      entityType: 'process_goals',
      entityId: 'goal-abc',
      version: 5,
    };
    const server: ConflictRecord = {
      entityType: 'process_goals',
      entityId: 'goal-abc',
      version: 3,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({
      type: CONFLICT_RESOLUTION.REFETCH_AND_RETRY,
      serverVersion: 3,
    });
  });

  it('returns APPLY for long_term_goals when versions match', () => {
    const local: ConflictRecord = {
      entityType: 'long_term_goals',
      entityId: 'goal-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'long_term_goals',
      entityId: 'goal-abc',
      version: 1,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.APPLY });
  });

  it('returns APPLY for process_goals when versions match', () => {
    const local: ConflictRecord = {
      entityType: 'process_goals',
      entityId: 'goal-abc',
      version: 7,
    };
    const server: ConflictRecord = {
      entityType: 'process_goals',
      entityId: 'goal-abc',
      version: 7,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.APPLY });
  });
});

// ── Edge Cases ──

describe('resolveConflict — edge cases', () => {
  it('returns APPLY for updatable entity at version 1 (initial write)', () => {
    const local: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'user_preferences',
      entityId: 'pref-abc',
      version: 1,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.APPLY });
  });

  it('SKIP resolution for append-only ignores version mismatch', () => {
    const local: ConflictRecord = {
      entityType: 'sessions',
      entityId: 'session-abc',
      version: 1,
    };
    const server: ConflictRecord = {
      entityType: 'sessions',
      entityId: 'session-abc',
      version: 99,
    };

    const result = resolveConflict(local, server);

    expect(result).toEqual({ type: CONFLICT_RESOLUTION.SKIP });
  });
});
