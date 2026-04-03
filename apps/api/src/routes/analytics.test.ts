import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerAnalyticsRoute, GlanceableResponseSchema } from './analytics.js';

/**
 * Mock the Supabase client factory so no real network calls are made.
 */
const { mockCreateUserClient, mockGetUser } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  createUserClient: mockCreateUserClient,
}));

/**
 * Mock tierOneMetrics so we test the route wiring, not the analytics computation.
 * Analytics functions are thoroughly tested in packages/analytics/.
 */
const { mockTierOneMetrics } = vi.hoisted(() => ({
  mockTierOneMetrics: vi.fn(),
}));

vi.mock('@pomofocus/analytics', () => ({
  tierOneMetrics: mockTierOneMetrics,
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

const FAKE_TIER_ONE_RESULT = {
  goalProgress: [
    { goalId: 'goal-1', goalTitle: 'Study', completedToday: 2, targetToday: 3 },
  ],
  weeklyDots: [true, true, false, true, false, false, false] as [boolean, boolean, boolean, boolean, boolean, boolean, boolean],
  currentStreak: 4,
};

const FAKE_SESSION_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: FAKE_USER_ID,
  process_goal_id: 'eeee0001-0000-0000-0000-000000000001',
  intention_text: null,
  started_at: '2026-03-17T10:00:00.000Z',
  ended_at: '2026-03-17T10:25:00.000Z',
  completed: true,
  abandonment_reason: null,
  focus_quality: null,
  distraction_type: null,
  device_id: null,
  created_at: '2026-03-17T10:25:01.000Z',
};

const FAKE_GOAL_ROW = {
  id: 'eeee0001-0000-0000-0000-000000000001',
  long_term_goal_id: 'dddd0001-0000-0000-0000-000000000001',
  user_id: FAKE_USER_ID,
  title: 'Study',
  target_sessions_per_day: 3,
  recurrence: 'daily',
  status: 'active',
  sort_order: 0,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
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
  registerAnalyticsRoute(app);
  return app;
}

/**
 * Builds a mock Supabase client with configurable query results.
 *
 * Each table (user_preferences, sessions, process_goals) gets its own
 * chainable query mock matching the Supabase SDK pattern.
 */
function createMockSupabase(overrides: {
  prefs?: { data: unknown; error: unknown };
  sessions?: { data: unknown; error: unknown };
  goals?: { data: unknown; error: unknown };
} = {}): unknown {
  const defaultPrefs = { data: { timezone: 'America/New_York' }, error: null };
  const defaultSessions = { data: [FAKE_SESSION_ROW], error: null };
  const defaultGoals = { data: [FAKE_GOAL_ROW], error: null };

  const prefs = overrides.prefs ?? defaultPrefs;
  const sessions = overrides.sessions ?? defaultSessions;
  const goals = overrides.goals ?? defaultGoals;

  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'user_preferences') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue(prefs),
            })),
          })),
        };
      }
      if (table === 'sessions') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue(sessions),
          })),
        };
      }
      if (table === 'process_goals') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue(goals),
          })),
        };
      }
      return {};
    }),
  };
}

describe('GET /v1/analytics/glanceable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: { user: FAKE_USER },
      error: null,
    });

    mockTierOneMetrics.mockReturnValue(FAKE_TIER_ONE_RESULT);
    mockCreateUserClient.mockReturnValue(createMockSupabase());
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/analytics/glanceable', { method: 'GET' }, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with glanceable analytics for authenticated user', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = GlanceableResponseSchema.parse(await res.json());
    expect(body.goalProgress).toHaveLength(1);
    expect(body.goalProgress[0]?.goalTitle).toBe('Study');
    expect(body.weeklyDots).toHaveLength(7);
    expect(body.currentStreak).toBe(4);
  });

  it('calls tierOneMetrics with converted session and goal data', async () => {
    const app = createTestApp();
    await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(mockTierOneMetrics).toHaveBeenCalledTimes(1);

    const [sessions, goals, timezone] = mockTierOneMetrics.mock.calls[0] as [unknown[], unknown[], string, number];

    // Sessions should be transformed to camelCase SessionData
    expect(sessions).toHaveLength(1);
    expect((sessions[0] as Record<string, unknown>).startedAt).toBe(FAKE_SESSION_ROW.started_at);
    expect((sessions[0] as Record<string, unknown>).processGoalId).toBe(FAKE_SESSION_ROW.process_goal_id);

    // Goals should be transformed to camelCase ProcessGoal
    expect(goals).toHaveLength(1);
    expect((goals[0] as Record<string, unknown>).targetSessionsPerDay).toBe(FAKE_GOAL_ROW.target_sessions_per_day);

    // Timezone from user preferences
    expect(timezone).toBe('America/New_York');
  });

  it('defaults timezone to UTC when no user preferences exist', async () => {
    mockCreateUserClient.mockReturnValue(
      createMockSupabase({ prefs: { data: null, error: null } }),
    );

    const app = createTestApp();
    await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    const [, , timezone] = mockTierOneMetrics.mock.calls[0] as [unknown, unknown, string, number];
    expect(timezone).toBe('UTC');
  });

  it('returns valid response with no sessions and no goals', async () => {
    const emptyResult = {
      goalProgress: [],
      weeklyDots: [false, false, false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean, boolean, boolean],
      currentStreak: 0,
    };
    mockTierOneMetrics.mockReturnValue(emptyResult);
    mockCreateUserClient.mockReturnValue(
      createMockSupabase({
        sessions: { data: [], error: null },
        goals: { data: [], error: null },
      }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = GlanceableResponseSchema.parse(await res.json());
    expect(body.goalProgress).toEqual([]);
    expect(body.weeklyDots).toEqual([false, false, false, false, false, false, false]);
    expect(body.currentStreak).toBe(0);
  });

  it('returns 500 when sessions query fails', async () => {
    mockCreateUserClient.mockReturnValue(
      createMockSupabase({
        sessions: { data: null, error: new Error('sessions query failed') },
      }),
    );

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when goals query fails', async () => {
    mockCreateUserClient.mockReturnValue(
      createMockSupabase({
        goals: { data: null, error: new Error('goals query failed') },
      }),
    );

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns 500 when user preferences query fails', async () => {
    mockCreateUserClient.mockReturnValue(
      createMockSupabase({
        prefs: { data: null, error: new Error('prefs query failed') },
      }),
    );

    const app = createTestApp();
    app.onError((_err, c) => {
      return c.json({ error: 'Internal server error', status: 500 }, 500);
    });

    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.status).toBe(500);
  });

  it('returns correct content-type header', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('response validates against GlanceableResponseSchema', async () => {
    const app = createTestApp();
    const res = await app.request(
      '/v1/analytics/glanceable',
      { method: 'GET', headers: authHeaders() },
      FAKE_ENV,
    );

    const body = await res.json();
    const parsed = GlanceableResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });
});
