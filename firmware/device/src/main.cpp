// PomoFocus Device Firmware — EN04 (nRF52840 Plus)
// Arduino setup/loop skeleton. See ADR-010 and ADR-015.

#include <Arduino.h>
#include "input.h"
#include "timer.h"

// Serial baud rate for debug output (matches monitor_speed in platformio.ini)
constexpr uint32_t SERIAL_BAUD = 115200;

// LED blink duration in milliseconds
constexpr uint32_t LED_BLINK_MS = 500;

void setup() {
  Serial.begin(SERIAL_BAUD);

  // Wait briefly for serial connection on USB-native boards
  delay(1000);

  Serial.println("PomoFocus booting");

  // Blink built-in LED once to confirm firmware is running.
  // XIAO nRF52840 LED is active LOW: LOW = on, HIGH = off.
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  delay(LED_BLINK_MS);
  digitalWrite(LED_BUILTIN, HIGH);

  // Initialise rotary encoder input (CLK=D4, DT=D5).
  input_init();

  Serial.println("Setup complete");
}

void loop() {
  // Poll rotary encoder for pending rotation events.
  input_poll();
}
