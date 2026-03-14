import { TIMER_STATUS } from './types.js';
import type { TimerConfig, TimerState } from './types.js';

/** Returns an idle timer state with the given configuration. */
export function createInitialState(config: TimerConfig): TimerState {
  return { status: TIMER_STATUS.IDLE, config };
}

/** Returns true when the timer is actively counting down (focusing or on a break). */
export function isRunning(state: TimerState): boolean {
  switch (state.status) {
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK:
      return true;
    case TIMER_STATUS.IDLE:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.BREAK_PAUSED:
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return false;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/** Returns the seconds remaining for timed states, or 0 for states without a countdown. */
export function getTimeRemaining(state: TimerState): number {
  switch (state.status) {
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK:
    case TIMER_STATUS.BREAK_PAUSED:
      return state.timeRemaining;
    case TIMER_STATUS.IDLE:
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return 0;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
