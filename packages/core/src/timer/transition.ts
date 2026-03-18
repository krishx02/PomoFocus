import { TIMER_STATUS, TIMER_EVENT_TYPE } from './types.js';
import type { TimerState, TimerEvent } from './types.js';

export function transition(state: TimerState, event: TimerEvent, now: number): TimerState {
  switch (state.status) {
    case TIMER_STATUS.IDLE:
      switch (event.type) {
        case TIMER_EVENT_TYPE.START:
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: state.config.focusDuration,
            startedAt: now,
            sessionNumber: 1,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.PAUSE:
        case TIMER_EVENT_TYPE.RESUME:
        case TIMER_EVENT_TYPE.TICK:
        case TIMER_EVENT_TYPE.TIMER_DONE:
        case TIMER_EVENT_TYPE.SKIP:
        case TIMER_EVENT_TYPE.SUBMIT:
        case TIMER_EVENT_TYPE.SKIP_BREAK:
        case TIMER_EVENT_TYPE.ABANDON:
        case TIMER_EVENT_TYPE.RESET:
          return state;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK:
    case TIMER_STATUS.BREAK_PAUSED:
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return state;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
