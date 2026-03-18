import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient } from './client';
import { createSession, getSessions } from './sessions';

function stubFetch(status: number, body: unknown): void {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: (): typeof response => response,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('createSession', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns session data for a successful 201 response', async () => {
    const sessionBody = {
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
      focus_quality: 'locked_in' as const,
    };

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
    const result = await createSession(client, sessionBody);

    expect(result.data).toEqual(responseBody);
    expect(result.error).toBeUndefined();
  });

  it('returns error for a 422 validation failure', async () => {
    const sessionBody = {
      started_at: 'invalid-date',
      ended_at: '2026-03-17T10:25:00Z',
    };

    const errorBody = {
      error: 'Validation failed',
      details: { field: 'started_at' },
    };

    stubFetch(422, errorBody);

    const client = createApiClient(baseUrl);
    const result = await createSession(client, sessionBody);

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(errorBody);
  });

  it('sends minimal required fields only', async () => {
    const sessionBody = {
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:25:00Z',
    };

    const responseBody = {
      id: '550e8400-e29b-41d4-a716-446655440001',
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
    const result = await createSession(client, sessionBody);

    expect(result.data).toEqual(responseBody);
  });
});

describe('getSessions', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns session list with no params', async () => {
    const responseBody = {
      data: [],
      total: 0,
    };

    stubFetch(200, responseBody);

    const client = createApiClient(baseUrl);
    const result = await getSessions(client);

    expect(result.data).toEqual(responseBody);
    expect(result.error).toBeUndefined();
  });

  it('returns session list with pagination params', async () => {
    const sessions = [
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
    ];

    const responseBody = {
      data: sessions,
      total: 1,
    };

    stubFetch(200, responseBody);

    const client = createApiClient(baseUrl);
    const result = await getSessions(client, { limit: 10, offset: 0 });

    expect(result.data).toEqual(responseBody);
  });

  it('returns error for a 422 validation failure', async () => {
    const errorBody = {
      error: 'Invalid limit parameter',
    };

    stubFetch(422, errorBody);

    const client = createApiClient(baseUrl);
    const result = await getSessions(client, { limit: -1 });

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(errorBody);
  });

  it('returns multiple sessions in paginated response', async () => {
    const sessions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'user-1',
        process_goal_id: 'goal-1',
        intention_text: 'Work on feature',
        started_at: '2026-03-17T10:00:00Z',
        ended_at: '2026-03-17T10:25:00Z',
        completed: true,
        abandonment_reason: null,
        focus_quality: 'locked_in',
        distraction_type: null,
        device_id: null,
        created_at: '2026-03-17T10:25:00Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        user_id: 'user-1',
        process_goal_id: 'goal-1',
        intention_text: null,
        started_at: '2026-03-17T10:30:00Z',
        ended_at: '2026-03-17T10:55:00Z',
        completed: true,
        abandonment_reason: null,
        focus_quality: 'decent',
        distraction_type: 'phone',
        device_id: null,
        created_at: '2026-03-17T10:55:00Z',
      },
    ];

    const responseBody = {
      data: sessions,
      total: 15,
    };

    stubFetch(200, responseBody);

    const client = createApiClient(baseUrl);
    const result = await getSessions(client, { limit: 2, offset: 0 });

    expect(result.data?.data).toHaveLength(2);
    expect(result.data?.total).toBe(15);
  });
});
