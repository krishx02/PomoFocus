import { QueryClient } from '@tanstack/react-query';

/**
 * Default stale time for all queries (30s).
 * Matches the 30s polling interval per ADR-003.
 */
const DEFAULT_STALE_TIME = 30_000;

/**
 * Default refetch interval for polling (30s).
 * Per ADR-003: TanStack Query polling at 30s, no Realtime WebSockets.
 */
const DEFAULT_REFETCH_INTERVAL = 30_000;

/**
 * Maximum number of retries for failed queries.
 */
const MAX_RETRIES = 3;

/**
 * Exponential backoff delay calculation.
 * Returns delay in ms: 1s, 2s, 4s (capped at 30s).
 */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

/**
 * Creates a configured QueryClient with PomoFocus defaults:
 * - staleTime: 30s (PKG-S04)
 * - refetchInterval: 30s for polling (ADR-003)
 * - retry: 3 attempts with exponential backoff
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        refetchInterval: DEFAULT_REFETCH_INTERVAL,
        retry: MAX_RETRIES,
        retryDelay,
      },
    },
  });
}
