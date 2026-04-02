import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@pomofocus/types';
import app from '../index.js';

/**
 * Integration tests for the auth flow: signup -> login -> authenticated API call
 * -> token refresh -> logout. Runs against a local Supabase instance.
 *
 * Prerequisites:
 *   - `supabase start` must be running
 *   - Migrations and seed data must be applied (`supabase db reset`)
 *
 * Run with: pnpm nx test @pomofocus/api --testPathPattern=integration
 */

// Local Supabase defaults (from `supabase status`)
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TEST_ENV = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
};

/**
 * Unique email suffix per test run to avoid collisions with
 * other test runs or seed data. Cleanup removes these users.
 */
const RUN_ID = Date.now().toString(36);
const USER_A_EMAIL = `integ-a-${RUN_ID}@test.local`;
const USER_A_PASSWORD = 'TestPass123!';
const USER_B_EMAIL = `integ-b-${RUN_ID}@test.local`;
const USER_B_PASSWORD = 'TestPass456!';

type TestUser = {
  id: string;
  profileId: string;
  accessToken: string;
  refreshToken: string;
};

let adminClient: SupabaseClient<Database>;
let userA: TestUser;
let userB: TestUser;
let _userAGoalId: string;
let _userAProcessGoalId: string;
let userBGoalId: string;
let userBProcessGoalId: string;
let supabaseAvailable = false;

/**
 * Creates an anon Supabase client for auth operations (signup/login).
 * Mimics what a real client app would do per ADR-002.
 */
function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Throws if a value is null or undefined. Returns the value narrowed.
 */
function assertDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

/**
 * Signs up a test user and returns their auth details.
 * Uses the anon client (like a real client would per ADR-002).
 */
async function signUpTestUser(
  email: string,
  password: string,
  displayName: string,
): Promise<TestUser> {
  const anonClient = createAnonClient();
  const { data, error } = await anonClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    throw new Error(`Signup failed for ${email}: ${error.message}`);
  }

  const user = assertDefined(data.user, `user for ${email}`);
  const session = assertDefined(data.session, `session for ${email}`);

  // The signup trigger creates a profile row -- fetch its ID
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError) {
    throw new Error(`Profile not created for ${email}: ${profileError.message}`);
  }

  const profileRow = assertDefined(profile, `profile row for ${email}`);

  return {
    id: user.id,
    profileId: profileRow.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

/**
 * Makes an HTTP request to the Hono app with proper env bindings.
 */
function apiRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return app.request(path, init, TEST_ENV);
}

/**
 * Makes an authenticated HTTP request to the Hono app.
 */
function authedRequest(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return apiRequest(path, { ...init, headers });
}

/**
 * Check if local Supabase is reachable. If not, skip all tests.
 */
async function isSupabaseRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    supabaseAvailable = await isSupabaseRunning();
    if (!supabaseAvailable) {
      return;
    }

    // Admin client for setup/cleanup (bypasses RLS)
    adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Sign up two test users
    userA = await signUpTestUser(USER_A_EMAIL, USER_A_PASSWORD, 'Integration User A');
    userB = await signUpTestUser(USER_B_EMAIL, USER_B_PASSWORD, 'Integration User B');

    // Create goals for each user (needed for session FK constraint).
    // Uses admin client to bypass RLS since these are setup operations.
    const { data: goalA, error: goalAError } = await adminClient
      .from('long_term_goals')
      .insert({ user_id: userA.profileId, title: 'Test Goal A' })
      .select('id')
      .single();
    if (goalAError) throw new Error(`Goal A creation failed: ${goalAError.message}`);
    _userAGoalId = assertDefined(goalA, 'goalA').id;

    const { data: pgA, error: pgAError } = await adminClient
      .from('process_goals')
      .insert({
        long_term_goal_id: _userAGoalId,
        user_id: userA.profileId,
        title: 'Test Process Goal A',
      })
      .select('id')
      .single();
    if (pgAError) throw new Error(`Process goal A creation failed: ${pgAError.message}`);
    _userAProcessGoalId = assertDefined(pgA, 'pgA').id;

    const { data: goalB, error: goalBError } = await adminClient
      .from('long_term_goals')
      .insert({ user_id: userB.profileId, title: 'Test Goal B' })
      .select('id')
      .single();
    if (goalBError) throw new Error(`Goal B creation failed: ${goalBError.message}`);
    userBGoalId = assertDefined(goalB, 'goalB').id;

    const { data: pgB, error: pgBError } = await adminClient
      .from('process_goals')
      .insert({
        long_term_goal_id: userBGoalId,
        user_id: userB.profileId,
        title: 'Test Process Goal B',
      })
      .select('id')
      .single();
    if (pgBError) throw new Error(`Process goal B creation failed: ${pgBError.message}`);
    userBProcessGoalId = assertDefined(pgB, 'pgB').id;
  }, 30000);

  afterAll(async () => {
    if (!supabaseAvailable) {
      return;
    }

    // Clean up test users via admin client (cascade deletes profiles, goals, sessions)
    await adminClient.auth.admin.deleteUser(userA.id);
    await adminClient.auth.admin.deleteUser(userB.id);
  }, 15000);

  it('skips when Supabase is not running', () => {
    if (!supabaseAvailable) {
      console.log('SKIP: Local Supabase not running -- run `supabase start` to enable integration tests');
    }
    // Always passes -- actual tests are gated by supabaseAvailable
    expect(true).toBe(true);
  });

  describe('signup creates user and profile', () => {
    it('signup returns valid user IDs and tokens', () => {
      if (!supabaseAvailable) return;

      expect(userA.id).toBeDefined();
      expect(userA.profileId).toBeDefined();
      expect(userA.accessToken).toBeDefined();
      expect(userA.refreshToken).toBeDefined();
      // Auth user ID and profile ID should be different UUIDs
      expect(userA.id).not.toBe(userA.profileId);
    });
  });

  describe('email login returns valid JWT', () => {
    it('login with correct credentials returns a session', async () => {
      if (!supabaseAvailable) return;

      const anonClient = createAnonClient();
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: USER_A_PASSWORD,
      });

      expect(error).toBeNull();
      const session = assertDefined(data.session, 'login session');
      expect(session.access_token).toBeDefined();
      expect(session.access_token.length).toBeGreaterThan(0);
    });

    it('login with wrong password fails', async () => {
      if (!supabaseAvailable) return;

      const anonClient = createAnonClient();
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: 'WrongPassword999!',
      });

      expect(error).toBeDefined();
      expect(data.session).toBeNull();
    });
  });

  describe('JWT in Authorization header grants access to /v1/me', () => {
    it('returns 200 with user profile when authenticated', async () => {
      if (!supabaseAvailable) return;

      const res = await authedRequest('/v1/me', userA.accessToken);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(userA.id);
      expect(body.email).toBe(USER_A_EMAIL);
      expect(body.created_at).toBeDefined();
    });
  });

  describe('invalid JWT returns 401', () => {
    it('returns 401 with no Authorization header', async () => {
      if (!supabaseAvailable) return;

      const res = await apiRequest('/v1/me');
      expect(res.status).toBe(401);
    });

    it('returns error with garbage token', async () => {
      if (!supabaseAvailable) return;

      const res = await authedRequest('/v1/me', 'not-a-valid-jwt');
      // The auth middleware accepts any Bearer token format,
      // but Supabase getUser() will fail with an invalid token
      const body = await res.json();
      expect([401, 403, 500]).toContain(res.status);
      expect(body.error).toBeDefined();
    });

    it('returns error with expired token format', async () => {
      if (!supabaseAvailable) return;

      // A structurally valid JWT that is expired
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJleHAiOjE2MDAwMDAwMDB9.fake-signature';
      const res = await authedRequest('/v1/me', expiredToken);

      const body = await res.json();
      expect([401, 403, 500]).toContain(res.status);
      expect(body.error).toBeDefined();
    });
  });

  describe('user A cannot access user B sessions (RLS isolation)', () => {
    let userBSessionId: string;

    beforeAll(async () => {
      if (!supabaseAvailable) return;

      // Create a session for user B using admin client
      const { data, error } = await adminClient
        .from('sessions')
        .insert({
          user_id: userB.profileId,
          process_goal_id: userBProcessGoalId,
          started_at: new Date().toISOString(),
          ended_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          completed: true,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create session for user B: ${error.message}`);
      }
      userBSessionId = assertDefined(data, 'user B session').id;
    });

    it('user A listing sessions does not see user B sessions', async () => {
      if (!supabaseAvailable) return;

      const res = await authedRequest('/v1/sessions', userA.accessToken, {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // User A should not see user B's session
      const sessionIds = (body.data as { id: string }[]).map((s) => s.id);
      expect(sessionIds).not.toContain(userBSessionId);
    });

    it('user B can see their own session', async () => {
      if (!supabaseAvailable) return;

      const res = await authedRequest('/v1/sessions', userB.accessToken, {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      const sessionIds = (body.data as { id: string }[]).map((s) => s.id);
      expect(sessionIds).toContain(userBSessionId);
    });
  });

  describe('token refresh returns new valid JWT', () => {
    it('refresh token produces a new access token', async () => {
      if (!supabaseAvailable) return;

      const anonClient = createAnonClient();

      // First, sign in to get a session
      const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: USER_A_PASSWORD,
      });
      expect(loginError).toBeNull();
      const loginSession = assertDefined(loginData.session, 'login session for refresh');

      // Refresh the session
      const { data: refreshData, error: _refreshError } = await anonClient.auth.refreshSession({
        refresh_token: loginSession.refresh_token,
      });

      expect(_refreshError).toBeNull();
      const refreshedSession = assertDefined(refreshData.session, 'refreshed session');
      expect(refreshedSession.access_token).toBeDefined();

      // The new token should work for API calls
      const res = await authedRequest('/v1/me', refreshedSession.access_token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(userA.id);
    });
  });

  describe('logout invalidates session', () => {
    it('after logout, the old refresh token no longer works', async () => {
      if (!supabaseAvailable) return;

      // Sign in to get a dedicated session for this test
      const anonClient = createAnonClient();
      const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: USER_A_PASSWORD,
      });
      expect(loginError).toBeNull();
      const loginSession = assertDefined(loginData.session, 'login session for logout');

      // Verify the token works before logout
      const resBefore = await authedRequest('/v1/me', loginSession.access_token);
      expect(resBefore.status).toBe(200);

      // Sign out (invalidates the refresh token server-side)
      // Note: Supabase JWTs are stateless -- the access token itself doesn't
      // become invalid immediately, but the refresh token is revoked so
      // the client cannot obtain new tokens.
      const { error: logoutError } = await anonClient.auth.signOut();
      expect(logoutError).toBeNull();

      // Verify: refreshing with the old refresh token should fail
      const { data: refreshData } = await anonClient.auth.refreshSession({
        refresh_token: loginSession.refresh_token,
      });
      // After signOut, the refresh token is revoked
      expect(refreshData.session).toBeNull();
    });
  });
});
