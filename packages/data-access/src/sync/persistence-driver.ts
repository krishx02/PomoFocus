// IndexedDB-backed persistence driver for the sync outbox queue (ADR-006).
// Web platform only. No React imports (PKG-D04).

import type { OutboxEntry, QueueItemState } from '@pomofocus/core';

// ── Constants ──

const DB_NAME = 'pomofocus-sync';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

// ── Stored Entry Shape ──

/** Shape of an outbox entry as stored in IndexedDB. */
type StoredOutboxEntry = {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly stateType: string;
  readonly errorMessage: string | null;
  readonly retryCount: number;
  readonly createdAt: number;
};

// ── Database Lifecycle ──

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (): void => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_state', 'stateType', { unique: false });
      }
    };

    request.onsuccess = (): void => {
      resolve(request.result);
    };

    request.onerror = (): void => {
      reject(new Error(request.error?.message ?? 'Failed to open IndexedDB'));
    };
  });
}

// ── Helpers ──

function toStored(entry: OutboxEntry): StoredOutboxEntry {
  return {
    id: entry.id,
    entityType: entry.entityType,
    entityId: entry.entityId,
    stateType: entry.state.type,
    errorMessage: entry.state.type === 'failed' ? entry.state.errorMessage : null,
    retryCount: entry.retryCount,
    createdAt: entry.createdAt,
  };
}

function toQueueItemState(stateType: string, errorMessage: string | null): QueueItemState {
  switch (stateType) {
    case 'pending':
      return { type: 'pending' };
    case 'uploading':
      return { type: 'uploading' };
    case 'confirmed':
      return { type: 'confirmed' };
    case 'failed':
      return { type: 'failed', errorMessage: errorMessage ?? '' };
    default:
      return { type: 'pending' };
  }
}

function fromStored(stored: StoredOutboxEntry): OutboxEntry {
  return {
    id: stored.id,
    entityType: stored.entityType as OutboxEntry['entityType'],
    entityId: stored.entityId,
    state: toQueueItemState(stored.stateType, stored.errorMessage),
    retryCount: stored.retryCount,
    createdAt: stored.createdAt,
  };
}

// ── Public API ──

/** Stores an outbox entry in IndexedDB. */
async function persistEntry(entry: OutboxEntry): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(toStored(entry));

    tx.oncomplete = (): void => {
      db.close();
      resolve();
    };
    tx.onerror = (): void => {
      db.close();
      reject(new Error(tx.error?.message ?? 'IndexedDB transaction failed'));
    };
  });
}

/** Returns all entries with status 'pending' or 'failed', ordered by createdAt ascending. */
async function loadPendingEntries(): Promise<readonly OutboxEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (): void => {
      const allEntries = request.result as StoredOutboxEntry[];
      const pending = allEntries
        .filter((e) => e.stateType === 'pending' || e.stateType === 'failed')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(fromStored);
      db.close();
      resolve(pending);
    };
    request.onerror = (): void => {
      db.close();
      reject(new Error(request.error?.message ?? 'IndexedDB request failed'));
    };
  });
}

/** Removes an entry from IndexedDB (marks it as uploaded by deletion). */
async function markUploaded(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = (): void => {
      db.close();
      resolve();
    };
    tx.onerror = (): void => {
      db.close();
      reject(new Error(tx.error?.message ?? 'IndexedDB transaction failed'));
    };
  });
}

/** Updates an entry's status to 'failed' with error message and incremented retry count. */
async function markFailed(id: string, error: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = (): void => {
      const existing = getRequest.result as StoredOutboxEntry | undefined;
      if (existing === undefined) {
        db.close();
        resolve();
        return;
      }

      const updated: StoredOutboxEntry = {
        ...existing,
        stateType: 'failed',
        errorMessage: error,
        retryCount: existing.retryCount + 1,
      };
      store.put(updated);
    };

    getRequest.onerror = (): void => {
      db.close();
      reject(new Error(getRequest.error?.message ?? 'IndexedDB request failed'));
    };

    tx.oncomplete = (): void => {
      db.close();
      resolve();
    };
    tx.onerror = (): void => {
      db.close();
      reject(new Error(tx.error?.message ?? 'IndexedDB transaction failed'));
    };
  });
}

export {
  persistEntry,
  loadPendingEntries,
  markUploaded,
  markFailed,
  DB_NAME,
  STORE_NAME,
};
