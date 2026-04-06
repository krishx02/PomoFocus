// Server interaction: OpenAPI client, auth token management, sync drivers.
// All auth imports live here. Core never imports this.
export { createApiClient } from './client';
export type { ApiClient, ApiClientOptions } from './client';
export { isApiError, handleApiError } from './errors';
export type { ApiError, ErrorResponseInput } from './errors';
export { createSession, getSessions } from './sessions';
export type {
  CreateSessionBody,
  SessionResponse,
  SessionListResponse,
  SessionListParams,
  CreateSessionResult,
  GetSessionsResult,
} from './sessions';
export {
  createAuthClient,
  signUp,
  signIn,
  signOut,
  signInWithOAuth,
  getSession,
  getAccessToken,
  onAuthStateChange,
} from './auth';
export type {
  AuthClientConfig,
  AuthUser,
  AuthSession,
  AuthError,
  AuthResult,
  OAuthProvider,
  AuthStateChangeCallback,
  Unsubscribe,
} from './auth';
export {
  signInWithApple,
  extractAppleUserProfile,
  isApplePrivateRelayEmail,
  signInWithGoogle,
  exchangeGoogleOAuthCode,
  GOOGLE_SCOPES,
} from './auth/oauth';
export type {
  AppleSignInResult,
  AppleUserProfile,
  SignInWithGoogleResult,
  ExchangeCodeResult,
} from './auth/oauth';
export { signUpWithEmail, signInWithEmail } from './auth/email';
export type { SignUpResult, SignInResult } from './auth/email';
export {
  createTokenProvider,
  isTokenExpiringSoon,
  REFRESH_BUFFER_SECONDS,
} from './auth/token-refresh';
export type { TokenRefreshDeps } from './auth/token-refresh';
export {
  persistEntry,
  loadPendingEntries,
  markUploaded,
  markFailed,
} from './sync/persistence-driver';
