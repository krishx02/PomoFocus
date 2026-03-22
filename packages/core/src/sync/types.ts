// Outbox queue state machine types (ADR-006).
// Pure types — no IO, no React, no Supabase imports.

// ── Syncable Entities ──

/** Tables that participate in outbox sync (ADR-005). */
export type SyncableEntityType =
  | 'sessions'
  | 'breaks'
  | 'encouragement_taps'
  | 'user_preferences'
  | 'long_term_goals'
  | 'process_goals';

// ── Queue Item Status (as const object per U-010) ──

export const QUEUE_ITEM_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

export type QueueItemStatus = (typeof QUEUE_ITEM_STATUS)[keyof typeof QUEUE_ITEM_STATUS];

// ── Queue Item States (discriminated union) ──

/** Discriminated union for the state of a single outbox entry. */
export type QueueItemState =
  | { readonly type: 'pending' }
  | { readonly type: 'uploading' }
  | { readonly type: 'confirmed' }
  | { readonly type: 'failed'; readonly errorMessage: string };

// ── Outbox Entry ──

/** A single entry in the outbox queue. */
export type OutboxEntry = {
  readonly id: string;
  readonly entityType: SyncableEntityType;
  readonly entityId: string;
  readonly state: QueueItemState;
  readonly retryCount: number;
  readonly createdAt: number;
};

// ── Outbox Queue ──

/** The full outbox queue — an ordered list of entries. */
export type OutboxQueue = {
  readonly entries: readonly OutboxEntry[];
};

// ── Sync Event Type (as const object per U-010) ──

export const SYNC_EVENT_TYPE = {
  ENQUEUE: 'ENQUEUE',
  UPLOAD_START: 'UPLOAD_START',
  UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
  UPLOAD_FAILURE: 'UPLOAD_FAILURE',
  RETRY: 'RETRY',
  NETWORK_AVAILABLE: 'NETWORK_AVAILABLE',
} as const;

export type SyncEventType = (typeof SYNC_EVENT_TYPE)[keyof typeof SYNC_EVENT_TYPE];

// ── Sync Events (discriminated union) ──

/** Discriminated union for outbox queue state machine events. */
export type SyncEvent =
  | {
      readonly type: typeof SYNC_EVENT_TYPE.ENQUEUE;
      readonly entryId: string;
      readonly entityType: SyncableEntityType;
      readonly entityId: string;
      readonly createdAt: number;
    }
  | { readonly type: typeof SYNC_EVENT_TYPE.UPLOAD_START; readonly entryId: string }
  | { readonly type: typeof SYNC_EVENT_TYPE.UPLOAD_SUCCESS; readonly entryId: string }
  | {
      readonly type: typeof SYNC_EVENT_TYPE.UPLOAD_FAILURE;
      readonly entryId: string;
      readonly errorMessage: string;
    }
  | { readonly type: typeof SYNC_EVENT_TYPE.RETRY; readonly entryId: string }
  | { readonly type: typeof SYNC_EVENT_TYPE.NETWORK_AVAILABLE };

// ── Retry Policy ──

/** Configuration for exponential backoff with jitter. */
export type RetryPolicy = {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly jitterMs: number;
};
