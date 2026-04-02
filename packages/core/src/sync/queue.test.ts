import { describe, it, expect } from 'vitest';
import { getNextPending, dequeueForUpload, getQueueDepth } from './queue.js';
import { processQueue, createEmptyQueue } from './transition.js';
import { SYNC_EVENT_TYPE, QUEUE_ITEM_STATUS } from './types.js';
import type { OutboxQueue, OutboxEntry } from './types.js';

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

// ── getNextPending ──

describe('getNextPending', () => {
  it('returns undefined for an empty queue', () => {
    const queue = createEmptyQueue();
    expect(getNextPending(queue)).toBeUndefined();
  });

  it('returns the only pending entry', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };

    expect(getNextPending(queue)).toBe(entry);
  });

  it('returns the oldest pending entry (FIFO)', () => {
    const older = makePendingEntry({ id: 'entry-1', createdAt: 1000 });
    const newer = makePendingEntry({ id: 'entry-2', createdAt: 2000 });
    const queue: OutboxQueue = { entries: [older, newer] };

    expect(getNextPending(queue)).toBe(older);
  });

  it('skips non-pending entries', () => {
    const uploading = makeUploadingEntry({ id: 'entry-1', createdAt: 1000 });
    const confirmed = makeConfirmedEntry({ id: 'entry-2', createdAt: 2000 });
    const pending = makePendingEntry({ id: 'entry-3', createdAt: 3000 });
    const queue: OutboxQueue = { entries: [uploading, confirmed, pending] };

    expect(getNextPending(queue)).toBe(pending);
  });

  it('returns undefined when no pending entries exist', () => {
    const uploading = makeUploadingEntry({ id: 'entry-1' });
    const confirmed = makeConfirmedEntry({ id: 'entry-2' });
    const failed = makeFailedEntry({ id: 'entry-3' });
    const queue: OutboxQueue = { entries: [uploading, confirmed, failed] };

    expect(getNextPending(queue)).toBeUndefined();
  });

  it('returns first pending when multiple pending entries exist among other states', () => {
    const confirmed = makeConfirmedEntry({ id: 'entry-1', createdAt: 1000 });
    const pending1 = makePendingEntry({ id: 'entry-2', createdAt: 2000 });
    const failed = makeFailedEntry({ id: 'entry-3', createdAt: 3000 });
    const pending2 = makePendingEntry({ id: 'entry-4', createdAt: 4000 });
    const queue: OutboxQueue = { entries: [confirmed, pending1, failed, pending2] };

    expect(getNextPending(queue)).toBe(pending1);
  });
});

// ── dequeueForUpload ──

describe('dequeueForUpload', () => {
  it('returns undefined for an empty queue', () => {
    const queue = createEmptyQueue();
    expect(dequeueForUpload(queue)).toBeUndefined();
  });

  it('returns undefined when no pending entries exist', () => {
    const uploading = makeUploadingEntry({ id: 'entry-1' });
    const confirmed = makeConfirmedEntry({ id: 'entry-2' });
    const queue: OutboxQueue = { entries: [uploading, confirmed] };

    expect(dequeueForUpload(queue)).toBeUndefined();
  });

  it('returns the entry and updated queue with entry transitioned to uploading', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };

    const result = dequeueForUpload(queue);

    expect(result).toBeDefined();
    expect(result?.entry.id).toBe('entry-1');
    expect(result?.entry.state.type).toBe('uploading');
    expect(result?.updatedQueue.entries).toHaveLength(1);
    expect(result?.updatedQueue.entries[0]?.state.type).toBe('uploading');
  });

  it('dequeues the oldest pending entry (FIFO)', () => {
    const older = makePendingEntry({ id: 'entry-1', createdAt: 1000 });
    const newer = makePendingEntry({ id: 'entry-2', createdAt: 2000 });
    const queue: OutboxQueue = { entries: [older, newer] };

    const result = dequeueForUpload(queue);

    expect(result?.entry.id).toBe('entry-1');
    expect(result?.entry.state.type).toBe('uploading');
    // Second entry should remain pending
    expect(result?.updatedQueue.entries[1]?.state.type).toBe('pending');
  });

  it('skips non-pending entries and dequeues the first pending', () => {
    const uploading = makeUploadingEntry({ id: 'entry-1', createdAt: 1000 });
    const pending = makePendingEntry({ id: 'entry-2', createdAt: 2000 });
    const queue: OutboxQueue = { entries: [uploading, pending] };

    const result = dequeueForUpload(queue);

    expect(result?.entry.id).toBe('entry-2');
    expect(result?.entry.state.type).toBe('uploading');
    // First entry unchanged
    expect(result?.updatedQueue.entries[0]?.state.type).toBe('uploading');
    expect(result?.updatedQueue.entries[0]?.id).toBe('entry-1');
  });

  it('does not mutate the original queue', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };

    dequeueForUpload(queue);

    expect(queue.entries[0]?.state.type).toBe('pending');
  });

  it('returned entry matches the entry in the updated queue', () => {
    const entry = makePendingEntry();
    const queue: OutboxQueue = { entries: [entry] };

    const result = dequeueForUpload(queue);

    expect(result?.entry).toBe(result?.updatedQueue.entries[0]);
  });
});

// ── getQueueDepth ──

describe('getQueueDepth', () => {
  it('returns all zeros for an empty queue', () => {
    const queue = createEmptyQueue();
    const depth = getQueueDepth(queue);

    expect(depth.pending).toBe(0);
    expect(depth.uploading).toBe(0);
    expect(depth.confirmed).toBe(0);
    expect(depth.failed).toBe(0);
    expect(depth.total).toBe(0);
  });

  it('counts a single pending entry', () => {
    const queue: OutboxQueue = { entries: [makePendingEntry()] };
    const depth = getQueueDepth(queue);

    expect(depth.pending).toBe(1);
    expect(depth.uploading).toBe(0);
    expect(depth.confirmed).toBe(0);
    expect(depth.failed).toBe(0);
    expect(depth.total).toBe(1);
  });

  it('counts entries across all statuses', () => {
    const queue: OutboxQueue = {
      entries: [
        makePendingEntry({ id: 'e1' }),
        makePendingEntry({ id: 'e2' }),
        makeUploadingEntry({ id: 'e3' }),
        makeConfirmedEntry({ id: 'e4' }),
        makeConfirmedEntry({ id: 'e5' }),
        makeConfirmedEntry({ id: 'e6' }),
        makeFailedEntry({ id: 'e7' }),
      ],
    };
    const depth = getQueueDepth(queue);

    expect(depth.pending).toBe(2);
    expect(depth.uploading).toBe(1);
    expect(depth.confirmed).toBe(3);
    expect(depth.failed).toBe(1);
    expect(depth.total).toBe(7);
  });

  it('total equals sum of all status counts', () => {
    const queue: OutboxQueue = {
      entries: [
        makePendingEntry({ id: 'e1' }),
        makeUploadingEntry({ id: 'e2' }),
        makeFailedEntry({ id: 'e3' }),
      ],
    };
    const depth = getQueueDepth(queue);

    expect(depth.total).toBe(depth.pending + depth.uploading + depth.confirmed + depth.failed);
  });
});

// ── Integration: Full Lifecycle ──

describe('queue ordering — full lifecycle integration', () => {
  it('enqueue -> upload start -> success/failure -> retry -> confirmed', () => {
    // Step 1: Enqueue two entries
    let queue = createEmptyQueue();
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-1',
      entityType: 'sessions',
      entityId: 'session-abc',
      createdAt: 1000,
    });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'entry-2',
      entityType: 'breaks',
      entityId: 'break-def',
      createdAt: 2000,
    });

    // Verify queue depth
    let depth = getQueueDepth(queue);
    expect(depth.pending).toBe(2);
    expect(depth.total).toBe(2);

    // Step 2: Dequeue first pending (FIFO — should be entry-1)
    const dequeue1 = dequeueForUpload(queue);
    expect(dequeue1).toBeDefined();
    expect(dequeue1?.entry.id).toBe('entry-1');
    expect(dequeue1?.entry.state.type).toBe('uploading');
    queue = dequeue1?.updatedQueue ?? queue;

    depth = getQueueDepth(queue);
    expect(depth.uploading).toBe(1);
    expect(depth.pending).toBe(1);

    // Step 3: First entry succeeds
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'entry-1',
    });

    depth = getQueueDepth(queue);
    expect(depth.confirmed).toBe(1);
    expect(depth.pending).toBe(1);

    // Step 4: Dequeue second entry
    const dequeue2 = dequeueForUpload(queue);
    expect(dequeue2).toBeDefined();
    expect(dequeue2?.entry.id).toBe('entry-2');
    queue = dequeue2?.updatedQueue ?? queue;

    // Step 5: Second entry fails
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'entry-2',
      errorMessage: 'server 500',
    });

    depth = getQueueDepth(queue);
    expect(depth.confirmed).toBe(1);
    expect(depth.failed).toBe(1);
    expect(depth.pending).toBe(0);

    // Step 6: No pending entries to dequeue
    expect(dequeueForUpload(queue)).toBeUndefined();
    expect(getNextPending(queue)).toBeUndefined();

    // Step 7: Retry the failed entry
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.RETRY,
      entryId: 'entry-2',
    });

    depth = getQueueDepth(queue);
    expect(depth.pending).toBe(1);
    expect(depth.confirmed).toBe(1);

    // Step 8: Dequeue the retried entry
    const dequeue3 = dequeueForUpload(queue);
    expect(dequeue3).toBeDefined();
    expect(dequeue3?.entry.id).toBe('entry-2');
    expect(dequeue3?.entry.retryCount).toBe(1);
    queue = dequeue3?.updatedQueue ?? queue;

    // Step 9: Second entry succeeds on retry
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_SUCCESS,
      entryId: 'entry-2',
    });

    depth = getQueueDepth(queue);
    expect(depth.confirmed).toBe(2);
    expect(depth.pending).toBe(0);
    expect(depth.uploading).toBe(0);
    expect(depth.failed).toBe(0);
    expect(depth.total).toBe(2);

    // No more entries to dequeue
    expect(dequeueForUpload(queue)).toBeUndefined();
  });

  it('getNextPending always returns FIFO order after mixed operations', () => {
    let queue = createEmptyQueue();

    // Enqueue three entries with increasing timestamps
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'e1',
      entityType: 'sessions',
      entityId: 's1',
      createdAt: 100,
    });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'e2',
      entityType: 'sessions',
      entityId: 's2',
      createdAt: 200,
    });
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.ENQUEUE,
      entryId: 'e3',
      entityType: 'sessions',
      entityId: 's3',
      createdAt: 300,
    });

    // Start uploading e1
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.UPLOAD_START, entryId: 'e1' });

    // Next pending should be e2 (FIFO)
    expect(getNextPending(queue)?.id).toBe('e2');

    // Fail e1 and retry it — it should go back to pending
    queue = processQueue(queue, {
      type: SYNC_EVENT_TYPE.UPLOAD_FAILURE,
      entryId: 'e1',
      errorMessage: 'err',
    });
    queue = processQueue(queue, { type: SYNC_EVENT_TYPE.RETRY, entryId: 'e1' });

    // e1 is pending again but it's first in the entries array (original position preserved)
    // FIFO is based on array order, so e1 should be returned first
    expect(getNextPending(queue)?.id).toBe('e1');
  });
});
