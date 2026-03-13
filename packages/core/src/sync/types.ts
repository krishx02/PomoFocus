// Placeholder types for the outbox queue state machine (ADR-006).
// Implementation comes in Phase 2 — these are type definitions only.

// ── Syncable Entities ──

/** Tables that participate in outbox sync (ADR-005). */
export type SyncableEntityType =
  | 'sessions'
  | 'breaks'
  | 'encouragement_taps'
  | 'user_preferences'
  | 'long_term_goals'
  | 'process_goals';

// ── Queue Item States ──

/** Discriminated union for the state of a single outbox entry. */
export type QueueItemState =
  | { readonly type: 'pending' }
  | { readonly type: 'uploading' }
  | { readonly type: 'confirmed' }
  | { readonly type: 'failed'; readonly errorMessage: string };

// ── Sync Events ──

/** Discriminated union for outbox queue state machine events. */
export type SyncEvent =
  | {
      readonly type: 'ENQUEUE';
      readonly entryId: string;
      readonly entityType: SyncableEntityType;
      readonly entityId: string;
    }
  | { readonly type: 'UPLOAD_START'; readonly entryId: string }
  | { readonly type: 'UPLOAD_SUCCESS'; readonly entryId: string }
  | { readonly type: 'UPLOAD_FAILURE'; readonly entryId: string; readonly errorMessage: string }
  | { readonly type: 'RETRY'; readonly entryId: string }
  | { readonly type: 'NETWORK_AVAILABLE' };

// ── Retry Policy ──

/** Configuration for exponential backoff with jitter. */
export type RetryPolicy = {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly jitterMs: number;
};
