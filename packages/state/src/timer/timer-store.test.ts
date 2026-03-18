import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTimerStore } from './timer-store.js';
import type { TimerConfig, ReflectionData } from '@pomofocus/core';
import { TIMER_STATUS } from '@pomofocus/core';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

function createStore(config: TimerConfig = defaultConfig): ReturnType<typeof createTimerStore> {
  return createTimerStore(config);
}

describe('timer store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  describe('initial state', () => {
    it('starts in idle status with given config', () => {
      const store = createStore();
      const { state } = store.getState();

      expect(state.status).toBe(TIMER_STATUS.IDLE);
      expect(state.config).toEqual(defaultConfig);
    });
  });

  describe('start()', () => {
    it('transitions from idle to focusing', () => {
      const store = createStore();

      store.getState().start();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(defaultConfig.focusDuration);
        expect(state.startedAt).toBe(1000);
        expect(state.sessionNumber).toBe(1);
      }
    });

    it('is a no-op when already focusing', () => {
      const store = createStore();
      store.getState().start();
      const stateAfterStart = store.getState().state;

      store.getState().start();

      expect(store.getState().state).toEqual(stateAfterStart);
    });
  });

  describe('pause()', () => {
    it('transitions from focusing to paused', () => {
      const store = createStore();
      store.getState().start();

      vi.setSystemTime(2000);
      store.getState().pause();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.PAUSED);
      if (state.status === TIMER_STATUS.PAUSED) {
        expect(state.pausedAt).toBe(2000);
        expect(state.timeRemaining).toBe(defaultConfig.focusDuration);
      }
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().pause();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('resume()', () => {
    it('transitions from paused to focusing', () => {
      const store = createStore();
      store.getState().start();
      store.getState().pause();

      vi.setSystemTime(3000);
      store.getState().resume();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.startedAt).toBe(3000);
      }
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().resume();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('tick()', () => {
    it('decrements timeRemaining by 1 when focusing', () => {
      const store = createStore();
      store.getState().start();

      store.getState().tick();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(defaultConfig.focusDuration - 1);
      }
    });

    it('does not go below 0', () => {
      const shortConfig: TimerConfig = { ...defaultConfig, focusDuration: 1 };
      const store = createStore(shortConfig);
      store.getState().start();

      store.getState().tick();
      store.getState().tick();

      const { state } = store.getState();
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(0);
      }
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().tick();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('abandon()', () => {
    it('transitions from focusing to abandoned', () => {
      const store = createStore();
      store.getState().start();

      vi.setSystemTime(5000);
      store.getState().abandon();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.ABANDONED);
      if (state.status === TIMER_STATUS.ABANDONED) {
        expect(state.abandonedAt).toBe(5000);
        expect(state.sessionNumber).toBe(1);
      }
    });

    it('transitions from paused to abandoned', () => {
      const store = createStore();
      store.getState().start();
      store.getState().pause();

      vi.setSystemTime(5000);
      store.getState().abandon();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.ABANDONED);
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().abandon();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('reset()', () => {
    it('transitions from abandoned to idle', () => {
      const store = createStore();
      store.getState().start();
      store.getState().abandon();

      store.getState().reset();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.IDLE);
      expect(state.config).toEqual(defaultConfig);
    });

    it('transitions from completed to idle', () => {
      const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
      const store = createStore(noReflectionConfig);

      // Go through a full focus + short break + skip break cycle to reach completed
      // Focus session
      store.getState().start();
      // Simulate TIMER_DONE via the transition directly — use skipBreak after break starts
      // Actually, the store doesn't expose TIMER_DONE. We need to go through the break flow.
      // Let's use a config with reflectionEnabled: false and shortBreakDuration so skipBreak works.

      // The store only exposes the listed actions. TIMER_DONE is not a store action.
      // To reach completed state, we need reflection → skip or submit.
      // With reflection disabled, short_break → SKIP_BREAK → focusing (next session).
      // With reflection enabled, short_break → SKIP_BREAK → reflection → SKIP → completed.

      // Let's use reflectionEnabled: true for this test.
      const reflectStore = createStore(defaultConfig);
      reflectStore.getState().start();

      // We can't easily trigger TIMER_DONE from the store (no action for it).
      // The store is a thin wrapper — TIMER_DONE would be dispatched by a driver.
      // For testing reset from completed, we need to set the store state manually
      // or use a focused approach. Since the store wraps transition(), let's verify
      // the action dispatches correctly by setting up the prerequisite state.

      // Alternative: use the Zustand setState escape hatch for test setup.
      reflectStore.setState({
        state: {
          status: TIMER_STATUS.COMPLETED,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      reflectStore.getState().reset();

      const { state } = reflectStore.getState();
      expect(state.status).toBe(TIMER_STATUS.IDLE);
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().reset();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('skipBreak()', () => {
    it('transitions from short_break to reflection when reflection enabled', () => {
      const store = createStore();

      // Set up short_break state directly (TIMER_DONE is not a store action)
      store.setState({
        state: {
          status: TIMER_STATUS.SHORT_BREAK,
          timeRemaining: 300,
          startedAt: 1000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      store.getState().skipBreak();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.REFLECTION);
    });

    it('transitions from short_break to focusing when reflection disabled', () => {
      const noReflectionConfig: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
      const store = createStore(noReflectionConfig);

      store.setState({
        state: {
          status: TIMER_STATUS.SHORT_BREAK,
          timeRemaining: 300,
          startedAt: 1000,
          sessionNumber: 1,
          config: noReflectionConfig,
        },
      });

      vi.setSystemTime(2000);
      store.getState().skipBreak();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.sessionNumber).toBe(2);
        expect(state.startedAt).toBe(2000);
      }
    });

    it('transitions from break_paused to reflection when reflection enabled', () => {
      const store = createStore();

      store.setState({
        state: {
          status: TIMER_STATUS.BREAK_PAUSED,
          timeRemaining: 200,
          pausedAt: 1500,
          breakType: 'short' as const,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      store.getState().skipBreak();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.REFLECTION);
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().skipBreak();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('submitReflection()', () => {
    it('transitions from reflection to completed with reflection data', () => {
      const store = createStore();

      store.setState({
        state: {
          status: TIMER_STATUS.REFLECTION,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      const reflectionData: ReflectionData = {
        focusQuality: 'locked_in',
        distractionType: 'phone',
      };

      store.getState().submitReflection(reflectionData);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.COMPLETED);
      if (state.status === TIMER_STATUS.COMPLETED) {
        expect(state.reflectionData).toEqual(reflectionData);
        expect(state.sessionNumber).toBe(1);
      }
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().submitReflection({ focusQuality: 'locked_in' });

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('skipReflection()', () => {
    it('transitions from reflection to completed without reflection data', () => {
      const store = createStore();

      store.setState({
        state: {
          status: TIMER_STATUS.REFLECTION,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      store.getState().skipReflection();

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.COMPLETED);
      if (state.status === TIMER_STATUS.COMPLETED) {
        expect(state.reflectionData).toBeUndefined();
      }
    });

    it('is a no-op when idle', () => {
      const store = createStore();
      const initialState = store.getState().state;

      store.getState().skipReflection();

      expect(store.getState().state).toEqual(initialState);
    });
  });

  describe('full flow: idle → focusing → paused → focusing → abandoned → idle', () => {
    it('transitions through a complete abandon cycle', () => {
      const store = createStore();

      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);

      store.getState().start();
      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);

      store.getState().pause();
      expect(store.getState().state.status).toBe(TIMER_STATUS.PAUSED);

      store.getState().resume();
      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);

      store.getState().abandon();
      expect(store.getState().state.status).toBe(TIMER_STATUS.ABANDONED);

      store.getState().reset();
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);
    });
  });

  describe('full flow: idle → focusing → break → reflection → completed → idle', () => {
    it('transitions through a complete session cycle', () => {
      const store = createStore();

      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);

      // Start focusing
      store.getState().start();
      expect(store.getState().state.status).toBe(TIMER_STATUS.FOCUSING);

      // Simulate reaching short break (TIMER_DONE is a driver concern, not a store action)
      store.setState({
        state: {
          status: TIMER_STATUS.SHORT_BREAK,
          timeRemaining: defaultConfig.shortBreakDuration,
          startedAt: 2000,
          sessionNumber: 1,
          config: defaultConfig,
        },
      });

      // Skip break → goes to reflection (reflectionEnabled: true)
      store.getState().skipBreak();
      expect(store.getState().state.status).toBe(TIMER_STATUS.REFLECTION);

      // Submit reflection → goes to completed
      store.getState().submitReflection({ focusQuality: 'decent' });
      expect(store.getState().state.status).toBe(TIMER_STATUS.COMPLETED);

      // Reset → goes back to idle
      store.getState().reset();
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);
    });
  });
});
