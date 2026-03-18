import { describe, it, expect, vi } from 'vitest';
import { createSession, getSessions } from './sessions';
import type { ApiClient } from './client';

const mockResponse = { ok: true, status: 200 };
const mockErrorResponse = { ok: false, status: 422 };

function createMockClient(overrides?: {
  POST?: ReturnType<typeof vi.fn>;
  GET?: ReturnType<typeof vi.fn>;
}): ApiClient {
  return {
    GET: overrides?.GET ?? vi.fn(),
    POST: overrides?.POST ?? vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
    PATCH: vi.fn(),
    OPTIONS: vi.fn(),
    HEAD: vi.fn(),
    TRACE: vi.fn(),
    use: vi.fn(),
    eject: vi.fn(),
  } as unknown as ApiClient;
}

describe('createSession', () => {
  const sessionData = {
    started_at: '2026-03-17T10:00:00Z',
    ended_at: '2026-03-17T10:25:00Z',
    focus_quality: 'locked_in' as const,
  };

  const createdSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 'user-123',
    process_goal_id: 'goal-456',
    intention_text: null,
    started_at: '2026-03-17T10:00:00Z',
    ended_at: '2026-03-17T10:25:00Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: 'locked_in' as const,
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-17T10:25:01Z',
  };

  it('calls POST /v1/sessions with the provided data', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: createdSession,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ POST: mockPost });

    await createSession(client, sessionData);

    expect(mockPost).toHaveBeenCalledWith('/v1/sessions', {
      body: sessionData,
    });
  });

  it('returns data on success', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: createdSession,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ POST: mockPost });

    const result = await createSession(client, sessionData);

    expect(result.data).toEqual(createdSession);
    expect(result.error).toBeUndefined();
  });

  it('returns error on validation failure', async () => {
    const validationError = {
      error: 'Validation failed',
      details: { started_at: 'must be a valid date-time' },
    };
    const mockPost = vi.fn().mockResolvedValue({
      data: undefined,
      error: validationError,
      response: mockErrorResponse,
    });
    const client = createMockClient({ POST: mockPost });

    const result = await createSession(client, sessionData);

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(validationError);
  });

  it('passes optional fields when provided', async () => {
    const dataWithDistraction = {
      ...sessionData,
      distraction_type: 'phone' as const,
    };
    const mockPost = vi.fn().mockResolvedValue({
      data: { ...createdSession, distraction_type: 'phone' },
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ POST: mockPost });

    await createSession(client, dataWithDistraction);

    expect(mockPost).toHaveBeenCalledWith('/v1/sessions', {
      body: dataWithDistraction,
    });
  });
});

describe('getSessions', () => {
  const sessionsList = {
    data: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'user-123',
        process_goal_id: 'goal-456',
        intention_text: null,
        started_at: '2026-03-17T10:00:00Z',
        ended_at: '2026-03-17T10:25:00Z',
        completed: true,
        abandonment_reason: null,
        focus_quality: 'locked_in' as const,
        distraction_type: null,
        device_id: null,
        created_at: '2026-03-17T10:25:01Z',
      },
    ],
    total: 1,
  };

  it('calls GET /v1/sessions without params when none provided', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: sessionsList,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ GET: mockGet });

    await getSessions(client);

    expect(mockGet).toHaveBeenCalledWith('/v1/sessions', {});
  });

  it('calls GET /v1/sessions with pagination params', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: sessionsList,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ GET: mockGet });

    await getSessions(client, { limit: 10, offset: 20 });

    expect(mockGet).toHaveBeenCalledWith('/v1/sessions', {
      params: { query: { limit: 10, offset: 20 } },
    });
  });

  it('returns data on success', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: sessionsList,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ GET: mockGet });

    const result = await getSessions(client);

    expect(result.data).toEqual(sessionsList);
    expect(result.error).toBeUndefined();
  });

  it('returns error on validation failure', async () => {
    const validationError = {
      error: 'Validation failed',
      details: { limit: 'must be positive' },
    };
    const mockGet = vi.fn().mockResolvedValue({
      data: undefined,
      error: validationError,
      response: mockErrorResponse,
    });
    const client = createMockClient({ GET: mockGet });

    const result = await getSessions(client, { limit: -1 });

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual(validationError);
  });

  it('passes only limit when offset is not provided', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: sessionsList,
      error: undefined,
      response: mockResponse,
    });
    const client = createMockClient({ GET: mockGet });

    await getSessions(client, { limit: 25 });

    expect(mockGet).toHaveBeenCalledWith('/v1/sessions', {
      params: { query: { limit: 25 } },
    });
  });
});
