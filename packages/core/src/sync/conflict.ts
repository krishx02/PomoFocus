// Conflict resolution rules (ADR-006).
// Pure functions — no IO, no React, no Supabase imports.

import type { SyncableEntityType } from './types.js';

// Re-export SyncableEntityType for consumer convenience.
export type { SyncableEntityType } from './types.js';

// ── Append-Only Entity Set ──

/** Entity types that use UUID idempotency (INSERT ON CONFLICT DO NOTHING). */
const APPEND_ONLY_ENTITIES: ReadonlySet<SyncableEntityType> = new Set([
  'sessions',
  'breaks',
  'encouragement_taps',
]);

// ── Conflict Record ──

/** Minimal record shape needed for conflict detection. */
export type ConflictRecord = {
  readonly entityType: SyncableEntityType;
  readonly entityId: string;
  readonly version: number;
};

// ── Resolution Strategies (as const object per U-010) ──

export const CONFLICT_RESOLUTION = {
  SKIP: 'SKIP',
  APPLY: 'APPLY',
  REFETCH_AND_RETRY: 'REFETCH_AND_RETRY',
} as const;

export type ConflictResolutionType =
  (typeof CONFLICT_RESOLUTION)[keyof typeof CONFLICT_RESOLUTION];

/** Discriminated union for conflict resolution outcomes. */
export type ConflictResolution =
  | { readonly type: typeof CONFLICT_RESOLUTION.SKIP }
  | { readonly type: typeof CONFLICT_RESOLUTION.APPLY }
  | {
      readonly type: typeof CONFLICT_RESOLUTION.REFETCH_AND_RETRY;
      readonly serverVersion: number;
    };

// ── Public API ──

/**
 * Returns true if the entity type is append-only (uses UUID idempotency).
 * Append-only records use INSERT ... ON CONFLICT (id) DO NOTHING —
 * retries are inherently safe and conflicts cannot occur.
 */
export function isIdempotent(entityType: SyncableEntityType): boolean {
  return APPEND_ONLY_ENTITIES.has(entityType);
}

/**
 * Determines the conflict resolution strategy for a local record
 * given the current server state.
 *
 * - Append-only entities: always SKIP (UUID dedup handles it).
 * - Updatable entities: APPLY if versions match (optimistic lock holds),
 *   REFETCH_AND_RETRY if versions differ (another device updated first).
 */
export function resolveConflict(
  localRecord: ConflictRecord,
  serverRecord: ConflictRecord,
): ConflictResolution {
  if (isIdempotent(localRecord.entityType)) {
    return { type: CONFLICT_RESOLUTION.SKIP };
  }

  if (localRecord.version === serverRecord.version) {
    return { type: CONFLICT_RESOLUTION.APPLY };
  }

  return {
    type: CONFLICT_RESOLUTION.REFETCH_AND_RETRY,
    serverVersion: serverRecord.version,
  };
}
