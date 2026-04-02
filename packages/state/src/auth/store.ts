import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { AuthUser, AuthError, AuthSession, AuthResult, Unsubscribe } from '@pomofocus/data-access';

// -- Auth Operations Interface --
// Pre-bound functions that the app shell creates by binding the SupabaseClient.
// This keeps @supabase/supabase-js out of packages/state/.

type AuthOperations = {
  readonly signIn: (email: string, password: string) => Promise<AuthResult<AuthSession>>;
  readonly signUp: (email: string, password: string) => Promise<AuthResult<AuthSession>>;
  readonly signOut: () => Promise<AuthResult<undefined>>;
  readonly getSession: () => Promise<AuthResult<AuthSession>>;
  readonly onAuthStateChange: (
    callback: (event: string, session: AuthSession | undefined) => void,
  ) => Unsubscribe;
};

// -- Store Shape --

type AuthState = {
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: AuthError | null;
};

type AuthActions = {
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signUp: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly initialize: () => Unsubscribe;
  readonly clearError: () => void;
};

type AuthStore = AuthState & AuthActions;

// -- Initial State --

const INITIAL_STATE: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

type AuthStoreInstance = UseBoundStore<StoreApi<AuthStore>>;

// -- Store Factory --

function createAuthStore(ops: AuthOperations): AuthStoreInstance {
  return create<AuthStore>()(
    devtools(
      (set) => ({
        ...INITIAL_STATE,

        signIn: async (email: string, password: string): Promise<void> => {
          set({ isLoading: true, error: null }, false, 'auth/signIn:start');

          const result = await ops.signIn(email, password);

          if (result.error !== undefined) {
            set(
              { isLoading: false, error: result.error },
              false,
              'auth/signIn:error',
            );
            return;
          }

          if (result.data !== undefined) {
            set(
              {
                user: result.data.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              },
              false,
              'auth/signIn:success',
            );
          }
        },

        signUp: async (email: string, password: string): Promise<void> => {
          set({ isLoading: true, error: null }, false, 'auth/signUp:start');

          const result = await ops.signUp(email, password);

          if (result.error !== undefined) {
            set(
              { isLoading: false, error: result.error },
              false,
              'auth/signUp:error',
            );
            return;
          }

          if (result.data !== undefined) {
            set(
              {
                user: result.data.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              },
              false,
              'auth/signUp:success',
            );
          } else {
            // signUp returned no session (e.g. email confirmation required)
            set(
              { isLoading: false },
              false,
              'auth/signUp:pending',
            );
          }
        },

        signOut: async (): Promise<void> => {
          set({ isLoading: true, error: null }, false, 'auth/signOut:start');

          const result = await ops.signOut();

          if (result.error !== undefined) {
            set(
              { isLoading: false, error: result.error },
              false,
              'auth/signOut:error',
            );
            return;
          }

          set(
            {
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            },
            false,
            'auth/signOut:success',
          );
        },

        initialize: (): Unsubscribe => {
          // Check existing session
          void ops.getSession().then((result) => {
            if (result.data !== undefined) {
              set(
                {
                  user: result.data.user,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                },
                false,
                'auth/initialize:session',
              );
            } else {
              set(
                { isLoading: false },
                false,
                'auth/initialize:noSession',
              );
            }
          });

          // Subscribe to auth state changes
          const subscription = ops.onAuthStateChange((_event, session) => {
            if (session !== undefined) {
              set(
                {
                  user: session.user,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                },
                false,
                'auth/stateChange:signedIn',
              );
            } else {
              set(
                {
                  user: null,
                  isAuthenticated: false,
                  isLoading: false,
                  error: null,
                },
                false,
                'auth/stateChange:signedOut',
              );
            }
          });

          return subscription;
        },

        clearError: (): void => {
          set({ error: null }, false, 'auth/clearError');
        },
      }),
      { name: 'AuthStore' },
    ),
  );
}

export { createAuthStore };
export type { AuthStore, AuthStoreInstance, AuthState, AuthActions, AuthOperations };
