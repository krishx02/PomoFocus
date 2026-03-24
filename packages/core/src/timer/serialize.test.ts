import { describe, it, expect } from 'vitest';
import {
  serializeState,
  deserializeState,
  SERIALIZATION_VERSION,
} from './serialize.js';
import { TIMER_STATUS } from './types.js';
import type { TimerConfig, TimerState } from './types.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

// ── All 9 state variants ──

const allStateVariants: { name: string; state: TimerState }[] = [
  {
    name: 'idle',
    state: { status: TIMER_STATUS.IDLE, config: defaultConfig },
  },
  {
    name: 'focusing',
    state: {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    },
  },
  {
    name: 'paused',
    state: {
      status: TIMER_STATUS.PAUSED,
      timeRemaining: 900,
      pausedAt: 1600,
      sessionNumber: 2,
      config: defaultConfig,
    },
  },
  {
    name: 'short_break',
    state: {
      status: TIMER_STATUS.SHORT_BREAK,
      timeRemaining: 250,
      startedAt: 2500,
      sessionNumber: 1,
      config: defaultConfig,
    },
  },
  {
    name: 'long_break',
    state: {
      status: TIMER_STATUS.LONG_BREAK,
      timeRemaining: 800,
      startedAt: 3000,
      sessionNumber: 4,
      config: defaultConfig,
    },
  },
  {
    name: 'break_paused (short)',
    state: {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 150,
      pausedAt: 2700,
      breakType: 'short',
      sessionNumber: 1,
      config: defaultConfig,
    },
  },
  {
    name: 'break_paused (long)',
    state: {
      status: TIMER_STATUS.BREAK_PAUSED,
      timeRemaining: 400,
      pausedAt: 3200,
      breakType: 'long',
      sessionNumber: 4,
      config: defaultConfig,
    },
  },
  {
    name: 'reflection',
    state: {
      status: TIMER_STATUS.REFLECTION,
      sessionNumber: 1,
      config: defaultConfig,
    },
  },
  {
    name: 'completed (without reflection)',
    state: {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 3,
      config: defaultConfig,
    },
  },
  {
    name: 'completed (with reflection)',
    state: {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 2,
      config: defaultConfig,
      reflectionData: {
        focusQuality: 'locked_in',
        distractionType: 'phone',
      },
    },
  },
  {
    name: 'completed (with reflection, no distraction)',
    state: {
      status: TIMER_STATUS.COMPLETED,
      sessionNumber: 1,
      config: defaultConfig,
      reflectionData: {
        focusQuality: 'decent',
      },
    },
  },
  {
    name: 'abandoned',
    state: {
      status: TIMER_STATUS.ABANDONED,
      sessionNumber: 1,
      abandonedAt: 5000,
      config: defaultConfig,
    },
  },
];

describe('serializeState', () => {
  it('wraps state with version number', () => {
    const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
    const serialized = serializeState(state);
    expect(serialized.version).toBe(SERIALIZATION_VERSION);
    expect(serialized.state).toEqual(state);
  });

  it('produces JSON-safe output', () => {
    const state: TimerState = {
      status: TIMER_STATUS.FOCUSING,
      timeRemaining: 1200,
      startedAt: 1000,
      sessionNumber: 1,
      config: defaultConfig,
    };
    const serialized = serializeState(state);
    const json = JSON.stringify(serialized);
    const parsed: unknown = JSON.parse(json);
    expect(parsed).toEqual(serialized);
  });
});

describe('deserializeState', () => {
  describe('round-trip: serializeState -> deserializeState produces identical state', () => {
    for (const { name, state } of allStateVariants) {
      it(`round-trips ${name} state`, () => {
        const serialized = serializeState(state);
        const json = JSON.stringify(serialized);
        const parsed: unknown = JSON.parse(json);
        const result = deserializeState(parsed);
        expect(result).toEqual(state);
      });
    }
  });

  describe('returns null for corrupted/missing data', () => {
    it('returns null for null', () => {
      expect(deserializeState(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(deserializeState(undefined)).toBeNull();
    });

    it('returns null for a string', () => {
      expect(deserializeState('not an object')).toBeNull();
    });

    it('returns null for a number', () => {
      expect(deserializeState(42)).toBeNull();
    });

    it('returns null for an array', () => {
      expect(deserializeState([1, 2, 3])).toBeNull();
    });

    it('returns null for empty object', () => {
      expect(deserializeState({})).toBeNull();
    });

    it('returns null for missing version', () => {
      const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
      expect(deserializeState({ state })).toBeNull();
    });

    it('returns null for non-numeric version', () => {
      const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
      expect(deserializeState({ version: 'one', state })).toBeNull();
    });

    it('returns null for wrong version number', () => {
      const state: TimerState = { status: TIMER_STATUS.IDLE, config: defaultConfig };
      expect(deserializeState({ version: 999, state })).toBeNull();
    });

    it('returns null for missing state', () => {
      expect(deserializeState({ version: SERIALIZATION_VERSION })).toBeNull();
    });

    it('returns null for state as non-object', () => {
      expect(deserializeState({ version: SERIALIZATION_VERSION, state: 'bad' })).toBeNull();
    });

    it('returns null for state as array', () => {
      expect(deserializeState({ version: SERIALIZATION_VERSION, state: [] })).toBeNull();
    });

    it('returns null for missing status', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: { config: defaultConfig },
        }),
      ).toBeNull();
    });

    it('returns null for invalid status', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: { status: 'invalid_status', config: defaultConfig },
        }),
      ).toBeNull();
    });

    it('returns null for missing config', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: { status: 'idle' },
        }),
      ).toBeNull();
    });

    it('returns null for invalid config (missing field)', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'idle',
            config: {
              focusDuration: 1500,
              shortBreakDuration: 300,
              // missing longBreakDuration
              sessionsBeforeLongBreak: 4,
              reflectionEnabled: true,
            },
          },
        }),
      ).toBeNull();
    });

    it('returns null for invalid config (wrong type)', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'idle',
            config: {
              focusDuration: '1500',
              shortBreakDuration: 300,
              longBreakDuration: 900,
              sessionsBeforeLongBreak: 4,
              reflectionEnabled: true,
            },
          },
        }),
      ).toBeNull();
    });
  });

  describe('returns null for state-specific missing fields', () => {
    it('focusing: returns null when timeRemaining is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'focusing',
            startedAt: 1000,
            sessionNumber: 1,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('focusing: returns null when startedAt is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'focusing',
            timeRemaining: 1200,
            sessionNumber: 1,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('focusing: returns null when sessionNumber is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'focusing',
            timeRemaining: 1200,
            startedAt: 1000,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('paused: returns null when pausedAt is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'paused',
            timeRemaining: 900,
            sessionNumber: 2,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('break_paused: returns null when breakType is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'break_paused',
            timeRemaining: 150,
            pausedAt: 2700,
            sessionNumber: 1,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('break_paused: returns null for invalid breakType', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'break_paused',
            timeRemaining: 150,
            pausedAt: 2700,
            breakType: 'medium',
            sessionNumber: 1,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('abandoned: returns null when abandonedAt is missing', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'abandoned',
            sessionNumber: 1,
            config: defaultConfig,
          },
        }),
      ).toBeNull();
    });

    it('completed: returns null for invalid reflectionData', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'completed',
            sessionNumber: 1,
            config: defaultConfig,
            reflectionData: { focusQuality: 'invalid_quality' },
          },
        }),
      ).toBeNull();
    });

    it('completed: returns null for invalid distractionType in reflectionData', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'completed',
            sessionNumber: 1,
            config: defaultConfig,
            reflectionData: {
              focusQuality: 'locked_in',
              distractionType: 'invalid_distraction',
            },
          },
        }),
      ).toBeNull();
    });

    it('completed: returns null when reflectionData is non-object', () => {
      expect(
        deserializeState({
          version: SERIALIZATION_VERSION,
          state: {
            status: 'completed',
            sessionNumber: 1,
            config: defaultConfig,
            reflectionData: 'bad',
          },
        }),
      ).toBeNull();
    });
  });

  describe('validates all focusQuality and distractionType values', () => {
    const focusQualities = ['locked_in', 'decent', 'struggled'] as const;
    const distractionTypes = ['phone', 'people', 'thoughts_wandering', 'got_stuck', 'other'] as const;

    for (const quality of focusQualities) {
      it(`accepts focusQuality: ${quality}`, () => {
        const state: TimerState = {
          status: TIMER_STATUS.COMPLETED,
          sessionNumber: 1,
          config: defaultConfig,
          reflectionData: { focusQuality: quality },
        };
        const result = deserializeState(serializeState(state));
        expect(result).toEqual(state);
      });
    }

    for (const distraction of distractionTypes) {
      it(`accepts distractionType: ${distraction}`, () => {
        const state: TimerState = {
          status: TIMER_STATUS.COMPLETED,
          sessionNumber: 1,
          config: defaultConfig,
          reflectionData: { focusQuality: 'decent', distractionType: distraction },
        };
        const result = deserializeState(serializeState(state));
        expect(result).toEqual(state);
      });
    }
  });
});
