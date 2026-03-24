// PomoFocus Timer — Core FSM transition function for nRF52840 firmware.
// Direct port of packages/core/src/timer/transition.ts (ADR-004).
// Pure function: no IO, no intervals, no side effects.

#include "timer.h"

// ── Guards (port of packages/core/src/timer/guards.ts) ──

bool isLongBreak(uint32_t sessionNumber, const TimerConfig& config) {
  if (sessionNumber < 1) return false;
  if (config.sessionsBeforeLongBreak < 1) return false;
  return sessionNumber % config.sessionsBeforeLongBreak == 0;
}

bool isReflectionEnabled(const TimerConfig& config) {
  return config.reflectionEnabled;
}

// ── Helper: create a focusing state for the next session ──

static TimerState nextFocusingState(const TimerState& state, unsigned long now) {
  TimerState result = {};
  result.phase = TimerPhase::focusing;
  result.timeRemaining = state.config.focusDuration;
  result.startedAt = now;
  result.pausedAt = 0;
  result.sessionNumber = state.sessionNumber + 1;
  result.config = state.config;
  result.breakType = BreakType::short_break;
  return result;
}

// ── Helper: create a reflection state ──

static TimerState reflectionState(const TimerState& state) {
  TimerState result = {};
  result.phase = TimerPhase::reflection;
  result.timeRemaining = 0;
  result.startedAt = 0;
  result.pausedAt = 0;
  result.sessionNumber = state.sessionNumber;
  result.config = state.config;
  result.breakType = BreakType::short_break;
  return result;
}

// ── Helper: create an abandoned state ──

static TimerState abandonedState(const TimerState& state, unsigned long now) {
  TimerState result = {};
  result.phase = TimerPhase::abandoned;
  result.timeRemaining = 0;
  result.startedAt = now;  // abandonedAt stored in startedAt field
  result.pausedAt = 0;
  result.sessionNumber = state.sessionNumber;
  result.config = state.config;
  result.breakType = BreakType::short_break;
  return result;
}

// ── Helper: handle break end (TIMER_DONE or SKIP_BREAK from break states) ──
// If reflection enabled, go to reflection. Otherwise, start next focus session.

static TimerState breakEndState(const TimerState& state, unsigned long now) {
  if (isReflectionEnabled(state.config)) {
    return reflectionState(state);
  }
  return nextFocusingState(state, now);
}

// ── Transition Function ──

TimerState transition(TimerState state, TimerEvent event, unsigned long now) {
  switch (state.phase) {

    // ── idle: only START is valid ──
    case TimerPhase::idle: {
      if (event == TimerEvent::START) {
        TimerState result = {};
        result.phase = TimerPhase::focusing;
        result.timeRemaining = state.config.focusDuration;
        result.startedAt = now;
        result.pausedAt = 0;
        result.sessionNumber = 1;
        result.config = state.config;
        result.breakType = BreakType::short_break;
        return result;
      }
      return state;
    }

    // ── focusing: PAUSE, TICK, TIMER_DONE, ABANDON ──
    case TimerPhase::focusing: {
      switch (event) {
        case TimerEvent::PAUSE: {
          TimerState result = {};
          result.phase = TimerPhase::paused;
          result.timeRemaining = state.timeRemaining;
          result.startedAt = 0;
          result.pausedAt = now;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        case TimerEvent::TICK: {
          TimerState result = state;
          if (state.timeRemaining > 0) {
            result.timeRemaining = state.timeRemaining - 1;
          }
          return result;
        }
        case TimerEvent::TIMER_DONE: {
          if (isLongBreak(state.sessionNumber, state.config)) {
            TimerState result = {};
            result.phase = TimerPhase::long_break;
            result.timeRemaining = state.config.longBreakDuration;
            result.startedAt = now;
            result.pausedAt = 0;
            result.sessionNumber = state.sessionNumber;
            result.config = state.config;
            result.breakType = BreakType::short_break;
            return result;
          }
          TimerState result = {};
          result.phase = TimerPhase::short_break;
          result.timeRemaining = state.config.shortBreakDuration;
          result.startedAt = now;
          result.pausedAt = 0;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        case TimerEvent::ABANDON:
          return abandonedState(state, now);
        default:
          return state;
      }
    }

    // ── paused: RESUME, ABANDON ──
    case TimerPhase::paused: {
      switch (event) {
        case TimerEvent::RESUME: {
          TimerState result = {};
          result.phase = TimerPhase::focusing;
          result.timeRemaining = state.timeRemaining;
          result.startedAt = now;
          result.pausedAt = 0;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        case TimerEvent::ABANDON:
          return abandonedState(state, now);
        default:
          return state;
      }
    }

    // ── short_break: PAUSE, TICK, TIMER_DONE, SKIP_BREAK, ABANDON ──
    case TimerPhase::short_break: {
      switch (event) {
        case TimerEvent::PAUSE: {
          TimerState result = {};
          result.phase = TimerPhase::break_paused;
          result.timeRemaining = state.timeRemaining;
          result.startedAt = 0;
          result.pausedAt = now;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        case TimerEvent::TICK: {
          TimerState result = state;
          if (state.timeRemaining > 0) {
            result.timeRemaining = state.timeRemaining - 1;
          }
          return result;
        }
        case TimerEvent::TIMER_DONE:
        case TimerEvent::SKIP_BREAK:
          return breakEndState(state, now);
        case TimerEvent::ABANDON:
          return abandonedState(state, now);
        default:
          return state;
      }
    }

    // ── long_break: PAUSE, TICK, TIMER_DONE, SKIP_BREAK, ABANDON ──
    case TimerPhase::long_break: {
      switch (event) {
        case TimerEvent::PAUSE: {
          TimerState result = {};
          result.phase = TimerPhase::break_paused;
          result.timeRemaining = state.timeRemaining;
          result.startedAt = 0;
          result.pausedAt = now;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::long_break;
          return result;
        }
        case TimerEvent::TICK: {
          TimerState result = state;
          if (state.timeRemaining > 0) {
            result.timeRemaining = state.timeRemaining - 1;
          }
          return result;
        }
        case TimerEvent::TIMER_DONE:
        case TimerEvent::SKIP_BREAK:
          return breakEndState(state, now);
        case TimerEvent::ABANDON:
          return abandonedState(state, now);
        default:
          return state;
      }
    }

    // ── break_paused: RESUME, SKIP_BREAK, ABANDON ──
    case TimerPhase::break_paused: {
      switch (event) {
        case TimerEvent::RESUME: {
          if (state.breakType == BreakType::short_break) {
            TimerState result = {};
            result.phase = TimerPhase::short_break;
            result.timeRemaining = state.timeRemaining;
            result.startedAt = now;
            result.pausedAt = 0;
            result.sessionNumber = state.sessionNumber;
            result.config = state.config;
            result.breakType = BreakType::short_break;
            return result;
          }
          TimerState result = {};
          result.phase = TimerPhase::long_break;
          result.timeRemaining = state.timeRemaining;
          result.startedAt = now;
          result.pausedAt = 0;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::long_break;
          return result;
        }
        case TimerEvent::SKIP_BREAK:
          return breakEndState(state, now);
        case TimerEvent::ABANDON:
          return abandonedState(state, now);
        default:
          return state;
      }
    }

    // ── reflection: SUBMIT, SKIP ──
    case TimerPhase::reflection: {
      switch (event) {
        case TimerEvent::SUBMIT: {
          // Note: reflection data is collected by the app layer,
          // not passed through the FSM on the device.
          TimerState result = {};
          result.phase = TimerPhase::completed;
          result.timeRemaining = 0;
          result.startedAt = 0;
          result.pausedAt = 0;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        case TimerEvent::SKIP: {
          TimerState result = {};
          result.phase = TimerPhase::completed;
          result.timeRemaining = 0;
          result.startedAt = 0;
          result.pausedAt = 0;
          result.sessionNumber = state.sessionNumber;
          result.config = state.config;
          result.breakType = BreakType::short_break;
          return result;
        }
        default:
          return state;
      }
    }

    // ── completed (terminal): only RESET ──
    case TimerPhase::completed: {
      if (event == TimerEvent::RESET) {
        return createIdleState(state.config);
      }
      return state;
    }

    // ── abandoned (terminal): only RESET ──
    case TimerPhase::abandoned: {
      if (event == TimerEvent::RESET) {
        return createIdleState(state.config);
      }
      return state;
    }
  }

  // Unreachable if all phases are handled, but satisfies compiler.
  return state;
}
