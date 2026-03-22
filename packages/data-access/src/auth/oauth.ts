import type { SupabaseClient, AuthError } from '@supabase/supabase-js';

// ==================== Apple Sign-In ====================

/**
 * Apple's private relay email domain. When users choose "Hide My Email"
 * during Apple Sign-In, Apple generates a unique @privaterelay.appleid.com
 * address that forwards to their real email.
 */
const APPLE_PRIVATE_RELAY_DOMAIN = 'privaterelay.appleid.com';

type AppleSignInResult = {
  readonly data: { readonly provider: 'apple'; readonly url: string };
  readonly error: null;
} | {
  readonly data: { readonly provider: 'apple'; readonly url: null };
  readonly error: AuthError;
};

type AppleUserProfile = {
  readonly email: string | undefined;
  readonly displayName: string | undefined;
  readonly isPrivateRelay: boolean;
};

function isApplePrivateRelayEmail(email: string): boolean {
  return email.endsWith(`@${APPLE_PRIVATE_RELAY_DOMAIN}`);
}

/**
 * Initiates Apple Sign-In via Supabase OAuth.
 *
 * Scopes are limited to `name email` per ADR-012 (minimum OAuth data).
 * Apple only returns the user's name on the FIRST sign-in — after that,
 * the identity provider no longer includes it. The caller must cache the
 * display name immediately via `extractAppleUserProfile` after the
 * redirect callback.
 */
async function signInWithApple(
  client: SupabaseClient,
  redirectTo?: string,
): Promise<AppleSignInResult> {
  const options: { readonly scopes: string; readonly redirectTo?: string } =
    redirectTo !== undefined
      ? { scopes: 'name email', redirectTo }
      : { scopes: 'name email' };

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'apple',
    options,
  });

  if (error !== null) {
    return {
      data: { provider: 'apple', url: null },
      error,
    };
  }

  return {
    data: { provider: 'apple', url: data.url },
    error: null,
  };
}

/**
 * Extracts the user profile from the Supabase auth session after an
 * Apple Sign-In callback completes. Detects private relay emails and
 * extracts the display name from Apple's identity data.
 *
 * Apple only sends the user's full name on the FIRST login. On subsequent
 * logins, `displayName` will be `undefined`. The caller is responsible for
 * caching the name in the `profiles` table on first login.
 */
function extractAppleUserProfile(
  identityData: Record<string, unknown> | undefined,
): AppleUserProfile {
  if (identityData === undefined) {
    return { email: undefined, displayName: undefined, isPrivateRelay: false };
  }

  const email = typeof identityData['email'] === 'string'
    ? identityData['email']
    : undefined;

  const isPrivateRelay = email !== undefined
    ? isApplePrivateRelayEmail(email)
    : false;

  const fullName = identityData['full_name'];
  const displayName = extractDisplayName(fullName, identityData);

  return { email, displayName, isPrivateRelay };
}

function extractDisplayName(
  fullName: unknown,
  identityData: Record<string, unknown>,
): string | undefined {
  // Apple sends name as a structured object: { firstName, lastName }
  if (typeof fullName === 'object' && fullName !== null) {
    const nameObj = fullName as Record<string, unknown>;
    const firstName = typeof nameObj['firstName'] === 'string' ? nameObj['firstName'] : undefined;
    const lastName = typeof nameObj['lastName'] === 'string' ? nameObj['lastName'] : undefined;

    if (firstName !== undefined && lastName !== undefined) {
      return `${firstName} ${lastName}`;
    }
    if (firstName !== undefined) {
      return firstName;
    }
    if (lastName !== undefined) {
      return lastName;
    }
  }

  // Fallback: some Supabase versions put name at the top level
  if (typeof identityData['name'] === 'string' && identityData['name'].length > 0) {
    return identityData['name'];
  }

  return undefined;
}

// ==================== Google Sign-In ====================

/**
 * Google OAuth scopes per ADR-012: request minimum data.
 * openid = OIDC subject identifier
 * email = user's email address
 * profile = display name and avatar
 */
const GOOGLE_SCOPES = 'openid email profile';

type SignInWithGoogleResult = {
  readonly data: {
    readonly provider: string;
    readonly url: string | null;
  };
  readonly error: unknown;
};

type ExchangeCodeResult = {
  readonly data: {
    readonly session: unknown;
    readonly user: unknown;
  };
  readonly error: unknown;
};

async function signInWithGoogle(
  client: SupabaseClient,
  redirectTo?: string,
): Promise<SignInWithGoogleResult> {
  const options: { scopes: string; redirectTo?: string } = {
    scopes: GOOGLE_SCOPES,
  };

  if (redirectTo !== undefined) {
    options.redirectTo = redirectTo;
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options,
  });

  return { data, error };
}

async function exchangeGoogleOAuthCode(
  client: SupabaseClient,
  authCode: string,
): Promise<ExchangeCodeResult> {
  const { data, error } = await client.auth.exchangeCodeForSession(authCode);

  return { data, error };
}

// ==================== Exports ====================

export { signInWithApple, extractAppleUserProfile, isApplePrivateRelayEmail };
export type { AppleSignInResult, AppleUserProfile };
export { signInWithGoogle, exchangeGoogleOAuthCode, GOOGLE_SCOPES };
export type { SignInWithGoogleResult, ExchangeCodeResult };
