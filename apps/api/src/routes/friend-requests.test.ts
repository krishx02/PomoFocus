import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { errorHandler } from '../middleware/error-handler.js';
import {
  registerFriendRequestsRoute,
  SendFriendRequestBodySchema,
} from './friend-requests.js';

/**
 * Table-dispatching Supabase mock.
 *
 * Route handlers call `supabase.from('profiles' | 'friend_requests' | 'friendships')`
 * and then chain `.select(...).eq(...).eq(...).maybeSingle()` / `.single()` / `.order()`
 * or `.insert(...).select(...).single()` / `.insert(...)` / `.delete().eq(...)`.
 *
 * The mock returns a fresh chainable builder per `from(tableName)` call whose terminal
 * methods (`maybeSingle`, `single`, `order`, raw insert, `delete`) resolve to values set
 * by the corresponding queue. Queues are popped FIFO so a single test can make multiple
 * calls against the same table.
 */
type ResolvedResult = { data: unknown; error: unknown; count?: number | null };

type TableQueues = {
  selectResults: ResolvedResult[];
  insertResults: ResolvedResult[];
  deleteResults: ResolvedResult[];
};

function makeQueues(): TableQueues {
  return { selectResults: [], insertResults: [], deleteResults: [] };
}

const tableQueues: Record<string, TableQueues> = {
  profiles: makeQueues(),
  friend_requests: makeQueues(),
  friendships: makeQueues(),
};

function resetQueues(): void {
  for (const table of Object.keys(tableQueues)) {
    tableQueues[table] = makeQueues();
  }
}

function queueSelect(table: keyof typeof tableQueues, result: ResolvedResult): void {
  tableQueues[table].selectResults.push(result);
}
function queueInsert(table: keyof typeof tableQueues, result: ResolvedResult): void {
  tableQueues[table].insertResults.push(result);
}
function queueDelete(table: keyof typeof tableQueues, result: ResolvedResult): void {
  tableQueues[table].deleteResults.push(result);
}

function consumeSelect(table: string): ResolvedResult {
  const next = tableQueues[table]?.selectResults.shift();
  if (!next) {
    throw new Error(`No queued SELECT result for table "${table}"`);
  }
  return next;
}
function consumeInsert(table: string): ResolvedResult {
  const next = tableQueues[table]?.insertResults.shift();
  if (!next) {
    throw new Error(`No queued INSERT result for table "${table}"`);
  }
  return next;
}
function consumeDelete(table: string): ResolvedResult {
  const next = tableQueues[table]?.deleteResults.shift();
  if (!next) {
    throw new Error(`No queued DELETE result for table "${table}"`);
  }
  return next;
}

/**
 * Build a chainable query builder for a given table. The chain is "lazy" in that
 * terminal methods resolve to queued results. Every chain method returns the same
 * object so any combination of `.eq(...)`, `.order(...)`, `.select(...)` works.
 *
 * The chain itself is a thenable — awaiting it consumes one SELECT result. This
 * supports Supabase patterns like `.select('id', { count: 'exact', head: true }).eq(...)`
 * where the terminal call is `.eq(...)` with no explicit `.single()` or `.maybeSingle()`.
 */
function makeChain(table: string): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const selectChain = (): Record<string, unknown> => chain;
  chain['eq'] = vi.fn(() => chain);
  chain['order'] = vi.fn(() => {
    // When `.order(...)` terminates a SELECT chain (list query), resolve to a SELECT result.
    return Promise.resolve(consumeSelect(table));
  });
  chain['maybeSingle'] = vi.fn(() => Promise.resolve(consumeSelect(table)));
  chain['single'] = vi.fn(() => Promise.resolve(consumeSelect(table)));
  chain['select'] = vi.fn(selectChain);
  // Make the chain itself awaitable (thenable). This handles count-head queries like
  // `await supabase.from(t).select('id', { count: 'exact', head: true }).eq(...)`.
  // Only consume a SELECT result on first `await` — subsequent chain calls are no-ops.
  chain['then'] = (resolve: (v: ResolvedResult) => void): void => {
    resolve(consumeSelect(table));
  };
  return chain;
}

/**
 * Build the top-level `from()` return value for a given table. This differs from
 * `makeChain` in that it must expose `insert`, `delete`, and `select` entry points.
 */
function makeTableHandle(table: string): Record<string, unknown> {
  return {
    select: vi.fn(() => makeChain(table)),
    insert: vi.fn((_row: unknown) => {
      // Either the handler chains .select().single() (returning a row)
      // or awaits directly (void insert). Support both by returning an object
      // that is also thenable.
      const inner: Record<string, unknown> = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(consumeInsert(table))),
        })),
      };
      // Allow `await supabase.from(t).insert(...)`
      (inner as { then: (resolve: (v: ResolvedResult) => void) => void }).then = (
        resolve: (v: ResolvedResult) => void,
      ): void => {
        resolve(consumeInsert(table));
      };
      return inner;
    }),
    delete: vi.fn(() => {
      const inner: Record<string, unknown> = {};
      inner['eq'] = vi.fn(() => Promise.resolve(consumeDelete(table)));
      return inner;
    }),
  };
}

function makeSupabaseClient(): Record<string, unknown> {
  return {
    from: vi.fn((table: string) => makeTableHandle(table)),
    auth: { getUser: mockGetUser },
  };
}

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

const FAKE_AUTH_USER_ID = 'a1111111-1111-1111-1111-111111111111';
const FAKE_SENDER_PROFILE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const FAKE_RECIPIENT_PROFILE_ID = 'bbbb2222-0000-0000-0000-000000000002';
const FAKE_REQUEST_ID = '11111111-2222-3333-4444-555555555555';

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
  app.onError(errorHandler);
  app.use('/v1/*', authMiddleware);
  registerFriendRequestsRoute(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  resetQueues();

  mockGetUser.mockResolvedValue({
    data: { user: FAKE_AUTH_USER },
    error: null,
  });

  mockCreateUserClient.mockImplementation(() => makeSupabaseClient());
  mockCreateAdminClient.mockImplementation(() => makeSupabaseClient());
});

describe('POST /v1/friend-requests', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_username: 'bob' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 422 when recipient_username is missing', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
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

  it('returns 422 when recipient_username is empty string', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: '' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 404 when recipient username does not exist', async () => {
    // 1st profiles select: current user lookup succeeds
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    // 2nd profiles select: recipient username not found
    queueSelect('profiles', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: 'does-not-exist' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Recipient not found');
  });

  it('returns 400 when sending a request to yourself', async () => {
    // Current user lookup returns the sender profile.
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    // Recipient username resolves to the same profile id.
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: 'alice' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Cannot send friend request to yourself');
  });

  it('returns 409 when already friends', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friendships', {
      data: { id: 'existing-friendship-id' },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: 'bob' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Already friends');
  });

  it('returns 409 when a duplicate friend request exists', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friendships', { data: null, error: null });
    queueInsert('friend_requests', {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: 'bob' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Friend request already exists');
  });

  it('returns 201 with the created friend request on success', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friendships', { data: null, error: null });
    queueInsert('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
        status: 'pending',
        created_at: '2026-04-05T12:00:00.000Z',
      },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ recipient_username: 'bob' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(FAKE_REQUEST_ID);
    expect(body.recipient_id).toBe(FAKE_RECIPIENT_PROFILE_ID);
    expect(body.status).toBe('pending');
    expect(body.created_at).toBe('2026-04-05T12:00:00.000Z');
  });

  it('Zod schema rejects empty recipient_username directly', () => {
    const result = SendFriendRequestBodySchema.safeParse({ recipient_username: '' });
    expect(result.success).toBe(false);
  });
});

describe('GET /v1/friend-requests', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/friend-requests', { method: 'GET' }, FAKE_ENV);
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty list when no pending requests exist', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', { data: [], error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual([]);
  });

  it('returns 200 with joined sender profile data', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: [
        {
          id: FAKE_REQUEST_ID,
          sender_id: FAKE_SENDER_PROFILE_ID,
          created_at: '2026-04-05T12:00:00.000Z',
          status: 'pending',
          sender: { display_name: 'Alice', avatar_url: 'https://cdn/alice.png' },
        },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body: {
      requests: {
        id: string;
        sender_id: string;
        display_name: string;
        avatar_url: string | null;
        created_at: string;
      }[];
    } = await res.json();
    expect(body.requests).toHaveLength(1);
    const first = body.requests[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('expected at least one request');
    expect(first.id).toBe(FAKE_REQUEST_ID);
    expect(first.sender_id).toBe(FAKE_SENDER_PROFILE_ID);
    expect(first.display_name).toBe('Alice');
    expect(first.avatar_url).toBe('https://cdn/alice.png');
  });

  it('handles avatar_url being null from the join', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: [
        {
          id: FAKE_REQUEST_ID,
          sender_id: FAKE_SENDER_PROFILE_ID,
          created_at: '2026-04-05T12:00:00.000Z',
          status: 'pending',
          sender: { display_name: 'Alice', avatar_url: null },
        },
      ],
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body: { requests: { avatar_url: string | null }[] } = await res.json();
    const first = body.requests[0];
    if (!first) throw new Error('expected at least one request');
    expect(first.avatar_url).toBeNull();
  });
});

describe('POST /v1/friend-requests/:id/accept', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}/accept`,
      { method: 'POST' },
      FAKE_ENV,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the friend request does not exist', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}/accept`,
      { method: 'POST', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
  });

  it('returns 403 when the current user is not the recipient', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: '99999999-0000-0000-0000-000000000000',
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
        status: 'pending',
      },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}/accept`,
      { method: 'POST', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(403);
  });

  it('returns 422 when the user already has 100 friends', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: FAKE_SENDER_PROFILE_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
        status: 'pending',
      },
      error: null,
    });
    // count=100 triggers the limit
    queueSelect('friendships', { data: null, error: null, count: 100 });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}/accept`,
      { method: 'POST', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain('Friend limit reached');
  });

  it('returns 200 on successful accept, creating friendship pair and deleting request', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: FAKE_SENDER_PROFILE_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
        status: 'pending',
      },
      error: null,
    });
    queueSelect('friendships', { data: null, error: null, count: 5 });
    // Admin inserts friendship pair (resolved via `await` on the insert thenable).
    queueInsert('friendships', { data: null, error: null });
    // Admin deletes the friend request.
    queueDelete('friend_requests', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}/accept`,
      { method: 'POST', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('DELETE /v1/friend-requests/:id', () => {
  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}`,
      { method: 'DELETE' },
      FAKE_ENV,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the friend request does not exist', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('friend_requests', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
  });

  it('returns 403 when the user is neither sender nor recipient', async () => {
    queueSelect('profiles', {
      data: { id: '88888888-0000-0000-0000-000000000000' },
      error: null,
    });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: FAKE_SENDER_PROFILE_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
      },
      error: null,
    });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(403);
  });

  it('returns 204 when the sender cancels their own request', async () => {
    queueSelect('profiles', { data: { id: FAKE_SENDER_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: FAKE_SENDER_PROFILE_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
      },
      error: null,
    });
    queueDelete('friend_requests', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
  });

  it('returns 204 when the recipient declines the request', async () => {
    queueSelect('profiles', { data: { id: FAKE_RECIPIENT_PROFILE_ID }, error: null });
    queueSelect('friend_requests', {
      data: {
        id: FAKE_REQUEST_ID,
        sender_id: FAKE_SENDER_PROFILE_ID,
        recipient_id: FAKE_RECIPIENT_PROFILE_ID,
      },
      error: null,
    });
    queueDelete('friend_requests', { data: null, error: null });

    const app = createTestApp();
    const res = await app.request(
      `/v1/friend-requests/${FAKE_REQUEST_ID}`,
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
  });

  it('returns 422 when id param is not a valid UUID', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/friend-requests/not-a-uuid',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });
});
