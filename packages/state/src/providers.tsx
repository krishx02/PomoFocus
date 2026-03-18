import type { ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';

type QueryProviderProps = {
  readonly client: QueryClient;
  readonly children: ReactNode;
};

/**
 * App-level provider wrapping TanStack Query's QueryClientProvider.
 * App shells pass a QueryClient created via `createQueryClient()`.
 */
export function QueryProvider({
  client,
  children,
}: QueryProviderProps): ReactNode {
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
