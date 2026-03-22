// PomoFocus Timer — C++ type definitions for nRF52840 firmware.
// Direct port of packages/core/src/timer/types.ts (ADR-004).
// Transition function is a separate issue — this file defines types only.

#ifndef POMOFOCUS_TIMER_H
#define POMOFOCUS_TIMER_H

#include <stdint.h>

// ── Timer Phase (9 states matching TypeScript TimerStatus) ──

enum class TimerPhase : uint8_t {
  idle,
  focusing,
  paused,
  short_break,
  long_break,
  break_paused,
  reflection,
  completed,
  abandoned,
};

// ── Timer Event (10 event types per ADR-004) ──
// Note: CONTINUE and FINISH events will be added when #186 lands
// (open-ended session cycling from Stream B).

enum class TimerEvent : uint8_t {
  START,
  PAUSE,
  RESUME,
  TICK,
  TIMER_DONE,
  SKIP,
  SUBMIT,
  SKIP_BREAK,
  ABANDON,
  RESET,
};

// ── Break Type (used by break_paused state) ──

enum class BreakType : uint8_t {
  short_break,
  long_break,
};

// ── Timer Configuration ──
// All durations in seconds. Matches TimerConfig in types.ts.

struct TimerConfig {
  uint32_t focusDuration;
  uint32_t shortBreakDuration;
  uint32_t longBreakDuration;
  uint32_t sessionsBeforeLongBreak;
  bool reflectionEnabled;
};

// Default configuration: 25min focus, 5min short break, 15min long break,
// long break every 4 sessions, reflection enabled.
constexpr TimerConfig DEFAULT_TIMER_CONFIG = {
    .focusDuration = 25 * 60,
    .shortBreakDuration = 5 * 60,
    .longBreakDuration = 15 * 60,
    .sessionsBeforeLongBreak = 4,
    .reflectionEnabled = true,
};

// ── Timer State ──
// Flat struct representation of the TypeScript discriminated union.
// The active `phase` determines which fields are meaningful:
//
//   idle:         config
//   focusing:     timeRemaining, startedAt, sessionNumber, config
//   paused:       timeRemaining, pausedAt, sessionNumber, config
//   short_break:  timeRemaining, startedAt, sessionNumber, config
//   long_break:   timeRemaining, startedAt, sessionNumber, config
//   break_paused: timeRemaining, pausedAt, breakType, sessionNumber, config
//   reflection:   sessionNumber, config
//   completed:    sessionNumber, config
//   abandoned:    sessionNumber, config

struct TimerState {
  TimerPhase phase;
  uint32_t timeRemaining;      // Seconds remaining in current phase
  unsigned long startedAt;     // millis() timestamp when phase started
  unsigned long pausedAt;      // millis() timestamp when paused
  uint32_t sessionNumber;      // Current focus session number (1-based)
  TimerConfig config;          // Timer configuration
  BreakType breakType;         // Only meaningful in break_paused phase
};

// Create an idle timer state with the given configuration.
constexpr TimerState createIdleState(TimerConfig config) {
  return {
      .phase = TimerPhase::idle,
      .timeRemaining = 0,
      .startedAt = 0,
      .pausedAt = 0,
      .sessionNumber = 0,
      .config = config,
      .breakType = BreakType::short_break,
  };
}

#endif // POMOFOCUS_TIMER_H
