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

#endif // POMOFOCUS_INPUT_H
