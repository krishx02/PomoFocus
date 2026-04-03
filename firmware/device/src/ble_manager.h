// PomoFocus Device Firmware — BLE SoftDevice Manager
// Initializes nRF52840 BLE SoftDevice (S140) via Adafruit Bluefruit,
// configures advertising with device name and Timer Service UUID,
// registers custom GATT services, and sets up LE Secure Connections
// (LESC) with Passkey Entry pairing.
// See ADR-010 (hardware), ADR-012 (security), and ADR-013 (GATT protocol).

#ifndef POMOFOCUS_BLE_MANAGER_H
#define POMOFOCUS_BLE_MANAGER_H

#include "ble_uuids.h"

// ── Device identity ──

// BLE advertised device name. Matches ADR-013 advertising spec.
constexpr const char* BLE_DEVICE_NAME = "PomoFocus";

// ── Advertising parameters ──

// Fast advertising interval in units of 0.625ms.
// 160 * 0.625ms = 100ms (ADR-013: ~100ms for discoverability).
constexpr uint16_t ADV_INTERVAL_FAST = 160;

// Advertising timeout: 0 = advertise indefinitely until connected.
constexpr uint16_t ADV_TIMEOUT_SEC = 0;

// TX power level in dBm. 0 dBm is a good default for indoor range
// without excessive battery drain.
constexpr int8_t ADV_TX_POWER = 0;

// ── MTU parameters ──

// Maximum MTU the device supports. ADR-013: adaptive MTU, device up to 247 bytes.
// nRF52840 SoftDevice S140 supports up to 247 bytes.
constexpr uint16_t BLE_MAX_MTU = 247;

// BLE 4.0 default MTU before negotiation.
constexpr uint16_t BLE_DEFAULT_MTU = 23;

// ATT protocol header overhead (3 bytes: 1 opcode + 2 handle).
constexpr uint16_t ATT_HEADER_SIZE = 3;

// Application-level chunk header overhead (4 bytes: sequence + flags + length).
// See ADR-013: chunk_payload_size = mtu - 3 ATT - 4 chunk header.
constexpr uint16_t CHUNK_HEADER_SIZE = 4;

// ── Connection parameters ──

// Connection supervision timeout in units of 10ms.
// 1000 * 10ms = 10 seconds. If no packets are exchanged within this window,
// the connection is considered lost. The BLE stack handles keep-alive
// automatically via empty PDUs within this window, so idle connections
// survive indefinitely as long as both devices are in range.
constexpr uint16_t CONN_SUPERVISION_TIMEOUT = 1000;

// ── Public API ──

// Initialize BLE SoftDevice, configure advertising, and start advertising.
// Call once from setup() after Serial.begin().
// Logs initialization progress and any errors to Serial.
void ble_init();

// Returns true if a central device is currently connected.
bool ble_isConnected();

// Returns the effective MTU negotiated with the connected central.
// Returns BLE_DEFAULT_MTU (23) if no connection is active or MTU
// has not been negotiated yet.
uint16_t ble_getEffectiveMtu();

// Returns the maximum chunk payload size for session sync transfers.
// Calculated as: effective_mtu - ATT_HEADER_SIZE - CHUNK_HEADER_SIZE.
// See ADR-013: chunk_payload_size = mtu - 3 - 4.
uint16_t ble_getChunkPayloadSize();

#endif // POMOFOCUS_BLE_MANAGER_H
