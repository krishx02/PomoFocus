// Sync upload driver — sends outbox entries to the Hono API via openapi-fetch (ADR-006, ADR-007).
// IO driver only. Pure sync FSM lives in packages/core/sync/.
// No direct Supabase imports (PKG-D02). No React imports (PKG-D04).

import type { ApiClient } from '../client';
import type { OutboxEntry, SyncableEntityType } from '@pomofocus/core';
import type { paths } from '../generated/api-types';

// ── Result Types ──

type UploadSuccess = {
  readonly ok: true;
};

type UploadFailure = {
  readonly ok: false;
  readonly status: number;
  readonly message: string;
  readonly retryable: boolean;
};

type UploadResult = UploadSuccess | UploadFailure;

// ── Payload Types ──

type SessionPayload =
  paths['/v1/sessions']['post']['requestBody']['content']['application/json'];

type EntityPayload = SessionPayload;

// ── Minimal Response Shape ──
// openapi-fetch returns `Response` (DOM type) which is unresolvable without
// "dom" in tsconfig lib. This package intentionally omits "dom" (it runs in
// Node/CF Workers). We define only the fields we read so the compiler can
// verify access without pulling in the DOM lib.

type MinimalResponse = {
  readonly status: number;
  readonly statusText: string;
};

// ── Upload Logic ──

/**
 * Uploads a single outbox entry to the API.
 *
 * Routes to the correct endpoint based on `entry.entityType`.
 * Returns a result object — never throws for expected failures.
 * Duplicate UUIDs (409) are treated as success (idempotent writes per ADR-007).
 */
async function uploadEntry(
  client: ApiClient,
  entry: OutboxEntry,
  payload: EntityPayload,
): Promise<UploadResult> {
  switch (entry.entityType) {
    case 'sessions':
      return uploadSession(client, payload);
    case 'breaks':
    case 'encouragement_taps':
    case 'user_preferences':
    case 'long_term_goals':
    case 'process_goals':
      return {
        ok: false,
        status: 0,
        message: `Upload not yet implemented for entity type: ${entry.entityType}`,
        retryable: false,
      };
    default: {
      const _exhaustive: never = entry.entityType;
      return _exhaustive;
    }
  }
}

async function uploadSession(
  client: ApiClient,
  payload: SessionPayload,
): Promise<UploadResult> {
  const result = await client.POST('/v1/sessions', {
    body: payload,
  });

  if (result.data !== undefined) {
    return { ok: true };
  }

  // Cast to minimal shape — openapi-fetch response is always a standard
  // Response at runtime; the DOM type is just unresolvable in our tsconfig.
  const response = result.response as unknown as MinimalResponse;
  const status = response.status;

  // Server returns 409 for duplicate UUID — treat as success (idempotent write)
  if (status === 409) {
    return { ok: true };
  }

  const message =
    extractErrorMessage(result.error) ?? (response.statusText !== '' ? response.statusText : 'Upload failed');

  return {
    ok: false,
    status,
    message,
    retryable: isRetryableStatus(status),
  };
}

// ── Helpers ──

function extractErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('error' in error && typeof error.error === 'string' && error.error.length > 0) {
    return error.error;
  }

  return undefined;
}

function isRetryableStatus(status: number): boolean {
  // 408 Request Timeout, 429 Too Many Requests, 5xx Server Errors
  if (status === 408 || status === 429) {
    return true;
  }
  return status >= 500;
}

/** Returns the set of entity types that have upload implementations. */
function getSupportedEntityTypes(): readonly SyncableEntityType[] {
  return ['sessions'] as const;
}

export { uploadEntry, isRetryableStatus, getSupportedEntityTypes };
export type { UploadResult, UploadSuccess, UploadFailure, EntityPayload, SessionPayload };
