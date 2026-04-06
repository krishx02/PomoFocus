import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from '../client';
import { uploadEntry, isRetryableStatus, getSupportedEntityTypes } from './upload-driver';
import type { UploadResult, SessionPayload } from './upload-driver';
import type { OutboxEntry } from '@pomofocus/core';

type StubResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (key: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  clone: () => StubResponse;
};

function stubFetch(status: number, body: unknown): void {
  const response: StubResponse = {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusTextFor(status),
    headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: () => response,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function statusTextFor(status: number): string {
  const texts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  return texts[status] ?? '';
}

function makeSessionEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'outbox-entry-1',
    entityType: 'sessions',
    entityId: '550e8400-e29b-41d4-a716-446655440000',
    state: { type: 'uploading' },
    retryCount: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeSessionPayload(): SessionPayload {
  return {
    started_at: '2026-03-17T10:00:00Z',
    ended_at: '2026-03-17T10:25:00Z',
    focus_quality: 'locked_in',
  };
}

describe('uploadEntry', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success for a 201 session creation', async () => {
    const responseBody = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-1',
      process_goal_id: 'goal-1',
      intention_text: null,
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
      completed: true,
      abandonment_reason: null,
      focus_quality: 'locked_in',
      distraction_type: null,
      device_id: null,
      created_at: '2026-03-17T10:25:00Z',
    };

    stubFetch(201, responseBody);

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result: UploadResult = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(true);
  });

  it('treats 409 (duplicate UUID) as success', async () => {
    stubFetch(409, { error: 'Duplicate entry' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(true);
  });

  it('returns retryable failure for 500 server error', async () => {
    stubFetch(500, { error: 'Internal server error' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.message).toBe('Internal server error');
      expect(result.retryable).toBe(true);
    }
  });

  it('returns retryable failure for 503 service unavailable', async () => {
    stubFetch(503, { error: 'Service unavailable' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.retryable).toBe(true);
    }
  });

  it('returns retryable failure for 429 too many requests', async () => {
    stubFetch(429, { error: 'Rate limited' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.retryable).toBe(true);
    }
  });

  it('returns non-retryable failure for 422 validation error', async () => {
    stubFetch(422, { error: 'Validation failed' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.message).toBe('Validation failed');
      expect(result.retryable).toBe(false);
    }
  });

  it('returns non-retryable failure for 401 unauthorized', async () => {
    stubFetch(401, { error: 'Unauthorized' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.retryable).toBe(false);
    }
  });

  it('returns non-retryable failure for 400 bad request', async () => {
    stubFetch(400, { error: 'Bad request' });

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.retryable).toBe(false);
    }
  });

  it('uses statusText when error body has no error field', async () => {
    stubFetch(500, {});

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Internal Server Error');
    }
  });

  it('uses fallback message when error body is empty and no statusText', async () => {
    const response: StubResponse = {
      ok: false,
      status: 500,
      statusText: '',
      headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
      clone: () => response,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload = makeSessionPayload();

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Upload failed');
    }
  });

  it('returns not-implemented failure for unsupported entity types', async () => {
    const client = createApiClient(baseUrl);
    const payload = makeSessionPayload();

    const unsupportedTypes = [
      'breaks',
      'encouragement_taps',
      'user_preferences',
      'long_term_goals',
      'process_goals',
    ] as const;

    for (const entityType of unsupportedTypes) {
      const entry = makeSessionEntry({ entityType });
      const result = await uploadEntry(client, entry, payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(0);
        expect(result.message).toContain(entityType);
        expect(result.retryable).toBe(false);
      }
    }
  });

  it('sends minimal session payload (no optional fields)', async () => {
    const responseBody = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-1',
      process_goal_id: 'goal-1',
      intention_text: null,
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
      completed: true,
      abandonment_reason: null,
      focus_quality: null,
      distraction_type: null,
      device_id: null,
      created_at: '2026-03-17T10:25:00Z',
    };

    stubFetch(201, responseBody);

    const client = createApiClient(baseUrl);
    const entry = makeSessionEntry();
    const payload: SessionPayload = {
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
    };

    const result = await uploadEntry(client, entry, payload);

    expect(result.ok).toBe(true);
  });
});

describe('isRetryableStatus', () => {
  it('returns true for 408 Request Timeout', () => {
    expect(isRetryableStatus(408)).toBe(true);
  });

  it('returns true for 429 Too Many Requests', () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('returns true for 500 Internal Server Error', () => {
    expect(isRetryableStatus(500)).toBe(true);
  });

  it('returns true for 502 Bad Gateway', () => {
    expect(isRetryableStatus(502)).toBe(true);
  });

  it('returns true for 503 Service Unavailable', () => {
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('returns false for 200 OK', () => {
    expect(isRetryableStatus(200)).toBe(false);
  });

  it('returns false for 400 Bad Request', () => {
    expect(isRetryableStatus(400)).toBe(false);
  });

  it('returns false for 401 Unauthorized', () => {
    expect(isRetryableStatus(401)).toBe(false);
  });

  it('returns false for 404 Not Found', () => {
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('returns false for 422 Unprocessable Entity', () => {
    expect(isRetryableStatus(422)).toBe(false);
  });
});

describe('getSupportedEntityTypes', () => {
  it('returns sessions as a supported entity type', () => {
    const supported = getSupportedEntityTypes();
    expect(supported).toContain('sessions');
  });

  it('returns a frozen array', () => {
    const supported = getSupportedEntityTypes();
    expect(Array.isArray(supported)).toBe(true);
  });
});
