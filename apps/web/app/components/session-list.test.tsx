import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionList } from './session-list';

vi.mock('@pomofocus/state', () => ({
  useSessions: vi.fn(),
}));

const { useSessions } = await import('@pomofocus/state');
const mockedUseSessions = vi.mocked(useSessions);

type SessionsResult = ReturnType<typeof useSessions>;

function mockQueryResult(
  overrides: Partial<SessionsResult>,
): SessionsResult {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isPending: true,
    isLoadingError: false,
    isRefetchError: false,
    isStale: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isFetching: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetching: false,
    isInitialLoading: false,
    status: 'pending',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: vi.fn(),
    promise: Promise.resolve({} as NonNullable<SessionsResult['data']>),
    ...overrides,
  } as SessionsResult;
}

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

const mockClient = {} as Parameters<typeof useSessions>[0];

describe('SessionList', () => {
  beforeEach(() => {
    mockedUseSessions.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state while sessions are being fetched', () => {
    mockedUseSessions.mockReturnValue(
      mockQueryResult({ isLoading: true, isPending: true, status: 'pending' }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('Loading sessions...')).toBeDefined();
  });

  it('shows empty state when no sessions exist', () => {
    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isSuccess: true,
        isPending: false,
        status: 'success',
        data: { data: [], total: 0 },
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('No sessions yet')).toBeDefined();
  });

  it('shows error state when query fails', () => {
    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isError: true,
        isPending: false,
        status: 'error',
        error: new Error('Network failure'),
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('Failed to load sessions')).toBeDefined();
  });

  it('renders session list with duration, start time, and focus quality', () => {
    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isSuccess: true,
        isPending: false,
        status: 'success',
        data: { data: [mockSession], total: 1 },
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('25m')).toBeDefined();
    expect(screen.getByText(/Mar 17, 2026/)).toBeDefined();
    expect(screen.getByText('locked_in')).toBeDefined();
  });

  it('renders multiple sessions', () => {
    const secondSession = {
      ...mockSession,
      id: '550e8400-e29b-41d4-a716-446655440001',
      started_at: '2026-03-17T11:00:00Z',
      ended_at: '2026-03-17T11:45:00Z',
      focus_quality: 'decent' as const,
    };

    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isSuccess: true,
        isPending: false,
        status: 'success',
        data: { data: [mockSession, secondSession], total: 2 },
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('25m')).toBeDefined();
    expect(screen.getByText('45m')).toBeDefined();
    expect(screen.getByText('locked_in')).toBeDefined();
    expect(screen.getByText('decent')).toBeDefined();
  });

  it('displays focus quality only when available', () => {
    const sessionWithoutQuality = {
      ...mockSession,
      focus_quality: null,
    };

    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isSuccess: true,
        isPending: false,
        status: 'success',
        data: { data: [sessionWithoutQuality], total: 1 },
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('25m')).toBeDefined();
    expect(screen.queryByText('locked_in')).toBeNull();
    expect(screen.queryByText('decent')).toBeNull();
    expect(screen.queryByText('struggled')).toBeNull();
  });

  it('handles session with no ended_at (in-progress)', () => {
    const inProgressSession = {
      ...mockSession,
      ended_at: null,
      completed: false,
    };

    mockedUseSessions.mockReturnValue(
      mockQueryResult({
        isSuccess: true,
        isPending: false,
        status: 'success',
        data: { data: [inProgressSession], total: 1 },
      }),
    );

    render(<SessionList client={mockClient} />);

    expect(screen.getByText('In progress')).toBeDefined();
  });

  it('passes client to useSessions hook', () => {
    mockedUseSessions.mockReturnValue(
      mockQueryResult({ isLoading: true, isPending: true, status: 'pending' }),
    );

    render(<SessionList client={mockClient} />);

    expect(mockedUseSessions).toHaveBeenCalledWith(mockClient);
  });
});
