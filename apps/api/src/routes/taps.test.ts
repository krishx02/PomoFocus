import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerTapsRoute, ListReceivedTapsResponseSchema } from './taps.js';

/**
 * Mock the Supabase client factory so no real network calls are made.
 * Each test configures the mocked query chain behavior per-call.
 *
 * Query chains used by the taps route:
 *   friendships lookup:
 *     from('friendships') -> select('id') -> eq().eq() -> maybeSingle()
 *   rate-limit count:
 *     from('encouragement_taps') -> select(_, { head: true, count: 'exact' })
 *       -> eq().eq().gte()
 *   insert:
 *     from('encouragement_taps') -> insert(...) -> select(...) -> single()
 *   delete:
 *     from('encouragement_taps') -> delete() -> eq().eq() -> select(...) -> maybeSingle()
 *   list:
 *     from('encouragement_taps') -> select(...) -> eq().gte().order()
 */

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
const SENDER_ID = 'aaaa1111-0000-0000-0000-000000000001';
const RECIPIENT_ID = 'bbbb2222-0000-0000-0000-000000000002';
const TAP_ID = '11111111-1111-1111-1111-111111111111';

const FAKE_SENDER_USER = {
  id: SENDER_ID,
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${FAKE_JWT}` };
}

type Handlers = {
  friendshipLookup?: () => Promise<{ data: unknown; error: unknown }>;
  tapCount?: () => Promise<{ count: number | null; error: unknown }>;
  tapInsert?: () => Promise<{ data: unknown; error: unknown }>;
  tapDelete?: () => Promise<{ data: unknown; error: unknown }>;
  tapList?: () => Promise<{ data: unknown; error: unknown }>;
  getUser?: () => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Minimal chain type returned by the mocked Supabase client. Uses `unknown`
 * return annotations since each test only exercises a single operation path.
 */
type MockChain = Record<string, unknown>;

type MockSupabase = {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

/**
 * Build a mocked Supabase client whose `from()` returns a chain that awaits
 * to the appropriate handler per table/operation.
 *
 * We implement just enough of the chain API to satisfy the route handlers —
 * each chain method returns `this` or a thenable that resolves to the
 * configured fixture.
 */
function buildMockSupabase(handlers: Handlers): MockSupabase {
  const getUser = handlers.getUser
    ? vi.fn(handlers.getUser)
    : vi.fn().mockResolvedValue({ data: { user: FAKE_SENDER_USER }, error: null });

  function makeFriendshipChain(): MockChain {
    const chain: MockChain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        handlers.friendshipLookup
          ? handlers.friendshipLookup()
          : Promise.resolve({ data: null, error: null }),
    };
    return chain;
  }

  function makeTapsChain(): MockChain {
    // This is shared across count / insert / delete / list. The chain methods
    // are thenable-returning no-ops, and the terminal awaited call hits the
    // appropriate handler. We distinguish by tracking the operation.
    let op: 'count' | 'insert' | 'delete' | 'list' | null = null;

    const terminal = {
      single: () =>
        handlers.tapInsert
          ? handlers.tapInsert()
          : Promise.resolve({ data: null, error: null }),
      maybeSingle: () =>
        handlers.tapDelete
          ? handlers.tapDelete()
          : Promise.resolve({ data: null, error: null }),
    };

    const chain: Record<string, unknown> = {
      select: (_cols?: unknown, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head && opts.count === 'exact') {
          op = 'count';
        } else if (op === 'insert' || op === 'delete') {
          // select after insert/delete — keep op
        } else {
          op = 'list';
        }
        return chain;
      },
      insert: () => {
        op = 'insert';
        return chain;
      },
      delete: () => {
        op = 'delete';
        return chain;
      },
      eq: () => chain,
      gte: () => {
        if (op === 'count') {
          // awaited directly after .gte()
          return handlers.tapCount
            ? handlers.tapCount()
            : Promise.resolve({ count: 0, error: null });
        }
        return chain;
      },
      order: () =>
        handlers.tapList
          ? handlers.tapList()
          : Promise.resolve({ data: [], error: null }),
      single: terminal.single,
      maybeSingle: terminal.maybeSingle,
    };
    return chain;
  }

  return {
    auth: { getUser },
    from: vi.fn((table: string) => {
      if (table === 'friendships') {
        return makeFriendshipChain();
      }
      if (table === 'encouragement_taps') {
        return makeTapsChain();
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createTestApp(
  handlers: Handlers = {},
): OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }> {
  mockCreateUserClient.mockReturnValue(buildMockSupabase(handlers));

  const app = new OpenAPIHono<{ Bindings: SupabaseEnv; Variables: AuthVariables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ error: 'Validation failed', details: result.error.flatten() }, 422);
      }
    },
  });
  app.use('/v1/*', authMiddleware);
  registerTapsRoute(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

// ---- POST /v1/taps ----

describe('POST /v1/taps', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 422 when recipient_id is missing', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 when recipient_id is not a valid UUID', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: 'not-a-uuid' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 400 when sender tries to tap themselves', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: SENDER_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Cannot tap yourself');
  });

  it('returns 403 when recipient is not a confirmed friend', async () => {
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: null, error: null }),
    });
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Recipient is not a confirmed friend');
  });

  it('returns 429 when sender has already sent 3 taps today', async () => {
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: { id: 'f-1' }, error: null }),
      tapCount: () => Promise.resolve({ count: 3, error: null }),
    });
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Max 3 taps per friend per day');
  });

  it('returns 429 when sender has more than 3 taps today (defensive)', async () => {
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: { id: 'f-1' }, error: null }),
      tapCount: () => Promise.resolve({ count: 5, error: null }),
    });
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(429);
  });

  it('returns 201 with the created tap when under the rate limit', async () => {
    const createdAt = '2026-04-05T10:00:00.000Z';
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: { id: 'f-1' }, error: null }),
      tapCount: () => Promise.resolve({ count: 2, error: null }),
      tapInsert: () =>
        Promise.resolve({
          data: {
            id: TAP_ID,
            recipient_id: RECIPIENT_ID,
            created_at: createdAt,
          },
          error: null,
        }),
    });
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(TAP_ID);
    expect(body.recipient_id).toBe(RECIPIENT_ID);
    expect(body.created_at).toBe(createdAt);
  });

  it('returns 201 when this is the first tap of the day (count=0)', async () => {
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: { id: 'f-1' }, error: null }),
      tapCount: () => Promise.resolve({ count: 0, error: null }),
      tapInsert: () =>
        Promise.resolve({
          data: {
            id: TAP_ID,
            recipient_id: RECIPIENT_ID,
            created_at: '2026-04-05T09:00:00.000Z',
          },
          error: null,
        }),
    });
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
  });

  it('returns 500 when the friendship lookup errors', async () => {
    const app = createTestApp({
      friendshipLookup: () =>
        Promise.resolve({ data: null, error: new Error('db boom') }),
    });
    app.onError((_err, c) =>
      c.json({ error: 'Internal server error', status: 500 }, 500),
    );
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when the insert errors', async () => {
    const app = createTestApp({
      friendshipLookup: () => Promise.resolve({ data: { id: 'f-1' }, error: null }),
      tapCount: () => Promise.resolve({ count: 0, error: null }),
      tapInsert: () =>
        Promise.resolve({ data: null, error: new Error('insert boom') }),
    });
    app.onError((_err, c) =>
      c.json({ error: 'Internal server error', status: 500 }, 500),
    );
    const res = await app.request(
      '/v1/taps',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_id: RECIPIENT_ID }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});

// ---- DELETE /v1/taps/{id} ----

describe('DELETE /v1/taps/{id}', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/v1/taps/${TAP_ID}`,
      { method: 'DELETE' },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 422 for a non-UUID id', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/taps/not-a-uuid',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 204 when the sender owns the tap and delete succeeds', async () => {
    const app = createTestApp({
      tapDelete: () => Promise.resolve({ data: { id: TAP_ID }, error: null }),
    });
    const res = await app.request(
      `/v1/taps/${TAP_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
  });

  it('returns 404 when the tap does not exist or sender does not own it', async () => {
    const app = createTestApp({
      tapDelete: () => Promise.resolve({ data: null, error: null }),
    });
    const res = await app.request(
      `/v1/taps/${TAP_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Tap not found');
  });

  it('returns 500 when the delete errors', async () => {
    const app = createTestApp({
      tapDelete: () =>
        Promise.resolve({ data: null, error: new Error('delete boom') }),
    });
    app.onError((_err, c) =>
      c.json({ error: 'Internal server error', status: 500 }, 500),
    );
    const res = await app.request(
      `/v1/taps/${TAP_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});

// ---- GET /v1/taps ----

describe('GET /v1/taps', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/taps', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty taps array when no taps received', async () => {
    const app = createTestApp({
      tapList: () => Promise.resolve({ data: [], error: null }),
    });
    const res = await app.request(
      '/v1/taps',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ taps: [] });
  });

  it('returns 200 with joined sender profile data', async () => {
    const app = createTestApp({
      tapList: () =>
        Promise.resolve({
          data: [
            {
              id: TAP_ID,
              created_at: '2026-04-05T10:00:00.000Z',
              sender: {
                display_name: 'Sarah',
                avatar_url: 'https://cdn.example.com/sarah.png',
              },
            },
            {
              id: '22222222-2222-2222-2222-222222222222',
              created_at: '2026-04-05T09:00:00.000Z',
              sender: { display_name: 'Bob', avatar_url: null },
            },
          ],
          error: null,
        }),
    });
    const res = await app.request(
      '/v1/taps',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = ListReceivedTapsResponseSchema.parse(await res.json());
    expect(body.taps).toHaveLength(2);
    expect(body.taps[0]).toEqual({
      id: TAP_ID,
      sender_display_name: 'Sarah',
      sender_avatar_url: 'https://cdn.example.com/sarah.png',
      created_at: '2026-04-05T10:00:00.000Z',
    });
    expect(body.taps[1]?.sender_display_name).toBe('Bob');
    expect(body.taps[1]?.sender_avatar_url).toBeNull();
  });

  it('returns nullable sender fields when profile is missing', async () => {
    const app = createTestApp({
      tapList: () =>
        Promise.resolve({
          data: [
            {
              id: TAP_ID,
              created_at: '2026-04-05T10:00:00.000Z',
              sender: null,
            },
          ],
          error: null,
        }),
    });
    const res = await app.request(
      '/v1/taps',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = ListReceivedTapsResponseSchema.parse(await res.json());
    expect(body.taps[0]?.sender_display_name).toBeNull();
    expect(body.taps[0]?.sender_avatar_url).toBeNull();
  });

  it('returns 500 when the list query errors', async () => {
    const app = createTestApp({
      tapList: () =>
        Promise.resolve({ data: null, error: new Error('list boom') }),
    });
    app.onError((_err, c) =>
      c.json({ error: 'Internal server error', status: 500 }, 500),
    );
    const res = await app.request(
      '/v1/taps',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});
