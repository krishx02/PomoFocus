import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { QueryProvider, createQueryClient } from '@pomofocus/state';

/**
 * API base URL read from environment variable.
 * Expo convention: EXPO_PUBLIC_ prefix makes it available client-side.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

type AppProvidersProps = {
  readonly children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  const queryClient = useMemo(() => createQueryClient(), []);

  return <QueryProvider client={queryClient}>{children}</QueryProvider>;
}
