export {
  createAuthClient,
  signUp,
  signIn,
  signOut,
  signInWithOAuth,
  getSession,
  getAccessToken,
  onAuthStateChange,
} from './client';
export type { AuthClientConfig } from './client';
export type {
  AuthUser,
  AuthSession,
  AuthError,
  AuthResult,
  OAuthProvider,
  AuthStateChangeCallback,
  Unsubscribe,
} from './types';
