import { describe, it, expect } from 'vitest';
import { rehydrate } from './rehydrate.js';
import { TIMER_STATUS, TIMER_EVENT_TYPE } from './types.js';
import type { TimerConfig, TimerState } from './types.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

describe('rehydrate', () => {
  describe('running state (focusing) with elapsed < remaining', () => {
    it('adjusts timeRemaining by elapsed time', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 1600);

      expect(result.state).toEqual({
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 900,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([]);
    });
  });

  describe('running state (focusing) with elapsed >= remaining', () => {
    it('applies TIMER_DONE transition when time has expired', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 2600;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.SHORT_BREAK);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });

    it('transitions to long break when session number matches', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 4,
        config: defaultConfig,
      };

      const now = 2600;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.LONG_BREAK);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });

    it('applies TIMER_DONE when timeRemaining is exactly zero', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 1500;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.SHORT_BREAK);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });
  });

  describe('running state (short_break) rehydration', () => {
    it('adjusts timeRemaining when elapsed < remaining', () => {
      const state: TimerState = {
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 300,
        startedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 2100);

      expect(result.state).toEqual({
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 200,
        startedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([]);
    });

    it('applies TIMER_DONE when break time has expired', () => {
      const state: TimerState = {
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 300,
        startedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 2400;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.REFLECTION);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });

    it('goes to completed if reflection disabled', () => {
      const noReflectionConfig: TimerConfig = {
        ...defaultConfig,
        reflectionEnabled: false,
      };
      const state: TimerState = {
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 300,
        startedAt: 2000,
        sessionNumber: 1,
        config: noReflectionConfig,
      };

      const now = 2400;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.COMPLETED);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });
  });

  describe('running state (long_break) rehydration', () => {
    it('adjusts timeRemaining when elapsed < remaining', () => {
      const state: TimerState = {
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 900,
        startedAt: 3000,
        sessionNumber: 4,
        config: defaultConfig,
      };

      const result = rehydrate(state, 3300);

      expect(result.state).toEqual({
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 600,
        startedAt: 3000,
        sessionNumber: 4,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([]);
    });

    it('applies TIMER_DONE when long break has expired', () => {
      const state: TimerState = {
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 900,
        startedAt: 3000,
        sessionNumber: 4,
        config: defaultConfig,
      };

      const now = 4000;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.REFLECTION);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });
  });

  describe('paused state rehydration', () => {
    it('returns paused state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.PAUSED,
        timeRemaining: 900,
        pausedAt: 1600,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });
  });

  describe('break_paused state rehydration', () => {
    it('returns break_paused state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.BREAK_PAUSED,
        timeRemaining: 200,
        pausedAt: 2700,
        breakType: 'short',
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });
  });

  describe('non-timed state rehydration', () => {
    it('returns idle state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.IDLE,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });

    it('returns reflection state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.REFLECTION,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });

    it('returns completed state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.COMPLETED,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });

    it('returns abandoned state unchanged', () => {
      const state: TimerState = {
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: 5000,
        config: defaultConfig,
      };

      const result = rehydrate(state, 99999);

      expect(result.state).toEqual(state);
      expect(result.missedTransitions).toEqual([]);
    });
  });

  describe('auto-abandon for sessions running way past max duration', () => {
    it('auto-abandons focusing state when elapsed >= 2x focus duration', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 1000 + 1500 * 2;
      const result = rehydrate(state, now);

      expect(result.state).toEqual({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: now,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.ABANDON },
      ]);
    });

    it('auto-abandons short_break when elapsed >= 2x short break duration', () => {
      const state: TimerState = {
        status: TIMER_STATUS.SHORT_BREAK,
        timeRemaining: 300,
        startedAt: 2000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 2000 + 300 * 2;
      const result = rehydrate(state, now);

      expect(result.state).toEqual({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 1,
        abandonedAt: now,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.ABANDON },
      ]);
    });

    it('auto-abandons long_break when elapsed >= 2x long break duration', () => {
      const state: TimerState = {
        status: TIMER_STATUS.LONG_BREAK,
        timeRemaining: 900,
        startedAt: 3000,
        sessionNumber: 4,
        config: defaultConfig,
      };

      const now = 3000 + 900 * 2;
      const result = rehydrate(state, now);

      expect(result.state).toEqual({
        status: TIMER_STATUS.ABANDONED,
        sessionNumber: 4,
        abandonedAt: now,
        config: defaultConfig,
      });
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.ABANDON },
      ]);
    });

    it('does not auto-abandon when elapsed is just under 2x threshold', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 1000 + 1500 * 2 - 1;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.SHORT_BREAK);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.TIMER_DONE },
      ]);
    });

    it('auto-abandon takes priority over TIMER_DONE for very long elapsed', () => {
      const state: TimerState = {
        status: TIMER_STATUS.FOCUSING,
        timeRemaining: 1500,
        startedAt: 1000,
        sessionNumber: 1,
        config: defaultConfig,
      };

      const now = 1000 + 10000;
      const result = rehydrate(state, now);

      expect(result.state.status).toBe(TIMER_STATUS.ABANDONED);
      expect(result.missedTransitions).toEqual([
        { type: TIMER_EVENT_TYPE.ABANDON },
      ]);
    });
  });
});
