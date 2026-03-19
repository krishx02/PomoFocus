import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerConfig, TimerState } from '@pomofocus/core';
import { TimerDisplay, formatTime } from './timer-display.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

// ── Mock useTimerStore ──

let mockTimerState: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };

vi.mock('@pomofocus/state', () => ({
  useTimerStore: (selector: (store: { state: TimerState }) => unknown) =>
    selector({ state: mockTimerState }),
}));

function setTimerState(state: TimerState): void {
  mockTimerState = state;
}

describe('TimerDisplay', () => {
  beforeEach(() => {
    setTimerState({ status: TIMER_STATUS.IDLE, config: defaultConfig });
  });

  afterEach(() => {
    cleanup();
  });

  describe('idle state', () => {
    it('displays default focus duration as 25:00', () => {
      render(<TimerDisplay />);

      expect(screen.getByText('25:00')).toBeDefined();
    });

    it('displays Ready status label', () => {
      render(<TimerDisplay />);

      expect(screen.getByText('Ready')).toBeDefined();
    });

    it('does not display session number', () => {
      render(<TimerDisplay />);

      expect(screen.queryByText(/Session/)).toBeNull();
    });
  });

  describe('focusing state', () => {
    it('displays time remaining formatted as mm:ss', () => {
      setTimerState({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1499,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('24:59')).toBeDefined();
    });

    it('displays Focusing status label', () => {
      setTimerState({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Focusing')).toBeDefined();
    });

    it('displays session number', () => {
      setTimerState({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 3,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Session 3')).toBeDefined();
    });
  });

  describe('paused state', () => {
    it('displays Paused status and time remaining', () => {
      setTimerState({
        status: TIMER_STATUS.PAUSED,
        timeRemaining: 720,
        pausedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Paused')).toBeDefined();
      expect(screen.getByText('12:00')).toBeDefined();
      expect(screen.getByText('Session 1')).toBeDefined();
    });
  });

  describe('short break state', () => {
    it('displays Short Break status and break time', () => {
      setTimerState({
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 299,
        startedAt: 3000,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Short Break')).toBeDefined();
      expect(screen.getByText('04:59')).toBeDefined();
    });
  });

  describe('long break state', () => {
    it('displays Long Break status and break time', () => {
      setTimerState({
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 900,
        startedAt: 4000,
        sessionNumber: 4,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Long Break')).toBeDefined();
      expect(screen.getByText('15:00')).toBeDefined();
      expect(screen.getByText('Session 4')).toBeDefined();
    });
  });

  describe('break paused state', () => {
    it('displays Break Paused status', () => {
      setTimerState({
        status: TIMER_STATUS.BREAK_PAUSED,
        timeRemaining: 200,
        pausedAt: 5000,
        breakType: 'short',
        sessionNumber: 2,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Break Paused')).toBeDefined();
      expect(screen.getByText('03:20')).toBeDefined();
      expect(screen.getByText('Session 2')).toBeDefined();
    });
  });

  describe('reflection state', () => {
    it('displays Reflection status and 00:00', () => {
      setTimerState({
        status: TIMER_STATUS.REFLECTION,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Reflection')).toBeDefined();
      expect(screen.getByText('00:00')).toBeDefined();
      expect(screen.getByText('Session 1')).toBeDefined();
    });
  });

  describe('completed state', () => {
    it('displays Completed status', () => {
      setTimerState({
        status: TIMER_STATUS.COMPLETED,
        sessionNumber: 1,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Completed')).toBeDefined();
      expect(screen.getByText('00:00')).toBeDefined();
    });
  });

  describe('abandoned state', () => {
    it('displays Abandoned status', () => {
      setTimerState({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: 6000,
        config: defaultConfig,
      });

      render(<TimerDisplay />);

      expect(screen.getByText('Abandoned')).toBeDefined();
      expect(screen.getByText('Session 1')).toBeDefined();
    });
  });

  describe('status labels for all states', () => {
    const cases: { status: TimerState; label: string }[] = [
      { status: { status: TIMER_STATUS.IDLE, config: defaultConfig }, label: 'Ready' },
      { status: { status: TIMER_STATUS.FOCUSING, timeRemaining: 1500, startedAt: 0, sessionNumber: 1, config: defaultConfig }, label: 'Focusing' },
      { status: { status: TIMER_STATUS.PAUSED, timeRemaining: 1500, pausedAt: 0, sessionNumber: 1, config: defaultConfig }, label: 'Paused' },
      { status: { status: TIMER_STATUS.SHORT_BREAK, timeRemaining: 300, startedAt: 0, sessionNumber: 1, config: defaultConfig }, label: 'Short Break' },
      { status: { status: TIMER_STATUS.LONG_BREAK, timeRemaining: 900, startedAt: 0, sessionNumber: 4, config: defaultConfig }, label: 'Long Break' },
      { status: { status: TIMER_STATUS.BREAK_PAUSED, timeRemaining: 200, pausedAt: 0, breakType: 'short', sessionNumber: 1, config: defaultConfig }, label: 'Break Paused' },
      { status: { status: TIMER_STATUS.REFLECTION, sessionNumber: 1, config: defaultConfig }, label: 'Reflection' },
      { status: { status: TIMER_STATUS.COMPLETED, sessionNumber: 1, config: defaultConfig }, label: 'Completed' },
      { status: { status: TIMER_STATUS.ABANDONED, sessionNumber: 1, abandonedAt: 0, config: defaultConfig }, label: 'Abandoned' },
    ];

    it.each(cases)('displays "$label" for $status.status', ({ status, label }) => {
      setTimerState(status);

      render(<TimerDisplay />);

      expect(screen.getByText(label)).toBeDefined();
    });
  });
});

describe('formatTime', () => {
  it('formats 1500 seconds as 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  it('formats 299 seconds as 04:59', () => {
    expect(formatTime(299)).toBe('04:59');
  });

  it('formats 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 3599 seconds as 59:59', () => {
    expect(formatTime(3599)).toBe('59:59');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('formats 1 second as 00:01', () => {
    expect(formatTime(1)).toBe('00:01');
  });
});
