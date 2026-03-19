import { isRunning, getTimeRemaining } from '@pomofocus/core';
import type { TimerStoreInstance } from './timer-store.js';

// ── Module-level State ──

let intervalId: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;

// ── Driver API ──

/**
 * Starts the timer driver. Sets up a Zustand subscription that watches
 * `isRunning(state)` and manages a 1-second interval accordingly.
 * Each interval tick dispatches TICK, then dispatches TIMER_DONE
 * if timeRemaining has reached 0.
 */
export function startTimer(store: TimerStoreInstance): void {
  // Clean up any existing driver before starting a new one.
  stopTimer();

  const maybeStartInterval = (): void => {
    const { state } = store.getState();

    if (isRunning(state) && intervalId === null) {
      intervalId = setInterval(() => {
        store.getState().tick();

        const afterTick = store.getState().state;
        if (isRunning(afterTick) && getTimeRemaining(afterTick) === 0) {
          store.getState().timerDone();
        }
      }, 1_000);
    } else if (!isRunning(state) && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Check current state immediately — the timer may already be running.
  maybeStartInterval();

  // Subscribe to future state changes.
  unsubscribe = store.subscribe(() => {
    maybeStartInterval();
  });
}

/**
 * Stops the timer driver. Clears the interval and removes the
 * Zustand subscription. Safe to call multiple times.
 */
export function stopTimer(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (unsubscribe !== null) {
    unsubscribe();
    unsubscribe = null;
  }
}
