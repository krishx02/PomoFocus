import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { SupabaseEnv } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';
import { registerInviteRoute, InviteResponseSchema } from './invite.js';

/**
 * Mock the Supabase client factory so no real clients are created.
 * The admin client bypasses RLS for the public username lookup.
 *
 * Chain: from('profiles').select(...).eq(...).maybeSingle()
 */
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  createAdminClient: mockCreateAdminClient,
}));

const FAKE_ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

const FAKE_PROFILE = {
  id: 'aaaa1111-0000-0000-0000-000000000001',
  display_name: 'Sarah',
  avatar_url: 'https://cdn.example.com/sarah.jpg',
};

function createTestApp(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'Validation failed', details: result.error.flatten() },
          422,
        );
      }
    },
  });
  registerInviteRoute(app);
  return app;
}

describe('GET /v1/invite/:username', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateAdminClient.mockReturnValue({
      from: mockFrom,
    });
  });

  it('returns 200 with public profile for an existing username', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: FAKE_PROFILE, error: null });

    const app = createTestApp();
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    expect(res.status).toBe(200);
    const body = InviteResponseSchema.parse(await res.json());
    expect(body.id).toBe(FAKE_PROFILE.id);
    expect(body.display_name).toBe(FAKE_PROFILE.display_name);
    expect(body.avatar_url).toBe(FAKE_PROFILE.avatar_url);
  });

  it('returns 404 when the username does not exist', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const app = createTestApp();
    const res = await app.request('/v1/invite/ghost', {}, FAKE_ENV);

    expect(res.status).toBe(404);
    const body: { error: string } = await res.json();
    expect(body.error).toBe('User not found');
  });

  it('does not require an Authorization header (public endpoint)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: FAKE_PROFILE, error: null });

    const app = createTestApp();
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    // No Authorization header was sent and the request still succeeded.
    expect(res.status).toBe(200);
  });

  it('uses the admin client (bypasses RLS) to resolve the username', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: FAKE_PROFILE, error: null });

    const app = createTestApp();
    await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    expect(mockCreateAdminClient).toHaveBeenCalledWith(FAKE_ENV);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('id, display_name, avatar_url');
    expect(mockEq).toHaveBeenCalledWith('username', 'sarah');
  });

  it('returns null avatar_url when the profile has no avatar', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { ...FAKE_PROFILE, avatar_url: null },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    expect(res.status).toBe(200);
    const body = InviteResponseSchema.parse(await res.json());
    expect(body.avatar_url).toBeNull();
  });

  it('returns exactly the expected shape — no sensitive fields', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        ...FAKE_PROFILE,
        // Simulate Supabase returning extra columns; the handler must not forward them.
        auth_user_id: 'secret-auth-id',
        username: 'sarah',
        created_at: '2026-03-01T00:00:00.000Z',
      },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    const body = InviteResponseSchema.parse(await res.json());
    expect(Object.keys(body).sort()).toEqual(['avatar_url', 'display_name', 'id']);
    expect(body).not.toHaveProperty('auth_user_id');
    expect(body).not.toHaveProperty('username');
    expect(body).not.toHaveProperty('created_at');
    expect(body).not.toHaveProperty('email');
  });

  it('returns correct content-type header', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: FAKE_PROFILE, error: null });

    const app = createTestApp();
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('propagates database errors as 500 via the error handler path', async () => {
    const dbError = new Error('connection refused');
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const app = createTestApp();
    // Without an error handler the thrown error surfaces as a 500 by Hono's default.
    const res = await app.request('/v1/invite/sarah', {}, FAKE_ENV);

    expect(res.status).toBe(500);
  });
});
