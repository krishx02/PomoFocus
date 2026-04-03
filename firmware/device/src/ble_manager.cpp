// PomoFocus Device Firmware — BLE SoftDevice Manager
// See ble_manager.h for interface documentation.
// See ADR-010 (hardware) and ADR-013 (GATT protocol) for design decisions.
//
// Uses Adafruit Bluefruit library (bundled with framework-arduinoadafruitnrf52)
// which wraps the Nordic SoftDevice S140. The Bluefruit API handles SoftDevice
// initialization, advertising packet construction, and connection management.
//
// This file initializes BLE and starts advertising only. GATT services and
// pairing are separate issues — not implemented here.
//
// NOTE: This file is named ble_manager.cpp (not ble.cpp) because the Nordic
// SoftDevice SDK ships its own ble.h. If our header were named ble.h, the
// Bluefruit library's #include "ble.h" would resolve to ours instead of the
// SoftDevice's, causing compilation failures.

#include "ble_manager.h"
#include "ble_services.h"

#include <bluefruit.h>

// Timer Service UUID object for advertising.
// Constructed from the 128-bit UUID byte array defined in ble_manager.h.
static BLEUuid s_timerServiceUuid(TIMER_SERVICE_UUID);

// ── Connection callbacks ──

static void onConnect(uint16_t connHandle) {
    BLEConnection* conn = Bluefruit.Connection(connHandle);
    char peerName[32 + 1] = {};
    conn->getPeerName(peerName, sizeof(peerName));

    Serial.print("[ble] connected: handle=");
    Serial.print(connHandle);
    Serial.print(" peer=");
    Serial.println(peerName);
}

static void onDisconnect(uint16_t connHandle, uint8_t reason) {
    Serial.print("[ble] disconnected: handle=");
    Serial.print(connHandle);
    Serial.print(" reason=0x");
    Serial.println(reason, HEX);

    // Restart advertising after disconnect so the device remains discoverable.
    // Bluefruit can auto-restart, but explicit restart ensures consistent
    // behavior across SoftDevice versions.
    Bluefruit.Advertising.start(ADV_TIMEOUT_SEC);
}

// ── Advertising configuration ──

static void startAdvertising() {
    // Clear any previous advertising data.
    Bluefruit.Advertising.clearData();

    // Add flags: general discoverable + BLE only (no BR/EDR).
    Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);

    // Include TX power level in advertising packet.
    Bluefruit.Advertising.addTxPower();

    // Include the Timer Service UUID so scanners (nRF Connect) can filter by it.
    // Uses addUuid() to advertise the UUID without registering a full GATT service
    // (GATT services are separate issues — out of scope here).
    Bluefruit.Advertising.addUuid(s_timerServiceUuid);

    // Include the device name in the scan response packet.
    // The name may not fit in the 31-byte advertising packet alongside the
    // 128-bit UUID, so Bluefruit places it in the scan response automatically.
    Bluefruit.ScanResponse.addName();

    // Set advertising interval and timeout.
    Bluefruit.Advertising.setInterval(ADV_INTERVAL_FAST, ADV_INTERVAL_FAST);
    Bluefruit.Advertising.setFastTimeout(ADV_TIMEOUT_SEC);

    // Start advertising indefinitely.
    Bluefruit.Advertising.start(ADV_TIMEOUT_SEC);

    Serial.println("[ble] advertising started");
}

// ── Public API ──

void ble_init() {
    Serial.println("[ble] initializing SoftDevice");

    // Initialize Bluefruit with max connections: 1 peripheral, 0 central.
    // PomoFocus device is a peripheral only — the phone is the central.
    Bluefruit.begin(1, 0);

    // Set device name (appears in nRF Connect scan results).
    Bluefruit.setName(BLE_DEVICE_NAME);

    // Set TX power level.
    Bluefruit.setTxPower(ADV_TX_POWER);

    // Register connection callbacks.
    Bluefruit.Periph.setConnectCallback(onConnect);
    Bluefruit.Periph.setDisconnectCallback(onDisconnect);

    Serial.println("[ble] SoftDevice initialized");

    // Initialize GATT services before advertising starts.
    // Services must be registered before Bluefruit.Advertising.start().
    ble_services_init();

    // Configure and start advertising.
    startAdvertising();
}
