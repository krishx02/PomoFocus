import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerConfig } from '@pomofocus/core';
import { createSession, getSessions, createApiClient } from '@pomofocus/data-access';
import { createTimerStore } from './timer/timer-store.js';
import { startTimer, stopTimer } from './timer/timer-driver.js';
import { useSessions } from './hooks/use-sessions.js';
import { useCreateSession } from './hooks/use-create-session.js';

vi.mock('@pomofocus/data-access', () => ({
  getSessions: vi.fn(),
  createSession: vi.fn(),
  createApiClient: vi.fn(() => ({})),
}));

const mockedGetSessions = vi.mocked(getSessions);
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

const mockClient = createApiClient('https://test.example.com');

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

describe('state package integration', () => {
  describe('timer store + driver', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
    });

    afterEach(() => {
      stopTimer();
      vi.useRealTimers();
    });

    it('start → tick → verify state changes → pause → resume → abandon lifecycle', () => {
      const config: TimerConfig = {
        focusDuration: 10,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        reflectionEnabled: true,
      };
      const store = createTimerStore(config);

      // Initial state is idle
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);

      // Start the timer and attach the driver
      store.getState().start();
      startTimer(store);

      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);
      const stateAfterStart = store.getState().state;
      if (stateAfterStart.status === TIMER_STATUS.FOCUSING) {
        expect(stateAfterStart.timeRemaining).toBe(10);
        expect(stateAfterStart.sessionNumber).toBe(1);
      }

      // Advance 3 seconds — driver ticks 3 times
      vi.advanceTimersByTime(3000);

      const stateAfterTicks = store.getState().state;
      expect(stateAfterTicks.status).toBe(TIMER_STATUS.FOCUSING);
      if (stateAfterTicks.status === TIMER_STATUS.FOCUSING) {
        expect(stateAfterTicks.timeRemaining).toBe(7);
      }

      // Pause — ticks should stop
      store.getState().pause();
      expect(store.getState().state.status).toBe(TIMER_STATUS.PAUSED);

      vi.advanceTimersByTime(5000);
      const stateWhilePaused = store.getState().state;
      if (stateWhilePaused.status === TIMER_STATUS.PAUSED) {
        expect(stateWhilePaused.timeRemaining).toBe(7);
      }

      // Resume — ticks restart
      store.getState().resume();
      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);

      vi.advanceTimersByTime(2000);
      const stateAfterResume = store.getState().state;
      if (stateAfterResume.status === TIMER_STATUS.FOCUSING) {
        expect(stateAfterResume.timeRemaining).toBe(5);
      }

      // Abandon the session
      store.getState().abandon();
      expect(store.getState().state.status).toBe(TIMER_STATUS.ABANDONED);

      // Verify ticks stop after abandon
      vi.advanceTimersByTime(5000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.ABANDONED);

      // Reset back to idle
      store.getState().reset();
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);
    });

    it('full focus cycle: TIMER_DONE → break → reflection → completed', () => {
      const config: TimerConfig = {
        focusDuration: 3,
        shortBreakDuration: 2,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        reflectionEnabled: true,
      };
      const store = createTimerStore(config);

      store.getState().start();
      startTimer(store);

      // Advance 3 seconds — focus finishes, TIMER_DONE dispatched → short_break
      vi.advanceTimersByTime(3000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.SHORT_BREAK);

      // Advance 2 seconds — break finishes, TIMER_DONE dispatched → reflection
      vi.advanceTimersByTime(2000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.REFLECTION);

      // Submit reflection → completed
      store.getState().submitReflection({
        focusQuality: 'locked_in',
        distractionType: 'phone',
      });
      expect(store.getState().state.status).toBe(TIMER_STATUS.COMPLETED);

      // Reset
      store.getState().reset();
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);
    });
  });

  describe('session hooks + timer store', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = createTestQueryClient();
      mockedGetSessions.mockReset();
      mockedCreateSession.mockReset();
    });

    afterEach(() => {
      queryClient.clear();
    });

    it('create session mutation invalidates sessions query cache', async () => {
      // Seed sessions query with initial data
      const initialSessions = { data: [], total: 0 };
      mockedGetSessions.mockResolvedValue({ data: initialSessions, error: undefined });

      const wrapper = createWrapper(queryClient);

      // Render useSessions hook — fetches initial data
      const { result: sessionsResult } = renderHook(
        () => useSessions(mockClient),
        { wrapper },
      );

      await waitFor(() => {
        expect(sessionsResult.current.isSuccess).toBe(true);
      });

      expect(sessionsResult.current.data).toEqual(initialSessions);
      expect(mockedGetSessions).toHaveBeenCalledTimes(1);

      // Set up mock for the refetch after invalidation — now returns the new session
      const updatedSessions = { data: [mockSessionResponse], total: 1 };
      mockedGetSessions.mockResolvedValue({ data: updatedSessions, error: undefined });

      // Set up create session mock
      mockedCreateSession.mockResolvedValue({
        data: mockSessionResponse,
        error: undefined,
      });

      // Render useCreateSession hook
      const { result: createResult } = renderHook(
        () => useCreateSession(mockClient),
        { wrapper },
      );

      // Mutate — creates a session
      act(() => {
        createResult.current.mutate({
          started_at: '2026-03-17T10:00:00Z',
          ended_at: '2026-03-17T10:25:00Z',
          focus_quality: 'locked_in',
        });
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      // The mutation's onSuccess should have invalidated the sessions query,
      // causing a refetch. Verify getSessions was called again.
      await waitFor(() => {
        expect(mockedGetSessions).toHaveBeenCalledTimes(2);
      });

      // Sessions query should now return the updated data
      await waitFor(() => {
        expect(sessionsResult.current.data).toEqual(updatedSessions);
      });
    });

    it('end-to-end: timer runs focus session, then session is persisted via mutation, cache is invalidated', async () => {
      // --- Phase 1: Run a focus session using timer store + driver (fake timers) ---
      vi.useFakeTimers();
      vi.setSystemTime(1000);

      const config: TimerConfig = {
        focusDuration: 2,
        shortBreakDuration: 1,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        reflectionEnabled: false,
      };
      const store = createTimerStore(config);

      store.getState().start();
      startTimer(store);

      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);

      // Run through focus
      vi.advanceTimersByTime(2000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.SHORT_BREAK);

      // Skip the break (reflection disabled → goes directly to next focusing)
      store.getState().skipBreak();
      const stateAfterSkip = store.getState().state;
      expect(stateAfterSkip.status).toBe(TIMER_STATUS.FOCUSING);
      if (stateAfterSkip.status === TIMER_STATUS.FOCUSING) {
        expect(stateAfterSkip.sessionNumber).toBe(2);
      }

      // Stop the driver and switch back to real timers for React hook testing
      stopTimer();
      vi.useRealTimers();

      // --- Phase 2: Persist the completed session via mutation ---
      const initialSessions = { data: [], total: 0 };
      mockedGetSessions.mockResolvedValue({ data: initialSessions, error: undefined });

      mockedCreateSession.mockResolvedValue({
        data: mockSessionResponse,
        error: undefined,
      });

      const wrapper = createWrapper(queryClient);

      // Fetch current sessions
      const { result: sessionsResult } = renderHook(
        () => useSessions(mockClient),
        { wrapper },
      );

      await waitFor(() => {
        expect(sessionsResult.current.isSuccess).toBe(true);
      });

      expect(sessionsResult.current.data?.total).toBe(0);

      // Update mock for refetch
      const updatedSessions = { data: [mockSessionResponse], total: 1 };
      mockedGetSessions.mockResolvedValue({ data: updatedSessions, error: undefined });

      // Create session mutation
      const { result: createResult } = renderHook(
        () => useCreateSession(mockClient),
        { wrapper },
      );

      act(() => {
        createResult.current.mutate({
          started_at: '2026-03-17T10:00:00Z',
          ended_at: '2026-03-17T10:25:00Z',
          focus_quality: 'locked_in',
        });
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });

      // Verify cache invalidation caused a refetch with updated data
      await waitFor(() => {
        expect(sessionsResult.current.data?.total).toBe(1);
      });

      expect(sessionsResult.current.data?.data).toHaveLength(1);
    });
  });
});
