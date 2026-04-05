import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import {
  registerGoalsRoute,
  CreateGoalBodySchema,
  UpdateGoalBodySchema,
  GoalParamsSchema,
} from './goals.js';

/**
 * Mock Supabase module so no real network calls are made.
 *
 * INSERT chain: insert() -> select() -> single()
 * SELECT all chain: select('*', { count: 'exact' }) -> order()
 * SELECT single chain: select('*') -> eq() -> single()
 * UPDATE chain: update() -> eq() -> select() -> single()
 * DELETE chain: delete() -> eq()
 */
const mockSingle = vi.fn();
const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));

const mockOrder = vi.fn();

const mockSelectSingle = vi.fn();
const mockSelectEq = vi.fn(() => ({ single: mockSelectSingle }));

const mockUpdateSingle = vi.fn();
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEq = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

const mockDeleteEq = vi.fn();
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

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

const FAKE_USER_ID = 'aaaa1111-0000-0000-0000-000000000001';

const FAKE_USER = {
  id: FAKE_USER_ID,
  email: 'alice@example.com',
  created_at: '2026-03-01T00:00:00.000Z',
};

const FAKE_GOAL_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: FAKE_USER_ID,
  title: 'Learn TypeScript',
  description: null,
  status: 'active',
  sort_order: 0,
  created_at: '2026-03-17T10:00:00.000Z',
  updated_at: '2026-03-17T10:00:00.000Z',
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
  registerGoalsRoute(app);
  return app;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${FAKE_JWT}` };
}

function setupMockSupabase(): void {
  mockGetUser.mockResolvedValue({
    data: { user: FAKE_USER },
    error: null,
  });

  mockCreateUserClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'long_term_goals') {
        return {
          insert: mockInsert,
          select: (...args: unknown[]) => {
            // select('*', { count: 'exact' }) for list
            if (args.length === 2) {
              return { order: mockOrder };
            }
            // select('*') for get-by-id
            return { eq: mockSelectEq };
          },
          update: mockUpdate,
          delete: mockDelete,
        };
      }
      return {};
    }),
    auth: { getUser: mockGetUser },
  });
}

describe('POST /v1/goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupMockSupabase();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 201 with created goal for valid body and auth', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_GOAL_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'Learn TypeScript' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(FAKE_GOAL_ROW.id);
    expect(body.title).toBe('Learn TypeScript');
    expect(body.status).toBe('active');
  });

  it('returns 201 with optional description and status', async () => {
    const goalWithOptionals = {
      ...FAKE_GOAL_ROW,
      description: 'Master the type system',
      status: 'completed',
    };
    mockSingle.mockResolvedValueOnce({ data: goalWithOptionals, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: 'Learn TypeScript',
          description: 'Master the type system',
          status: 'completed',
        }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.description).toBe('Master the type system');
    expect(body.status).toBe('completed');
  });

  it('returns 422 when title is missing', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
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

  it('returns 422 when title is empty string', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: '' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 for invalid status enum value', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'Test', status: 'invalid' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('passes correct fields to Supabase insert', async () => {
    mockSingle.mockResolvedValueOnce({ data: FAKE_GOAL_ROW, error: null });

    const app = createTestApp();
    await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title: 'Learn TypeScript',
          description: 'Master the type system',
          sort_order: 5,
        }),
      },
      FAKE_ENV,
    );

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: FAKE_USER_ID,
      title: 'Learn TypeScript',
      description: 'Master the type system',
      status: 'active',
      sort_order: 5,
    });
  });

  it('returns 500 when Supabase insert fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/goals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'Test' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('validates CreateGoalBodySchema accepts all valid status values', () => {
    const validStatuses = ['active', 'completed', 'retired'];
    for (const status of validStatuses) {
      const result = CreateGoalBodySchema.safeParse({ title: 'Test', status });
      expect(result.success).toBe(true);
    }
  });
});

describe('GET /v1/goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupMockSupabase();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/goals', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with list of goals', async () => {
    const goals = [
      FAKE_GOAL_ROW,
      { ...FAKE_GOAL_ROW, id: '22222222-2222-2222-2222-222222222222', sort_order: 1 },
    ];
    mockOrder.mockResolvedValueOnce({ data: goals, error: null, count: 2 });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns empty data array when no goals exist', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('orders goals by sort_order ascending', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null, count: 0 });

    const app = createTestApp();
    await app.request(
      '/v1/goals',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(mockOrder).toHaveBeenCalledWith('sort_order', { ascending: true });
  });

  it('returns 500 when Supabase select fails', async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: new Error('something unexpected happened'),
      count: null,
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/goals',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });
});

describe('GET /v1/goals/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupMockSupabase();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'GET' },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with a single goal', async () => {
    mockSelectSingle.mockResolvedValueOnce({ data: FAKE_GOAL_ROW, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(FAKE_GOAL_ROW.id);
    expect(body.title).toBe(FAKE_GOAL_ROW.title);
  });

  it('returns 404 when goal does not exist', async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/99999999-9999-9999-9999-999999999999',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Goal not found');
  });

  it('returns 422 when id is not a valid UUID', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/not-a-uuid',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('validates GoalParamsSchema requires a valid UUID', () => {
    const valid = GoalParamsSchema.safeParse({ id: '11111111-1111-1111-1111-111111111111' });
    expect(valid.success).toBe(true);

    const invalid = GoalParamsSchema.safeParse({ id: 'not-a-uuid' });
    expect(invalid.success).toBe(false);
  });
});

describe('PATCH /v1/goals/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupMockSupabase();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with updated goal', async () => {
    const updatedGoal = { ...FAKE_GOAL_ROW, title: 'Updated Title' };
    mockUpdateSingle.mockResolvedValueOnce({ data: updatedGoal, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'Updated Title' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated Title');
  });

  it('returns 200 when updating status', async () => {
    const updatedGoal = { ...FAKE_GOAL_ROW, status: 'completed' };
    mockUpdateSingle.mockResolvedValueOnce({ data: updatedGoal, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'completed' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
  });

  it('returns 200 when updating sort_order', async () => {
    const updatedGoal = { ...FAKE_GOAL_ROW, sort_order: 3 };
    mockUpdateSingle.mockResolvedValueOnce({ data: updatedGoal, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sort_order: 3 }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sort_order).toBe(3);
  });

  it('returns 200 when setting description to null', async () => {
    const updatedGoal = { ...FAKE_GOAL_ROW, description: null };
    mockUpdateSingle.mockResolvedValueOnce({ data: updatedGoal, error: null });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ description: null }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBeNull();
  });

  it('returns 404 when goal does not exist', async () => {
    mockUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/99999999-9999-9999-9999-999999999999',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'Updated' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Goal not found');
  });

  it('returns 422 for invalid status enum value', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: 'invalid' }),
      },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('validates UpdateGoalBodySchema allows all fields to be optional', () => {
    const result = UpdateGoalBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates UpdateGoalBodySchema allows nullable description', () => {
    const result = UpdateGoalBodySchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it('passes correct update payload to Supabase', async () => {
    mockUpdateSingle.mockResolvedValueOnce({ data: FAKE_GOAL_ROW, error: null });

    const app = createTestApp();
    await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: 'New Title', sort_order: 2 }),
      },
      FAKE_ENV,
    );

    expect(mockUpdate).toHaveBeenCalledWith({ title: 'New Title', sort_order: 2 });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', '11111111-1111-1111-1111-111111111111');
  });
});

describe('DELETE /v1/goals/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupMockSupabase();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'DELETE' },
      FAKE_ENV,
    );

    expect(res.status).toBe(401);
  });

  it('returns 204 on successful delete', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null, count: 1 });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(204);
  });

  it('returns 404 when goal does not exist', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null, count: 0 });

    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/99999999-9999-9999-9999-999999999999',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Goal not found');
  });

  it('returns 422 when id is not a valid UUID', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/goals/not-a-uuid',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(422);
  });

  it('returns 500 when Supabase delete fails', async () => {
    mockDeleteEq.mockResolvedValueOnce({
      error: new Error('something unexpected happened'),
      count: null,
    });

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('calls Supabase delete with correct id', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null, count: 1 });

    const app = createTestApp();
    await app.request(
      '/v1/goals/11111111-1111-1111-1111-111111111111',
      { method: 'DELETE', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', '11111111-1111-1111-1111-111111111111');
  });
});
