import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import {
  registerFriendsRoute,
  ListFocusingFriendsResponseSchema,
} from './friends.js';

/**
 * Loose schema that permits extra keys. Used to validate the raw JSON in the
 * privacy test — we want to catch ANY field that leaks through, including ones
 * the strict response schema would silently strip.
 */
const LooseFocusingResponseSchema = z.object({
  friends: z.array(z.record(z.string(), z.unknown())),
});

/**
 * Mock Supabase module so no real network calls are made.
 *
 * The friends/focusing route issues up to 5 sequential queries against the
 * admin (service_role) client:
 *   1. profiles.select('id').eq('auth_user_id', ...).single()
 *   2. friendships.select('friend_id').eq('user_id', ...)
 *   3. sessions.select(...).in('user_id', ...).is('ended_at', null).gt('started_at', ...)
 *   4. profiles.select(...).in('id', ...)
 *   5. user_preferences.select(...).in('user_id', ...)
 *
 * Rather than building a single shared chainable mock, we mock `from(table)`
 * to return a per-table chainable builder whose terminal methods (`.single()`,
 * `.is()`, `.in()`, `.gt()`) return the next queued result. This mirrors the
 * pattern in sessions.test.ts but scales to multiple queries.
 */

type QueryResult = { data: unknown; error: unknown };

const mockGetUser = vi.fn();

// Per-test queued results for each stage of the pipeline.
let profileSingleResult: QueryResult | undefined;
let friendshipsResult: QueryResult | undefined;
let sessionsResult: QueryResult | undefined;
let profilesInResult: QueryResult | undefined;
let preferencesInResult: QueryResult | undefined;

function resetResults(): void {
  profileSingleResult = undefined;
  friendshipsResult = undefined;
  sessionsResult = undefined;
  profilesInResult = undefined;
  preferencesInResult = undefined;
}

/**
 * Builds a chainable query builder for a given table. Terminal methods return
 * the queued result for the matching query shape.
 */
function buildFromHandler(table: string): unknown {
  if (table === 'profiles') {
    // Two shapes land on 'profiles':
    //   a) .select('id').eq('auth_user_id', ...).single() -> profileSingleResult
    //   b) .select('id, display_name, avatar_url').in('id', ...) -> profilesInResult
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve(profileSingleResult ?? { data: null, error: null }),
          ),
        })),
        in: vi.fn(() =>
          Promise.resolve(profilesInResult ?? { data: [], error: null }),
        ),
      })),
    };
  }
  if (table === 'friendships') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() =>
          Promise.resolve(friendshipsResult ?? { data: [], error: null }),
        ),
      })),
    };
  }
  if (table === 'sessions') {
    return {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          is: vi.fn(() => ({
            gt: vi.fn(() =>
              Promise.resolve(sessionsResult ?? { data: [], error: null }),
            ),
          })),
        })),
      })),
    };
  }
  if (table === 'user_preferences') {
    return {
      select: vi.fn(() => ({
        in: vi.fn(() =>
          Promise.resolve(preferencesInResult ?? { data: [], error: null }),
        ),
      })),
    };
  }
  throw new Error(`unexpected table in test: ${table}`);
}

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

const FAKE_AUTH_USER_ID = 'aaaa1111-0000-0000-0000-000000000001';
const FAKE_PROFILE_ID = 'bbbb1111-0000-0000-0000-000000000001';

const FAKE_AUTH_USER = {
  id: FAKE_AUTH_USER_ID,
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
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
  registerFriendsRoute(app);
  return app;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${FAKE_JWT}` };
}

type FocusingFriend = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  started_at: string;
  work_duration: number;
};

/**
 * Parse and validate a successful /v1/friends/focusing response via the
 * route's own Zod schema (U-009 — no `as` casts).
 */
async function parseFocusingResponse(
  res: Response,
): Promise<{ friends: FocusingFriend[] }> {
  const json: unknown = await res.json();
  return ListFocusingFriendsResponseSchema.parse(json);
}

describe('GET /v1/friends/focusing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resetResults();

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_AUTH_USER },
      error: null,
    });

    // User-scoped client (authMiddleware): only needs auth.getUser + from().
    mockCreateUserClient.mockImplementation(() => ({
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) => buildFromHandler(table)),
    }));

    // Admin client (route body): same shape — dispatch per table.
    mockCreateAdminClient.mockImplementation(() => ({
      from: vi.fn((table: string) => buildFromHandler(table)),
    }));
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET' },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns empty friends array when user has no friendships', async () => {
    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = { data: [], error: null };

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await parseFocusingResponse(res);
    expect(body).toEqual({ friends: [] });
  });

  it('returns empty friends array when friends exist but none are focusing', async () => {
    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = {
      data: [
        { friend_id: 'cccc1111-0000-0000-0000-000000000001' },
        { friend_id: 'cccc1111-0000-0000-0000-000000000002' },
      ],
      error: null,
    };
    sessionsResult = { data: [], error: null };

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await parseFocusingResponse(res);
    expect(body).toEqual({ friends: [] });
  });

  it('returns focusing friends with display_name, avatar_url, started_at, and work_duration', async () => {
    const friendOneId = 'cccc1111-0000-0000-0000-000000000001';
    const friendTwoId = 'cccc1111-0000-0000-0000-000000000002';

    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = {
      data: [{ friend_id: friendOneId }, { friend_id: friendTwoId }],
      error: null,
    };
    sessionsResult = {
      data: [
        { user_id: friendOneId, started_at: '2026-04-05T14:30:00.000Z' },
        { user_id: friendTwoId, started_at: '2026-04-05T14:45:00.000Z' },
      ],
      error: null,
    };
    profilesInResult = {
      data: [
        {
          id: friendOneId,
          display_name: 'Sarah',
          avatar_url: 'https://example.com/sarah.png',
        },
        {
          id: friendTwoId,
          display_name: 'Bob',
          avatar_url: null,
        },
      ],
      error: null,
    };
    preferencesInResult = {
      data: [
        { user_id: friendOneId, work_duration_minutes: 25 },
        { user_id: friendTwoId, work_duration_minutes: 50 },
      ],
      error: null,
    };

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await parseFocusingResponse(res);
    expect(body.friends).toHaveLength(2);

    const sarah = body.friends.find((f) => f.id === friendOneId);
    expect(sarah).toEqual({
      id: friendOneId,
      display_name: 'Sarah',
      avatar_url: 'https://example.com/sarah.png',
      started_at: '2026-04-05T14:30:00.000Z',
      work_duration: 25,
    });

    const bob = body.friends.find((f) => f.id === friendTwoId);
    expect(bob).toEqual({
      id: friendTwoId,
      display_name: 'Bob',
      avatar_url: null,
      started_at: '2026-04-05T14:45:00.000Z',
      work_duration: 50,
    });
  });

  it('does not expose raw session data (no goal, quality, intention, reflection)', async () => {
    const friendOneId = 'cccc1111-0000-0000-0000-000000000001';

    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = { data: [{ friend_id: friendOneId }], error: null };
    sessionsResult = {
      data: [
        { user_id: friendOneId, started_at: '2026-04-05T14:30:00.000Z' },
      ],
      error: null,
    };
    profilesInResult = {
      data: [
        { id: friendOneId, display_name: 'Sarah', avatar_url: null },
      ],
      error: null,
    };
    preferencesInResult = {
      data: [{ user_id: friendOneId, work_duration_minutes: 25 }],
      error: null,
    };

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    // The privacy check inspects the raw JSON shape, not the strict response
    // schema (which would silently strip any leaked fields). LooseSchema
    // preserves whatever keys the API returned.
    const rawJson: unknown = await res.json();
    const loose = LooseFocusingResponseSchema.parse(rawJson);
    expect(loose.friends).toHaveLength(1);

    const friend = loose.friends[0];
    expect(friend).toBeDefined();
    if (!friend) return;
    // Only the four allowed fields plus id.
    expect(Object.keys(friend).sort()).toEqual(
      ['avatar_url', 'display_name', 'id', 'started_at', 'work_duration'].sort(),
    );
    // Explicit negative checks for leaking fields.
    expect(friend).not.toHaveProperty('process_goal_id');
    expect(friend).not.toHaveProperty('focus_quality');
    expect(friend).not.toHaveProperty('distraction_type');
    expect(friend).not.toHaveProperty('intention_text');
    expect(friend).not.toHaveProperty('ended_at');
    expect(friend).not.toHaveProperty('completed');
    expect(friend).not.toHaveProperty('abandonment_reason');
  });

  it('applies 4-hour stale session filter via gt(started_at, now - 4h)', async () => {
    const friendOneId = 'cccc1111-0000-0000-0000-000000000001';

    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = { data: [{ friend_id: friendOneId }], error: null };
    sessionsResult = { data: [], error: null };

    // Capture arguments passed to .gt() so we can assert on the cutoff.
    const gtSpy = vi.fn(() =>
      Promise.resolve(sessionsResult ?? { data: [], error: null }),
    );
    const isSpy = vi.fn(() => ({ gt: gtSpy }));
    const inSpy = vi.fn(() => ({ is: isSpy }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));

    mockCreateAdminClient.mockImplementation(() => ({
      from: vi.fn((table: string) => {
        if (table === 'sessions') {
          return { select: selectSpy };
        }
        return buildFromHandler(table);
      }),
    }));

    const before = Date.now();
    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(isSpy).toHaveBeenCalledWith('ended_at', null);
    expect(gtSpy).toHaveBeenCalledTimes(1);
    const call = gtSpy.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) return;
    const [column, cutoff] = call;
    expect(column).toBe('started_at');
    expect(typeof cutoff).toBe('string');
    const cutoffMs = new Date(String(cutoff)).getTime();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    // Cutoff should be "now - 4h" at request time, within the window spanned
    // by the test harness clock.
    expect(cutoffMs).toBeGreaterThanOrEqual(before - fourHoursMs - 10);
    expect(cutoffMs).toBeLessThanOrEqual(after - fourHoursMs + 10);
  });

  it('filters sessions to the authenticated user\'s friend_ids (friendship JOIN enforcement)', async () => {
    const friendOneId = 'cccc1111-0000-0000-0000-000000000001';
    const friendTwoId = 'cccc1111-0000-0000-0000-000000000002';

    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = {
      data: [{ friend_id: friendOneId }, { friend_id: friendTwoId }],
      error: null,
    };
    sessionsResult = { data: [], error: null };

    const friendshipsEqSpy = vi.fn(() =>
      Promise.resolve(friendshipsResult ?? { data: [], error: null }),
    );
    const friendshipsSelectSpy = vi.fn(() => ({ eq: friendshipsEqSpy }));

    const sessionsInSpy = vi.fn(() => ({
      is: vi.fn(() => ({
        gt: vi.fn(() =>
          Promise.resolve(sessionsResult ?? { data: [], error: null }),
        ),
      })),
    }));
    const sessionsSelectSpy = vi.fn(() => ({ in: sessionsInSpy }));

    mockCreateAdminClient.mockImplementation(() => ({
      from: vi.fn((table: string) => {
        if (table === 'friendships') {
          return { select: friendshipsSelectSpy };
        }
        if (table === 'sessions') {
          return { select: sessionsSelectSpy };
        }
        return buildFromHandler(table);
      }),
    }));

    const app = createTestApp();
    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    // Friendships filtered by the authenticated user's profile id.
    expect(friendshipsEqSpy).toHaveBeenCalledWith('user_id', FAKE_PROFILE_ID);
    // Sessions restricted to those friend ids (not all users).
    expect(sessionsInSpy).toHaveBeenCalledWith('user_id', [
      friendOneId,
      friendTwoId,
    ]);
  });

  it('returns 500 when profile lookup fails', async () => {
    profileSingleResult = {
      data: null,
      error: new Error('something unexpected happened'),
    };

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when friendships query fails', async () => {
    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = {
      data: null,
      error: new Error('something unexpected happened'),
    };

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when sessions query fails', async () => {
    profileSingleResult = { data: { id: FAKE_PROFILE_ID }, error: null };
    friendshipsResult = {
      data: [{ friend_id: 'cccc1111-0000-0000-0000-000000000001' }],
      error: null,
    };
    sessionsResult = {
      data: null,
      error: new Error('something unexpected happened'),
    };

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/friends/focusing',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});
