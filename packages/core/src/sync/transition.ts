import { SYNC_EVENT_TYPE, QUEUE_ITEM_STATUS } from './types.js';
import type { OutboxQueue, OutboxEntry, SyncEvent, QueueItemState } from './types.js';

/** Creates an empty outbox queue. */
export function createEmptyQueue(): OutboxQueue {
  return { entries: [] };
}

/**
 * Pure state machine: processQueue(queue, event) -> newQueue.
 * Mirrors the timer pattern from ADR-004. No IO, no side effects.
 */
export function processQueue(queue: OutboxQueue, event: SyncEvent): OutboxQueue {
  switch (event.type) {
    case SYNC_EVENT_TYPE.ENQUEUE:
      return handleEnqueue(queue, event);
    case SYNC_EVENT_TYPE.UPLOAD_START:
      return handleUploadStart(queue, event);
    case SYNC_EVENT_TYPE.UPLOAD_SUCCESS:
      return handleUploadSuccess(queue, event);
    case SYNC_EVENT_TYPE.UPLOAD_FAILURE:
      return handleUploadFailure(queue, event);
    case SYNC_EVENT_TYPE.RETRY:
      return handleRetry(queue, event);
    case SYNC_EVENT_TYPE.NETWORK_AVAILABLE:
      return handleNetworkAvailable(queue);
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// ── Event Handlers ──

function handleEnqueue(
  queue: OutboxQueue,
  event: Extract<SyncEvent, { type: typeof SYNC_EVENT_TYPE.ENQUEUE }>,
): OutboxQueue {
  const newEntry: OutboxEntry = {
    id: event.entryId,
    entityType: event.entityType,
    entityId: event.entityId,
    state: { type: QUEUE_ITEM_STATUS.PENDING },
    retryCount: 0,
    createdAt: event.createdAt,
  };
  return { entries: [...queue.entries, newEntry] };
}

function handleUploadStart(
  queue: OutboxQueue,
  event: Extract<SyncEvent, { type: typeof SYNC_EVENT_TYPE.UPLOAD_START }>,
): OutboxQueue {
  return updateEntry(queue, event.entryId, (entry) => {
    if (entry.state.type !== QUEUE_ITEM_STATUS.PENDING) {
      return entry;
    }
    return { ...entry, state: { type: QUEUE_ITEM_STATUS.UPLOADING } };
  });
}

function handleUploadSuccess(
  queue: OutboxQueue,
  event: Extract<SyncEvent, { type: typeof SYNC_EVENT_TYPE.UPLOAD_SUCCESS }>,
): OutboxQueue {
  return updateEntry(queue, event.entryId, (entry) => {
    if (entry.state.type !== QUEUE_ITEM_STATUS.UPLOADING) {
      return entry;
    }
    return { ...entry, state: { type: QUEUE_ITEM_STATUS.CONFIRMED } };
  });
}

function handleUploadFailure(
  queue: OutboxQueue,
  event: Extract<SyncEvent, { type: typeof SYNC_EVENT_TYPE.UPLOAD_FAILURE }>,
): OutboxQueue {
  return updateEntry(queue, event.entryId, (entry) => {
    if (entry.state.type !== QUEUE_ITEM_STATUS.UPLOADING) {
      return entry;
    }
    const failedState: QueueItemState = {
      type: QUEUE_ITEM_STATUS.FAILED,
      errorMessage: event.errorMessage,
    };
    return { ...entry, state: failedState, retryCount: entry.retryCount + 1 };
  });
}

function handleRetry(
  queue: OutboxQueue,
  event: Extract<SyncEvent, { type: typeof SYNC_EVENT_TYPE.RETRY }>,
): OutboxQueue {
  return updateEntry(queue, event.entryId, (entry) => {
    if (entry.state.type !== QUEUE_ITEM_STATUS.FAILED) {
      return entry;
    }
    return { ...entry, state: { type: QUEUE_ITEM_STATUS.PENDING } };
  });
}

function handleNetworkAvailable(queue: OutboxQueue): OutboxQueue {
  const hasFailedEntries = queue.entries.some(
    (entry) => entry.state.type === QUEUE_ITEM_STATUS.FAILED,
  );
  if (!hasFailedEntries) {
    return queue;
  }

  return {
    entries: queue.entries.map((entry) => {
      if (entry.state.type !== QUEUE_ITEM_STATUS.FAILED) {
        return entry;
      }
      return { ...entry, state: { type: QUEUE_ITEM_STATUS.PENDING } as const };
    }),
  };
}

// ── Internal Helpers ──

/**
 * Finds an entry by id and applies the updater function.
 * Returns the original queue if the entry is not found or not modified.
 */
function updateEntry(
  queue: OutboxQueue,
  entryId: string,
  updater: (entry: OutboxEntry) => OutboxEntry,
): OutboxQueue {
  const index = queue.entries.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return queue;
  }

  const entry = queue.entries[index];
  if (entry === undefined) {
    return queue;
  }

  const updated = updater(entry);
  if (updated === entry) {
    return queue;
  }

  const newEntries = [...queue.entries];
  newEntries[index] = updated;
  return { entries: newEntries };
}
