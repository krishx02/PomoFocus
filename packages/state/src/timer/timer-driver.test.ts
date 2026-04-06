import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTimerStore } from './timer-store.js';
import { startTimer, stopTimer } from './timer-driver.js';
import type { TimerConfig } from '@pomofocus/core';
import { TIMER_STATUS } from '@pomofocus/core';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

function createStore(config: TimerConfig = defaultConfig): ReturnType<typeof createTimerStore> {
  return createTimerStore({ config, storage: null });
}

describe('timer driver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    stopTimer();
    vi.useRealTimers();
  });

  describe('startTimer()', () => {
    it('starts a 1-second interval when the timer is running', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);

      const initialRemaining = 1500;
      vi.advanceTimersByTime(1000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(initialRemaining - 1);
      }
    });

    it('does not start an interval when the timer is idle', () => {
      const store = createStore();

      startTimer(store);
      vi.advanceTimersByTime(5000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.IDLE);
    });

    it('starts the interval when the timer transitions to running', () => {
      const store = createStore();

      startTimer(store);

      // Timer is idle, no ticks should happen
      vi.advanceTimersByTime(3000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.IDLE);

      // Now start the timer — driver should detect the change and begin ticking
      store.getState().start();
      vi.advanceTimersByTime(3000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(1500 - 3);
      }
    });

    it('ticks multiple times over several seconds', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(10_000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(1500 - 10);
      }
    });
  });

  describe('stopTimer()', () => {
    it('clears the interval so ticks stop', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(3000);

      stopTimer();
      vi.advanceTimersByTime(5000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        // Only 3 ticks should have occurred, not 8
        expect(state.timeRemaining).toBe(1500 - 3);
      }
    });

    it('is safe to call multiple times', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);

      stopTimer();
      stopTimer();
      stopTimer();

      // No error thrown — verify timer is idle-safe
      vi.advanceTimersByTime(5000);
      const { state } = store.getState();
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(1500);
      }
    });
  });

  describe('interval lifecycle', () => {
    it('stops the interval when the timer is paused', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(3000);

      store.getState().pause();
      vi.advanceTimersByTime(5000);

      // Only 3 ticks from before the pause
      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.PAUSED);
      if (state.status === TIMER_STATUS.PAUSED) {
        expect(state.timeRemaining).toBe(1500 - 3);
      }
    });

    it('restarts the interval when the timer is resumed', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(3000); // 3 ticks

      store.getState().pause();
      vi.advanceTimersByTime(2000); // no ticks

      store.getState().resume();
      vi.advanceTimersByTime(2000); // 2 more ticks

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.FOCUSING);
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(1500 - 3 - 2);
      }
    });

    it('stops the interval when the timer is abandoned', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(2000);

      store.getState().abandon();
      vi.advanceTimersByTime(5000);

      expect(store.getState().state.status).toBe(TIMER_STATUS.ABANDONED);
    });
  });

  describe('TIMER_DONE dispatch', () => {
    it('dispatches TIMER_DONE when focus timeRemaining reaches 0', () => {
      const shortConfig: TimerConfig = { ...defaultConfig, focusDuration: 3 };
      const store = createStore(shortConfig);
      store.getState().start();

      startTimer(store);

      // After 3 seconds, timeRemaining hits 0 → TIMER_DONE → short_break
      vi.advanceTimersByTime(3000);

      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.SHORT_BREAK);
      if (state.status === TIMER_STATUS.SHORT_BREAK) {
        expect(state.timeRemaining).toBe(defaultConfig.shortBreakDuration);
      }
    });

    it('dispatches TIMER_DONE when break timeRemaining reaches 0', () => {
      const shortConfig: TimerConfig = {
        ...defaultConfig,
        focusDuration: 2,
        shortBreakDuration: 2,
      };
      const store = createStore(shortConfig);
      store.getState().start();

      startTimer(store);

      // 2s focus → TIMER_DONE → short_break with 2s
      vi.advanceTimersByTime(2000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.SHORT_BREAK);

      // 2s break → TIMER_DONE → reflection (reflectionEnabled: true)
      vi.advanceTimersByTime(2000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.REFLECTION);
    });

    it('transitions through a full focus cycle: focus → break → reflection', () => {
      const shortConfig: TimerConfig = {
        ...defaultConfig,
        focusDuration: 1,
        shortBreakDuration: 1,
      };
      const store = createStore(shortConfig);
      store.getState().start();

      startTimer(store);

      // 1s focus → short_break
      vi.advanceTimersByTime(1000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.SHORT_BREAK);

      // 1s break → reflection
      vi.advanceTimersByTime(1000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.REFLECTION);

      // Driver should have stopped ticking (reflection is not running)
      vi.advanceTimersByTime(5000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.REFLECTION);
    });

    it('continues ticking during break after TIMER_DONE from focus', () => {
      const shortConfig: TimerConfig = {
        ...defaultConfig,
        focusDuration: 2,
        shortBreakDuration: 300,
      };
      const store = createStore(shortConfig);
      store.getState().start();

      startTimer(store);

      // 2s focus → short_break
      vi.advanceTimersByTime(2000);
      expect(store.getState().state.status).toBe(TIMER_STATUS.SHORT_BREAK);

      // Continue ticking during break
      vi.advanceTimersByTime(3000);
      const { state } = store.getState();
      expect(state.status).toBe(TIMER_STATUS.SHORT_BREAK);
      if (state.status === TIMER_STATUS.SHORT_BREAK) {
        expect(state.timeRemaining).toBe(300 - 3);
      }
    });
  });

  describe('cleanup', () => {
    it('cleans up previous driver when startTimer is called again', () => {
      const store = createStore();
      store.getState().start();

      startTimer(store);
      vi.advanceTimersByTime(2000); // 2 ticks

      // Start again — should clean up old interval
      startTimer(store);
      vi.advanceTimersByTime(3000); // 3 ticks (not 3 + extra from old interval)

      const { state } = store.getState();
      if (state.status === TIMER_STATUS.FOCUSING) {
        expect(state.timeRemaining).toBe(1500 - 2 - 3);
      }
    });
  });
});
