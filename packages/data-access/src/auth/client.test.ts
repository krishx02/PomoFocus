import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  signUp,
  signIn,
  signOut,
  signInWithOAuth,
  getSession,
  getAccessToken,
  onAuthStateChange,
  createAuthClient,
} from './client';
import type { AuthClientConfig } from './client';
import type {
  AuthSession,
  AuthResult,
  OAuthProvider,
  Unsubscribe,
} from './types';

function makeSession(overrides?: Partial<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}>): {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
} {
  return {
    access_token: 'eyJ-access-token',
    refresh_token: 'eyJ-refresh-token',
    expires_at: 1700000000,
    user: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    },
    ...overrides,
  };
}

function makeSupabaseError(
  message: string,
  status: number,
): { message: string; status: number; name: string; __isAuthError: boolean } {
  return { message, status, name: 'AuthError', __isAuthError: true };
}

type MockAuth = {
  signUp: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
};

function createMockClient(authOverrides?: Partial<MockAuth>): {
  client: SupabaseClient;
  auth: MockAuth;
} {
  const auth: MockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    ...authOverrides,
  };

  const client = { auth } as unknown as SupabaseClient;
  return { client, auth };
}

describe('createAuthClient', () => {
  it('returns a SupabaseClient instance', () => {
    const config: AuthClientConfig = {
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    };

    const client = createAuthClient(config);
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});

describe('signUp', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns mapped session on successful signup', async () => {
    const session = makeSession();
    auth.signUp.mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const result: AuthResult<AuthSession> = await signUp(client, 'test@example.com', 'password123');

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.accessToken).toBe('eyJ-access-token');
    expect(result.data?.refreshToken).toBe('eyJ-refresh-token');
    expect(result.data?.expiresAt).toBe(1700000000);
    expect(result.data?.user.id).toBe('user-123');
    expect(result.data?.user.email).toBe('test@example.com');
    expect(result.data?.user.displayName).toBe('Test User');
  });

  it('returns error on signup failure', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: makeSupabaseError('Email already registered', 422),
    });

    const result: AuthResult<AuthSession> = await signUp(client, 'existing@example.com', 'password123');

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Email already registered');
    expect(result.error?.status).toBe(422);
  });

  it('returns undefined data when signup requires email confirmation', async () => {
    auth.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com', user_metadata: {} },
        session: null,
      },
      error: null,
    });

    const result: AuthResult<AuthSession> = await signUp(client, 'test@example.com', 'password123');

    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});

describe('signIn', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns mapped session on successful sign in', async () => {
    const session = makeSession();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const result: AuthResult<AuthSession> = await signIn(client, 'test@example.com', 'password123');

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.accessToken).toBe('eyJ-access-token');
    expect(result.data?.user.email).toBe('test@example.com');
  });

  it('returns error on invalid credentials', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: makeSupabaseError('Invalid login credentials', 400),
    });

    const result: AuthResult<AuthSession> = await signIn(client, 'test@example.com', 'wrong');

    expect(result.data).toBeUndefined();
    expect(result.error?.message).toBe('Invalid login credentials');
    expect(result.error?.status).toBe(400);
  });
});

describe('signOut', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns no error on successful sign out', async () => {
    auth.signOut.mockResolvedValue({ error: null });

    const result: AuthResult<undefined> = await signOut(client);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeUndefined();
  });

  it('returns error on sign out failure', async () => {
    auth.signOut.mockResolvedValue({
      error: makeSupabaseError('Session not found', 400),
    });

    const result: AuthResult<undefined> = await signOut(client);

    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Session not found');
  });
});

describe('signInWithOAuth', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns OAuth URL on success', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth?...' },
      error: null,
    });

    const provider: OAuthProvider = 'google';
    const result: AuthResult<{ url: string }> = await signInWithOAuth(client, provider);

    expect(result.error).toBeUndefined();
    expect(result.data?.url).toContain('https://accounts.google.com');
  });

  it('returns error when OAuth fails', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: '' },
      error: makeSupabaseError('Provider not configured', 400),
    });

    const result: AuthResult<{ url: string }> = await signInWithOAuth(client, 'google');

    expect(result.data).toBeUndefined();
    expect(result.error?.message).toBe('Provider not configured');
  });

  it('returns error when OAuth URL is empty', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: '' },
      error: null,
    });

    const result: AuthResult<{ url: string }> = await signInWithOAuth(client, 'google');

    expect(result.data).toBeUndefined();
    expect(result.error?.message).toBe('OAuth URL not returned');
  });
});

describe('getSession', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns mapped session when session exists', async () => {
    const session = makeSession();
    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const result: AuthResult<AuthSession> = await getSession(client);

    expect(result.error).toBeUndefined();
    expect(result.data?.accessToken).toBe('eyJ-access-token');
    expect(result.data?.user.id).toBe('user-123');
  });

  it('returns undefined data when no session exists', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const result: AuthResult<AuthSession> = await getSession(client);

    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('returns error when session retrieval fails', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: makeSupabaseError('Session expired', 401),
    });

    const result: AuthResult<AuthSession> = await getSession(client);

    expect(result.data).toBeUndefined();
    expect(result.error?.message).toBe('Session expired');
    expect(result.error?.status).toBe(401);
  });
});

describe('getAccessToken', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('returns the access token when session exists', async () => {
    const session = makeSession({ access_token: 'my-jwt-token' });
    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const token: string | undefined = await getAccessToken(client);

    expect(token).toBe('my-jwt-token');
  });

  it('returns undefined when no session exists', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const token: string | undefined = await getAccessToken(client);

    expect(token).toBeUndefined();
  });

  it('returns undefined when session retrieval fails', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: makeSupabaseError('Auth error', 500),
    });

    const token: string | undefined = await getAccessToken(client);

    expect(token).toBeUndefined();
  });
});

describe('onAuthStateChange', () => {
  it('calls callback with mapped session on state change', () => {
    const unsubscribeFn = vi.fn();
    const { client, auth } = createMockClient({
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: { unsubscribe: unsubscribeFn },
        },
      }),
    });

    const events: { event: string; session: AuthSession | undefined }[] = [];

    onAuthStateChange(client, (event, session) => {
      events.push({ event, session });
    });

    const registeredCallback = auth.onAuthStateChange.mock.calls[0]?.[0] as
      | ((event: string, session: unknown) => void)
      | undefined;
    expect(registeredCallback).toBeDefined();

    const session = makeSession();
    registeredCallback?.('SIGNED_IN', session);

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('SIGNED_IN');
    expect(events[0]?.session?.accessToken).toBe('eyJ-access-token');
    expect(events[0]?.session?.user.id).toBe('user-123');
  });

  it('calls callback with undefined session on sign out', () => {
    const unsubscribeFn = vi.fn();
    const { client, auth } = createMockClient({
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: { unsubscribe: unsubscribeFn },
        },
      }),
    });

    const events: { event: string; session: AuthSession | undefined }[] = [];

    onAuthStateChange(client, (event, session) => {
      events.push({ event, session });
    });

    const registeredCallback = auth.onAuthStateChange.mock.calls[0]?.[0] as
      | ((event: string, session: unknown) => void)
      | undefined;
    registeredCallback?.('SIGNED_OUT', null);

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('SIGNED_OUT');
    expect(events[0]?.session).toBeUndefined();
  });

  it('returns an unsubscribe function', () => {
    const unsubscribeFn = vi.fn();
    const { client } = createMockClient({
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: { unsubscribe: unsubscribeFn },
        },
      }),
    });

    const result: Unsubscribe = onAuthStateChange(client, () => {
      // no-op
    });

    expect(result.unsubscribe).toBeDefined();
    result.unsubscribe();
    expect(unsubscribeFn).toHaveBeenCalledOnce();
  });
});

describe('user mapping', () => {
  let client: SupabaseClient;
  let auth: MockAuth;

  beforeEach(() => {
    ({ client, auth } = createMockClient());
  });

  it('maps name from user_metadata.name when full_name is absent', async () => {
    const session = makeSession({
      user: {
        id: 'user-456',
        email: 'name@example.com',
        user_metadata: { name: 'Name Only' },
      },
    });

    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const result = await getSession(client);
    expect(result.data?.user.displayName).toBe('Name Only');
  });

  it('prefers full_name over name in user_metadata', async () => {
    const session = makeSession({
      user: {
        id: 'user-789',
        email: 'both@example.com',
        user_metadata: { full_name: 'Full Name', name: 'Short Name' },
      },
    });

    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const result = await getSession(client);
    expect(result.data?.user.displayName).toBe('Full Name');
  });

  it('returns undefined displayName when neither full_name nor name exists', async () => {
    const session = makeSession({
      user: {
        id: 'user-000',
        email: 'no-name@example.com',
        user_metadata: {},
      },
    });

    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const result = await getSession(client);
    expect(result.data?.user.displayName).toBeUndefined();
  });
});

describe('auth module exports', () => {
  it('exports all required functions from the module entry point', async () => {
    const authModule = await import('./index');

    expect(typeof authModule.createAuthClient).toBe('function');
    expect(typeof authModule.signUp).toBe('function');
    expect(typeof authModule.signIn).toBe('function');
    expect(typeof authModule.signOut).toBe('function');
    expect(typeof authModule.signInWithOAuth).toBe('function');
    expect(typeof authModule.getSession).toBe('function');
    expect(typeof authModule.getAccessToken).toBe('function');
    expect(typeof authModule.onAuthStateChange).toBe('function');
  });
});
