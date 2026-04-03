// PomoFocus Device Firmware — BLE SoftDevice Manager
// Initializes nRF52840 BLE SoftDevice (S140) via Adafruit Bluefruit,
// configures advertising with device name and Timer Service UUID.
// See ADR-010 (hardware) and ADR-013 (GATT protocol) for design decisions.

#ifndef POMOFOCUS_BLE_MANAGER_H
#define POMOFOCUS_BLE_MANAGER_H

#include <cstdint>

// ── Device identity ──

// BLE advertised device name. Matches ADR-013 advertising spec.
constexpr const char* BLE_DEVICE_NAME = "PomoFocus";

// ── Timer Service UUID ──
// Primary service UUID included in advertising packets for discovery.
// Full 128-bit UUID: 504D4643-0001-CAFE-FACE-DEAD00000000
// See ADR-013 UUID scheme: PMFC{XXXX}-CAFE-FACE-DEAD-P0M0F0CUS00
// Byte array in little-endian order for Bluefruit API.
constexpr uint8_t TIMER_SERVICE_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x00, 0x43, 0x46, 0x4D, 0x50
};

// ── Advertising parameters ──

// Fast advertising interval in units of 0.625ms.
// 160 * 0.625ms = 100ms (ADR-013: ~100ms for discoverability).
constexpr uint16_t ADV_INTERVAL_FAST = 160;

// Advertising timeout: 0 = advertise indefinitely until connected.
constexpr uint16_t ADV_TIMEOUT_SEC = 0;

// TX power level in dBm. 0 dBm is a good default for indoor range
// without excessive battery drain.
constexpr int8_t ADV_TX_POWER = 0;

// ── Public API ──

// Initialize BLE SoftDevice, configure advertising, and start advertising.
// Call once from setup() after Serial.begin().
// Logs initialization progress and any errors to Serial.
void ble_init();

#endif // POMOFOCUS_BLE_MANAGER_H
