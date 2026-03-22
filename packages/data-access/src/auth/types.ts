import type { Provider } from '@supabase/supabase-js';

type AuthUser = {
  readonly id: string;
  readonly email: string | undefined;
  readonly displayName: string | undefined;
  readonly provider: string | undefined;
};

type AuthSession = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number | undefined;
  readonly user: AuthUser;
};

type AuthError = {
  readonly message: string;
  readonly status: number | undefined;
};

type AuthResult<T> = {
  readonly data: T | undefined;
  readonly error: AuthError | undefined;
};

type OAuthProvider = Provider;

type AuthStateChangeCallback = (
  event: string,
  session: AuthSession | undefined,
) => void;

type Unsubscribe = {
  readonly unsubscribe: () => void;
};

export type {
  AuthUser,
  AuthSession,
  AuthError,
  AuthResult,
  OAuthProvider,
  AuthStateChangeCallback,
  Unsubscribe,
};
