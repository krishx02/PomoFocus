import { useQuery, queryOptions } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { getSessions } from '@pomofocus/data-access';
import type { ApiClient, SessionListResponse } from '@pomofocus/data-access';

/**
 * Stale time for session queries (30s).
 * Matches ADR-003 polling interval. Explicit per PKG-S04.
 */
const SESSIONS_STALE_TIME = 30_000;

/**
 * Refetch interval for session polling (30s).
 * Per ADR-003: TanStack Query polling at 30s, no Realtime WebSockets.
 */
const SESSIONS_REFETCH_INTERVAL = 30_000;

/**
 * Query options factory for sessions (PKG-S05).
 * Centralizes query key and options — eliminates key typo bugs.
 */
function sessionsQueryOptions(client: ApiClient): ReturnType<typeof queryOptions<SessionListResponse>> {
  return queryOptions<SessionListResponse>({
    queryKey: ['sessions'],
    queryFn: async (): Promise<SessionListResponse> => {
      const result = await getSessions(client);

      if (result.error !== undefined) {
        if (result.error instanceof Error) {
          throw result.error;
        }
        throw new Error(
          typeof result.error === 'string' ? result.error : 'Failed to fetch sessions',
        );
      }

      if (result.data === undefined) {
        throw new Error('No data returned from getSessions');
      }

      return result.data;
    },
    staleTime: SESSIONS_STALE_TIME,
    refetchInterval: SESSIONS_REFETCH_INTERVAL,
  });
}

/**
 * Fetches the session list from the API via data-access with 30s polling.
 * Server data stays in TanStack Query cache — not stored in Zustand (PKG-S01).
 */
function useSessions(client: ApiClient): UseQueryResult<SessionListResponse> {
  return useQuery(sessionsQueryOptions(client));
}

export { sessionsQueryOptions, useSessions };
