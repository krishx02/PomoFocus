// PomoFocus LED state indicator driver.
// Maps timer FSM states to LED behavior (steady, blink, pulse, off).
// See ADR-010 for hardware: D9, simple on/off for v1 (no PWM).

#ifndef POMOFOCUS_FEEDBACK_H
#define POMOFOCUS_FEEDBACK_H

#include <Arduino.h>

// LED pin assignment — Arduino pin 9 (D9 on XIAO nRF52840, see design doc pin table).
// The feather_nrf52840_express variant maps pin 9 to P0.26 via g_ADigitalPinMap.
constexpr uint8_t PIN_LED_INDICATOR = 9;

// Timer states — direct mirror of packages/core/src/timer/types.ts TIMER_STATUS (NAT-F04).
// Using enum class to avoid polluting the global namespace.
enum class TimerStatus : uint8_t {
  IDLE,
  FOCUSING,
  PAUSED,
  SHORT_BREAK,
  LONG_BREAK,
  BREAK_PAUSED,
  REFLECTION,
  COMPLETED,
  ABANDONED,
};

// Blink timing constants
constexpr uint32_t BLINK_PERIOD_MS = 1000;   // 1Hz blink for paused states
constexpr uint32_t PULSE_PERIOD_MS = 2000;   // 0.5Hz pulse for break states

// Initialize LED GPIO pin as OUTPUT and turn off.
void initLed();

// Update LED output based on current timer state.
// Must be called from loop() — uses millis() for non-blocking blink/pulse.
//
// Behavior:
//   FOCUSING           -> steady on
//   PAUSED, BREAK_PAUSED -> blink ~1Hz (500ms on / 500ms off)
//   SHORT_BREAK, LONG_BREAK -> slow pulse ~0.5Hz (1000ms on / 1000ms off)
//   IDLE, REFLECTION, COMPLETED, ABANDONED -> off
void updateLed(TimerStatus status);

#endif // POMOFOCUS_FEEDBACK_H
