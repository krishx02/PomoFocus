// PomoFocus Timer FSM — Comprehensive unit tests for nRF52840 firmware.
// Covers every valid transition and verifies invalid events return state unchanged.
// Runs on host via PlatformIO native test runner: pio test -e native
//
// Maps to ADR-004 transition table and design doc research/designs/timer-state-machine.md.

#include <unity.h>
#include "timer.h"

// ── Test Configuration ──

static constexpr TimerConfig DEFAULT_CFG = {
    .focusDuration = 1500,           // 25 min
    .shortBreakDuration = 300,       // 5 min
    .longBreakDuration = 900,        // 15 min
    .sessionsBeforeLongBreak = 4,
    .reflectionEnabled = true,
};

static constexpr TimerConfig NO_REFLECTION_CFG = {
    .focusDuration = 1500,
    .shortBreakDuration = 300,
    .longBreakDuration = 900,
    .sessionsBeforeLongBreak = 4,
    .reflectionEnabled = false,
};

static constexpr unsigned long NOW = 10000;

// ── Helper: assert two TimerStates are equal field by field ──

static void assertStatesEqual(const TimerState& expected, const TimerState& actual,
                               int line) {
  TEST_ASSERT_EQUAL_INT_MESSAGE(
      static_cast<int>(expected.phase),
      static_cast<int>(actual.phase),
      "phase mismatch");
  TEST_ASSERT_EQUAL_UINT32_MESSAGE(expected.timeRemaining, actual.timeRemaining,
                                    "timeRemaining mismatch");
  TEST_ASSERT_EQUAL_MESSAGE(expected.startedAt, actual.startedAt,
                             "startedAt mismatch");
  TEST_ASSERT_EQUAL_MESSAGE(expected.pausedAt, actual.pausedAt,
                             "pausedAt mismatch");
  TEST_ASSERT_EQUAL_UINT32_MESSAGE(expected.sessionNumber, actual.sessionNumber,
                                    "sessionNumber mismatch");
  TEST_ASSERT_EQUAL_INT_MESSAGE(
      static_cast<int>(expected.breakType),
      static_cast<int>(actual.breakType),
      "breakType mismatch");
}

// ── Helper: create common states for testing ──

static TimerState makeFocusing(const TimerConfig& cfg, uint32_t session,
                                uint32_t remaining, unsigned long started) {
  TimerState s = {};
  s.phase = TimerPhase::focusing;
  s.timeRemaining = remaining;
  s.startedAt = started;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makePaused(const TimerConfig& cfg, uint32_t session,
                              uint32_t remaining, unsigned long paused) {
  TimerState s = {};
  s.phase = TimerPhase::paused;
  s.timeRemaining = remaining;
  s.startedAt = 0;
  s.pausedAt = paused;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makeShortBreak(const TimerConfig& cfg, uint32_t session,
                                  uint32_t remaining, unsigned long started) {
  TimerState s = {};
  s.phase = TimerPhase::short_break;
  s.timeRemaining = remaining;
  s.startedAt = started;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makeLongBreak(const TimerConfig& cfg, uint32_t session,
                                 uint32_t remaining, unsigned long started) {
  TimerState s = {};
  s.phase = TimerPhase::long_break;
  s.timeRemaining = remaining;
  s.startedAt = started;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makeBreakPaused(const TimerConfig& cfg, uint32_t session,
                                   uint32_t remaining, unsigned long paused,
                                   BreakType bt) {
  TimerState s = {};
  s.phase = TimerPhase::break_paused;
  s.timeRemaining = remaining;
  s.startedAt = 0;
  s.pausedAt = paused;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = bt;
  return s;
}

static TimerState makeReflection(const TimerConfig& cfg, uint32_t session) {
  TimerState s = {};
  s.phase = TimerPhase::reflection;
  s.timeRemaining = 0;
  s.startedAt = 0;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makeCompleted(const TimerConfig& cfg, uint32_t session) {
  TimerState s = {};
  s.phase = TimerPhase::completed;
  s.timeRemaining = 0;
  s.startedAt = 0;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

static TimerState makeAbandoned(const TimerConfig& cfg, uint32_t session,
                                 unsigned long abandonedAt) {
  TimerState s = {};
  s.phase = TimerPhase::abandoned;
  s.timeRemaining = 0;
  s.startedAt = abandonedAt;
  s.pausedAt = 0;
  s.sessionNumber = session;
  s.config = cfg;
  s.breakType = BreakType::short_break;
  return s;
}

// ════════════════════════════════════════════════════════════════
// Guards
// ════════════════════════════════════════════════════════════════

void test_isLongBreak_sessions_1_through_3_are_short(void) {
  TEST_ASSERT_FALSE(isLongBreak(1, DEFAULT_CFG));
  TEST_ASSERT_FALSE(isLongBreak(2, DEFAULT_CFG));
  TEST_ASSERT_FALSE(isLongBreak(3, DEFAULT_CFG));
}

void test_isLongBreak_session_4_is_long(void) {
  TEST_ASSERT_TRUE(isLongBreak(4, DEFAULT_CFG));
}

void test_isLongBreak_session_8_is_long(void) {
  TEST_ASSERT_TRUE(isLongBreak(8, DEFAULT_CFG));
}

void test_isLongBreak_sessions_5_6_7_are_short(void) {
  TEST_ASSERT_FALSE(isLongBreak(5, DEFAULT_CFG));
  TEST_ASSERT_FALSE(isLongBreak(6, DEFAULT_CFG));
  TEST_ASSERT_FALSE(isLongBreak(7, DEFAULT_CFG));
}

void test_isLongBreak_session_0_returns_false(void) {
  TEST_ASSERT_FALSE(isLongBreak(0, DEFAULT_CFG));
}

void test_isLongBreak_invalid_config_returns_false(void) {
  TimerConfig cfg = DEFAULT_CFG;
  cfg.sessionsBeforeLongBreak = 0;
  TEST_ASSERT_FALSE(isLongBreak(4, cfg));
}

void test_isReflectionEnabled_true(void) {
  TEST_ASSERT_TRUE(isReflectionEnabled(DEFAULT_CFG));
}

void test_isReflectionEnabled_false(void) {
  TEST_ASSERT_FALSE(isReflectionEnabled(NO_REFLECTION_CFG));
}

// ════════════════════════════════════════════════════════════════
// idle state
// ════════════════════════════════════════════════════════════════

void test_idle_START_transitions_to_focusing(void) {
  TimerState idle = createIdleState(DEFAULT_CFG);
  TimerState result = transition(idle, TimerEvent::START, NOW);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.focusDuration, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW, result.startedAt);
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_idle_START_uses_custom_focus_duration(void) {
  TimerConfig cfg = DEFAULT_CFG;
  cfg.focusDuration = 3000;
  TimerState idle = createIdleState(cfg);
  TimerState result = transition(idle, TimerEvent::START, NOW);

  TEST_ASSERT_EQUAL_UINT32(3000, result.timeRemaining);
}

void test_idle_invalid_events_return_unchanged(void) {
  TimerState idle = createIdleState(DEFAULT_CFG);

  TimerEvent invalid[] = {
      TimerEvent::PAUSE,      TimerEvent::RESUME,   TimerEvent::TICK,
      TimerEvent::TIMER_DONE, TimerEvent::SKIP,     TimerEvent::SUBMIT,
      TimerEvent::SKIP_BREAK, TimerEvent::ABANDON,  TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(idle, ev, NOW);
    assertStatesEqual(idle, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// focusing state
// ════════════════════════════════════════════════════════════════

void test_focusing_PAUSE_transitions_to_paused(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 1200, NOW);
  TimerState result = transition(state, TimerEvent::PAUSE, NOW + 300);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::paused),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1200, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 300, result.pausedAt);
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_focusing_TICK_decrements_timeRemaining(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 100, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(99, result.timeRemaining);
}

void test_focusing_TICK_does_not_go_below_zero(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 0, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL_UINT32(0, result.timeRemaining);
}

void test_focusing_TIMER_DONE_session1_goes_to_short_break(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 1500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.shortBreakDuration, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 1500, result.startedAt);
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_focusing_TIMER_DONE_session2_goes_to_short_break(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 2, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 1500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break),
                    static_cast<int>(result.phase));
}

void test_focusing_TIMER_DONE_session3_goes_to_short_break(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 3, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 1500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break),
                    static_cast<int>(result.phase));
}

void test_focusing_TIMER_DONE_session4_goes_to_long_break(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 4, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 1500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::long_break),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.longBreakDuration, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 1500, result.startedAt);
  TEST_ASSERT_EQUAL_UINT32(4, result.sessionNumber);
}

void test_focusing_TIMER_DONE_session8_goes_to_long_break(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 8, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 1500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::long_break),
                    static_cast<int>(result.phase));
}

void test_focusing_ABANDON_goes_to_abandoned(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 900, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 600);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
  TEST_ASSERT_EQUAL(NOW + 600, result.startedAt);
}

void test_focusing_invalid_events_return_unchanged(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 1200, NOW);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::RESUME,
      TimerEvent::SKIP,       TimerEvent::SUBMIT,
      TimerEvent::SKIP_BREAK, TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// paused state
// ════════════════════════════════════════════════════════════════

void test_paused_RESUME_transitions_to_focusing(void) {
  TimerState state = makePaused(DEFAULT_CFG, 1, 900, NOW);
  TimerState result = transition(state, TimerEvent::RESUME, NOW + 500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(900, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 500, result.startedAt);
  TEST_ASSERT_EQUAL_UINT32(0, result.pausedAt);
}

void test_paused_ABANDON_goes_to_abandoned(void) {
  TimerState state = makePaused(DEFAULT_CFG, 2, 600, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 500);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(2, result.sessionNumber);
}

void test_paused_invalid_events_return_unchanged(void) {
  TimerState state = makePaused(DEFAULT_CFG, 1, 900, NOW);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::PAUSE,
      TimerEvent::TICK,       TimerEvent::TIMER_DONE,
      TimerEvent::SKIP,       TimerEvent::SUBMIT,
      TimerEvent::SKIP_BREAK, TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// short_break state
// ════════════════════════════════════════════════════════════════

void test_short_break_PAUSE_transitions_to_break_paused(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::PAUSE, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::break_paused),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(200, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 100, result.pausedAt);
  TEST_ASSERT_EQUAL(static_cast<int>(BreakType::short_break),
                    static_cast<int>(result.breakType));
}

void test_short_break_TICK_decrements(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL_UINT32(199, result.timeRemaining);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break),
                    static_cast<int>(result.phase));
}

void test_short_break_TICK_does_not_go_below_zero(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 0, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL_UINT32(0, result.timeRemaining);
}

void test_short_break_TIMER_DONE_reflection_enabled_goes_to_reflection(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 300);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_short_break_TIMER_DONE_reflection_disabled_goes_to_focusing(void) {
  TimerState state = makeShortBreak(NO_REFLECTION_CFG, 1, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 300);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(NO_REFLECTION_CFG.focusDuration, result.timeRemaining);
  TEST_ASSERT_EQUAL_UINT32(2, result.sessionNumber);
}

void test_short_break_SKIP_BREAK_reflection_enabled_goes_to_reflection(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_short_break_SKIP_BREAK_reflection_disabled_goes_to_focusing(void) {
  TimerState state = makeShortBreak(NO_REFLECTION_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(2, result.sessionNumber);
}

void test_short_break_ABANDON_goes_to_abandoned(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_short_break_invalid_events_return_unchanged(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);

  TimerEvent invalid[] = {
      TimerEvent::START, TimerEvent::RESUME,
      TimerEvent::SKIP,  TimerEvent::SUBMIT,
      TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// long_break state
// ════════════════════════════════════════════════════════════════

void test_long_break_PAUSE_transitions_to_break_paused(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 800, NOW);
  TimerState result = transition(state, TimerEvent::PAUSE, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::break_paused),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(800, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 100, result.pausedAt);
  TEST_ASSERT_EQUAL(static_cast<int>(BreakType::long_break),
                    static_cast<int>(result.breakType));
}

void test_long_break_TICK_decrements(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 800, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL_UINT32(799, result.timeRemaining);
}

void test_long_break_TICK_does_not_go_below_zero(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 0, NOW);
  TimerState result = transition(state, TimerEvent::TICK, NOW + 1000);

  TEST_ASSERT_EQUAL_UINT32(0, result.timeRemaining);
}

void test_long_break_TIMER_DONE_reflection_enabled_goes_to_reflection(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 900);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(4, result.sessionNumber);
}

void test_long_break_TIMER_DONE_reflection_disabled_goes_to_focusing(void) {
  TimerState state = makeLongBreak(NO_REFLECTION_CFG, 4, 0, NOW);
  TimerState result = transition(state, TimerEvent::TIMER_DONE, NOW + 900);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(5, result.sessionNumber);
}

void test_long_break_SKIP_BREAK_reflection_enabled_goes_to_reflection(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 500, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

void test_long_break_SKIP_BREAK_reflection_disabled_goes_to_focusing(void) {
  TimerState state = makeLongBreak(NO_REFLECTION_CFG, 4, 500, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(5, result.sessionNumber);
}

void test_long_break_ABANDON_goes_to_abandoned(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 800, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_long_break_invalid_events_return_unchanged(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 800, NOW);

  TimerEvent invalid[] = {
      TimerEvent::START, TimerEvent::RESUME,
      TimerEvent::SKIP,  TimerEvent::SUBMIT,
      TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// break_paused state
// ════════════════════════════════════════════════════════════════

void test_break_paused_RESUME_short_goes_to_short_break(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 150, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::RESUME, NOW + 200);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(150, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 200, result.startedAt);
}

void test_break_paused_RESUME_long_goes_to_long_break(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 4, 600, NOW, BreakType::long_break);
  TimerState result = transition(state, TimerEvent::RESUME, NOW + 200);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::long_break),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(600, result.timeRemaining);
  TEST_ASSERT_EQUAL(NOW + 200, result.startedAt);
}

void test_break_paused_SKIP_BREAK_reflection_enabled_goes_to_reflection(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 150, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

void test_break_paused_SKIP_BREAK_reflection_disabled_goes_to_focusing(void) {
  TimerState state =
      makeBreakPaused(NO_REFLECTION_CFG, 1, 150, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(2, result.sessionNumber);
}

void test_break_paused_ABANDON_goes_to_abandoned(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 150, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_break_paused_invalid_events_return_unchanged(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 150, NOW, BreakType::short_break);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::PAUSE,
      TimerEvent::TICK,       TimerEvent::TIMER_DONE,
      TimerEvent::SKIP,       TimerEvent::SUBMIT,
      TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// reflection state
// ════════════════════════════════════════════════════════════════

void test_reflection_SUBMIT_goes_to_completed(void) {
  TimerState state = makeReflection(DEFAULT_CFG, 1);
  TimerState result = transition(state, TimerEvent::SUBMIT, NOW);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::completed),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_reflection_SKIP_goes_to_completed(void) {
  TimerState state = makeReflection(DEFAULT_CFG, 1);
  TimerState result = transition(state, TimerEvent::SKIP, NOW);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::completed),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(1, result.sessionNumber);
}

void test_reflection_invalid_events_return_unchanged(void) {
  TimerState state = makeReflection(DEFAULT_CFG, 1);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::PAUSE,
      TimerEvent::RESUME,     TimerEvent::TICK,
      TimerEvent::TIMER_DONE, TimerEvent::SKIP_BREAK,
      TimerEvent::ABANDON,    TimerEvent::RESET,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// completed state (terminal)
// ════════════════════════════════════════════════════════════════

void test_completed_RESET_returns_to_idle(void) {
  TimerState state = makeCompleted(DEFAULT_CFG, 3);
  TimerState result = transition(state, TimerEvent::RESET, NOW);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(0, result.sessionNumber);
  TEST_ASSERT_EQUAL_UINT32(0, result.timeRemaining);
}

void test_completed_invalid_events_return_unchanged(void) {
  TimerState state = makeCompleted(DEFAULT_CFG, 3);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::PAUSE,
      TimerEvent::RESUME,     TimerEvent::TICK,
      TimerEvent::TIMER_DONE, TimerEvent::SKIP,
      TimerEvent::SUBMIT,     TimerEvent::SKIP_BREAK,
      TimerEvent::ABANDON,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// abandoned state (terminal)
// ════════════════════════════════════════════════════════════════

void test_abandoned_RESET_returns_to_idle(void) {
  TimerState state = makeAbandoned(DEFAULT_CFG, 2, NOW);
  TimerState result = transition(state, TimerEvent::RESET, NOW + 5000);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(0, result.sessionNumber);
}

void test_abandoned_invalid_events_return_unchanged(void) {
  TimerState state = makeAbandoned(DEFAULT_CFG, 2, NOW);

  TimerEvent invalid[] = {
      TimerEvent::START,      TimerEvent::PAUSE,
      TimerEvent::RESUME,     TimerEvent::TICK,
      TimerEvent::TIMER_DONE, TimerEvent::SKIP,
      TimerEvent::SUBMIT,     TimerEvent::SKIP_BREAK,
      TimerEvent::ABANDON,
  };

  for (auto ev : invalid) {
    TimerState result = transition(state, ev, NOW + 100);
    assertStatesEqual(state, result, __LINE__);
  }
}

// ════════════════════════════════════════════════════════════════
// ABANDON from all active states (comprehensive check)
// ════════════════════════════════════════════════════════════════

void test_ABANDON_from_focusing(void) {
  TimerState state = makeFocusing(DEFAULT_CFG, 1, 1200, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_ABANDON_from_paused(void) {
  TimerState state = makePaused(DEFAULT_CFG, 1, 900, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_ABANDON_from_short_break(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_ABANDON_from_long_break(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 800, NOW);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

void test_ABANDON_from_break_paused(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 150, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::ABANDON, NOW + 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::abandoned),
                    static_cast<int>(result.phase));
}

// ════════════════════════════════════════════════════════════════
// Session number increment on focus completion
// ════════════════════════════════════════════════════════════════

void test_session_number_increments_after_break_end_reflection_disabled(void) {
  // Session 1 focus -> short break -> TIMER_DONE (no reflection) -> focusing session 2
  TimerState shortBrk = makeShortBreak(NO_REFLECTION_CFG, 1, 0, NOW);
  TimerState result = transition(shortBrk, TimerEvent::TIMER_DONE, NOW + 300);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(2, result.sessionNumber);
}

void test_session_number_increments_after_skip_break_reflection_disabled(void) {
  TimerState shortBrk = makeShortBreak(NO_REFLECTION_CFG, 2, 100, NOW);
  TimerState result = transition(shortBrk, TimerEvent::SKIP_BREAK, NOW + 100);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(3, result.sessionNumber);
}

void test_session_preserved_through_reflection(void) {
  // Session 1 -> break ends -> reflection -> completed: sessionNumber stays 1
  TimerState refl = makeReflection(DEFAULT_CFG, 1);
  TimerState completed = transition(refl, TimerEvent::SUBMIT, NOW);

  TEST_ASSERT_EQUAL_UINT32(1, completed.sessionNumber);
}

// ════════════════════════════════════════════════════════════════
// SKIP_BREAK comprehensive (from all break-related states)
// ════════════════════════════════════════════════════════════════

void test_SKIP_BREAK_from_short_break(void) {
  TimerState state = makeShortBreak(DEFAULT_CFG, 1, 200, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 50);

  // reflection enabled -> goes to reflection
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

void test_SKIP_BREAK_from_long_break(void) {
  TimerState state = makeLongBreak(DEFAULT_CFG, 4, 500, NOW);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 50);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

void test_SKIP_BREAK_from_break_paused_short(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 1, 100, NOW, BreakType::short_break);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 50);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

void test_SKIP_BREAK_from_break_paused_long(void) {
  TimerState state =
      makeBreakPaused(DEFAULT_CFG, 4, 400, NOW, BreakType::long_break);
  TimerState result = transition(state, TimerEvent::SKIP_BREAK, NOW + 50);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection),
                    static_cast<int>(result.phase));
}

// ════════════════════════════════════════════════════════════════
// RESET from terminal states
// ════════════════════════════════════════════════════════════════

void test_RESET_from_completed_preserves_config(void) {
  TimerState state = makeCompleted(DEFAULT_CFG, 4);
  TimerState result = transition(state, TimerEvent::RESET, NOW);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.focusDuration, result.config.focusDuration);
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.sessionsBeforeLongBreak,
                            result.config.sessionsBeforeLongBreak);
}

void test_RESET_from_abandoned_preserves_config(void) {
  TimerState state = makeAbandoned(DEFAULT_CFG, 2, NOW);
  TimerState result = transition(state, TimerEvent::RESET, NOW + 5000);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle),
                    static_cast<int>(result.phase));
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.focusDuration, result.config.focusDuration);
}

// ════════════════════════════════════════════════════════════════
// Multi-cycle integration: full session 1-4 cycle
// ════════════════════════════════════════════════════════════════

void test_full_four_session_cycle(void) {
  unsigned long t = 1000;

  // Start from idle
  TimerState state = createIdleState(NO_REFLECTION_CFG);

  // Session 1: idle -> focusing -> short_break -> focusing
  state = transition(state, TimerEvent::START, t);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(1, state.sessionNumber);

  state = transition(state, TimerEvent::TIMER_DONE, t += 1500);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(1, state.sessionNumber);

  state = transition(state, TimerEvent::TIMER_DONE, t += 300);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(2, state.sessionNumber);

  // Session 2: focusing -> short_break -> focusing
  state = transition(state, TimerEvent::TIMER_DONE, t += 1500);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break), static_cast<int>(state.phase));

  state = transition(state, TimerEvent::TIMER_DONE, t += 300);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(3, state.sessionNumber);

  // Session 3: focusing -> short_break -> focusing
  state = transition(state, TimerEvent::TIMER_DONE, t += 1500);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break), static_cast<int>(state.phase));

  state = transition(state, TimerEvent::TIMER_DONE, t += 300);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(4, state.sessionNumber);

  // Session 4: focusing -> long_break (isLongBreak guard fires)
  state = transition(state, TimerEvent::TIMER_DONE, t += 1500);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::long_break), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(4, state.sessionNumber);
  TEST_ASSERT_EQUAL_UINT32(NO_REFLECTION_CFG.longBreakDuration, state.timeRemaining);

  // Long break ends -> next focus session (session 5)
  state = transition(state, TimerEvent::TIMER_DONE, t += 900);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::focusing), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(5, state.sessionNumber);
}

void test_full_cycle_with_reflection(void) {
  unsigned long t = 1000;

  TimerState state = createIdleState(DEFAULT_CFG);

  // idle -> focusing (session 1)
  state = transition(state, TimerEvent::START, t);
  TEST_ASSERT_EQUAL_UINT32(1, state.sessionNumber);

  // focusing -> short_break
  state = transition(state, TimerEvent::TIMER_DONE, t += 1500);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::short_break), static_cast<int>(state.phase));

  // short_break -> reflection (reflection enabled)
  state = transition(state, TimerEvent::TIMER_DONE, t += 300);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::reflection), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(1, state.sessionNumber);

  // reflection -> completed
  state = transition(state, TimerEvent::SUBMIT, t += 10);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::completed), static_cast<int>(state.phase));

  // completed -> idle (reset)
  state = transition(state, TimerEvent::RESET, t += 100);
  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle), static_cast<int>(state.phase));
  TEST_ASSERT_EQUAL_UINT32(0, state.sessionNumber);
}

// ════════════════════════════════════════════════════════════════
// createIdleState
// ════════════════════════════════════════════════════════════════

void test_createIdleState_fields(void) {
  TimerState idle = createIdleState(DEFAULT_CFG);

  TEST_ASSERT_EQUAL(static_cast<int>(TimerPhase::idle),
                    static_cast<int>(idle.phase));
  TEST_ASSERT_EQUAL_UINT32(0, idle.timeRemaining);
  TEST_ASSERT_EQUAL(0UL, idle.startedAt);
  TEST_ASSERT_EQUAL(0UL, idle.pausedAt);
  TEST_ASSERT_EQUAL_UINT32(0, idle.sessionNumber);
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.focusDuration, idle.config.focusDuration);
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.shortBreakDuration,
                            idle.config.shortBreakDuration);
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.longBreakDuration,
                            idle.config.longBreakDuration);
  TEST_ASSERT_EQUAL_UINT32(DEFAULT_CFG.sessionsBeforeLongBreak,
                            idle.config.sessionsBeforeLongBreak);
  TEST_ASSERT_TRUE(idle.config.reflectionEnabled);
}

// ════════════════════════════════════════════════════════════════
// PlatformIO Unity entry point
// ════════════════════════════════════════════════════════════════

int main(void) {
  UNITY_BEGIN();

  // Guards
  RUN_TEST(test_isLongBreak_sessions_1_through_3_are_short);
  RUN_TEST(test_isLongBreak_session_4_is_long);
  RUN_TEST(test_isLongBreak_session_8_is_long);
  RUN_TEST(test_isLongBreak_sessions_5_6_7_are_short);
  RUN_TEST(test_isLongBreak_session_0_returns_false);
  RUN_TEST(test_isLongBreak_invalid_config_returns_false);
  RUN_TEST(test_isReflectionEnabled_true);
  RUN_TEST(test_isReflectionEnabled_false);

  // idle
  RUN_TEST(test_idle_START_transitions_to_focusing);
  RUN_TEST(test_idle_START_uses_custom_focus_duration);
  RUN_TEST(test_idle_invalid_events_return_unchanged);

  // focusing
  RUN_TEST(test_focusing_PAUSE_transitions_to_paused);
  RUN_TEST(test_focusing_TICK_decrements_timeRemaining);
  RUN_TEST(test_focusing_TICK_does_not_go_below_zero);
  RUN_TEST(test_focusing_TIMER_DONE_session1_goes_to_short_break);
  RUN_TEST(test_focusing_TIMER_DONE_session2_goes_to_short_break);
  RUN_TEST(test_focusing_TIMER_DONE_session3_goes_to_short_break);
  RUN_TEST(test_focusing_TIMER_DONE_session4_goes_to_long_break);
  RUN_TEST(test_focusing_TIMER_DONE_session8_goes_to_long_break);
  RUN_TEST(test_focusing_ABANDON_goes_to_abandoned);
  RUN_TEST(test_focusing_invalid_events_return_unchanged);

  // paused
  RUN_TEST(test_paused_RESUME_transitions_to_focusing);
  RUN_TEST(test_paused_ABANDON_goes_to_abandoned);
  RUN_TEST(test_paused_invalid_events_return_unchanged);

  // short_break
  RUN_TEST(test_short_break_PAUSE_transitions_to_break_paused);
  RUN_TEST(test_short_break_TICK_decrements);
  RUN_TEST(test_short_break_TICK_does_not_go_below_zero);
  RUN_TEST(test_short_break_TIMER_DONE_reflection_enabled_goes_to_reflection);
  RUN_TEST(test_short_break_TIMER_DONE_reflection_disabled_goes_to_focusing);
  RUN_TEST(test_short_break_SKIP_BREAK_reflection_enabled_goes_to_reflection);
  RUN_TEST(test_short_break_SKIP_BREAK_reflection_disabled_goes_to_focusing);
  RUN_TEST(test_short_break_ABANDON_goes_to_abandoned);
  RUN_TEST(test_short_break_invalid_events_return_unchanged);

  // long_break
  RUN_TEST(test_long_break_PAUSE_transitions_to_break_paused);
  RUN_TEST(test_long_break_TICK_decrements);
  RUN_TEST(test_long_break_TICK_does_not_go_below_zero);
  RUN_TEST(test_long_break_TIMER_DONE_reflection_enabled_goes_to_reflection);
  RUN_TEST(test_long_break_TIMER_DONE_reflection_disabled_goes_to_focusing);
  RUN_TEST(test_long_break_SKIP_BREAK_reflection_enabled_goes_to_reflection);
  RUN_TEST(test_long_break_SKIP_BREAK_reflection_disabled_goes_to_focusing);
  RUN_TEST(test_long_break_ABANDON_goes_to_abandoned);
  RUN_TEST(test_long_break_invalid_events_return_unchanged);

  // break_paused
  RUN_TEST(test_break_paused_RESUME_short_goes_to_short_break);
  RUN_TEST(test_break_paused_RESUME_long_goes_to_long_break);
  RUN_TEST(test_break_paused_SKIP_BREAK_reflection_enabled_goes_to_reflection);
  RUN_TEST(test_break_paused_SKIP_BREAK_reflection_disabled_goes_to_focusing);
  RUN_TEST(test_break_paused_ABANDON_goes_to_abandoned);
  RUN_TEST(test_break_paused_invalid_events_return_unchanged);

  // reflection
  RUN_TEST(test_reflection_SUBMIT_goes_to_completed);
  RUN_TEST(test_reflection_SKIP_goes_to_completed);
  RUN_TEST(test_reflection_invalid_events_return_unchanged);

  // completed (terminal)
  RUN_TEST(test_completed_RESET_returns_to_idle);
  RUN_TEST(test_completed_invalid_events_return_unchanged);

  // abandoned (terminal)
  RUN_TEST(test_abandoned_RESET_returns_to_idle);
  RUN_TEST(test_abandoned_invalid_events_return_unchanged);

  // ABANDON from all active states
  RUN_TEST(test_ABANDON_from_focusing);
  RUN_TEST(test_ABANDON_from_paused);
  RUN_TEST(test_ABANDON_from_short_break);
  RUN_TEST(test_ABANDON_from_long_break);
  RUN_TEST(test_ABANDON_from_break_paused);

  // Session number increments
  RUN_TEST(test_session_number_increments_after_break_end_reflection_disabled);
  RUN_TEST(test_session_number_increments_after_skip_break_reflection_disabled);
  RUN_TEST(test_session_preserved_through_reflection);

  // SKIP_BREAK comprehensive
  RUN_TEST(test_SKIP_BREAK_from_short_break);
  RUN_TEST(test_SKIP_BREAK_from_long_break);
  RUN_TEST(test_SKIP_BREAK_from_break_paused_short);
  RUN_TEST(test_SKIP_BREAK_from_break_paused_long);

  // RESET from terminal states
  RUN_TEST(test_RESET_from_completed_preserves_config);
  RUN_TEST(test_RESET_from_abandoned_preserves_config);

  // createIdleState
  RUN_TEST(test_createIdleState_fields);

  // Multi-cycle integration
  RUN_TEST(test_full_four_session_cycle);
  RUN_TEST(test_full_cycle_with_reflection);

  return UNITY_END();
}
