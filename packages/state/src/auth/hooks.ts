import { useContext } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AuthUser, AuthError } from '@pomofocus/data-access';
import { AuthStoreContext } from './provider.js';
import type { AuthStoreInstance } from './store.js';

type UseAuthReturn = {
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly error: AuthError | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signUp: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
};

function useAuthStoreFromContext(): AuthStoreInstance {
  const store = useContext(AuthStoreContext);
  if (store === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return store;
}

function useAuth(): UseAuthReturn {
  const store = useAuthStoreFromContext();
  return store(
    useShallow((state) => ({
      user: state.user,
      isLoading: state.isLoading,
      isAuthenticated: state.isAuthenticated,
      error: state.error,
      signIn: state.signIn,
      signUp: state.signUp,
      signOut: state.signOut,
    })),
  );
}

function useUser(): AuthUser | null {
  const store = useAuthStoreFromContext();
  return store((state) => state.user);
}

function useIsAuthenticated(): boolean {
  const store = useAuthStoreFromContext();
  return store((state) => state.isAuthenticated);
}

export { useAuth, useUser, useIsAuthenticated };
export type { UseAuthReturn };
