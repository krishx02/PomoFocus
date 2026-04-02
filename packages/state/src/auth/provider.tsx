import { createContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createAuthStore } from './store.js';
import type { AuthStoreInstance, AuthOperations } from './store.js';

const AuthStoreContext = createContext<AuthStoreInstance | null>(null);

type AuthProviderProps = {
  readonly ops: AuthOperations;
  readonly children: ReactNode;
};

function AuthProvider({ ops, children }: AuthProviderProps): ReactNode {
  const storeRef = useRef<AuthStoreInstance | null>(null);
  storeRef.current ??= createAuthStore(ops);

  const store = storeRef.current;

  useEffect(() => {
    const subscription = store.getState().initialize();

    return (): void => {
      subscription.unsubscribe();
    };
  }, [store]);

  return (
    <AuthStoreContext.Provider value={store}>
      {children}
    </AuthStoreContext.Provider>
  );
}

export { AuthProvider, AuthStoreContext };
export type { AuthProviderProps };
