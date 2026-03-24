import { TIMER_STATUS, TIMER_EVENT_TYPE } from './types.js';
import type { TimerState, TimerEvent } from './types.js';
import { transition } from './transition.js';

export type RehydrationResult = {
  state: TimerState;
  missedTransitions: TimerEvent[];
};

function getMaxDuration(state: TimerState): number {
  switch (state.status) {
    case TIMER_STATUS.FOCUSING:
      return state.config.focusDuration;
    case TIMER_STATUS.SHORT_BREAK:
      return state.config.shortBreakDuration;
    case TIMER_STATUS.LONG_BREAK:
      return state.config.longBreakDuration;
    case TIMER_STATUS.IDLE:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.BREAK_PAUSED:
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

export function rehydrate(persistedState: TimerState, now: number): RehydrationResult {
  switch (persistedState.status) {
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK: {
      const elapsed = now - persistedState.startedAt;
      const maxDuration = getMaxDuration(persistedState);
      const autoAbandonThreshold = maxDuration * 2;

      if (elapsed >= autoAbandonThreshold) {
        return {
          state: {
            status: TIMER_STATUS.ABANDONED,
            sessionNumber: persistedState.sessionNumber,
            abandonedAt: now,
            config: persistedState.config,
          },
          missedTransitions: [{ type: TIMER_EVENT_TYPE.ABANDON }],
        };
      }

      const adjustedRemaining = persistedState.timeRemaining - elapsed;

      if (adjustedRemaining <= 0) {
        const timerDoneEvent: TimerEvent = { type: TIMER_EVENT_TYPE.TIMER_DONE };
        const newState = transition(persistedState, timerDoneEvent, now);
        return {
          state: newState,
          missedTransitions: [timerDoneEvent],
        };
      }

      return {
        state: {
          ...persistedState,
          timeRemaining: adjustedRemaining,
        },
        missedTransitions: [],
      };
    }
    case TIMER_STATUS.IDLE:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.BREAK_PAUSED:
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return {
        state: persistedState,
        missedTransitions: [],
      };
    default: {
      const _exhaustive: never = persistedState;
      return _exhaustive;
    }
  }
}
