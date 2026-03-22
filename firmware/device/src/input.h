// PomoFocus Device Firmware — Rotary Encoder Input Handler
// KY-040 rotary encoder on XIAO D4/CLK (P0.04) and D5/DT (P0.05).
// Software debouncing supplements 100nF hardware caps on CLK-GND and DT-GND.
// See ADR-010 for hardware platform and pin assignments.

#ifndef POMOFOCUS_INPUT_H
#define POMOFOCUS_INPUT_H

#include <Arduino.h>

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

// Initialise encoder GPIO pins and attach interrupts.
// Must be called once from setup() after Serial.begin().
void input_init();

// Register a callback for rotation events.
// Pass nullptr to clear. Only one callback is supported.
void input_on_rotation(EncoderCallback cb);

// Poll for pending rotation events and dispatch callbacks.
// Call from loop() on every iteration.
void input_poll();

// Return the cumulative signed step count (CW increments, CCW decrements).
int32_t input_step_count();

#endif // POMOFOCUS_INPUT_H
