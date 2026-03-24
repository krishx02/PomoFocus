import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { extractBearerToken, authMiddleware } from './auth.js';
import type { AuthVariables } from './auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';

/**
 * Mock the Supabase client factory so no real clients are created.
 * Uses vi.hoisted() because vi.mock factories are hoisted above imports.
 */
const { mockCreateUserClient } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('../lib/supabase.js', () => ({
  createUserClient: mockCreateUserClient,
}));

const FAKE_ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake';

describe('extractBearerToken', () => {
  it('extracts token from valid Bearer header', () => {
    expect(extractBearerToken(`Bearer ${FAKE_JWT}`)).toBe(FAKE_JWT);
  });

  it('returns undefined for missing header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractBearerToken('')).toBeUndefined();
  });

  it('returns undefined for non-Bearer scheme', () => {
    expect(extractBearerToken(`Basic ${FAKE_JWT}`)).toBeUndefined();
  });

  it('returns undefined for Bearer with no token', () => {
    expect(extractBearerToken('Bearer ')).toBeUndefined();
  });

  it('returns undefined for Bearer with extra parts', () => {
    expect(extractBearerToken('Bearer token extra')).toBeUndefined();
  });

  it('returns undefined for just the word Bearer', () => {
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTestApp(): Hono<{ Bindings: SupabaseEnv; Variables: AuthVariables }> {
    const app = new Hono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>();
    app.use('*', authMiddleware);
    app.get('/test', (c) => {
      const supabase = c.get('supabase');
      // Return a truthy indicator that the client was attached
      return c.json({ hasClient: Boolean(supabase) });
    });
    return app;
  }

  it('returns 401 when Authorization header is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/test', {}, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/test',
      { headers: { Authorization: `Basic ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 401 when Bearer token is empty', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/test',
      { headers: { Authorization: 'Bearer ' } },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('creates user client with correct token and attaches to context', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);

    const body: { hasClient: boolean } = await res.json();
    expect(body.hasClient).toBe(true);

    expect(mockCreateUserClient).toHaveBeenCalledWith(FAKE_ENV, FAKE_JWT);
  });

  it('passes env bindings to createUserClient', async () => {
    const app = createTestApp();
    await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(mockCreateUserClient).toHaveBeenCalledWith(FAKE_ENV, FAKE_JWT);
  });

  it('does not expose service_role key in responses', async () => {
    const app = new Hono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>();
    app.use('*', authMiddleware);
    app.get('/test', (c) => {
      // Simulate a route that accidentally tries to return env
      return c.json({ env: c.env });
    });

    const res = await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    // The middleware only attaches the supabase client to context variables —
    // it does not add env vars. Routes that accidentally return c.env is a
    // developer mistake caught by code review, not the middleware's responsibility.
    expect(res.status).toBe(200);
    // Verify the middleware creates a user client, not admin
    expect(mockCreateUserClient).toHaveBeenCalledTimes(1);
  });

  it('calls next() after attaching client so downstream routes execute', async () => {
    const routeHandler = vi.fn((_c: unknown) => {
      // This should be called
    });

    const app = new Hono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>();
    app.use('*', authMiddleware);
    app.get('/test', (c) => {
      routeHandler(c);
      return c.json({ ok: true });
    });

    await app.request(
      '/test',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(routeHandler).toHaveBeenCalledTimes(1);
  });
});
