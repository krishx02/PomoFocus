import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createApiClient,
  createSession,
  getSessions,
  isApiError,
  handleApiError,
} from './index';
import type {
  ApiClient,
  ApiError,
  CreateSessionBody,
  SessionResponse,
  SessionListResponse,
  CreateSessionResult,
  GetSessionsResult,
} from './index';

function stubFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 422 ? 'Unprocessable Entity' : '',
      headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      clone() {
        return this;
      },
    }),
  );
}

describe('data-access integration', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a client and verifies type inference', () => {
    const client: ApiClient = createApiClient(baseUrl);

    // Client has typed HTTP methods
    expect(typeof client.GET).toBe('function');
    expect(typeof client.POST).toBe('function');
    expect(typeof client.PUT).toBe('function');
    expect(typeof client.DELETE).toBe('function');
  });

  it('full pipeline: client creation → createSession → type-safe response', async () => {
    const sessionData: CreateSessionBody = {
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
      focus_quality: 'locked_in',
    };

    const responseBody: SessionResponse = {
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
    const result: CreateSessionResult = await createSession(client, sessionData);

    // Verify the full response structure
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.data?.focus_quality).toBe('locked_in');
    expect(result.error).toBeUndefined();
  });

  it('full pipeline: client creation → getSessions → type-safe response', async () => {
    const responseBody: SessionListResponse = {
      data: [
        {
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
        },
      ],
      total: 1,
    };

    stubFetch(200, responseBody);

    const client = createApiClient(baseUrl);
    const result: GetSessionsResult = await getSessions(client, { limit: 10 });

    // Verify paginated response structure
    expect(result.data).toBeDefined();
    expect(result.data?.data).toHaveLength(1);
    expect(result.data?.total).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('full pipeline: client creation → error response → handleApiError', async () => {
    const errorBody = {
      error: 'Validation failed',
      details: { field: 'started_at' },
    };

    stubFetch(422, errorBody);

    const client = createApiClient(baseUrl);
    const sessionData: CreateSessionBody = {
      started_at: 'invalid-date',
      ended_at: '2026-03-17T10:25:00Z',
    };

    const result = await createSession(client, sessionData);

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();

    // Use handleApiError to transform the error
    const apiError: ApiError = handleApiError({
      error: result.error,
      response: {
        status: 422,
        statusText: 'Unprocessable Entity',
      },
    });

    expect(apiError.status).toBe(422);
    expect(apiError.message).toBe('Validation failed');
    expect(isApiError(apiError)).toBe(true);
  });

  it('isApiError correctly identifies ApiError objects', () => {
    const validError: ApiError = { status: 404, message: 'Not found' };
    expect(isApiError(validError)).toBe(true);

    expect(isApiError(null)).toBe(false);
    expect(isApiError('string')).toBe(false);
    expect(isApiError({ status: 'not-a-number', message: 'test' })).toBe(false);
  });

  it('all public exports are accessible from index', () => {
    // Runtime function exports
    expect(typeof createApiClient).toBe('function');
    expect(typeof createSession).toBe('function');
    expect(typeof getSessions).toBe('function');
    expect(typeof isApiError).toBe('function');
    expect(typeof handleApiError).toBe('function');
  });
});
