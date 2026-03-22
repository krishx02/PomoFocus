// PomoFocus Device Firmware — Rotary Encoder Input Handler
// Rotation: Gray-code state table with ISR + software debounce.
// Press: polling-based debounce with short/long classification and ghost suppression.
// Hardware: 100nF caps on CLK-GND and DT-GND (ADR-010).

#include "input.h"

// ==================== Rotation (ISR-driven) ====================

// Software debounce: minimum microseconds between accepted state transitions.
// 100nF caps handle most bounce; this catches residual at 64 MHz.
constexpr uint32_t DEBOUNCE_US = 1500;

// Gray-code state table.
// Index: (previous_state << 2) | current_state
// Values: 0 = invalid/no-move, +1 = CW, -1 = CCW
// States are 2-bit: (CLK << 1) | DT
static constexpr int8_t STATE_TABLE[16] = {
   0,  // 00 -> 00: no change
  -1,  // 00 -> 01: CCW
   1,  // 00 -> 10: CW
   0,  // 00 -> 11: invalid (skipped state)
   1,  // 01 -> 00: CW
   0,  // 01 -> 01: no change
   0,  // 01 -> 10: invalid
  -1,  // 01 -> 11: CCW
  -1,  // 10 -> 00: CCW
   0,  // 10 -> 01: invalid
   0,  // 10 -> 10: no change
   1,  // 10 -> 11: CW
   0,  // 11 -> 00: invalid
   1,  // 11 -> 01: CW
  -1,  // 11 -> 10: CCW
   0   // 11 -> 11: no change
};

// Volatile ISR state
static volatile uint8_t  s_prev_state    = 0;
static volatile int8_t   s_pending_delta = 0;
static volatile uint32_t s_last_us       = 0;

// Non-volatile poll-side state
static int32_t        s_step_count = 0;
static EncoderCallback s_rotation_callback = nullptr;

// Read the current 2-bit Gray-code state from CLK and DT.
static inline uint8_t read_encoder_state() {
  uint8_t clk = static_cast<uint8_t>(digitalRead(PIN_ENC_CLK));
  uint8_t dt  = static_cast<uint8_t>(digitalRead(PIN_ENC_DT));
  return static_cast<uint8_t>((clk << 1) | dt);
}

// ISR: called on CLK or DT pin change.
static void encoder_isr() {
  uint32_t now = micros();
  if ((now - s_last_us) < DEBOUNCE_US) {
    return;
  }

  uint8_t current = read_encoder_state();
  uint8_t index   = static_cast<uint8_t>((s_prev_state << 2) | current);
  int8_t  delta   = STATE_TABLE[index];

  if (delta != 0) {
    s_pending_delta += delta;
    s_last_us = now;
  }

  s_prev_state = current;
}

// Poll rotation events and dispatch callbacks.
static void poll_rotation() {
  noInterrupts();
  int8_t delta = s_pending_delta;
  s_pending_delta = 0;
  interrupts();

  if (delta == 0) {
    return;
  }

  int8_t sign = (delta > 0) ? 1 : -1;
  int8_t count = (delta > 0) ? delta : -delta;

  for (int8_t i = 0; i < count; ++i) {
    s_step_count += sign;
    RotationDir dir = (sign > 0) ? RotationDir::Clockwise
                                 : RotationDir::CounterClockwise;

    const char* label = (dir == RotationDir::Clockwise) ? "CW" : "CCW";
    Serial.print("[input] ");
    Serial.print(label);
    Serial.print(" step=");
    Serial.println(s_step_count);

    if (s_rotation_callback != nullptr) {
      s_rotation_callback(dir, s_step_count);
    }
  }
}

// ==================== Press (polling-based) ====================

// Debounce state for SW pin
static bool     s_last_raw_sw     = HIGH;  // Pull-up: idle = HIGH
static bool     s_debounced_sw    = HIGH;
static uint32_t s_last_change_ms  = 0;

// Press tracking
static bool     s_press_active    = false;
static uint32_t s_press_start_ms  = 0;

// Rotation ghost suppression: snapshot CLK/DT at press-down.
// If they changed by release, the press is mechanical crosstalk.
static bool     s_clk_at_press    = HIGH;
static bool     s_dt_at_press     = HIGH;

static PressCallback s_press_callback = nullptr;

// Poll press events and dispatch callbacks.
static void poll_press() {
  const uint32_t now    = millis();
  const bool     raw_sw = digitalRead(PIN_ENC_SW);

  // Software debounce: reset timer on any raw state change.
  if (raw_sw != s_last_raw_sw) {
    s_last_change_ms = now;
    s_last_raw_sw    = raw_sw;
  }

  if ((now - s_last_change_ms) < DEBOUNCE_MS) {
    return;
  }

  const bool prev_debounced = s_debounced_sw;
  s_debounced_sw = raw_sw;

  // Press-down edge (HIGH -> LOW, pull-up: LOW = pressed)
  if (prev_debounced == HIGH && s_debounced_sw == LOW) {
    s_press_active   = true;
    s_press_start_ms = now;
    s_clk_at_press = digitalRead(PIN_ENC_CLK);
    s_dt_at_press  = digitalRead(PIN_ENC_DT);
    return;
  }

  // Release edge (LOW -> HIGH)
  if (prev_debounced == LOW && s_debounced_sw == HIGH && s_press_active) {
    s_press_active = false;

    // Ghost press suppression: CLK or DT changed during press = rotation crosstalk.
    const bool clk_now = digitalRead(PIN_ENC_CLK);
    const bool dt_now  = digitalRead(PIN_ENC_DT);
    if (clk_now != s_clk_at_press || dt_now != s_dt_at_press) {
      Serial.println("[input] ghost press suppressed (rotation detected)");
      return;
    }

    const uint32_t duration_ms = now - s_press_start_ms;
    PressEvent event;
    if (duration_ms >= LONG_PRESS_MS) {
      event = PressEvent::LONG_PRESS;
      Serial.print("[input] LONG_PRESS (");
    } else {
      event = PressEvent::SHORT_PRESS;
      Serial.print("[input] SHORT_PRESS (");
    }
    Serial.print(duration_ms);
    Serial.println("ms)");

    if (s_press_callback != nullptr) {
      s_press_callback(event);
    }
  }
}

// ==================== Public API ====================

void input_init() {
  // Rotation pins: INPUT_PULLUP for Gray-code ISR
  pinMode(PIN_ENC_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC_DT,  INPUT_PULLUP);

  s_prev_state = read_encoder_state();
  s_last_us    = micros();

  attachInterrupt(digitalPinToInterrupt(PIN_ENC_CLK), encoder_isr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_DT),  encoder_isr, CHANGE);

  // Press pin: INPUT_PULLUP (KY-040 has no pull-up on SW)
  pinMode(PIN_ENC_SW, INPUT_PULLUP);
  s_last_raw_sw    = digitalRead(PIN_ENC_SW);
  s_debounced_sw   = s_last_raw_sw;
  s_last_change_ms = millis();
  s_press_active   = false;

  Serial.println("[input] encoder init: CLK=D4(P0.04) DT=D5(P0.05) SW=D2(P0.28)");
}

void input_on_rotation(EncoderCallback cb) {
  s_rotation_callback = cb;
}

void input_set_press_callback(PressCallback callback) {
  s_press_callback = callback;
}

void input_poll() {
  poll_rotation();
  poll_press();
}

int32_t input_step_count() {
  return s_step_count;
}
