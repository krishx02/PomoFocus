import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerConfig, TimerState } from '@pomofocus/core';
import { TimerControls } from './timer-controls.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

// ── Mock store actions ──

const mockStart = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockAbandon = vi.fn();
const mockReset = vi.fn();

let mockTimerState: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };

// ── Mock useCreateSession ──

const mockMutate = vi.fn();

vi.mock('@pomofocus/state', () => ({
  useTimerStore: (selector: (store: Record<string, unknown>) => unknown) =>
    selector({
      state: mockTimerState,
      start: mockStart,
      pause: mockPause,
      resume: mockResume,
      abandon: mockAbandon,
      reset: mockReset,
    }),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  useCreateSession: () => ({
    mutate: mockMutate,
    mutateAsync: vi.fn(),
    isIdle: true,
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('@pomofocus/data-access', () => ({
  createApiClient: vi.fn(() => ({})),
}));

function setTimerState(state: TimerState): void {
  mockTimerState = state;
}

describe('TimerControls', () => {
  beforeEach(() => {
    setTimerState({ status: TIMER_STATUS.IDLE, config: defaultConfig });
    mockStart.mockReset();
    mockPause.mockReset();
    mockResume.mockReset();
    mockAbandon.mockReset();
    mockReset.mockReset();
    mockMutate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Idle state ──

  describe('idle state', () => {
    it('shows Start button', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Start' })).toBeDefined();
    });

    it('does not show Pause, Resume, Abandon, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Abandon' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });

    it('calls start action when Start is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Start' }));

      expect(mockStart).toHaveBeenCalledOnce();
    });
  });

  // ── Focusing state ──

  describe('focusing state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1400,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      });
    });

    it('shows Pause and Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });

    it('does not show Start, Resume, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });

    it('calls pause action when Pause is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

      expect(mockPause).toHaveBeenCalledOnce();
    });

    it('calls abandon action when Abandon is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Abandon' }));

      expect(mockAbandon).toHaveBeenCalledOnce();
    });
  });

  // ── Paused state ──

  describe('paused state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.PAUSED,
        timeRemaining: 1200,
        pausedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      });
    });

    it('shows Resume and Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });

    it('does not show Start, Pause, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });

    it('calls resume action when Resume is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

      expect(mockResume).toHaveBeenCalledOnce();
    });
  });

  // ── Short break state ──

  describe('short break state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 250,
        startedAt: 3000,
        sessionNumber: 1,
        config: defaultConfig,
      });
    });

    it('shows Pause and Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });

    it('does not show Start, Resume, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });
  });

  // ── Long break state ──

  describe('long break state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 800,
        startedAt: 4000,
        sessionNumber: 4,
        config: defaultConfig,
      });
    });

    it('shows Pause and Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });

    it('does not show Start, Resume, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });
  });

  // ── Break paused state ──

  describe('break paused state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.BREAK_PAUSED,
        timeRemaining: 150,
        pausedAt: 5000,
        breakType: 'short',
        sessionNumber: 2,
        config: defaultConfig,
      });
    });

    it('shows Resume and Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });

    it('does not show Start, Pause, or Reset buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });

    it('calls resume action when Resume is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

      expect(mockResume).toHaveBeenCalledOnce();
    });
  });

  // ── Reflection state ──

  describe('reflection state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.REFLECTION,
        sessionNumber: 1,
        config: defaultConfig,
      });
    });

    it('does not show any control buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Abandon' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    });
  });

  // ── Completed state ──

  describe('completed state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.COMPLETED,
        sessionNumber: 1,
        config: defaultConfig,
      });
    });

    it('shows Reset button', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
    });

    it('does not show Start, Pause, Resume, or Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Abandon' })).toBeNull();
    });

    it('calls reset action when Reset is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

      expect(mockReset).toHaveBeenCalledOnce();
    });
  });

  // ── Abandoned state ──

  describe('abandoned state', () => {
    beforeEach(() => {
      setTimerState({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: 6000,
        config: defaultConfig,
      });
    });

    it('shows Reset button', () => {
      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
    });

    it('does not show Start, Pause, Resume, or Abandon buttons', () => {
      render(<TimerControls />);

      expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Abandon' })).toBeNull();
    });

    it('calls reset action when Reset is pressed', () => {
      render(<TimerControls />);

      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

      expect(mockReset).toHaveBeenCalledOnce();
    });
  });

  // ── Session save on complete ──

  describe('session save on complete', () => {
    it('calls useCreateSession mutate when state transitions to completed', () => {
      setTimerState({
        status: TIMER_STATUS.COMPLETED,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerControls />);

      expect(mockMutate).toHaveBeenCalledOnce();
    });

    it('does not call mutate in non-completed states', () => {
      setTimerState({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1400,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerControls />);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('does not call mutate in abandoned state', () => {
      setTimerState({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: 6000,
        config: defaultConfig,
      });

      render(<TimerControls />);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  // ── Abandon in all active states ──

  describe('abandon button in all active states', () => {
    const activeStates: { name: string; state: TimerState }[] = [
      {
        name: 'focusing',
        state: {
          status: TIMER_STATUS.FOCUSING,
          timeRemaining: 1400,
          startedAt: 1000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'paused',
        state: {
          status: TIMER_STATUS.PAUSED,
          timeRemaining: 1200,
          pausedAt: 2000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'short_break',
        state: {
          status: TIMER_STATUS.SHORT_BREAK,
          timeRemaining: 250,
          startedAt: 3000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      },
      {
        name: 'long_break',
        state: {
          status: TIMER_STATUS.LONG_BREAK,
          timeRemaining: 800,
          startedAt: 4000,
          sessionNumber: 4,
          config: defaultConfig,
        },
      },
      {
        name: 'break_paused',
        state: {
          status: TIMER_STATUS.BREAK_PAUSED,
          timeRemaining: 150,
          pausedAt: 5000,
          breakType: 'short',
          sessionNumber: 2,
          config: defaultConfig,
        },
      },
    ];

    it.each(activeStates)('shows Abandon button in $name state', ({ state }) => {
      setTimerState(state);

      render(<TimerControls />);

      expect(screen.getByRole('button', { name: 'Abandon' })).toBeDefined();
    });
  });
});
