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
const { mockCreateUserClient, mockCreateAdminClient, mockGetUser } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  createUserClient: mockCreateUserClient,
  createAdminClient: mockCreateAdminClient,
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

/**
 * DELETE /v1/me — Account deletion (GDPR Art. 17).
 *
 * Cascade-deletes all user data across 11 application tables by deleting
 * the profiles row (ON DELETE CASCADE), then removes the Supabase Auth record.
 */
describe('DELETE /v1/me', () => {
  const mockDeleteEq = vi.fn();
  const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
  const mockAdminDeleteUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue({
      from: vi.fn(),
      auth: { getUser: mockGetUser },
    });

    mockDeleteEq.mockResolvedValue({ error: null });
    mockAdminDeleteUser.mockResolvedValue({ error: null });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        delete: mockDelete,
      })),
      auth: {
        admin: {
          deleteUser: mockAdminDeleteUser,
        },
      },
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me', { method: 'DELETE' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 204 on successful account deletion', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
  });

  it('deletes the profile row by auth_user_id', async () => {
    const app = createTestApp();
    await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    const adminClient = mockCreateAdminClient.mock.results[0]?.value as {
      from: ReturnType<typeof vi.fn>;
    };
    expect(adminClient.from).toHaveBeenCalledWith('profiles');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('auth_user_id', FAKE_USER.id);
  });

  it('calls auth.admin.deleteUser with the auth user ID', async () => {
    const app = createTestApp();
    await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(mockAdminDeleteUser).toHaveBeenCalledWith(FAKE_USER.id);
  });

  it('uses the admin client (service_role key) for deletion', async () => {
    const app = createTestApp();
    await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(mockCreateAdminClient).toHaveBeenCalledWith(FAKE_ENV);
  });

  it('returns 500 when profile deletion fails', async () => {
    mockDeleteEq.mockResolvedValueOnce({
      error: new Error('something unexpected happened'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
    // Auth user should NOT be deleted if profile deletion failed
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });

  it('returns 500 when auth user deletion fails', async () => {
    mockAdminDeleteUser.mockResolvedValueOnce({
      error: new Error('auth deletion failed'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns empty body on 204', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/me',
      { method: 'DELETE', headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
  });
});
