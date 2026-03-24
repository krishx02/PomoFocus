// Queue ordering and dequeue logic (ADR-006).
// Pure functions — no IO, no React, no Supabase imports.

import { QUEUE_ITEM_STATUS } from './types.js';
import type { OutboxQueue, OutboxEntry, QueueItemStatus } from './types.js';

// ── Return Types ──

/** Result of dequeueForUpload: the entry being uploaded and the updated queue. */
export type DequeueResult = {
  readonly entry: OutboxEntry;
  readonly updatedQueue: OutboxQueue;
};

/** Count of entries by status, plus total. */
export type QueueDepth = {
  readonly pending: number;
  readonly uploading: number;
  readonly confirmed: number;
  readonly failed: number;
  readonly total: number;
};

// ── Public API ──

/**
 * Returns the oldest pending entry in the queue (FIFO ordering).
 * Returns undefined if no pending entries exist.
 */
export function getNextPending(queue: OutboxQueue): OutboxEntry | undefined {
  return queue.entries.find(
    (entry) => entry.state.type === QUEUE_ITEM_STATUS.PENDING,
  );
}

/**
 * Dequeues the next pending entry for upload.
 * Returns the entry (transitioned to uploading) and the updated queue,
 * or undefined if no pending entries exist.
 */
export function dequeueForUpload(queue: OutboxQueue): DequeueResult | undefined {
  const pendingIndex = queue.entries.findIndex(
    (entry) => entry.state.type === QUEUE_ITEM_STATUS.PENDING,
  );

  if (pendingIndex === -1) {
    return undefined;
  }

  const pendingEntry = queue.entries[pendingIndex];
  if (pendingEntry === undefined) {
    return undefined;
  }

  const uploadingEntry: OutboxEntry = {
    ...pendingEntry,
    state: { type: QUEUE_ITEM_STATUS.UPLOADING },
  };

  const newEntries = [...queue.entries];
  newEntries[pendingIndex] = uploadingEntry;

  return {
    entry: uploadingEntry,
    updatedQueue: { entries: newEntries },
  };
}

/**
 * Returns the count of entries by status and the total count.
 */
export function getQueueDepth(queue: OutboxQueue): QueueDepth {
  const counts: Record<QueueItemStatus, number> = {
    [QUEUE_ITEM_STATUS.PENDING]: 0,
    [QUEUE_ITEM_STATUS.UPLOADING]: 0,
    [QUEUE_ITEM_STATUS.CONFIRMED]: 0,
    [QUEUE_ITEM_STATUS.FAILED]: 0,
  };

  for (const entry of queue.entries) {
    counts[entry.state.type] += 1;
  }

  return {
    pending: counts[QUEUE_ITEM_STATUS.PENDING],
    uploading: counts[QUEUE_ITEM_STATUS.UPLOADING],
    confirmed: counts[QUEUE_ITEM_STATUS.CONFIRMED],
    failed: counts[QUEUE_ITEM_STATUS.FAILED],
    total: queue.entries.length,
  };
}
