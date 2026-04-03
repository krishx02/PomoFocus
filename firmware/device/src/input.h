// PomoFocus Device Firmware — Rotary Encoder Input Handler
// KY-040 rotary encoder: rotation (ISR + Gray-code) and press (polling + debounce).
// Hardware: 100nF caps on CLK-GND and DT-GND, internal pull-up on SW (ADR-010).
// Pins: D4 = CLK, D5 = DT, D2 = SW (see pin mapping below).

#ifndef POMOFOCUS_INPUT_H
#define POMOFOCUS_INPUT_H

#include <Arduino.h>

// --- XIAO nRF52840 pin mapping ---
// The PlatformIO board definition uses the feather_nrf52840_express variant,
// which has a different Arduino-index-to-GPIO mapping than the XIAO.
//
// XIAO pad -> nRF52840 GPIO -> Feather Arduino index
//   D0/A0     P0.02            A4 (index 18)
//   D1/A1     P0.03            A5 (index 19)
//   D2/A2     P0.28            A3 (index 17)
//   D4        P0.04            A0 (index 14)
//   D5        P0.05            A1 (index 15)

// --- Encoder pin assignments ---
constexpr uint8_t PIN_ENC_CLK = A0;  // XIAO D4, P0.04
constexpr uint8_t PIN_ENC_DT  = A1;  // XIAO D5, P0.05
constexpr uint8_t PIN_ENC_SW  = A3;  // XIAO D2, P0.28 — no pull-up on KY-040 module

// --- Rotation types ---

// Rotation direction reported by the encoder handler.
enum class RotationDir : int8_t {
  None = 0,
  Clockwise = 1,
  CounterClockwise = -1
};

// Callback invoked on each confirmed encoder detent.
// direction: CW (+1) or CCW (-1).
// step_count: cumulative signed step count since boot.
using EncoderCallback = void (*)(RotationDir direction, int32_t step_count);

// --- Press types ---

// Debounce timing for SW pin
constexpr uint32_t DEBOUNCE_MS = 50;

// Threshold separating short press from long press.
constexpr uint32_t LONG_PRESS_MS = 500;

enum class PressEvent : uint8_t {
  SHORT_PRESS,
  LONG_PRESS,
};

// Callback invoked on press release after debounce and ghost suppression.
using PressCallback = void (*)(PressEvent event);

// --- Public API ---

// Initialize encoder GPIO pins (CLK, DT, SW) and attach rotation interrupts.
// Must be called once from setup() after Serial.begin().
void input_init();

// Register a callback for rotation events.
// Pass nullptr to clear. Only one callback is supported.
void input_on_rotation(EncoderCallback cb);

// Register a callback for press events.
// Pass nullptr to clear. Only one callback is supported.
void input_set_press_callback(PressCallback callback);

// Poll for pending rotation and press events and dispatch callbacks.
// Call from loop() on every iteration.
void input_poll();

// Return the cumulative signed step count (CW increments, CCW decrements).
int32_t input_step_count();

// --- Input-to-Timer Event Mapping (issue #221) ---

#include "timer.h"

// Screen mode determines how encoder events are interpreted.
// TIMER: press/long-press maps to timer FSM events per current phase.
// GOAL_SELECT: rotation scrolls goals, press selects a goal.
enum class ScreenMode : uint8_t {
  TIMER,
  GOAL_SELECT,
};

// Result of mapping an encoder press to a timer event.
// valid=false means the press has no timer event mapping in the current state
// (e.g., rotation during focusing, or press in a terminal state).
struct MappedEvent {
  bool valid;
  TimerEvent event;
};

// Map a press event to a timer FSM event based on the current timer phase.
// Only meaningful in TIMER screen mode.
//
// Mapping table (from issue #221 acceptance criteria):
//   idle:         SHORT_PRESS -> START
//   focusing:     SHORT_PRESS -> PAUSE,   LONG_PRESS -> ABANDON
//   paused:       SHORT_PRESS -> RESUME,  LONG_PRESS -> ABANDON
//   short_break:  SHORT_PRESS -> SKIP_BREAK, LONG_PRESS -> ABANDON
//   long_break:   SHORT_PRESS -> SKIP_BREAK, LONG_PRESS -> ABANDON
//   break_paused: SHORT_PRESS -> SKIP_BREAK, LONG_PRESS -> ABANDON
//   reflection:   SHORT_PRESS -> SKIP (skip reflection on device)
//   completed:    SHORT_PRESS -> RESET
//   abandoned:    SHORT_PRESS -> RESET
MappedEvent input_map_press(TimerPhase phase, PressEvent press);

// Map a rotation event in GOAL_SELECT mode to a delta for the goal selection index.
// Returns +1 for CW (next goal), -1 for CCW (previous goal), 0 for no rotation.
int8_t input_map_rotation_to_goal_delta(RotationDir dir);

#endif // POMOFOCUS_INPUT_H
