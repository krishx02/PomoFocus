// PomoFocus LED state indicator driver — implementation.
// Non-blocking blink/pulse using millis() timing (no delay, no interrupts).

#include "feedback.h"

// Module-level blink state — shared across blink modes so that a state
// transition resets cleanly (no leftover toggle from the previous mode).
// Named with underscore prefix to avoid collision with Adafruit BSP's
// ledOn(uint32_t) function in wiring_digital.h.
static uint32_t lastToggle = 0;
static bool ledIsOn = false;

void initLed() {
  pinMode(PIN_LED_INDICATOR, OUTPUT);
  digitalWrite(PIN_LED_INDICATOR, LOW);
}

// Non-blocking blink: toggles LED on/off at the given period.
// Called every loop() iteration — returns immediately when not yet time.
static void blinkWithPeriod(uint32_t periodMs) {
  const uint32_t now = millis();
  const uint32_t halfPeriod = periodMs / 2;

  if (now - lastToggle >= halfPeriod) {
    lastToggle = now;
    ledIsOn = !ledIsOn;
    digitalWrite(PIN_LED_INDICATOR, ledIsOn ? HIGH : LOW);
  }
}

void updateLed(TimerStatus status) {
  // Track previous status to reset blink timing on state transitions.
  static TimerStatus prevStatus = TimerStatus::IDLE;

  if (status != prevStatus) {
    prevStatus = status;
    // Reset blink state so the new mode starts from a clean off state.
    ledIsOn = false;
    lastToggle = millis();
    digitalWrite(PIN_LED_INDICATOR, LOW);
  }

  switch (status) {
    case TimerStatus::FOCUSING:
      // Steady on
      digitalWrite(PIN_LED_INDICATOR, HIGH);
      break;

    case TimerStatus::PAUSED:
    case TimerStatus::BREAK_PAUSED:
      // Blink ~1Hz (500ms on / 500ms off)
      blinkWithPeriod(BLINK_PERIOD_MS);
      break;

    case TimerStatus::SHORT_BREAK:
    case TimerStatus::LONG_BREAK:
      // Slow pulse ~0.5Hz (1000ms on / 1000ms off)
      blinkWithPeriod(PULSE_PERIOD_MS);
      break;

    case TimerStatus::IDLE:
    case TimerStatus::REFLECTION:
    case TimerStatus::COMPLETED:
    case TimerStatus::ABANDONED:
      // LED off
      digitalWrite(PIN_LED_INDICATOR, LOW);
      break;
  }
}
