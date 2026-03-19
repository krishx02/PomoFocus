import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getSessions } from '@pomofocus/data-access';
import { createApiClient } from '@pomofocus/data-access';
import { useSessions, sessionsQueryOptions } from './use-sessions.js';

vi.mock('@pomofocus/data-access', () => ({
  getSessions: vi.fn(),
  createApiClient: vi.fn(() => ({})),
}));

const mockedGetSessions = vi.mocked(getSessions);

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient): (props: { children: ReactNode }) => ReactNode {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ApiClient resolves from openapi-fetch which uses complex generics.
// In tests, getSessions is mocked so the client is never called.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const mockClient = createApiClient('https://test.example.com');

const mockSession = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: 'user-1',
  process_goal_id: 'goal-1',
  intention_text: null,
  started_at: '2026-03-17T10:00:00Z',
  ended_at: '2026-03-17T10:25:00Z',
  completed: true,
  abandonment_reason: null,
  focus_quality: 'locked_in' as const,
  distraction_type: null,
  device_id: null,
  created_at: '2026-03-17T10:25:00Z',
};

describe('sessionsQueryOptions', () => {
  it('returns query options with correct query key', () => {
    const options = sessionsQueryOptions(mockClient);

    expect(options.queryKey).toEqual(['sessions']);
  });

  it('sets staleTime to 30_000 (PKG-S04)', () => {
    const options = sessionsQueryOptions(mockClient);

    expect(options.staleTime).toBe(30_000);
  });

  it('sets refetchInterval to 30_000 for polling', () => {
    const options = sessionsQueryOptions(mockClient);

    expect(options.refetchInterval).toBe(30_000);
  });

  it('includes a queryFn', () => {
    const options = sessionsQueryOptions(mockClient);

    expect(options.queryFn).toBeDefined();
    expect(typeof options.queryFn).toBe('function');
  });
});

describe('useSessions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockedGetSessions.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches sessions via data-access getSessions', async () => {
    const responseData = { data: [mockSession], total: 1 };
    mockedGetSessions.mockResolvedValue({ data: responseData, error: undefined });

    const { result } = renderHook(() => useSessions(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedGetSessions).toHaveBeenCalledWith(mockClient);
    expect(result.current.data).toEqual(responseData);
  });

  it('returns empty array when no sessions exist', async () => {
    const responseData = { data: [], total: 0 };
    mockedGetSessions.mockResolvedValue({ data: responseData, error: undefined });

    const { result } = renderHook(() => useSessions(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toEqual([]);
    expect(result.current.data?.total).toBe(0);
  });

  it('returns multiple sessions', async () => {
    const secondSession = {
      ...mockSession,
      id: '550e8400-e29b-41d4-a716-446655440001',
      started_at: '2026-03-17T10:30:00Z',
      ended_at: '2026-03-17T10:55:00Z',
      focus_quality: 'decent' as const,
    };
    const responseData = { data: [mockSession, secondSession], total: 2 };
    mockedGetSessions.mockResolvedValue({ data: responseData, error: undefined });

    const { result } = renderHook(() => useSessions(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
  });

  it('throws error when getSessions returns an error', async () => {
    mockedGetSessions.mockResolvedValue({
      data: undefined,
      error: { error: 'Server error' },
    });

    const { result } = renderHook(() => useSessions(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not store data in Zustand (PKG-S01) — data lives in TanStack Query cache', async () => {
    const responseData = { data: [mockSession], total: 1 };
    mockedGetSessions.mockResolvedValue({ data: responseData, error: undefined });

    const { result } = renderHook(() => useSessions(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify data is in query cache
    const cachedData = queryClient.getQueryData(['sessions']);
    expect(cachedData).toEqual(responseData);
  });
});
