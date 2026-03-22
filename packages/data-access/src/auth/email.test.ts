import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUpWithEmail, signInWithEmail } from './email';
import type { SupabaseClient, AuthError, Session, User } from '@supabase/supabase-js';
import type { Mock } from 'vitest';

function createMockSession(userId: string): Session {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: createMockUser(userId),
  };
}

function createMockUser(userId: string): User {
  return {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  };
}

function createAuthError(message: string, status: number): AuthError {
  const error = new Error(message) as AuthError;
  error.name = 'AuthApiError';
  error.status = status;
  error.code = undefined;
  return error;
}

type MockSupabase = {
  readonly client: SupabaseClient;
  readonly signUpMock: Mock;
  readonly signInWithPasswordMock: Mock;
};

function createMockSupabase(overrides: {
  signUp?: ReturnType<SupabaseClient['auth']['signUp']>;
  signInWithPassword?: ReturnType<SupabaseClient['auth']['signInWithPassword']>;
}): MockSupabase {
  const signUpMock = vi.fn().mockReturnValue(
    overrides.signUp ?? Promise.resolve({ data: { user: null, session: null }, error: null }),
  );
  const signInWithPasswordMock = vi.fn().mockReturnValue(
    overrides.signInWithPassword ?? Promise.resolve({ data: { user: null, session: null }, error: null }),
  );

  const client = {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
    },
  } as unknown as SupabaseClient;

  return { client, signUpMock, signInWithPasswordMock };
}

describe('signUpWithEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns session and userId on successful signup', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const session = createMockSession(userId);
    const user = createMockUser(userId);

    const { client } = createMockSupabase({
      signUp: Promise.resolve({
        data: { user, session },
        error: null,
      }),
    });

    const result = await signUpWithEmail(client, 'test@example.com', 'password123', 'Test User');

    expect(result.session).toBe(session);
    expect(result.userId).toBe(userId);
    expect(result.error).toBeNull();
  });

  it('passes displayName as user_metadata', async () => {
    const { client, signUpMock } = createMockSupabase({
      signUp: Promise.resolve({
        data: { user: null, session: null },
        error: null,
      }),
    });

    await signUpWithEmail(client, 'test@example.com', 'password123', 'My Name');

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: {
          display_name: 'My Name',
        },
      },
    });
  });

  it('returns AuthError for duplicate email', async () => {
    const authError = createAuthError('User already registered', 422);

    const { client } = createMockSupabase({
      signUp: Promise.resolve({
        data: { user: null, session: null },
        error: authError,
      }),
    });

    const result = await signUpWithEmail(client, 'existing@example.com', 'password123', 'Test User');

    expect(result.session).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.error).toBe(authError);
    expect(result.error?.message).toBe('User already registered');
  });

  it('returns AuthError for weak password', async () => {
    const authError = createAuthError('Password should be at least 8 characters', 422);

    const { client } = createMockSupabase({
      signUp: Promise.resolve({
        data: { user: null, session: null },
        error: authError,
      }),
    });

    const result = await signUpWithEmail(client, 'test@example.com', 'short', 'Test User');

    expect(result.session).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.error).toBe(authError);
    expect(result.error?.message).toBe('Password should be at least 8 characters');
  });

  it('returns null userId when user is null in response', async () => {
    const session = createMockSession('some-id');

    const { client } = createMockSupabase({
      signUp: Promise.resolve({
        data: { user: null, session },
        error: null,
      }),
    });

    const result = await signUpWithEmail(client, 'test@example.com', 'password123', 'Test User');

    expect(result.session).toBe(session);
    expect(result.userId).toBeNull();
    expect(result.error).toBeNull();
  });
});

describe('signInWithEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns session and userId on successful signin', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const session = createMockSession(userId);
    const user = createMockUser(userId);

    const { client } = createMockSupabase({
      signInWithPassword: Promise.resolve({
        data: { user, session },
        error: null,
      }),
    });

    const result = await signInWithEmail(client, 'test@example.com', 'password123');

    expect(result.session).toBe(session);
    expect(result.userId).toBe(userId);
    expect(result.error).toBeNull();
  });

  it('returns AuthError for wrong password', async () => {
    const authError = createAuthError('Invalid login credentials', 400);

    const { client } = createMockSupabase({
      signInWithPassword: Promise.resolve({
        data: { user: null, session: null },
        error: authError,
      }),
    });

    const result = await signInWithEmail(client, 'test@example.com', 'wrongpassword');

    expect(result.session).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.error).toBe(authError);
    expect(result.error?.message).toBe('Invalid login credentials');
    expect(result.error?.status).toBe(400);
  });

  it('returns AuthError for non-existent user', async () => {
    const authError = createAuthError('Invalid login credentials', 400);

    const { client } = createMockSupabase({
      signInWithPassword: Promise.resolve({
        data: { user: null, session: null },
        error: authError,
      }),
    });

    const result = await signInWithEmail(client, 'nonexistent@example.com', 'password123');

    expect(result.session).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.error).toBe(authError);
  });

  it('calls signInWithPassword with correct arguments', async () => {
    const { client, signInWithPasswordMock } = createMockSupabase({
      signInWithPassword: Promise.resolve({
        data: { user: createMockUser('id'), session: createMockSession('id') },
        error: null,
      }),
    });

    await signInWithEmail(client, 'user@test.com', 'mypassword');

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'mypassword',
    });
  });
});
