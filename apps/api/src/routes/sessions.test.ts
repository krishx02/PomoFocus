import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerSessionsRoute, CreateSessionBodySchema, ListSessionsQuerySchema } from './sessions.js';

/**
 * Mock Supabase module so no real network calls are made.
 * The mock returns a chainable query builder matching the Supabase SDK pattern.
 *
 * INSERT chain: insert() -> select() -> single()
 * SELECT chain: select('*', { count: 'exact' }) -> order() -> range()
 */
const mockSingle = vi.fn();
const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));

const mockRange = vi.fn();
const mockOrder = vi.fn(() => ({ range: mockRange }));
const mockQuerySelect = vi.fn(() => ({ order: mockOrder }));

vi.mock('../lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockQuerySelect,
    })),
  })),
}));

/**
 * Fake Supabase env bindings for test requests.
 * These are never sent to a real Supabase instance — the module is mocked.
 */
const FAKE_ENV = {
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key',
};

function createTestApp(): OpenAPIHono {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'Validation failed', details: result.error.flatten() },
          422,
        );
      }
    },
  });
  registerSessionsRoute(app);
  return app;
}

function validSessionBody(): Record<string, unknown> {
  return {
    started_at: '2026-03-17T10:00:00.000Z',
    ended_at: '2026-03-17T10:25:00.000Z',
  };
}

const FAKE_SESSION_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '00000000-0000-0000-0000-000000000000',
  process_goal_id: '00000000-0000-0000-0000-000000000000',
  intention_text: null,
  started_at: '2026-03-17T10:00:00.000Z',
  ended_at: '2026-03-17T10:25:00.000Z',
  completed: true,
  abandonment_reason: null,
  focus_quality: null,
  distraction_type: null,
  device_id: null,
  created_at: '2026-03-17T10:25:01.000Z',
};

describe('POST /v1/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns 201 with created session for valid body', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_SESSION_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionBody()),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(FAKE_SESSION_ROW.id);
    expect(body.started_at).toBe(FAKE_SESSION_ROW.started_at);
    expect(body.ended_at).toBe(FAKE_SESSION_ROW.ended_at);
  });

  it('returns 201 with optional focus_quality and distraction_type', async () => {
    const sessionWithOptionals = {
      ...FAKE_SESSION_ROW,
      focus_quality: 'locked_in',
      distraction_type: 'phone',
    };
    mockSingle.mockResolvedValueOnce({
      data: sessionWithOptionals,
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionBody(),
          focus_quality: 'locked_in',
          distraction_type: 'phone',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.focus_quality).toBe('locked_in');
    expect(body.distraction_type).toBe('phone');
  });

  it('returns 422 when required field "started_at" is missing', async () => {
    const app = createTestApp();
    const { started_at: _, ...bodyWithoutStartedAt } = validSessionBody();

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyWithoutStartedAt),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 when required field "ended_at" is missing', async () => {
    const app = createTestApp();
    const { ended_at: _, ...bodyWithoutEndedAt } = validSessionBody();

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyWithoutEndedAt),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 for invalid focus_quality enum value', async () => {
    const app = createTestApp();

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionBody(),
          focus_quality: 'invalid_value',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 422 for invalid distraction_type enum value', async () => {
    const app = createTestApp();

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionBody(),
          distraction_type: 'invalid_value',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 when started_at is not a valid datetime', async () => {
    const app = createTestApp();

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionBody(),
          started_at: 'not-a-date',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('passes correct data to Supabase insert', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_SESSION_ROW, error: null });

    const app = createTestApp();
    await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validSessionBody(),
          focus_quality: 'decent',
          distraction_type: 'thoughts_wandering',
        }),
      },
      FAKE_ENV,
    );

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: '00000000-0000-0000-0000-000000000000',
      process_goal_id: '00000000-0000-0000-0000-000000000000',
      started_at: '2026-03-17T10:00:00.000Z',
      ended_at: '2026-03-17T10:25:00.000Z',
      focus_quality: 'decent',
      distraction_type: 'thoughts_wandering',
      completed: true,
    });
  });

  it('returns 500 when Supabase insert fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json(
        { error: 'Internal server error', status: 500 },
        500,
      );
    });

    const res = await app.request(
      '/v1/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSessionBody()),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('validates CreateSessionBodySchema accepts all valid focus_quality values', () => {
    const validQualities = ['locked_in', 'decent', 'struggled'];
    for (const quality of validQualities) {
      const result = CreateSessionBodySchema.safeParse({
        ...validSessionBody(),
        focus_quality: quality,
      });
      expect(result.success).toBe(true);
    }
  });

  it('validates CreateSessionBodySchema accepts all valid distraction_type values', () => {
    const validTypes = ['phone', 'people', 'thoughts_wandering', 'got_stuck', 'other'];
    for (const type of validTypes) {
      const result = CreateSessionBodySchema.safeParse({
        ...validSessionBody(),
        distraction_type: type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('GET /v1/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  const FAKE_SESSIONS_LIST = [
    {
      ...FAKE_SESSION_ROW,
      id: '22222222-2222-2222-2222-222222222222',
      started_at: '2026-03-17T11:00:00.000Z',
    },
    FAKE_SESSION_ROW,
  ];

  it('returns 200 with default pagination (limit=20, offset=0)', async () => {
    mockRange.mockResolvedValueOnce({
      data: FAKE_SESSIONS_LIST,
      error: null,
      count: 2,
    });

    const app = createTestApp();
    const res = await app.request('/v1/sessions', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);

    // Verify default pagination was applied: select -> order -> range(0, 19)
    expect(mockQuerySelect).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 19);
  });

  it('returns 200 with custom limit and offset', async () => {
    mockRange.mockResolvedValueOnce({
      data: [FAKE_SESSION_ROW],
      error: null,
      count: 50,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/sessions?limit=5&offset=10',
      { method: 'GET' },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(50);

    // Verify custom pagination: range(10, 14)
    expect(mockRange).toHaveBeenCalledWith(10, 14);
  });

  it('caps limit at 100 via Zod validation', () => {
    const overLimit = ListSessionsQuerySchema.safeParse({ limit: 200, offset: 0 });
    expect(overLimit.success).toBe(false);

    const atLimit = ListSessionsQuerySchema.safeParse({ limit: 100, offset: 0 });
    expect(atLimit.success).toBe(true);
  });

  it('rejects limit below 1 via Zod validation', () => {
    const zeroLimit = ListSessionsQuerySchema.safeParse({ limit: 0, offset: 0 });
    expect(zeroLimit.success).toBe(false);

    const negativeLimit = ListSessionsQuerySchema.safeParse({ limit: -5, offset: 0 });
    expect(negativeLimit.success).toBe(false);
  });

  it('rejects negative offset via Zod validation', () => {
    const negativeOffset = ListSessionsQuerySchema.safeParse({ limit: 20, offset: -1 });
    expect(negativeOffset.success).toBe(false);
  });

  it('returns empty data array when no sessions exist', async () => {
    mockRange.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 0,
    });

    const app = createTestApp();
    const res = await app.request('/v1/sessions', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns 500 when Supabase select fails', async () => {
    mockRange.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
      count: null,
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json(
        { error: 'Internal server error', status: 500 },
        500,
      );
    });

    const res = await app.request('/v1/sessions', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(500);
  });
});
