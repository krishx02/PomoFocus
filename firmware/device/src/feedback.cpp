// PomoFocus — Feedback drivers implementation (LED + vibration motor)
// Non-blocking timing using millis() (no delay, no interrupts).
// Call updateLed() and Feedback::update() from loop().

#include "feedback.h"

// ==================== LED indicator ====================

// Module-level blink state — shared across blink modes so that a state
// transition resets cleanly (no leftover toggle from the previous mode).
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

// ==================== Vibration motor ====================

// Pattern definitions — static const, zero heap allocation (NAT-F01).

// Short buzz: 100ms on
constexpr PatternStep PATTERN_SHORT_BUZZ[] = {
  {100, true},
};
constexpr uint8_t PATTERN_SHORT_BUZZ_COUNT = 1;

// Long buzz: 400ms on
constexpr PatternStep PATTERN_LONG_BUZZ[] = {
  {400, true},
};
constexpr uint8_t PATTERN_LONG_BUZZ_COUNT = 1;

// Double buzz: 100ms on, 100ms off, 100ms on
constexpr PatternStep PATTERN_DOUBLE_BUZZ[] = {
  {100, true},
  {100, false},
  {100, true},
};
constexpr uint8_t PATTERN_DOUBLE_BUZZ_COUNT = 3;

// Timer end: 3 short buzzes (100ms) with 200ms gaps
// on 100ms -> off 200ms -> on 100ms -> off 200ms -> on 100ms
constexpr PatternStep PATTERN_TIMER_END[] = {
  {100, true},
  {200, false},
  {100, true},
  {200, false},
  {100, true},
};
constexpr uint8_t PATTERN_TIMER_END_COUNT = 5;

void Feedback::begin() {
  pinMode(MOTOR_PIN, OUTPUT);
  setMotor(false);
}

void Feedback::vibrate(uint32_t durationMs) {
  steps_[0] = {durationMs, true};
  stepCount_ = 1;
  currentStep_ = 0;
  stepStartMs_ = millis();
  active_ = true;
  setMotor(true);
}

void Feedback::vibratePattern(VibrationPattern pattern) {
  switch (pattern) {
    case VibrationPattern::SHORT_BUZZ:
      loadPattern(PATTERN_SHORT_BUZZ, PATTERN_SHORT_BUZZ_COUNT);
      break;
    case VibrationPattern::LONG_BUZZ:
      loadPattern(PATTERN_LONG_BUZZ, PATTERN_LONG_BUZZ_COUNT);
      break;
    case VibrationPattern::DOUBLE_BUZZ:
      loadPattern(PATTERN_DOUBLE_BUZZ, PATTERN_DOUBLE_BUZZ_COUNT);
      break;
    case VibrationPattern::TIMER_END:
      loadPattern(PATTERN_TIMER_END, PATTERN_TIMER_END_COUNT);
      break;
  }
}

void Feedback::update() {
  if (!active_) {
    return;
  }

  uint32_t elapsed = millis() - stepStartMs_;
  if (elapsed >= steps_[currentStep_].durationMs) {
    advanceStep();
  }
}

bool Feedback::isActive() const {
  return active_;
}

void Feedback::setMotor(bool on) {
  digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
}

void Feedback::loadPattern(const PatternStep* steps, uint8_t count) {
  uint8_t safeCount = (count > MAX_PATTERN_STEPS) ? MAX_PATTERN_STEPS : count;
  for (uint8_t i = 0; i < safeCount; ++i) {
    steps_[i] = steps[i];
  }
  stepCount_ = safeCount;
  currentStep_ = 0;
  stepStartMs_ = millis();
  active_ = true;
  setMotor(steps_[0].motorOn);
}

void Feedback::advanceStep() {
  ++currentStep_;
  if (currentStep_ >= stepCount_) {
    active_ = false;
    setMotor(false);
    return;
  }
  stepStartMs_ = millis();
  setMotor(steps_[currentStep_].motorOn);
}
