import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerMeRoute, MeResponseSchema } from './me.js';

/**
 * Mock the Supabase client factory so no real clients are created.
 * Uses vi.hoisted() because vi.mock factories are hoisted above imports.
 */
const { mockCreateUserClient, mockGetUser } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockGetUser: vi.fn(),
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

const FAKE_USER = {
  id: 'aaaa1111-0000-0000-0000-000000000001',
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

function createTestApp(): OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }> {
  const app = new OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>();
  app.use('/v1/*', authMiddleware);
  registerMeRoute(app);
  return app;
}

describe('GET /v1/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateUserClient.mockReturnValue({
      from: vi.fn(),
      auth: { getUser: mockGetUser },
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me', {}, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid authorization scheme', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { headers: { Authorization: `Basic ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with authenticated user profile', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = MeResponseSchema.parse(await res.json());
    expect(body.id).toBe(FAKE_USER.id);
    expect(body.email).toBe(FAKE_USER.email);
    expect(body.created_at).toBe(FAKE_USER.created_at);
  });

  it('returns null email when user has no email', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { ...FAKE_USER, email: undefined } },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = MeResponseSchema.parse(await res.json());
    expect(body.email).toBeNull();
  });

  it('returns exactly the expected shape', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    const body = MeResponseSchema.parse(await res.json());
    expect(Object.keys(body).sort()).toEqual(['created_at', 'email', 'id']);
  });

  it('returns correct content-type header', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
