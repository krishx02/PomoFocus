import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerFeedRoute, FeedTodayResponseSchema } from './feed.js';

/**
 * Mock Supabase module so no real network calls are made.
 *
 * Two clients are mocked:
 *  - createUserClient (user-scoped): used for auth.getUser() and friendships SELECT
 *  - createAdminClient (service_role): used for cross-user sessions SELECT
 *
 * The friendships chain:   from('friendships').select(...).eq('user_id', id).overrideTypes()
 * The sessions chain:      from('sessions').select(...).in().eq().gte().overrideTypes()
 */
const mockFriendshipsOverrideTypes = vi.fn();
const mockFriendshipsEq = vi.fn(() => ({ overrideTypes: mockFriendshipsOverrideTypes }));
const mockFriendshipsSelect = vi.fn(() => ({ eq: mockFriendshipsEq }));

const mockSessionsOverrideTypes = vi.fn();
const mockSessionsGte = vi.fn(() => ({ overrideTypes: mockSessionsOverrideTypes }));
const mockSessionsEq = vi.fn(() => ({ gte: mockSessionsGte }));
const mockSessionsIn = vi.fn(() => ({ eq: mockSessionsEq }));
const mockSessionsSelect = vi.fn(() => ({ in: mockSessionsIn }));

const mockGetUser = vi.fn();

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

const FAKE_USER_ID = 'aaaa1111-0000-0000-0000-000000000001';

const FAKE_USER = {
  id: FAKE_USER_ID,
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

const FRIEND_SARAH_ID = 'bbbb2222-0000-0000-0000-000000000002';
const FRIEND_BOB_ID = 'cccc3333-0000-0000-0000-000000000003';
const FRIEND_LONER_ID = 'dddd4444-0000-0000-0000-000000000004';

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
  registerFeedRoute(app);
  return app;
}

describe('GET /v1/feed/today', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue({
      from: vi.fn(() => ({
        select: mockFriendshipsSelect,
      })),
      auth: { getUser: mockGetUser },
    });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: mockSessionsSelect,
      })),
    });
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/feed/today', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid authorization scheme', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: { Authorization: `Basic ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with empty entries when user has no friends', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({ data: [], error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toEqual([]);

    // Admin client should not be invoked when no friends exist.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('returns 200 with empty entries when friends exist but none focused today', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_LONER_ID,
          friend: {
            id: FRIEND_LONER_ID,
            display_name: 'Loner',
            avatar_url: null,
          },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({ data: [], error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toEqual([]);
  });

  it('returns 200 with one entry per friend who focused today (GROUP BY)', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: {
            id: FRIEND_SARAH_ID,
            display_name: 'Sarah',
            avatar_url: 'https://example.com/sarah.png',
          },
        },
        {
          friend_id: FRIEND_BOB_ID,
          friend: {
            id: FRIEND_BOB_ID,
            display_name: 'Bob',
            avatar_url: null,
          },
        },
      ],
      error: null,
    });

    // Sarah has 3 sessions today, Bob has 1.
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [
        { user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' },
        { user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T11:30:00.000Z' },
        { user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T15:45:00.000Z' },
        { user_id: FRIEND_BOB_ID, ended_at: '2026-04-05T08:20:00.000Z' },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toHaveLength(2);

    const sarah = body.entries.find((e) => e.friend_id === FRIEND_SARAH_ID);
    expect(sarah).toEqual({
      friend_id: FRIEND_SARAH_ID,
      display_name: 'Sarah',
      avatar_url: 'https://example.com/sarah.png',
      sessions_today: 3,
    });

    const bob = body.entries.find((e) => e.friend_id === FRIEND_BOB_ID);
    expect(bob).toEqual({
      friend_id: FRIEND_BOB_ID,
      display_name: 'Bob',
      avatar_url: null,
      sessions_today: 1,
    });
  });

  it('orders entries by most recent session descending', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
        {
          friend_id: FRIEND_BOB_ID,
          friend: { id: FRIEND_BOB_ID, display_name: 'Bob', avatar_url: null },
        },
      ],
      error: null,
    });

    // Bob finished most recently, Sarah earlier.
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [
        { user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T08:00:00.000Z' },
        { user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T10:00:00.000Z' },
        { user_id: FRIEND_BOB_ID, ended_at: '2026-04-05T17:00:00.000Z' },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toHaveLength(2);
    // Bob (17:00) before Sarah (10:00) — most recent first.
    expect(body.entries[0]?.friend_id).toBe(FRIEND_BOB_ID);
    expect(body.entries[1]?.friend_id).toBe(FRIEND_SARAH_ID);
  });

  it('filters sessions to the authenticated user friends only (friendship JOIN privacy)', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    await app.request('/v1/feed/today', { method: 'GET', headers: authHeaders() }, FAKE_ENV);

    // Friendships query scoped to the authenticated user.
    expect(mockFriendshipsEq).toHaveBeenCalledWith('user_id', FAKE_USER_ID);
    // Sessions query restricted to the friend ID list (NOT all users).
    expect(mockSessionsIn).toHaveBeenCalledWith('user_id', [FRIEND_SARAH_ID]);
  });

  it('filters sessions to completed only', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    await app.request('/v1/feed/today', { method: 'GET', headers: authHeaders() }, FAKE_ENV);

    expect(mockSessionsEq).toHaveBeenCalledWith('completed', true);
  });

  it('filters sessions to today only (ended_at >= midnight UTC)', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: new Date().toISOString() }],
      error: null,
    });

    const app = createTestApp();
    await app.request('/v1/feed/today', { method: 'GET', headers: authHeaders() }, FAKE_ENV);

    expect(mockSessionsGte).toHaveBeenCalledTimes(1);
    const [column, value] = mockSessionsGte.mock.calls[0] ?? [];
    expect(column).toBe('ended_at');
    // Must be midnight-UTC ISO of today — ends with T00:00:00.000Z and matches today's date.
    expect(typeof value).toBe('string');
    const today = new Date();
    const year = String(today.getUTCFullYear());
    const month = String(today.getUTCMonth() + 1).padStart(2, '0');
    const day = String(today.getUTCDate()).padStart(2, '0');
    expect(value).toBe(`${year}-${month}-${day}T00:00:00.000Z`);
  });

  it('selects only friend identity fields (no goal, duration, or quality data)', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    await app.request('/v1/feed/today', { method: 'GET', headers: authHeaders() }, FAKE_ENV);

    // Friendships nested select: only identity fields.
    const friendshipsSelectArg = mockFriendshipsSelect.mock.calls[0]?.[0];
    expect(typeof friendshipsSelectArg).toBe('string');
    expect(friendshipsSelectArg).toContain('display_name');
    expect(friendshipsSelectArg).toContain('avatar_url');
    expect(friendshipsSelectArg).not.toMatch(/focus_quality|distraction|intention|goal_title|duration/);

    // Sessions select: only user_id + ended_at (no durations, quality, goals).
    const sessionsSelectArg = mockSessionsSelect.mock.calls[0]?.[0];
    expect(sessionsSelectArg).toBe('user_id, ended_at');
  });

  it('response shape contains no raw session or goal data', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toHaveLength(1);
    const entry = body.entries[0];
    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }
    // Only four public fields — no leakage of internal fields.
    expect(Object.keys(entry).sort()).toEqual(
      ['avatar_url', 'display_name', 'friend_id', 'sessions_today'].sort(),
    );
  });

  it('uses the admin (service_role) client for the cross-user sessions query', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    await app.request('/v1/feed/today', { method: 'GET', headers: authHeaders() }, FAKE_ENV);

    // Admin client is required because RLS on sessions blocks cross-user SELECTs.
    // Privacy is enforced by the explicit friendship-derived `in(user_id, ...)` filter.
    expect(mockCreateAdminClient).toHaveBeenCalledWith(FAKE_ENV);
  });

  it('skips friendships where the joined profile is null (defensive)', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: null,
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: [{ user_id: FRIEND_SARAH_ID, ended_at: '2026-04-05T09:00:00.000Z' }],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = FeedTodayResponseSchema.parse(await res.json());
    expect(body.entries).toEqual([]);
  });

  it('returns 500 when friendships query fails', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: null,
      error: new Error('friendships query failed'),
    });

    const app = createTestApp();
    app.onError((_err, c) => c.json({ error: 'Internal server error', status: 500 }, 500));

    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when sessions query fails', async () => {
    mockFriendshipsOverrideTypes.mockResolvedValueOnce({
      data: [
        {
          friend_id: FRIEND_SARAH_ID,
          friend: { id: FRIEND_SARAH_ID, display_name: 'Sarah', avatar_url: null },
        },
      ],
      error: null,
    });
    mockSessionsOverrideTypes.mockResolvedValueOnce({
      data: null,
      error: new Error('sessions query failed'),
    });

    const app = createTestApp();
    app.onError((_err, c) => c.json({ error: 'Internal server error', status: 500 }, 500));

    const res = await app.request(
      '/v1/feed/today',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});
