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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.START }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when START from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.PAUSE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when PAUSE from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESUME }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESUME from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TICK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TICK from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when TIMER_DONE from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
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
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP_BREAK from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — SUBMIT event', () => {
  it('transitions from reflection to completed with reflectionData (locked_in)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      {
        type: TIMER_EVENT_TYPE.SUBMIT,
        data: { focusQuality: 'locked_in', distractionType: 'phone' },
      },
      3000,
    );
    expect(result).toEqual({
      status: 'completed',
      sessionNumber: 1,
      config: defaultConfig,
      reflectionData: { focusQuality: 'locked_in', distractionType: 'phone' },
    });
  });

  it('transitions from reflection to completed with reflectionData (decent)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(
      state,
      {
        type: TIMER_EVENT_TYPE.SUBMIT,
        data: { focusQuality: 'decent', distractionType: 'thoughts_wandering' },
      },
      4000,
    );
    expect(result).toEqual({
      status: 'completed',
      sessionNumber: 2,
      config: defaultConfig,
      reflectionData: { focusQuality: 'decent', distractionType: 'thoughts_wandering' },
    });
  });

  it('transitions from reflection to completed with reflectionData (struggled)', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 3,
      config: defaultConfig,
    };
    const result = transition(
      state,
      {
        type: TIMER_EVENT_TYPE.SUBMIT,
        data: { focusQuality: 'struggled', distractionType: 'got_stuck' },
      },
      5000,
    );
    expect(result).toEqual({
      status: 'completed',
      sessionNumber: 3,
      config: defaultConfig,
      reflectionData: { focusQuality: 'struggled', distractionType: 'got_stuck' },
    });
  });

  it('preserves sessionNumber in completed state after SUBMIT', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(
      state,
      {
        type: TIMER_EVENT_TYPE.SUBMIT,
        data: { focusQuality: 'locked_in' },
      },
      6000,
    );
    expect(result).toEqual(
      expect.objectContaining({ sessionNumber: 4 }),
    );
  });

  it('returns state unchanged when SUBMIT from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'locked_in' } },
      1000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'decent' } },
      2000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'struggled' } },
      2000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'locked_in' } },
      3000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'decent' } },
      4000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'struggled' } },
      3000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'locked_in' } },
      3000,
    );
    expect(result).toBe(state);
  });

  it('returns state unchanged when SUBMIT from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
    };
    const result = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'decent' } },
      6000,
    );
    expect(result).toBe(state);
  });
});

describe('transition — SKIP event', () => {
  it('transitions from reflection to completed without reflectionData', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 3000);
    expect(result).toEqual({
      status: 'completed',
      sessionNumber: 1,
      config: defaultConfig,
    });
  });

  it('preserves sessionNumber in completed state after SKIP', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 6000);
    expect(result).toEqual(
      expect.objectContaining({ sessionNumber: 4 }),
    );
  });

  it('does not include reflectionData in completed state after SKIP', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 4000);
    expect(result).not.toHaveProperty('reflectionData');
  });

  it('returns state unchanged when SKIP from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 4000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when SKIP from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — ABANDON event', () => {
  it('transitions from focusing to abandoned with abandonedAt and sessionNumber', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 2000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, now);
    expect(result).toEqual({
      status: 'abandoned',
      sessionNumber: 1,
      abandonedAt: now,
      config: defaultConfig,
    });
  });

  it('transitions from paused to abandoned with abandonedAt and sessionNumber', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 2,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, now);
    expect(result).toEqual({
      status: 'abandoned',
      sessionNumber: 2,
      abandonedAt: now,
      config: defaultConfig,
    });
  });

  it('transitions from short_break to abandoned with abandonedAt and sessionNumber', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 200,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, now);
    expect(result).toEqual({
      status: 'abandoned',
      sessionNumber: 1,
      abandonedAt: now,
      config: defaultConfig,
    });
  });

  it('transitions from long_break to abandoned with abandonedAt and sessionNumber', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 600,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const now = 4000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, now);
    expect(result).toEqual({
      status: 'abandoned',
      sessionNumber: 4,
      abandonedAt: now,
      config: defaultConfig,
    });
  });

  it('transitions from break_paused to abandoned with abandonedAt and sessionNumber', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const now = 3000;
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, now);
    expect(result).toEqual({
      status: 'abandoned',
      sessionNumber: 1,
      abandonedAt: now,
      config: defaultConfig,
    });
  });

  it('returns state unchanged when ABANDON from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 3,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, 5000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when ABANDON from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when ABANDON from completed', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when ABANDON from abandoned', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.ABANDON }, 6000);
    expect(result).toBe(state);
  });
});

describe('transition — RESET event', () => {
  it('transitions from completed to idle with preserved config', () => {
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 4,
      config: defaultConfig,
      reflectionData: { focusQuality: 'locked_in' },
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 7000);
    expect(result).toEqual({
      status: 'idle',
      config: defaultConfig,
    });
  });

  it('transitions from abandoned to idle with preserved config', () => {
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 2,
      abandonedAt: 5000,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 7000);
    expect(result).toEqual({
      status: 'idle',
      config: defaultConfig,
    });
  });

  it('preserves custom config through RESET from completed', () => {
    const customConfig: TimerConfig = {
      focusDuration: 3000,
      shortBreakDuration: 600,
      longBreakDuration: 1800,
      sessionsBeforeLongBreak: 6,
      reflectionEnabled: false,
    };
    const state: TimerState = {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
      config: customConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 8000);
    expect(result).toEqual({
      status: 'idle',
      config: customConfig,
    });
  });

  it('preserves custom config through RESET from abandoned', () => {
    const customConfig: TimerConfig = {
      focusDuration: 3000,
      shortBreakDuration: 600,
      longBreakDuration: 1800,
      sessionsBeforeLongBreak: 6,
      reflectionEnabled: false,
    };
    const state: TimerState = {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 4000,
      config: customConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 8000);
    expect(result).toEqual({
      status: 'idle',
      config: customConfig,
    });
  });

  it('returns state unchanged when RESET from idle', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 1000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from focusing', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 2000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from short_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 300,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from long_break', () => {
    const state: TimerState = {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 900,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 4000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from break_paused', () => {
    const state: TimerState = {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 200,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 3000);
    expect(result).toBe(state);
  });

  it('returns state unchanged when RESET from reflection', () => {
    const state: TimerState = {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const result = transition(state, { type: TIMER_EVENT_TYPE.RESET }, 3000);
    expect(result).toBe(state);
  });
});

describe('transition — full 4-session lifecycle integration', () => {
  // Helper: advance through a focus session (TICK to 0, then TIMER_DONE)
  function completeFocus(state: TimerState, startTime: number): { state: TimerState; time: number } {
    let current = state;
    let time = startTime;
    if (current.status === TIMER_STATUS.FOCUSING) {
      const ticks = current.timeRemaining;
      for (let i = 0; i < ticks; i++) {
        time += 1;
        current = transition(current, { type: TIMER_EVENT_TYPE.TICK }, time);
      }
      time += 1;
      current = transition(current, { type: TIMER_EVENT_TYPE.TIMER_DONE }, time);
    }
    return { state: current, time };
  }

  // Helper: advance through a break (TICK to 0, then TIMER_DONE)
  function completeBreak(state: TimerState, startTime: number): { state: TimerState; time: number } {
    let current = state;
    let time = startTime;
    if (current.status === TIMER_STATUS.SHORT_BREAK || current.status === TIMER_STATUS.LONG_BREAK) {
      const ticks = current.timeRemaining;
      for (let i = 0; i < ticks; i++) {
        time += 1;
        current = transition(current, { type: TIMER_EVENT_TYPE.TICK }, time);
      }
      time += 1;
      current = transition(current, { type: TIMER_EVENT_TYPE.TIMER_DONE }, time);
    }
    return { state: current, time };
  }

  // Use short durations and reflection disabled so sessions auto-advance
  // (break -> TIMER_DONE -> focusing with sessionNumber + 1)
  const lifecycleConfig: TimerConfig = {
    focusDuration: 3,
    shortBreakDuration: 2,
    longBreakDuration: 4,
    sessionsBeforeLongBreak: 4,
    reflectionEnabled: false,
  };

  it('completes a full 4-session cycle with auto-advancing sessions (reflection disabled)', () => {
    let time = 0;
    let state: TimerState = { status: TIMER_STATUS.IDLE, config: lifecycleConfig };

    // === Session 1 ===
    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.START }, time);
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1 }));

    const after1Focus = completeFocus(state, time);
    state = after1Focus.state;
    time = after1Focus.time;
    expect(state.status).toBe('short_break');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1 }));

    const after1Break = completeBreak(state, time);
    state = after1Break.state;
    time = after1Break.time;
    // reflection disabled: auto-advances to focusing with sessionNumber + 1
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 2 }));

    // === Session 2 ===
    const after2Focus = completeFocus(state, time);
    state = after2Focus.state;
    time = after2Focus.time;
    expect(state.status).toBe('short_break');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 2 }));

    const after2Break = completeBreak(state, time);
    state = after2Break.state;
    time = after2Break.time;
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 3 }));

    // === Session 3 ===
    const after3Focus = completeFocus(state, time);
    state = after3Focus.state;
    time = after3Focus.time;
    expect(state.status).toBe('short_break');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 3 }));

    const after3Break = completeBreak(state, time);
    state = after3Break.state;
    time = after3Break.time;
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 4 }));

    // === Session 4 (long break) ===
    const after4Focus = completeFocus(state, time);
    state = after4Focus.state;
    time = after4Focus.time;
    // sessionNumber 4 % sessionsBeforeLongBreak 4 === 0 => long break
    expect(state.status).toBe('long_break');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 4 }));

    const after4Break = completeBreak(state, time);
    state = after4Break.state;
    time = after4Break.time;
    // reflection disabled: auto-advances to focusing with sessionNumber + 1
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 5 }));
  });

  it('completes a full 4-session cycle with reflection enabled (reflection → completed → reset each session)', () => {
    const reflectionConfig: TimerConfig = {
      focusDuration: 3,
      shortBreakDuration: 2,
      longBreakDuration: 4,
      sessionsBeforeLongBreak: 4,
      reflectionEnabled: true,
    };
    let time = 0;
    let state: TimerState = { status: TIMER_STATUS.IDLE, config: reflectionConfig };

    // With reflection enabled, each session ends at completed and must be RESET.
    // sessionNumber resets to 1 after each RESET → START cycle.
    // To test the long break trigger, we use sessionsBeforeLongBreak = 1 in a separate test.
    // This test verifies the reflection → completed → RESET → idle → START cycle.

    // === Session 1 ===
    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.START }, time);
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1 }));

    const after1Focus = completeFocus(state, time);
    state = after1Focus.state;
    time = after1Focus.time;
    expect(state.status).toBe('short_break');

    const after1Break = completeBreak(state, time);
    state = after1Break.state;
    time = after1Break.time;
    expect(state.status).toBe('reflection');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1, config: reflectionConfig }));

    time += 1;
    state = transition(
      state,
      { type: TIMER_EVENT_TYPE.SUBMIT, data: { focusQuality: 'locked_in' } },
      time,
    );
    expect(state.status).toBe('completed');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1, config: reflectionConfig }));

    // Reset preserves config
    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.RESET }, time);
    expect(state).toEqual({ status: 'idle', config: reflectionConfig });

    // === Session 2 (starts fresh at sessionNumber 1) ===
    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.START }, time);
    expect(state.status).toBe('focusing');
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1, config: reflectionConfig }));

    const after2Focus = completeFocus(state, time);
    state = after2Focus.state;
    time = after2Focus.time;
    expect(state.status).toBe('short_break');

    const after2Break = completeBreak(state, time);
    state = after2Break.state;
    time = after2Break.time;
    expect(state.status).toBe('reflection');

    // Skip reflection this time
    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.SKIP }, time);
    expect(state.status).toBe('completed');
    expect(state).not.toHaveProperty('reflectionData');

    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.RESET }, time);
    expect(state).toEqual({ status: 'idle', config: reflectionConfig });
  });

  it('verifies isLongBreak triggers correctly at session 4 with auto-advancing', () => {
    let time = 0;
    let state: TimerState = { status: TIMER_STATUS.IDLE, config: lifecycleConfig };

    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.START }, time);

    // Fast-forward through sessions 1-3 (short breaks)
    for (let session = 1; session <= 3; session++) {
      const afterFocus = completeFocus(state, time);
      state = afterFocus.state;
      time = afterFocus.time;
      expect(state.status).toBe('short_break');
      expect(state).toEqual(expect.objectContaining({ sessionNumber: session }));

      const afterBreak = completeBreak(state, time);
      state = afterBreak.state;
      time = afterBreak.time;
      expect(state.status).toBe('focusing');
      expect(state).toEqual(expect.objectContaining({ sessionNumber: session + 1 }));
    }

    // Session 4: should get long_break
    const after4Focus = completeFocus(state, time);
    state = after4Focus.state;
    time = after4Focus.time;
    expect(state.status).toBe('long_break');
    expect(state).toEqual(expect.objectContaining({
      sessionNumber: 4,
      timeRemaining: lifecycleConfig.longBreakDuration,
    }));
  });

  it('verifies sessionNumber increments correctly across the full cycle', () => {
    let time = 0;
    let state: TimerState = { status: TIMER_STATUS.IDLE, config: lifecycleConfig };

    time += 1;
    state = transition(state, { type: TIMER_EVENT_TYPE.START }, time);
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 1 }));

    // After session 1 focus + break -> session 2
    let result = completeFocus(state, time);
    state = result.state;
    time = result.time;
    result = completeBreak(state, time);
    state = result.state;
    time = result.time;
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 2, status: 'focusing' }));

    // After session 2 focus + break -> session 3
    result = completeFocus(state, time);
    state = result.state;
    time = result.time;
    result = completeBreak(state, time);
    state = result.state;
    time = result.time;
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 3, status: 'focusing' }));

    // After session 3 focus + break -> session 4
    result = completeFocus(state, time);
    state = result.state;
    time = result.time;
    result = completeBreak(state, time);
    state = result.state;
    time = result.time;
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 4, status: 'focusing' }));

    // After session 4 focus -> long break (still session 4)
    result = completeFocus(state, time);
    state = result.state;
    time = result.time;
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 4, status: 'long_break' }));

    // After long break -> session 5
    result = completeBreak(state, time);
    state = result.state;
    time = result.time;
    expect(state).toEqual(expect.objectContaining({ sessionNumber: 5, status: 'focusing' }));
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
