// PomoFocus Device Firmware — Rotary Encoder Input Handler
// KY-040 rotary encoder rotation detection with software debouncing.
// Hardware: 100nF caps on CLK-GND and DT-GND (ADR-010).
// Pins: D4 = CLK, D5 = DT (interrupt-capable on nRF52840).
//
// Algorithm: Gray-code state table. Each CLK transition triggers an ISR
// that samples both CLK and DT to form a 2-bit state. Combined with
// the previous state (4-bit index), a lookup table yields +1 (CW),
// -1 (CCW), or 0 (invalid/bounce). Software debouncing adds a minimum
// interval between accepted transitions to filter residual bounce that
// passes through the 100nF hardware caps at 64 MHz sampling speed.

#include "input.h"

// --- Pin assignments (from design doc pin table) ---
// XIAO nRF52840 D4 = nRF52840 P0.04 = Feather variant A0 (Arduino index 14)
// XIAO nRF52840 D5 = nRF52840 P0.05 = Feather variant A1 (Arduino index 15)
// The board JSON uses the feather_nrf52840_express variant which lacks XIAO
// Dx constants, so we map through the feather's analog pin names.
constexpr uint8_t PIN_ENC_CLK = A0;  // XIAO D4
constexpr uint8_t PIN_ENC_DT  = A1;  // XIAO D5

// --- Software debounce ---
// Minimum microseconds between accepted state transitions.
// 100nF caps handle most bounce; this catches residual at 64 MHz.
constexpr uint32_t DEBOUNCE_US = 1500;

// --- Gray-code state table ---
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

// --- Volatile ISR state ---
static volatile uint8_t  s_prev_state    = 0;
static volatile int8_t   s_pending_delta = 0; // accumulated +/- since last poll
static volatile uint32_t s_last_us       = 0; // timestamp of last accepted transition

// --- Non-volatile poll-side state ---
static int32_t        s_step_count = 0;
static EncoderCallback s_callback  = nullptr;

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
    return; // too soon — likely bounce
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

void input_init() {
  pinMode(PIN_ENC_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC_DT,  INPUT_PULLUP);

  // Sample initial state so the first transition has a valid reference.
  s_prev_state = read_encoder_state();
  s_last_us    = micros();

  // Attach interrupts on both pins for full Gray-code resolution.
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_CLK), encoder_isr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_DT),  encoder_isr, CHANGE);

  Serial.println("[input] encoder init: CLK=XIAO_D4(P0.04) DT=XIAO_D5(P0.05)");
}

void input_on_rotation(EncoderCallback cb) {
  s_callback = cb;
}

void input_poll() {
  // Atomically read and clear the pending delta from the ISR.
  noInterrupts();
  int8_t delta = s_pending_delta;
  s_pending_delta = 0;
  interrupts();

  if (delta == 0) {
    return;
  }

  // Each unit of delta represents one detent step.
  // Fast rotation may accumulate multiple steps between polls.
  // Process as individual steps so callers see one event per detent.
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

    if (s_callback != nullptr) {
      s_callback(dir, s_step_count);
    }
  }
}

int32_t input_step_count() {
  return s_step_count;
}
