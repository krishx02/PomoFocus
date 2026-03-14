import { describe, it, expect } from 'vitest';
import { createInitialState, isRunning, getTimeRemaining } from './utils.js';
import { TIMER_STATUS } from './types.js';
import type { TimerConfig, TimerState } from './types.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

describe('createInitialState', () => {
  it('returns idle state with the provided config', () => {
    const state = createInitialState(defaultConfig);
    expect(state).toEqual({ status: 'idle', config: defaultConfig });
  });

  it('preserves custom config values', () => {
    const customConfig: TimerConfig = {
      focusDuration: 3000,
      shortBreakDuration: 600,
      longBreakDuration: 1800,
      sessionsBeforeLongBreak: 2,
      reflectionEnabled: false,
    };
    const state = createInitialState(customConfig);
    expect(state).toEqual({ status: 'idle', config: customConfig });
  });
});

describe('isRunning', () => {
  it('returns false for idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    expect(isRunning(state)).toBe(false);
  });

  it('returns true for focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1500,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(true);
  });

  it('returns false for paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(false);
  });

  it('returns true for short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(true);
  });

  it('returns true for long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(true);
  });

  it('returns false for break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(false);
  });

  it('returns false for reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(isRunning(state)).toBe(false);
  });

  it('returns false for completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    expect(isRunning(state)).toBe(false);
  });

  it('returns false for abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    expect(isRunning(state)).toBe(false);
  });
});

describe('getTimeRemaining', () => {
  it('returns 0 for idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    expect(getTimeRemaining(state)).toBe(0);
  });

  it('returns timeRemaining for focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1234,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(1234);
  });

  it('returns timeRemaining for paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 567,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(567);
  });

  it('returns timeRemaining for short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 250,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(250);
  });

  it('returns timeRemaining for long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 800,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(800);
  });

  it('returns timeRemaining for break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 150,
      pausedAt: 2700,
      breakType: 'long',
      sessionNumber: 4,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(150);
  });

  it('returns 0 for reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    expect(getTimeRemaining(state)).toBe(0);
  });

  it('returns 0 for completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    expect(getTimeRemaining(state)).toBe(0);
  });

  it('returns 0 for abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    expect(getTimeRemaining(state)).toBe(0);
  });
});
