import { describe, it, expect } from 'vitest';
import { transition } from './transition.js';
import { TIMER_STATUS, TIMER_EVENT_TYPE } from './types.js';
import type { TimerConfig, TimerState } from './types.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

describe('transition — START event', () => {
  it('transitions from idle to focusing with correct fields', () => {
    const idle: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const now = 1000;
    const result = transition(idle, { type: TIMER_EVENT_TYPE.START }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: defaultConfig.focusDuration,
      startedAt: now,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('uses custom focusDuration from config', () => {
    const customConfig: TimerConfig = {
      ...defaultConfig,
      focusDuration: 3000,
    };
    const idle: TimerState = { status: TIMER_STATUS.IDLE, config: customConfig };
    const now = 5000;
    const result = transition(idle, { type: TIMER_EVENT_TYPE.START }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: 3000,
      startedAt: now,
      sessionNumber: 1,
      config: customConfig,
    });
  });

  it('returns state unchanged when START from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 4000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — PAUSE event', () => {
  it('transitions from focusing to paused with pausedAt and same timeRemaining', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 2000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, now);
    expect(result).toEqual({
      status: 'paused',
      timeRemaining: 1200,
      pausedAt: now,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('preserves sessionNumber across pause', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 800,
      startedAt: 500,
      sessionNumber: 3,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 1500);
    expect(result).toEqual(
      expect.objectContaining({ sessionNumber: 3 }),
    );
  });

  it('returns state unchanged when PAUSE from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when PAUSE from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 2000);
    expect(result).toBe(state);
  });

  it('transitions from short_break to break_paused with breakType short', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, now);
    expect(result).toEqual({
      status: 'break_paused',
      timeRemaining: 300,
      pausedAt: now,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('transitions from long_break to break_paused with breakType long', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const now = 4000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, now);
    expect(result).toEqual({
      status: 'break_paused',
      timeRemaining: 900,
      pausedAt: now,
      breakType: 'long',
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('returns state unchanged when PAUSE from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when PAUSE from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when PAUSE from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — RESUME event', () => {
  it('transitions from paused to focusing with new startedAt and same timeRemaining', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 2000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: 900,
      startedAt: now,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('preserves sessionNumber across resume', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 600,
      pausedAt: 2000,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 3000);
    expect(result).toEqual(
      expect.objectContaining({ sessionNumber: 2 }),
    );
  });

  it('returns state unchanged when RESUME from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — TICK event', () => {
  it('decrements timeRemaining by 1 from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1500,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 2000);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: 1499,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('does not decrement timeRemaining below 0', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 2500);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 0 }),
    );
  });

  it('decrements from 1 to 0', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 2499);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 0 }),
    );
  });

  it('preserves startedAt and sessionNumber across tick', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1000,
      startedAt: 500,
      sessionNumber: 3,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 1500);
    expect(result).toEqual(
      expect.objectContaining({ startedAt: 500, sessionNumber: 3 }),
    );
  });

  it('returns state unchanged when TICK from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TICK from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 2000);
    expect(result).toBe(state);
  });

  it('decrements timeRemaining by 1 from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toEqual({
      status: 'short_break',
      timeRemaining: 299,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('decrements timeRemaining by 1 from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 4000);
    expect(result).toEqual({
      status: 'long_break',
      timeRemaining: 899,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('returns state unchanged when TICK from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TICK from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TICK from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — TIMER_DONE event', () => {
  it('transitions from focusing to short_break when isLongBreak is false (session 1)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 2500;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'short_break',
      timeRemaining: defaultConfig.shortBreakDuration,
      startedAt: now,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('transitions from focusing to short_break for session 2', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'short_break',
      timeRemaining: defaultConfig.shortBreakDuration,
      startedAt: now,
      sessionNumber: 2,
      config: defaultConfig,
    });
  });

  it('transitions from focusing to short_break for session 3', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 3,
      config: defaultConfig,
    };
    const now = 4000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'short_break',
      timeRemaining: defaultConfig.shortBreakDuration,
      startedAt: now,
      sessionNumber: 3,
      config: defaultConfig,
    });
  });

  it('transitions from focusing to long_break when isLongBreak is true (session 4)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const now = 5000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'long_break',
      timeRemaining: defaultConfig.longBreakDuration,
      startedAt: now,
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('preserves sessionNumber and config across TIMER_DONE transition', () => {
    const customConfig: TimerConfig = {
      ...defaultConfig,
      shortBreakDuration: 600,
    };
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 1,
      config: customConfig,
    };
    const now = 2000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual(
      expect.objectContaining({
        sessionNumber: 1,
        config: customConfig,
        timeRemaining: 600,
      }),
    );
  });

  it('sets startedAt to now for break state', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 0,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 9999;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual(
      expect.objectContaining({ startedAt: now }),
    );
  });

  it('returns state unchanged when TIMER_DONE from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TIMER_DONE from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 2000);
    expect(result).toBe(state);
  });

  it('transitions from short_break to reflection when reflectionEnabled', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 0,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 3000);
    expect(result).toEqual({
      status: 'reflection',
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('transitions from short_break to focusing with sessionNumber + 1 when reflection disabled', () => {
    const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 0,
      startedAt: 2500,
      sessionNumber: 1,
      config: noReflectionConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: noReflectionConfig.focusDuration,
      startedAt: now,
      sessionNumber: 2,
      config: noReflectionConfig,
    });
  });

  it('transitions from long_break to reflection when reflectionEnabled', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 0,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 4000);
    expect(result).toEqual({
      status: 'reflection',
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('transitions from long_break to focusing with sessionNumber + 1 when reflection disabled', () => {
    const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 0,
      startedAt: 3000,
      sessionNumber: 4,
      config: noReflectionConfig,
    };
    const now = 4000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: noReflectionConfig.focusDuration,
      startedAt: now,
      sessionNumber: 5,
      config: noReflectionConfig,
    });
  });

  it('returns state unchanged when TIMER_DONE from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TIMER_DONE from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TIMER_DONE from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TIMER_DONE from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — PAUSE from break states', () => {
  it('preserves timeRemaining when pausing short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 150,
      startedAt: 2000,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 2500);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 150, sessionNumber: 2 }),
    );
  });

  it('preserves timeRemaining when pausing long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 450,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 3500);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 450, sessionNumber: 4 }),
    );
  });

  it('returns state unchanged when PAUSE from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 3000);
    expect(result).toBe(state);
  });
});

describe('transition — RESUME from break_paused', () => {
  it('resumes to short_break when breakType is short', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, now);
    expect(result).toEqual({
      status: 'short_break',
      timeRemaining: 200,
      startedAt: now,
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('resumes to long_break when breakType is long', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 600,
      pausedAt: 4000,
      breakType: 'long',
      sessionNumber: 4,
      config: defaultConfig,
    };
    const now = 5000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, now);
    expect(result).toEqual({
      status: 'long_break',
      timeRemaining: 600,
      startedAt: now,
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('preserves timeRemaining across pause/resume cycle', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 123,
      pausedAt: 5000,
      breakType: 'short',
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 6000);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 123 }),
    );
  });

  it('returns state unchanged when RESUME from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 4000);
    expect(result).toBe(state);
  });
});

describe('transition — TICK from break states', () => {
  it('does not decrement short_break timeRemaining below 0', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 0,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 0 }),
    );
  });

  it('does not decrement long_break timeRemaining below 0', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 0,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 4000);
    expect(result).toEqual(
      expect.objectContaining({ timeRemaining: 0 }),
    );
  });

  it('preserves startedAt and sessionNumber across short_break tick', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 200,
      startedAt: 2500,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toEqual(
      expect.objectContaining({ startedAt: 2500, sessionNumber: 2 }),
    );
  });

  it('preserves startedAt and sessionNumber across long_break tick', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 800,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 4000);
    expect(result).toEqual(
      expect.objectContaining({ startedAt: 3000, sessionNumber: 4 }),
    );
  });

  it('returns state unchanged when TICK from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TICK from break_paused (long)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 600,
      pausedAt: 4000,
      breakType: 'long',
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 5000);
    expect(result).toBe(state);
  });
});

describe('transition — SKIP_BREAK event', () => {
  it('transitions from short_break to reflection when reflectionEnabled', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 200,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 3000);
    expect(result).toEqual({
      status: 'reflection',
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('transitions from long_break to reflection when reflectionEnabled', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 600,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 4000);
    expect(result).toEqual({
      status: 'reflection',
      sessionNumber: 4,
      config: defaultConfig,
    });
  });

  it('transitions from break_paused to reflection when reflectionEnabled', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 3000);
    expect(result).toEqual({
      status: 'reflection',
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('transitions from short_break to focusing with sessionNumber + 1 when reflection disabled', () => {
    const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 200,
      startedAt: 2500,
      sessionNumber: 1,
      config: noReflectionConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: noReflectionConfig.focusDuration,
      startedAt: now,
      sessionNumber: 2,
      config: noReflectionConfig,
    });
  });

  it('transitions from long_break to focusing with sessionNumber + 1 when reflection disabled', () => {
    const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 600,
      startedAt: 3000,
      sessionNumber: 4,
      config: noReflectionConfig,
    };
    const now = 4000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: noReflectionConfig.focusDuration,
      startedAt: now,
      sessionNumber: 5,
      config: noReflectionConfig,
    });
  });

  it('transitions from break_paused to focusing with sessionNumber + 1 when reflection disabled', () => {
    const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'long',
      sessionNumber: 4,
      config: noReflectionConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, now);
    expect(result).toEqual({
      status: 'focusing',
      timeRemaining: noReflectionConfig.focusDuration,
      startedAt: now,
      sessionNumber: 5,
      config: noReflectionConfig,
    });
  });

  it('returns state unchanged when SKIP_BREAK from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — unhandled events return state unchanged', () => {
  it('returns idle state unchanged for non-START events', () => {
    const idle: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const now = 1000;
    expect(transition(idle, { type: TIMER_EVENT_TYPE.PAUSE }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.RESUME }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.TICK }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.TIMER_DONE }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.SKIP }, now)).toBe(idle);
    expect(
      transition(
        idle,
        { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'locked_in' } },
        now,
      ),
    ).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.ABANDON }, now)).toBe(idle);
    expect(transition(idle, { type: TIMER_EVENT_TYPE.RESET }, now)).toBe(idle);
  });
});
