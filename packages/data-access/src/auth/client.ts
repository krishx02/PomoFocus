import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthUser,
  AuthSession,
  AuthError,
  AuthResult,
  OAuthProvider,
  AuthStateChangeCallback,
  Unsubscribe,
} from './types';

type AuthClientConfig = {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
};

function createAuthClient(config: AuthClientConfig): SupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- createClient generic defaults to `any` database schema
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function mapUser(
  user: { id: string; email?: string | undefined; user_metadata?: Record<string, unknown> },
): AuthUser {
  const metadata = user.user_metadata ?? {};
  const displayName = typeof metadata['full_name'] === 'string'
    ? metadata['full_name']
    : typeof metadata['name'] === 'string'
      ? metadata['name']
      : undefined;

  const provider = typeof metadata['iss'] === 'string'
    ? metadata['iss']
    : undefined;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName,
    provider,
  };
}

function mapError(error: { message: string; status: number | undefined }): AuthError {
  return {
    message: error.message,
    status: error.status,
  };
}

function mapSession(
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    user: { id: string; email?: string | undefined; user_metadata?: Record<string, unknown> };
  },
): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? undefined,
    user: mapUser(session.user),
  };
}

async function signUp(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResult<AuthSession>> {
  const { data, error } = await client.auth.signUp({ email, password });

  if (error !== null) {
    return { data: undefined, error: mapError(error) };
  }

  if (data.session === null) {
    return { data: undefined, error: undefined };
  }

  return { data: mapSession(data.session), error: undefined };
}

async function signIn(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResult<AuthSession>> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error !== null) {
    return { data: undefined, error: mapError(error) };
  }

  return { data: mapSession(data.session), error: undefined };
}

async function signOut(client: SupabaseClient): Promise<AuthResult<undefined>> {
  const { error } = await client.auth.signOut();

  if (error !== null) {
    return { data: undefined, error: mapError(error) };
  }

  return { data: undefined, error: undefined };
}

async function signInWithOAuth(
  client: SupabaseClient,
  provider: OAuthProvider,
): Promise<AuthResult<{ url: string }>> {
  const { data, error } = await client.auth.signInWithOAuth({ provider });

  if (error !== null) {
    return { data: undefined, error: mapError(error) };
  }

  if (data.url.length === 0) {
    return {
      data: undefined,
      error: { message: 'OAuth URL not returned', status: undefined },
    };
  }

  return { data: { url: data.url }, error: undefined };
}

async function getSession(
  client: SupabaseClient,
): Promise<AuthResult<AuthSession>> {
  const { data, error } = await client.auth.getSession();

  if (error !== null) {
    return { data: undefined, error: mapError(error) };
  }

  if (data.session === null) {
    return { data: undefined, error: undefined };
  }

  return { data: mapSession(data.session), error: undefined };
}

async function getAccessToken(
  client: SupabaseClient,
): Promise<string | undefined> {
  const { data, error } = await client.auth.getSession();

  if (error !== null) {
    return undefined;
  }

  if (data.session === null) {
    return undefined;
  }

  return data.session.access_token;
}

function onAuthStateChange(
  client: SupabaseClient,
  callback: AuthStateChangeCallback,
): Unsubscribe {
  const { data } = client.auth.onAuthStateChange((event, session) => {
    const mappedSession = session !== null ? mapSession(session) : undefined;
    callback(event, mappedSession);
  });

  return {
    unsubscribe: () => {
      data.subscription.unsubscribe();
    },
  };
}

export {
  createAuthClient,
  signUp,
  signIn,
  signOut,
  signInWithOAuth,
  getSession,
  getAccessToken,
  onAuthStateChange,
};
export type { AuthClientConfig };
