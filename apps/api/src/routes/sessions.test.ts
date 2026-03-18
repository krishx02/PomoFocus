import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerSessionsRoute, CreateSessionBodySchema } from './sessions.js';

/**
 * Mock Supabase module so no real network calls are made.
 * The mock returns a chainable query builder matching the Supabase SDK pattern.
 */
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

vi.mock('../lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
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
