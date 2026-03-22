// PomoFocus — Feedback drivers (LED + vibration motor)
// LED: Maps timer FSM states to LED behavior (steady, blink, pulse, off).
//   See ADR-010 for hardware: D9, simple on/off for v1 (no PWM).
// Vibration motor: Drives a coin vibration motor via 2N2222 NPN transistor.
//   Circuit: GPIO -> 1K resistor -> 2N2222 base, motor between V+ and collector,
//   1N4148 flyback diode across motor terminals (cathode to V+).
//   See ADR-010 for hardware details.

#ifndef POMOFOCUS_FEEDBACK_H
#define POMOFOCUS_FEEDBACK_H

#include <Arduino.h>

// ---------- LED indicator ----------

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

// ---------- Vibration motor ----------

// GPIO pin connected to 2N2222 base through 1K resistor.
// Arduino pin 2 on Adafruit nRF52 BSP (feather_nrf52840_express variant).
// Actual GPIO mapping depends on variant's g_ADigitalPinMap — confirm with
// hardware wiring. Pin must not conflict with EN04 display SPI or encoder.
constexpr uint8_t MOTOR_PIN = 2;

// Maximum number of steps in a vibration pattern (on/off pairs).
// Longest pattern is timer-end: 3 buzzes + 2 gaps + trailing off = 6 steps.
// Allocate 12 for headroom without dynamic allocation (NAT-F01).
constexpr uint8_t MAX_PATTERN_STEPS = 12;

enum class VibrationPattern : uint8_t {
  SHORT_BUZZ,
  LONG_BUZZ,
  DOUBLE_BUZZ,
  TIMER_END,
};

struct PatternStep {
  uint32_t durationMs;
  bool motorOn;
};

class Feedback {
public:
  void begin();
  void vibrate(uint32_t durationMs);
  void vibratePattern(VibrationPattern pattern);
  void update();
  bool isActive() const;

private:
  void setMotor(bool on);
  void loadPattern(const PatternStep* steps, uint8_t count);
  void advanceStep();

  PatternStep steps_[MAX_PATTERN_STEPS] = {};
  uint8_t stepCount_ = 0;
  uint8_t currentStep_ = 0;
  uint32_t stepStartMs_ = 0;
  bool active_ = false;
};

#endif // POMOFOCUS_FEEDBACK_H
