import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthVariables } from '../middleware/auth.js';
import type { SupabaseEnv } from '../lib/supabase.js';
import { registerMeRoute, MeResponseSchema, MeExportResponseSchema } from './me.js';

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

const FAKE_PROFILE_ID = 'bbbb2222-0000-0000-0000-000000000001';

const FAKE_PROFILE = {
  id: FAKE_PROFILE_ID,
  auth_user_id: FAKE_USER.id,
  display_name: 'Alice',
  username: 'alice',
  avatar_url: null,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

const FAKE_PREFERENCES = {
  id: 'cccc3333-0000-0000-0000-000000000001',
  user_id: FAKE_PROFILE_ID,
  work_duration_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_before_long_break: 4,
  reflection_enabled: true,
  timezone: 'UTC',
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
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
 * The export endpoint queries multiple tables with different patterns:
 * - profiles: .eq('auth_user_id', ...).maybeSingle()
 * - user_preferences: .eq('user_id', ...).maybeSingle()
 * - user_id-scoped tables: .eq('user_id', ...) returning arrays
 * - friend_requests: two queries (.eq('sender_id'), .eq('recipient_id'))
 * - device_sync_log: .in('device_id', [...])
 *
 * We need a more flexible mock to handle these patterns.
 */
function createExportMockClientFull(options: {
  profile?: unknown;
  preferences?: unknown;
  longTermGoals?: unknown[];
  processGoals?: unknown[];
  sessions?: unknown[];
  breaks?: unknown[];
  devices?: { id: string; [key: string]: unknown }[];
  deviceSyncLog?: unknown[];
  friendRequestsSent?: unknown[];
  friendRequestsReceived?: unknown[];
  friendships?: unknown[];
  encouragementTaps?: unknown[];
}): Record<string, unknown> {
  const {
    profile = null,
    preferences = null,
    longTermGoals = [],
    processGoals = [],
    sessions = [],
    breaks = [],
    devices = [],
    deviceSyncLog = [],
    friendRequestsSent = [],
    friendRequestsReceived = [],
    friendships = [],
    encouragementTaps = [],
  } = options;

  // Track call counts for friend_requests to return sent vs received
  let friendRequestCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
            })),
          })),
        };
      }
      if (table === 'user_preferences') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: preferences, error: null }),
            })),
          })),
        };
      }
      if (table === 'friend_requests') {
        friendRequestCallCount++;
        const data = friendRequestCallCount % 2 === 1 ? friendRequestsSent : friendRequestsReceived;
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data, error: null })),
          })),
        };
      }
      if (table === 'device_sync_log') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: deviceSyncLog, error: null })),
          })),
        };
      }

      // All user_id-scoped tables
      const tableMap: Record<string, unknown[]> = {
        long_term_goals: longTermGoals,
        process_goals: processGoals,
        sessions,
        breaks,
        devices,
        friendships,
        encouragement_taps: encouragementTaps,
      };

      const data = tableMap[table] ?? [];
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data, error: null })),
        })),
      };
    }),
    auth: { getUser: mockGetUser },
  };
}

describe('GET /v1/me/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without authorization header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me/export', {}, FAKE_ENV);

    expect(res.status).toBe(401);
  });

  it('returns 200 with all entity types in response', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    const mockClient = createExportMockClientFull({
      profile: FAKE_PROFILE,
      preferences: FAKE_PREFERENCES,
    });

    mockCreateUserClient.mockReturnValue(mockClient);

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    const expectedKeys = [
      'profile',
      'preferences',
      'long_term_goals',
      'process_goals',
      'sessions',
      'breaks',
      'devices',
      'device_sync_log',
      'friend_requests',
      'friendships',
      'encouragement_taps',
    ];
    expect(Object.keys(body).sort()).toEqual(expectedKeys.sort());
  });

  it('sets Content-Disposition header for file download', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({ profile: FAKE_PROFILE }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="pomofocus-export.json"',
    );
  });

  it('returns 200 with empty collections when user has no data', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({}),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.profile).toBeNull();
    expect(body.preferences).toBeNull();
    expect(body.long_term_goals).toEqual([]);
    expect(body.process_goals).toEqual([]);
    expect(body.sessions).toEqual([]);
    expect(body.breaks).toEqual([]);
    expect(body.devices).toEqual([]);
    expect(body.device_sync_log).toEqual([]);
    expect(body.friend_requests).toEqual([]);
    expect(body.friendships).toEqual([]);
    expect(body.encouragement_taps).toEqual([]);
  });

  it('includes profile and preferences when they exist', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({
        profile: FAKE_PROFILE,
        preferences: FAKE_PREFERENCES,
      }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.profile).toEqual(FAKE_PROFILE);
    expect(body.preferences).toEqual(FAKE_PREFERENCES);
  });

  it('includes data from all entity tables', async () => {
    const fakeSession = {
      id: 'ssss0001-0000-0000-0000-000000000001',
      user_id: FAKE_PROFILE_ID,
      started_at: '2026-03-15T10:00:00.000Z',
    };
    const fakeDevice = {
      id: 'dddd0001-0000-0000-0000-000000000001',
      user_id: FAKE_PROFILE_ID,
      device_name: 'My Device',
    };
    const fakeSyncLog = {
      id: 'llll0001-0000-0000-0000-000000000001',
      device_id: fakeDevice.id,
      direction: 'upload',
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({
        profile: FAKE_PROFILE,
        sessions: [fakeSession],
        devices: [fakeDevice],
        deviceSyncLog: [fakeSyncLog],
      }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.sessions).toEqual([fakeSession]);
    expect(body.devices).toEqual([fakeDevice]);
    expect(body.device_sync_log).toEqual([fakeSyncLog]);
  });

  it('validates response against MeExportResponseSchema', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({ profile: FAKE_PROFILE }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    const body = await res.json();
    const result = MeExportResponseSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('returns content-type application/json', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: FAKE_USER },
      error: null,
    });

    mockCreateUserClient.mockReturnValue(
      createExportMockClientFull({ profile: FAKE_PROFILE }),
    );

    const app = createTestApp();
    const res = await app.request(
      '/v1/me/export',
      { headers: { Authorization: `Bearer ${FAKE_JWT}` } },
      FAKE_ENV,
    );

    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
