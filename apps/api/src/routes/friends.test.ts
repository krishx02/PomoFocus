import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerFriendsRoute, ListFriendsResponseSchema } from './friends.js';
import { z } from '@hono/zod-openapi';

const ErrorResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Mock the Supabase module so no real network calls are made. The user-scoped
 * client (`createUserClient`) is used by the auth middleware; the admin client
 * (`createAdminClient`) is used inside the DELETE handler to bypass RLS when
 * deleting friendship rows. Both clients are mocked independently so tests
 * can assert which client performed which query.
 */
const { mockCreateUserClient, mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  createUserClient: mockCreateUserClient,
  createAdminClient: mockCreateAdminClient,
}));

const FAKE_ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_ANON_KEY: 'fake-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key',
};

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake';

const FAKE_AUTH_USER_ID = '00000000-0000-0000-0000-000000000aaa';
const MY_PROFILE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const FRIEND_ID_SARAH = 'bbbb1111-0000-0000-0000-000000000001';
const FRIEND_ID_ALEX = 'cccc1111-0000-0000-0000-000000000002';

const FAKE_AUTH_USER = {
  id: FAKE_AUTH_USER_ID,
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${FAKE_JWT}` };
}

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
  registerFriendsRoute(app);
  return app;
}

describe('GET /v1/friends', () => {
  // Mocks for the friendships -> profiles join SELECT chain:
  //   from('friendships').select(...).overrideTypes<...>()
  const mockFriendshipsOverrideTypes = vi.fn();
  const mockFriendshipsSelect = vi.fn(() => ({ overrideTypes: mockFriendshipsOverrideTypes }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockCreateUserClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'friendships') {
          return { select: mockFriendshipsSelect };
        }
        throw new Error(`Unexpected table in GET /v1/friends: ${table}`);
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: FAKE_AUTH_USER },
          error: null,
        }),
      },
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/friends', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with friends ordered by display_name', async () => {
    // Supabase returns rows in insertion order — the API sorts in-memory.
    // Provide rows in a non-sorted order to verify the sort.
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend: {
            id: FRIEND_ID_SARAH,
            display_name: 'Sarah',
            avatar_url: 'https://example.com/sarah.png',
            username: 'sarah123',
          },
        },
        {
          friend: {
            id: FRIEND_ID_ALEX,
            display_name: 'Alex',
            avatar_url: null,
            username: 'alex',
          },
        },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = ListFriendsResponseSchema.parse(await res.json());
    expect(body.friends).toHaveLength(2);
    // Verify ordered by display_name ascending
    expect(body.friends[0]?.display_name).toBe('Alex');
    expect(body.friends[1]?.display_name).toBe('Sarah');
    // Verify response shape (only public fields exposed)
    expect(body.friends[0]).toEqual({
      id: FRIEND_ID_ALEX,
      display_name: 'Alex',
      avatar_url: null,
      username: 'alex',
    });
  });

  it('returns 200 with empty array when user has no friends', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = ListFriendsResponseSchema.parse(await res.json());
    expect(body).toEqual({ friends: [] });
  });

  it('queries the friendships table with the friend profile join', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({ data: [], error: null });

    const app = createTestApp();
    await app.request(
      '/v1/friends',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(mockFriendshipsSelect).toHaveBeenCalledWith(
      'friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url, username)',
    );
  });

  it('filters out rows with a null friend relation', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        { friend: null },
        {
          friend: {
            id: FRIEND_ID_ALEX,
            display_name: 'Alex',
            avatar_url: null,
            username: 'alex',
          },
        },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = ListFriendsResponseSchema.parse(await res.json());
    expect(body.friends).toHaveLength(1);
    expect(body.friends[0]?.id).toBe(FRIEND_ID_ALEX);
  });

  it('returns 500 when Supabase select fails', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: null,
      error: new Error('db unavailable'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/friends',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});

describe('DELETE /v1/friends/:id', () => {
  // User-scoped client mocks:
  //   profiles:   from('profiles').select('id').eq('auth_user_id', ...).single()
  //   friendships: from('friendships').select('id').eq('user_id', ...).eq('friend_id', ...).maybeSingle()
  const mockProfilesSingle = vi.fn();
  const mockProfilesEq = vi.fn(() => ({ single: mockProfilesSingle }));
  const mockProfilesSelect = vi.fn(() => ({ eq: mockProfilesEq }));

  const mockFriendshipsMaybeSingle = vi.fn();
  const mockFriendshipsEqFriendId = vi.fn(() => ({ maybeSingle: mockFriendshipsMaybeSingle }));
  const mockFriendshipsEqUserId = vi.fn(() => ({ eq: mockFriendshipsEqFriendId }));
  const mockFriendshipsSelectForDelete = vi.fn(() => ({ eq: mockFriendshipsEqUserId }));

  // Admin client mocks:
  //   from('friendships').delete().eq('user_id', ...).eq('friend_id', ...)
  const mockAdminDeleteEqFriendId = vi.fn();
  const mockAdminDeleteEqUserId = vi.fn(() => ({ eq: mockAdminDeleteEqFriendId }));
  const mockAdminDelete = vi.fn(() => ({ eq: mockAdminDeleteEqUserId }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockCreateUserClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: mockProfilesSelect };
        }
        if (table === 'friendships') {
          return { select: mockFriendshipsSelectForDelete };
        }
        throw new Error(`Unexpected user-scoped table: ${table}`);
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: FAKE_AUTH_USER },
          error: null,
        }),
      },
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'friendships') {
          return { delete: mockAdminDelete };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    });

    // Default: profile lookup succeeds.
    mockProfilesSingle.mockResolvedValue({
      data: { id: MY_PROFILE_ID },
      error: null,
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE' },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 422 when path id is not a valid uuid', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/not-a-uuid',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 404 when friendship does not exist', async () => {
    mockFriendshipsMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = ErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('Friendship not found');
    // Admin delete must NOT run if friendship verification failed.
    expect(mockAdminDelete).not.toHaveBeenCalled();
  });

  it('returns 204 and deletes both friendship rows on success', async () => {
    mockFriendshipsMaybeSingle.mockResolvedValueOnce({
      data: { id: 'friendship-row-1' },
      error: null,
    });
    mockAdminDeleteEqFriendId
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);

    // Verify dual-row delete: both forward (me -> friend) and reverse
    // (friend -> me) rows were targeted.
    expect(mockAdminDelete).toHaveBeenCalledTimes(2);
    expect(mockAdminDeleteEqUserId).toHaveBeenNthCalledWith(1, 'user_id', MY_PROFILE_ID);
    expect(mockAdminDeleteEqFriendId).toHaveBeenNthCalledWith(1, 'friend_id', FRIEND_ID_SARAH);
    expect(mockAdminDeleteEqUserId).toHaveBeenNthCalledWith(2, 'user_id', FRIEND_ID_SARAH);
    expect(mockAdminDeleteEqFriendId).toHaveBeenNthCalledWith(2, 'friend_id', MY_PROFILE_ID);
  });

  it('verifies friendship via the user-scoped client before deleting', async () => {
    mockFriendshipsMaybeSingle.mockResolvedValueOnce({
      data: { id: 'friendship-row-1' },
      error: null,
    });
    mockAdminDeleteEqFriendId
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    const app = createTestApp();
    await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(mockFriendshipsSelectForDelete).toHaveBeenCalledWith('id');
    expect(mockFriendshipsEqUserId).toHaveBeenCalledWith('user_id', MY_PROFILE_ID);
    expect(mockFriendshipsEqFriendId).toHaveBeenCalledWith('friend_id', FRIEND_ID_SARAH);
  });

  it('returns 500 when the forward delete fails', async () => {
    mockFriendshipsMaybeSingle.mockResolvedValueOnce({
      data: { id: 'friendship-row-1' },
      error: null,
    });
    mockAdminDeleteEqFriendId.mockResolvedValueOnce({
      error: new Error('delete failed'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when the reverse delete fails', async () => {
    mockFriendshipsMaybeSingle.mockResolvedValueOnce({
      data: { id: 'friendship-row-1' },
      error: null,
    });
    mockAdminDeleteEqFriendId
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('reverse delete failed') });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when profile lookup fails', async () => {
    mockProfilesSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('profile not found'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      `/v1/friends/${FRIEND_ID_SARAH}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});
