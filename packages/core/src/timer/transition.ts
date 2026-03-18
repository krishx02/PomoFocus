import { TIMER_STATUS, TIMER_EVENT_TYPE } from './types.js';
import type { TimerState, TimerEvent } from './types.js';
import { isLongBreak, isReflectionEnabled } from './guards.js';

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
      switch (event.type) {
        case TIMER_EVENT_TYPE.PAUSE:
          return {
            status: TIMER_STATUS.PAUSED,
            timeRemaining: state.timeRemaining,
            pausedAt: now,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TICK:
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: Math.max(0, state.timeRemaining - 1),
            startedAt: state.startedAt,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TIMER_DONE:
          if (isLongBreak(state.sessionNumber, state.config)) {
            return {
              status: TIMER_STATUS.LONG_BREAK,
              timeRemaining: state.config.longBreakDuration,
              startedAt: now,
              sessionNumber: state.sessionNumber,
              config: state.config,
            };
          }
          return {
            status: TIMER_STATUS.SHORT_BREAK,
            timeRemaining: state.config.shortBreakDuration,
            startedAt: now,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.RESUME:
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
    case TIMER_STATUS.PAUSED:
      switch (event.type) {
        case TIMER_EVENT_TYPE.RESUME:
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: state.timeRemaining,
            startedAt: now,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.PAUSE:
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
    case TIMER_STATUS.SHORT_BREAK:
      switch (event.type) {
        case TIMER_EVENT_TYPE.PAUSE:
          return {
            status: TIMER_STATUS.BREAK_PAUSED,
            timeRemaining: state.timeRemaining,
            pausedAt: now,
            breakType: 'short',
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TICK:
          return {
            status: TIMER_STATUS.SHORT_BREAK,
            timeRemaining: Math.max(0, state.timeRemaining - 1),
            startedAt: state.startedAt,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TIMER_DONE:
        case TIMER_EVENT_TYPE.SKIP_BREAK:
          if (isReflectionEnabled(state.config)) {
            return {
              status: TIMER_STATUS.REFLECTION,
              sessionNumber: state.sessionNumber,
              config: state.config,
            };
          }
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: state.config.focusDuration,
            startedAt: now,
            sessionNumber: state.sessionNumber + 1,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.RESUME:
        case TIMER_EVENT_TYPE.SKIP:
        case TIMER_EVENT_TYPE.SUBMIT:
        case TIMER_EVENT_TYPE.ABANDON:
        case TIMER_EVENT_TYPE.RESET:
          return state;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case TIMER_STATUS.LONG_BREAK:
      switch (event.type) {
        case TIMER_EVENT_TYPE.PAUSE:
          return {
            status: TIMER_STATUS.BREAK_PAUSED,
            timeRemaining: state.timeRemaining,
            pausedAt: now,
            breakType: 'long',
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TICK:
          return {
            status: TIMER_STATUS.LONG_BREAK,
            timeRemaining: Math.max(0, state.timeRemaining - 1),
            startedAt: state.startedAt,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.TIMER_DONE:
        case TIMER_EVENT_TYPE.SKIP_BREAK:
          if (isReflectionEnabled(state.config)) {
            return {
              status: TIMER_STATUS.REFLECTION,
              sessionNumber: state.sessionNumber,
              config: state.config,
            };
          }
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: state.config.focusDuration,
            startedAt: now,
            sessionNumber: state.sessionNumber + 1,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.RESUME:
        case TIMER_EVENT_TYPE.SKIP:
        case TIMER_EVENT_TYPE.SUBMIT:
        case TIMER_EVENT_TYPE.ABANDON:
        case TIMER_EVENT_TYPE.RESET:
          return state;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case TIMER_STATUS.BREAK_PAUSED:
      switch (event.type) {
        case TIMER_EVENT_TYPE.RESUME:
          if (state.breakType === 'short') {
            return {
              status: TIMER_STATUS.SHORT_BREAK,
              timeRemaining: state.timeRemaining,
              startedAt: now,
              sessionNumber: state.sessionNumber,
              config: state.config,
            };
          }
          return {
            status: TIMER_STATUS.LONG_BREAK,
            timeRemaining: state.timeRemaining,
            startedAt: now,
            sessionNumber: state.sessionNumber,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.SKIP_BREAK:
          if (isReflectionEnabled(state.config)) {
            return {
              status: TIMER_STATUS.REFLECTION,
              sessionNumber: state.sessionNumber,
              config: state.config,
            };
          }
          return {
            status: TIMER_STATUS.FOCUSING,
            timeRemaining: state.config.focusDuration,
            startedAt: now,
            sessionNumber: state.sessionNumber + 1,
            config: state.config,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.PAUSE:
        case TIMER_EVENT_TYPE.TICK:
        case TIMER_EVENT_TYPE.TIMER_DONE:
        case TIMER_EVENT_TYPE.SKIP:
        case TIMER_EVENT_TYPE.SUBMIT:
        case TIMER_EVENT_TYPE.ABANDON:
        case TIMER_EVENT_TYPE.RESET:
          return state;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case TIMER_STATUS.REFLECTION:
      switch (event.type) {
        case TIMER_EVENT_TYPE.SUBMIT:
          return {
            status: TIMER_STATUS.COMPLETED,
            sessionNumber: state.sessionNumber,
            reflectionData: event.data,
          };
        case TIMER_EVENT_TYPE.SKIP:
          return {
            status: TIMER_STATUS.COMPLETED,
            sessionNumber: state.sessionNumber,
          };
        case TIMER_EVENT_TYPE.START:
        case TIMER_EVENT_TYPE.PAUSE:
        case TIMER_EVENT_TYPE.RESUME:
        case TIMER_EVENT_TYPE.TICK:
        case TIMER_EVENT_TYPE.TIMER_DONE:
        case TIMER_EVENT_TYPE.SKIP_BREAK:
        case TIMER_EVENT_TYPE.ABANDON:
        case TIMER_EVENT_TYPE.RESET:
          return state;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return state;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
