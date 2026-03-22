import { describe, it, expect } from 'vitest';
import { processQueue, createEmptyQueue } from './transition.js';
import { SYNC_EVENT_TYPE, QUEUE_ITEM_STATUS } from './types.js';
import type { OutboxQueue, OutboxEntry, SyncEvent } from './types.js';

// ── Helpers ──

function makePendingEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: QUEUE_ITEM_STATUS.PENDING },
    retryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

function makeUploadingEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: QUEUE_ITEM_STATUS.UPLOADING },
    retryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

function makeFailedEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: QUEUE_ITEM_STATUS.FAILED, errorMessage: 'network error' },
    retryCount: 1,
    createdAt: 1000,
    ...overrides,
  };
}

function makeConfirmedEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: QUEUE_ITEM_STATUS.CONFIRMED },
    retryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

// ── createEmptyQueue ──

describe('createEmptyQueue', () => {
  it('returns a queue with no entries', () => {
    const queue = createEmptyQueue();
    expect(queue.entries).toEqual([]);
  });
});

// ── ENQUEUE ──

describe('processQueue — ENQUEUE event', () => {
  it('adds a new entry to an empty queue in pending state', () => {
    const queue = createEmptyQueue();
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-1',
      entityType: 'sessions',
      entityId: 'session-abc',
      createdAt: 1000,
    };

    const result = processQueue(queue, event);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual({
      id: 'entry-1',
      entityType: 'sessions',
      entityId: 'session-abc',
      state: { type: 'pending' },
      retryCount: 0,
      createdAt: 1000,
    });
  });

  it('appends to existing entries', () => {
    const existing = makePendingEntry({ id: 'entry-1' });
    const queue: OutboxQueue = { entries: [existing] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-2',
      entityType: 'breaks',
      entityId: 'break-def',
      createdAt: 2000,
    };

    const result = processQueue(queue, event);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toBe(existing);
    expect(result.entries[1]?.entityType).toBe('breaks');
  });

  it('preserves order of existing entries', () => {
    const first = makePendingEntry({ id: 'entry-1', createdAt: 1000 });
    const second = makePendingEntry({ id: 'entry-2', createdAt: 2000 });
    const queue: OutboxQueue = { entries: [first, second] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-3',
      entityType: 'user_preferences',
      entityId: 'pref-ghi',
      createdAt: 3000,
    };

    const result = processQueue(queue, event);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]?.id).toBe('entry-1');
    expect(result.entries[1]?.id).toBe('entry-2');
    expect(result.entries[2]?.id).toBe('entry-3');
  });
});

// ── UPLOAD_START ──

describe('processQueue — UPLOAD_START event', () => {
  it('transitions a pending entry to uploading', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state).toEqual({ type: 'uploading' });
  });

  it('does not modify other entries', () => {
    const entry1 = makePendingEntry({ id: 'entry-1' });
    const entry2 = makePendingEntry({ id: 'entry-2' });
    const queue: OutboxQueue = { entries: [entry1, entry2] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state.type).toBe('uploading');
    expect(result.entries[1]).toBe(entry2);
  });

  it('returns queue unchanged when entry not found', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'nonexistent',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });

  it('returns queue unchanged when entry is not pending', () => {
    const entry = makeUploadingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });
});

// ── UPLOAD_SUCCESS ──

describe('processQueue — UPLOAD_SUCCESS event', () => {
  it('transitions an uploading entry to confirmed', () => {
    const entry = makeUploadingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state).toEqual({ type: 'confirmed' });
  });

  it('returns queue unchanged when entry is not uploading', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });

  it('returns queue unchanged when entry not found', () => {
    const entry = makeUploadingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'nonexistent',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });
});

// ── UPLOAD_FAILURE ──

describe('processQueue — UPLOAD_FAILURE event', () => {
  it('transitions an uploading entry to failed with error message and increments retryCount', () => {
    const entry = makeUploadingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'timeout',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state).toEqual({
      type: 'failed',
      errorMessage: 'timeout',
    });
    expect(result.entries[0]?.retryCount).toBe(1);
  });

  it('increments retryCount on repeated failures', () => {
    const entry: OutboxEntry = {
      id: 'entry-1',
      entityType: 'sessions',
      entityId: 'session-abc',
      state: { type: QUEUE_ITEM_STATUS.FAILED, errorMessage: 'first error' },
      retryCount: 2,
      createdAt: 1000,
    };
    // Retry moves back to pending
    const retried = processQueue({ entries: [entry] }, { type: SYNC_EVENT_TYPE.RETRY, entryId: 'entry-1' });
    // Start upload
    const uploading = processQueue(retried, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'entry-1' });
    // Fail again — retryCount should be 3
    const failed = processQueue(uploading, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'second error',
    });

    expect(failed.entries[0]?.state).toEqual({
      type: 'failed',
      errorMessage: 'second error',
    });
    expect(failed.entries[0]?.retryCount).toBe(3);
  });

  it('returns queue unchanged when entry is not uploading', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'error',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });

  it('returns queue unchanged when entry not found', () => {
    const entry = makeUploadingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'nonexistent',
      errorMessage: 'error',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });
});

// ── RETRY ──

describe('processQueue — RETRY event', () => {
  it('transitions a failed entry back to pending', () => {
    const entry = makeFailedEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state).toEqual({ type: 'pending' });
  });

  it('preserves retryCount when transitioning to pending', () => {
    const entry = makeFailedEntry({ retryCount: 3 });
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.retryCount).toBe(3);
  });

  it('returns queue unchanged when entry is not failed', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'entry-1',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });

  it('returns queue unchanged when entry not found', () => {
    const entry = makeFailedEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'nonexistent',
    };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });
});

// ── NETWORK_AVAILABLE ──

describe('processQueue — NETWORK_AVAILABLE event', () => {
  it('transitions all failed entries back to pending', () => {
    const failed1 = makeFailedEntry({ id: 'entry-1' });
    const failed2 = makeFailedEntry({ id: 'entry-2' });
    const queue: OutboxQueue = { entries: [failed1, failed2] };
    const event: SyncEvent = { type: SYNC_EVENT_TYPE.NETWORK_AVAILABLE };

    const result = processQueue(queue, event);

    expect(result.entries[0]?.state).toEqual({ type: 'pending' });
    expect(result.entries[1]?.state).toEqual({ type: 'pending' });
  });

  it('does not modify non-failed entries', () => {
    const pending = makePendingEntry({ id: 'entry-1' });
    const uploading = makeUploadingEntry({ id: 'entry-2' });
    const confirmed = makeConfirmedEntry({ id: 'entry-3' });
    const failed = makeFailedEntry({ id: 'entry-4' });
    const queue: OutboxQueue = { entries: [pending, uploading, confirmed, failed] };
    const event: SyncEvent = { type: SYNC_EVENT_TYPE.NETWORK_AVAILABLE };

    const result = processQueue(queue, event);

    expect(result.entries[0]).toBe(pending);
    expect(result.entries[1]).toBe(uploading);
    expect(result.entries[2]).toBe(confirmed);
    expect(result.entries[3]?.state).toEqual({ type: 'pending' });
  });

  it('returns queue unchanged when no failed entries exist', () => {
    const pending = makePendingEntry();
    const queue: OutboxQueue = { entries: [pending] };
    const event: SyncEvent = { type: SYNC_EVENT_TYPE.NETWORK_AVAILABLE };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });

  it('returns queue unchanged when queue is empty', () => {
    const queue = createEmptyQueue();
    const event: SyncEvent = { type: SYNC_EVENT_TYPE.NETWORK_AVAILABLE };

    const result = processQueue(queue, event);

    expect(result).toBe(queue);
  });
});

// ── Edge Cases ──

describe('processQueue — edge cases', () => {
  it('does not mutate the original queue', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };
    const event: SyncEvent = {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    };

    processQueue(queue, event);

    expect(queue.entries[0]?.state.type).toBe('pending');
  });

  it('handles full lifecycle: enqueue -> upload_start -> upload_success', () => {
    let queue = createEmptyQueue();

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-1',
      entityType: 'sessions',
      entityId: 'session-abc',
      createdAt: 1000,
    });
    expect(queue.entries[0]?.state.type).toBe('pending');

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    });
    expect(queue.entries[0]?.state.type).toBe('uploading');

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'entry-1',
    });
    expect(queue.entries[0]?.state.type).toBe('confirmed');
  });

  it('handles failure and retry lifecycle: pending -> uploading -> failed -> pending', () => {
    let queue: OutboxQueue = { entries: [makePendingEntry()] };

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_START,
      entryId: 'entry-1',
    });
    expect(queue.entries[0]?.state.type).toBe('uploading');

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'network error',
    });
    expect(queue.entries[0]?.state.type).toBe('failed');
    expect(queue.entries[0]?.retryCount).toBe(1);

    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'entry-1',
    });
    expect(queue.entries[0]?.state.type).toBe('pending');
    expect(queue.entries[0]?.retryCount).toBe(1);
  });

  it('confirmed entries are not affected by any targeted event', () => {
    const entry = makeConfirmedEntry();
    const queue: OutboxQueue = { entries: [entry] };

    const afterStart = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'entry-1' });
    expect(afterStart).toBe(queue);

    const afterSuccess = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS, entryId: 'entry-1' });
    expect(afterSuccess).toBe(queue);

    const afterFailure = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'err',
    });
    expect(afterFailure).toBe(queue);

    const afterRetry = processQueue(queue, { type: SYNC_EVENT_TYPE.RETRY, entryId: 'entry-1' });
    expect(afterRetry).toBe(queue);
  });

  it('retryCount accumulates across multiple failure cycles', () => {
    let queue: OutboxQueue = { entries: [makePendingEntry()] };

    // First failure cycle
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'entry-1' });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'err1',
    });
    expect(queue.entries[0]?.retryCount).toBe(1);

    // Retry and second failure cycle
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.RETRY, entryId: 'entry-1' });
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'entry-1' });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'err2',
    });
    expect(queue.entries[0]?.retryCount).toBe(2);

    // Retry and third failure cycle
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.RETRY, entryId: 'entry-1' });
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'entry-1' });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-1',
      errorMessage: 'err3',
    });
    expect(queue.entries[0]?.retryCount).toBe(3);
  });
});
