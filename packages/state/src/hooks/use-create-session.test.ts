import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createSession, createApiClient } from '@pomofocus/data-access';
import { useCreateSession } from './use-create-session.js';

vi.mock('@pomofocus/data-access', () => ({
  createSession: vi.fn(),
  createApiClient: vi.fn(() => ({})),
}));

const mockedCreateSession = vi.mocked(createSession);

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
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
// In tests, createSession is mocked so the client is never called.
const mockClient = createApiClient('https://test.example.com');

const mockSessionBody = {
  started_at: '2026-03-17T10:00:00Z',
  ended_at: '2026-03-17T10:25:00Z',
  focus_quality: 'locked_in' as const,
};

const mockSessionResponse = {
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

describe('useCreateSession', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockedCreateSession.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls createSession from data-access with the provided body', async () => {
    mockedCreateSession.mockResolvedValue({
      data: mockSessionResponse,
      error: undefined,
    });

    const { result } = renderHook(() => useCreateSession(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(mockSessionBody);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedCreateSession).toHaveBeenCalledWith(mockClient, mockSessionBody);
  });

  it('returns created session data on success', async () => {
    mockedCreateSession.mockResolvedValue({
      data: mockSessionResponse,
      error: undefined,
    });

    const { result } = renderHook(() => useCreateSession(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(mockSessionBody);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSessionResponse);
  });

  it('invalidates sessions query cache on success (PKG-S07)', async () => {
    // Seed the sessions query cache so we can verify invalidation
    queryClient.setQueryData(['sessions'], { data: [], total: 0 });

    mockedCreateSession.mockResolvedValue({
      data: mockSessionResponse,
      error: undefined,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSession(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(mockSessionBody);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['sessions'] });

    invalidateQueriesSpy.mockRestore();
  });

  it('sets error state when createSession returns an error', async () => {
    mockedCreateSession.mockResolvedValue({
      data: undefined,
      error: { error: 'Validation error' },
    });

    const { result } = renderHook(() => useCreateSession(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(mockSessionBody);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not invalidate sessions cache on error', async () => {
    mockedCreateSession.mockResolvedValue({
      data: undefined,
      error: { error: 'Server error' },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSession(mockClient), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(mockSessionBody);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();

    invalidateQueriesSpy.mockRestore();
  });
});
