import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient, AuthError } from '@supabase/supabase-js';
import {
  signInWithApple,
  extractAppleUserProfile,
  isApplePrivateRelayEmail,
  signInWithGoogle,
  exchangeGoogleOAuthCode,
} from './oauth';

function createMockSupabaseClient(overrides?: {
  signInWithOAuth?: ReturnType<typeof vi.fn>;
  exchangeCodeForSession?: ReturnType<typeof vi.fn>;
}): SupabaseClient {
  return {
    auth: {
      signInWithOAuth: overrides?.signInWithOAuth ?? vi.fn(),
      exchangeCodeForSession: overrides?.exchangeCodeForSession ?? vi.fn(),
    },
  } as unknown as SupabaseClient;
}

// ==================== Apple Sign-In ====================

describe('signInWithApple', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Supabase with apple provider and correct scopes', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: 'https://appleid.apple.com/auth/authorize?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithApple(client);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { scopes: 'name email' },
    });
  });

  it('returns provider and url on success', async () => {
    const oauthUrl = 'https://appleid.apple.com/auth/authorize?client_id=test';
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: oauthUrl },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    const result = await signInWithApple(client);

    expect(result.data.provider).toBe('apple');
    expect(result.data.url).toBe(oauthUrl);
    expect(result.error).toBeNull();
  });

  it('passes redirectTo when provided', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: 'https://appleid.apple.com/auth/authorize?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithApple(client, 'pomofocus://auth/callback');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        scopes: 'name email',
        redirectTo: 'pomofocus://auth/callback',
      },
    });
  });

  it('supports web callback URLs', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: 'https://appleid.apple.com/auth/authorize?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithApple(client, 'https://pomofocus.app/auth/callback');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        scopes: 'name email',
        redirectTo: 'https://pomofocus.app/auth/callback',
      },
    });
  });

  it('returns error when Supabase auth fails', async () => {
    const authError = { name: 'AuthError', message: 'Provider not enabled', status: 400 } as AuthError;
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: null },
      error: authError,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    const result = await signInWithApple(client);

    expect(result.data.provider).toBe('apple');
    expect(result.data.url).toBeNull();
    expect(result.error).toBe(authError);
  });

  it('does not include redirectTo in options when undefined', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: 'https://appleid.apple.com/auth/authorize?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithApple(client, undefined);

    const firstCall = signInWithOAuth.mock.calls[0] as
      | [{ provider: string; options?: Record<string, unknown> }]
      | undefined;
    const calledOptions = firstCall?.[0]?.options;
    expect(calledOptions).toBeDefined();
    expect('redirectTo' in (calledOptions ?? {})).toBe(false);
  });

  it('returns typed result without throwing', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'apple', url: null },
      error: { name: 'AuthError', message: 'Network error', status: 500 } as AuthError,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    // Should NOT throw — returns error in result
    const result = await signInWithApple(client);
    expect(result.error).not.toBeNull();
  });
});

describe('extractAppleUserProfile', () => {
  it('extracts email and display name from first login', () => {
    const identityData = {
      email: 'user@example.com',
      full_name: { firstName: 'John', lastName: 'Doe' },
      sub: 'apple-user-id-123',
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.email).toBe('user@example.com');
    expect(profile.displayName).toBe('John Doe');
    expect(profile.isPrivateRelay).toBe(false);
  });

  it('detects Apple private relay email', () => {
    const identityData = {
      email: 'abc123@privaterelay.appleid.com',
      full_name: { firstName: 'John', lastName: 'Doe' },
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.email).toBe('abc123@privaterelay.appleid.com');
    expect(profile.isPrivateRelay).toBe(true);
  });

  it('returns undefined displayName for returning user (no name sent)', () => {
    const identityData = {
      email: 'user@example.com',
      sub: 'apple-user-id-123',
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.email).toBe('user@example.com');
    expect(profile.displayName).toBeUndefined();
    expect(profile.isPrivateRelay).toBe(false);
  });

  it('handles first name only', () => {
    const identityData = {
      email: 'user@example.com',
      full_name: { firstName: 'John' },
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.displayName).toBe('John');
  });

  it('handles last name only', () => {
    const identityData = {
      email: 'user@example.com',
      full_name: { lastName: 'Doe' },
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.displayName).toBe('Doe');
  });

  it('falls back to top-level name field', () => {
    const identityData = {
      email: 'user@example.com',
      name: 'Jane Smith',
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.displayName).toBe('Jane Smith');
  });

  it('returns undefined for all fields when identityData is undefined', () => {
    const profile = extractAppleUserProfile(undefined);

    expect(profile.email).toBeUndefined();
    expect(profile.displayName).toBeUndefined();
    expect(profile.isPrivateRelay).toBe(false);
  });

  it('handles empty identity data object', () => {
    const profile = extractAppleUserProfile({});

    expect(profile.email).toBeUndefined();
    expect(profile.displayName).toBeUndefined();
    expect(profile.isPrivateRelay).toBe(false);
  });

  it('handles non-string email', () => {
    const identityData = {
      email: 42,
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.email).toBeUndefined();
    expect(profile.isPrivateRelay).toBe(false);
  });

  it('handles full_name with non-string values', () => {
    const identityData = {
      email: 'user@example.com',
      full_name: { firstName: 123, lastName: true },
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.displayName).toBeUndefined();
  });

  it('ignores empty name string fallback', () => {
    const identityData = {
      email: 'user@example.com',
      name: '',
    };

    const profile = extractAppleUserProfile(identityData);

    expect(profile.displayName).toBeUndefined();
  });
});

describe('isApplePrivateRelayEmail', () => {
  it('returns true for private relay email', () => {
    expect(isApplePrivateRelayEmail('abc123@privaterelay.appleid.com')).toBe(true);
  });

  it('returns false for regular email', () => {
    expect(isApplePrivateRelayEmail('user@example.com')).toBe(false);
  });

  it('returns false for icloud email', () => {
    expect(isApplePrivateRelayEmail('user@icloud.com')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isApplePrivateRelayEmail('user@fakeprivaterelay.appleid.com')).toBe(false);
  });

  it('returns true for relay with long local part', () => {
    expect(isApplePrivateRelayEmail('very.long.email.address.12345@privaterelay.appleid.com')).toBe(true);
  });
});

// ==================== Google Sign-In ====================

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls signInWithOAuth with google provider and correct scopes', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithGoogle(client);

    expect(signInWithOAuth).toHaveBeenCalledOnce();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
      },
    });
  });

  it('returns provider and url on success', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    const result = await signInWithGoogle(client);

    expect(result.data.provider).toBe('google');
    expect(result.data.url).toBe('https://accounts.google.com/o/oauth2/auth?...');
    expect(result.error).toBeNull();
  });

  it('passes redirectTo when provided', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithGoogle(client, 'https://app.pomofocus.com/auth/callback');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'https://app.pomofocus.com/auth/callback',
      },
    });
  });

  it('omits redirectTo from options when not provided', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithGoogle(client);

    const firstCall = signInWithOAuth.mock.calls[0] as Record<string, unknown>[] | undefined;
    const firstArg = firstCall?.[0];
    const calledOptions = firstArg?.['options'] as Record<string, unknown> | undefined;
    expect(calledOptions).toBeDefined();
    expect('redirectTo' in (calledOptions ?? {})).toBe(false);
  });

  it('returns error when OAuth initiation fails', async () => {
    const authError = { name: 'AuthError', message: 'Provider not enabled', status: 400 };
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: null },
      error: authError,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    const result = await signInWithGoogle(client);

    expect(result.data.url).toBeNull();
    expect(result.error).toEqual(authError);
  });

  it('supports mobile deep link callback URL', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithGoogle(client, 'pomofocus://auth/callback');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'pomofocus://auth/callback',
      },
    });
  });

  it('supports web callback URL', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/auth?...' },
      error: null,
    });
    const client = createMockSupabaseClient({ signInWithOAuth });

    await signInWithGoogle(client, 'http://localhost:3000/auth/callback');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'http://localhost:3000/auth/callback',
      },
    });
  });
});

describe('exchangeGoogleOAuthCode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exchanges auth code for session', async () => {
    const session = {
      access_token: 'token-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-1', email: 'user@example.com' },
    };
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    const client = createMockSupabaseClient({ exchangeCodeForSession });

    const result = await exchangeGoogleOAuthCode(client, 'auth-code-123');

    expect(exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
    expect(result.data.session).toEqual(session);
    expect(result.error).toBeNull();
  });

  it('returns error when code exchange fails', async () => {
    const authError = { name: 'AuthError', message: 'Invalid code', status: 400 };
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: authError,
    });
    const client = createMockSupabaseClient({ exchangeCodeForSession });

    const result = await exchangeGoogleOAuthCode(client, 'invalid-code');

    expect(result.data.session).toBeNull();
    expect(result.error).toEqual(authError);
  });

  it('returns user data from successful code exchange', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Test User' },
    };
    const session = {
      access_token: 'token-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      token_type: 'bearer',
      user,
    };
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session, user },
      error: null,
    });
    const client = createMockSupabaseClient({ exchangeCodeForSession });

    const result = await exchangeGoogleOAuthCode(client, 'auth-code-456');

    expect(result.data.user).toEqual(user);
    expect(result.error).toBeNull();
  });
});
