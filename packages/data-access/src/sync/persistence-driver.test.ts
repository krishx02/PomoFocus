import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { OutboxEntry } from '@pomofocus/core';
import {
  persistEntry,
  loadPendingEntries,
  markUploaded,
  markFailed,
  DB_NAME,
} from './persistence-driver';

// ── Helpers ──

function createEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: 'pending' },
    retryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = (): void => {
      resolve();
    };
    request.onerror = (): void => {
      reject(new Error(request.error?.message ?? 'Failed to delete database'));
    };
  });
}

// ── Tests ──

describe('persistence-driver', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  describe('persistEntry', () => {
    it('stores an entry that can be loaded back', async () => {
      const entry = createEntry();
      await persistEntry(entry);

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(entry);
    });

    it('overwrites an existing entry with the same id', async () => {
      const entry = createEntry();
      await persistEntry(entry);

      const updated = createEntry({ retryCount: 3 });
      await persistEntry(updated);

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.retryCount).toBe(3);
    });

    it('stores multiple distinct entries', async () => {
      await persistEntry(createEntry({ id: 'a', createdAt: 100 }));
      await persistEntry(createEntry({ id: 'b', createdAt: 200 }));
      await persistEntry(createEntry({ id: 'c', createdAt: 300 }));

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(3);
    });

    it('preserves all OutboxEntry fields', async () => {
      const entry = createEntry({
        id: 'full-entry',
        entityType: 'breaks',
        entityId: 'break-xyz',
        state: { type: 'failed', errorMessage: 'Network timeout' },
        retryCount: 2,
        createdAt: 9999,
      });

      await persistEntry(entry);
      const loaded = await loadPendingEntries();
      expect(loaded[0]).toEqual(entry);
    });
  });

  describe('loadPendingEntries', () => {
    it('returns empty array when no entries exist', async () => {
      const loaded = await loadPendingEntries();
      expect(loaded).toEqual([]);
    });

    it('returns entries with pending status', async () => {
      await persistEntry(createEntry({ id: 'pending-1', state: { type: 'pending' } }));
      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.state.type).toBe('pending');
    });

    it('returns entries with failed status', async () => {
      await persistEntry(
        createEntry({
          id: 'failed-1',
          state: { type: 'failed', errorMessage: 'Server error' },
        }),
      );
      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.state.type).toBe('failed');
    });

    it('excludes entries with uploading status', async () => {
      await persistEntry(
        createEntry({ id: 'uploading-1', state: { type: 'uploading' } }),
      );
      const loaded = await loadPendingEntries();
      expect(loaded).toEqual([]);
    });

    it('excludes entries with confirmed status', async () => {
      await persistEntry(
        createEntry({ id: 'confirmed-1', state: { type: 'confirmed' } }),
      );
      const loaded = await loadPendingEntries();
      expect(loaded).toEqual([]);
    });

    it('returns mixed pending and failed entries, excluding others', async () => {
      await persistEntry(createEntry({ id: 'p1', state: { type: 'pending' }, createdAt: 1 }));
      await persistEntry(
        createEntry({
          id: 'f1',
          state: { type: 'failed', errorMessage: 'err' },
          createdAt: 2,
        }),
      );
      await persistEntry(createEntry({ id: 'u1', state: { type: 'uploading' }, createdAt: 3 }));
      await persistEntry(createEntry({ id: 'c1', state: { type: 'confirmed' }, createdAt: 4 }));

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(2);
      expect(loaded.map((e) => e.id)).toEqual(['p1', 'f1']);
    });

    it('returns entries ordered by createdAt ascending', async () => {
      await persistEntry(createEntry({ id: 'later', createdAt: 3000 }));
      await persistEntry(createEntry({ id: 'earliest', createdAt: 1000 }));
      await persistEntry(createEntry({ id: 'middle', createdAt: 2000 }));

      const loaded = await loadPendingEntries();
      expect(loaded.map((e) => e.id)).toEqual(['earliest', 'middle', 'later']);
    });
  });

  describe('markUploaded', () => {
    it('removes the entry from IndexedDB', async () => {
      await persistEntry(createEntry({ id: 'to-remove' }));
      await markUploaded('to-remove');

      const loaded = await loadPendingEntries();
      expect(loaded).toEqual([]);
    });

    it('does not affect other entries', async () => {
      await persistEntry(createEntry({ id: 'keep', createdAt: 1 }));
      await persistEntry(createEntry({ id: 'remove', createdAt: 2 }));

      await markUploaded('remove');

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe('keep');
    });

    it('is a no-op when the id does not exist', async () => {
      await expect(markUploaded('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('markFailed', () => {
    it('updates entry status to failed with error message', async () => {
      await persistEntry(createEntry({ id: 'fail-me' }));
      await markFailed('fail-me', 'Connection refused');

      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.state).toEqual({
        type: 'failed',
        errorMessage: 'Connection refused',
      });
    });

    it('increments the retry count', async () => {
      await persistEntry(createEntry({ id: 'retry-me', retryCount: 0 }));
      await markFailed('retry-me', 'Timeout');

      const loaded = await loadPendingEntries();
      expect(loaded[0]?.retryCount).toBe(1);
    });

    it('increments retry count on successive failures', async () => {
      await persistEntry(createEntry({ id: 'multi-fail', retryCount: 0 }));
      await markFailed('multi-fail', 'Error 1');
      await markFailed('multi-fail', 'Error 2');
      await markFailed('multi-fail', 'Error 3');

      const loaded = await loadPendingEntries();
      expect(loaded[0]?.retryCount).toBe(3);
      expect(loaded[0]?.state).toEqual({
        type: 'failed',
        errorMessage: 'Error 3',
      });
    });

    it('is a no-op when the id does not exist', async () => {
      await expect(markFailed('nonexistent', 'some error')).resolves.toBeUndefined();
    });

    it('does not affect other entries', async () => {
      await persistEntry(createEntry({ id: 'untouched', createdAt: 1 }));
      await persistEntry(createEntry({ id: 'fail-target', createdAt: 2 }));

      await markFailed('fail-target', 'Server 500');

      const loaded = await loadPendingEntries();
      const untouched = loaded.find((e) => e.id === 'untouched');
      expect(untouched?.state.type).toBe('pending');
      expect(untouched?.retryCount).toBe(0);
    });
  });

  describe('data persistence across connections', () => {
    it('data survives closing and reopening the database', async () => {
      await persistEntry(createEntry({ id: 'persistent-entry' }));

      // Loading again opens a new connection internally
      const loaded = await loadPendingEntries();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe('persistent-entry');
    });
  });
});
