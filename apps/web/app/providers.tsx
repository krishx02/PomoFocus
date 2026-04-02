import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { QueryProvider, createQueryClient } from '@pomofocus/state';
import { createAuthClient } from '@pomofocus/data-access';

/**
 * API base URL read from environment variable.
 * Expo convention: EXPO_PUBLIC_ prefix makes it available client-side.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

type SupabaseAuthClient = ReturnType<typeof createAuthClient>;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- SupabaseClient resolves as error type because @supabase/supabase-js types are not in this project's tsconfig
const AuthClientContext = createContext<SupabaseAuthClient | null>(null);

function createSingletonAuthClient(): SupabaseAuthClient {
  return createAuthClient({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- SupabaseClient resolves as error type because @supabase/supabase-js types are not in this project's tsconfig
let singletonAuthClient: SupabaseAuthClient | undefined;

function getAuthClient(): SupabaseAuthClient {
  if (singletonAuthClient === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- SupabaseClient type unresolvable in this project's tsconfig
    singletonAuthClient = createSingletonAuthClient();
  }
  return singletonAuthClient;
}

export function useAuthClient(): SupabaseAuthClient {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- SupabaseClient type unresolvable in this project's tsconfig
  const client = useContext(AuthClientContext);
  if (client === null) {
    throw new Error('useAuthClient must be used within AppProviders');
  }
  return client;
}

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  const queryClient = useMemo(() => createQueryClient(), []);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- SupabaseClient type unresolvable in this project's tsconfig
  const authClient = useMemo(() => getAuthClient(), []);

  return (
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- SupabaseClient type unresolvable in this project's tsconfig
    <AuthClientContext.Provider value={authClient}>
      <QueryProvider client={queryClient}>{children}</QueryProvider>
    </AuthClientContext.Provider>
  );
}
