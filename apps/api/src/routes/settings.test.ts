import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import {
  registerSettingsRoute,
  SettingsResponseSchema,
  UpdateSettingsBodySchema,
} from './settings.js';

/**
 * Mock Supabase module so no real network calls are made.
 *
 * GET chain: select('*') -> single()
 * UPDATE chain: update() -> select() -> single()
 */
const mockSingle = vi.fn();
const mockSelectStar = vi.fn(() => ({ single: mockSingle }));
const mockUpdateSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpdate = vi.fn(() => ({ select: mockUpdateSelect }));

const mockGetUser = vi.fn();

const { mockCreateUserClient } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  createUserClient: mockCreateUserClient,
}));

const FAKE_ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_ANON_KEY: 'fake-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key',
};

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake';

const FAKE_USER = {
  id: 'aaaa1111-0000-0000-0000-000000000001',
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

const FAKE_PREFERENCES_ROW = {
  id: 'cccc0001-0000-0000-0000-000000000001',
  user_id: FAKE_USER.id,
  work_duration_minutes: 30,
  short_break_minutes: 5,
  long_break_minutes: 20,
  sessions_before_long_break: 4,
  reflection_enabled: true,
  timezone: 'America/New_York',
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

function createTestApp(): OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }> {
  const app = new OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'Validation failed', details: result.error.flatten() },
          422,
        );
      }
    },
  });
  app.use('/v1/*', authMiddleware);
  registerSettingsRoute(app);
  return app;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${FAKE_JWT}` };
}

describe('GET /v1/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelectStar,
        update: mockUpdate,
      })),
      auth: { getUser: mockGetUser },
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/settings', {}, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with current user preferences', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_PREFERENCES_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      { headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = SettingsResponseSchema.parse(await res.json());
    expect(body.work_duration_minutes).toBe(30);
    expect(body.short_break_minutes).toBe(5);
    expect(body.long_break_minutes).toBe(20);
    expect(body.sessions_before_long_break).toBe(4);
    expect(body.reflection_enabled).toBe(true);
    expect(body.timezone).toBe('America/New_York');
  });

  it('excludes internal fields (id, user_id, created_at, updated_at)', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_PREFERENCES_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      { headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('created_at');
    expect(body).not.toHaveProperty('updated_at');
  });

  it('returns exactly the expected shape', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_PREFERENCES_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      { headers: authHeaders() },
      FAKE_ENV,
    );

    const body = SettingsResponseSchema.parse(await res.json());
    expect(Object.keys(body).sort()).toEqual([
      'long_break_minutes',
      'reflection_enabled',
      'sessions_before_long_break',
      'short_break_minutes',
      'timezone',
      'work_duration_minutes',
    ]);
  });

  it('returns 500 when Supabase select fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/settings',
      { headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});

describe('PATCH /v1/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelectStar,
        update: mockUpdate,
      })),
      auth: { getUser: mockGetUser },
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_duration_minutes: 45 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with updated preferences for a single field', async () => {
    const updatedRow = { ...FAKE_PREFERENCES_ROW, work_duration_minutes: 45 };
    mockSingle.mockResolvedValueOnce({ data: updatedRow, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ work_duration_minutes: 45 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = SettingsResponseSchema.parse(await res.json());
    expect(body.work_duration_minutes).toBe(45);
  });

  it('returns 200 with updated preferences for multiple fields', async () => {
    const updatedRow = {
      ...FAKE_PREFERENCES_ROW,
      work_duration_minutes: 50,
      short_break_minutes: 10,
      reflection_enabled: false,
      timezone: 'Europe/London',
    };
    mockSingle.mockResolvedValueOnce({ data: updatedRow, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          work_duration_minutes: 50,
          short_break_minutes: 10,
          reflection_enabled: false,
          timezone: 'Europe/London',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = SettingsResponseSchema.parse(await res.json());
    expect(body.work_duration_minutes).toBe(50);
    expect(body.short_break_minutes).toBe(10);
    expect(body.reflection_enabled).toBe(false);
    expect(body.timezone).toBe('Europe/London');
  });

  it('passes only provided fields to Supabase update', async () => {
    const updatedRow = { ...FAKE_PREFERENCES_ROW, long_break_minutes: 30 };
    mockSingle.mockResolvedValueOnce({ data: updatedRow, error: null });

    const app = createTestApp();
    await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ long_break_minutes: 30 }),
      },
      FAKE_ENV,
    );

    expect(mockUpdate).toHaveBeenCalledWith({ long_break_minutes: 30 });
  });

  it('returns 422 when work_duration_minutes is 0', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ work_duration_minutes: 0 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 when work_duration_minutes is negative', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ work_duration_minutes: -5 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when short_break_minutes is 0', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ short_break_minutes: 0 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when long_break_minutes is 0', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ long_break_minutes: 0 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when sessions_before_long_break is 0', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessions_before_long_break: 0 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when timezone is an empty string', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ timezone: '' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when reflection_enabled is not a boolean', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reflection_enabled: 'yes' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when unknown field is sent (strict mode)', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ unknown_field: 'hello' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 500 when Supabase update fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/settings',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ work_duration_minutes: 45 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('validates UpdateSettingsBodySchema rejects non-integer durations', () => {
    const result = UpdateSettingsBodySchema.safeParse({ work_duration_minutes: 25.5 });
    expect(result.success).toBe(false);
  });

  it('validates UpdateSettingsBodySchema accepts all valid fields together', () => {
    const result = UpdateSettingsBodySchema.safeParse({
      work_duration_minutes: 50,
      short_break_minutes: 10,
      long_break_minutes: 30,
      sessions_before_long_break: 6,
      reflection_enabled: false,
      timezone: 'Asia/Tokyo',
    });
    expect(result.success).toBe(true);
  });

  it('validates UpdateSettingsBodySchema accepts an empty object', () => {
    const result = UpdateSettingsBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
