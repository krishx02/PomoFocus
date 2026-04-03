// PomoFocus Device Firmware — BLE SoftDevice Manager
// See ble_manager.h for interface documentation.
// See ADR-010 (hardware), ADR-012 (security), ADR-013 (GATT protocol).
//
// Uses Adafruit Bluefruit library (bundled with framework-arduinoadafruitnrf52)
// which wraps the Nordic SoftDevice S140. The Bluefruit API handles SoftDevice
// initialization, advertising packet construction, and connection management.
//
// Security: LE Secure Connections (LESC) with Passkey Entry. The device has
// a display (IO capability = Display Only), so the SoftDevice generates a
// 6-digit passkey which we show on the e-ink screen. The phone (keyboard
// capable) enters the code. Bonding is enabled by default so the Long Term
// Key (LTK) is persisted after the first pairing — subsequent connections
// skip the passkey step.
//
// NOTE: This file is named ble_manager.cpp (not ble.cpp) because the Nordic
// SoftDevice SDK ships its own ble.h. If our header were named ble.h, the
// Bluefruit library's #include "ble.h" would resolve to ours instead of the
// SoftDevice's, causing compilation failures.

#include "ble_manager.h"
#include "ble_services.h"
#include "display.h"

#include <bluefruit.h>

// Timer Service UUID object for advertising.
// Constructed from the 128-bit UUID byte array defined in ble_manager.h.
static BLEUuid s_timerServiceUuid(TIMER_SERVICE_UUID);

// ── Connection state ──

// Current connection handle. Valid only when s_connected is true.
static uint16_t s_connHandle = BLE_CONN_HANDLE_INVALID;

// Whether a central is currently connected.
static bool s_connected = false;

// Effective MTU negotiated with the connected central.
// Starts at BLE_DEFAULT_MTU (23) and updates after MTU exchange.
static uint16_t s_effectiveMtu = BLE_DEFAULT_MTU;

// ── Security callbacks ──

// Called by the SoftDevice when a passkey is generated during LESC pairing.
// Displays the 6-digit code on the e-ink screen so the user can enter it
// on their phone. The passkey parameter is 6 ASCII digit bytes (not null-
// terminated). match_request is false for Display Only IO capability.
// Returns true to accept the passkey (always, since we are display-only).
static bool onPasskeyDisplay(uint16_t connHandle, uint8_t const passkey[6],
                             bool matchRequest) {
    (void)matchRequest;  // Always false for Display Only IO caps

    Serial.print("[ble] passkey display: ");
    for (uint8_t i = 0; i < 6; i++) {
        Serial.print(static_cast<char>(passkey[i]));
    }
    Serial.print(" (conn=");
    Serial.print(connHandle);
    Serial.println(")");

    Display::showPasskeyScreen(passkey);

    return true;
}

// Called when the pairing process completes (success or failure).
// auth_status == BLE_GAP_SEC_STATUS_SUCCESS (0) means bonding keys
// were exchanged and persisted — subsequent connections will skip passkey.
static void onPairComplete(uint16_t connHandle, uint8_t authStatus) {
    Serial.print("[ble] pairing ");
    if (authStatus == BLE_GAP_SEC_STATUS_SUCCESS) {
        Serial.print("succeeded");
    } else {
        Serial.print("failed: 0x");
        Serial.print(authStatus, HEX);
    }
    Serial.print(" (conn=");
    Serial.print(connHandle);
    Serial.println(")");
}

// Called when a connection is secured (encrypted), either after initial
// pairing or after reconnecting with bonded keys.
static void onSecuredConnection(uint16_t connHandle) {
    Serial.print("[ble] connection secured (conn=");
    Serial.print(connHandle);
    Serial.println(")");
}

// ── Connection callbacks ──

static void onConnect(uint16_t connHandle) {
    s_connHandle = connHandle;
    s_connected = true;

    BLEConnection* conn = Bluefruit.Connection(connHandle);
    char peerName[32 + 1] = {};
    conn->getPeerName(peerName, sizeof(peerName));

    Serial.print("[ble] connected: handle=");
    Serial.print(connHandle);
    Serial.print(" peer=");
    Serial.println(peerName);

    // Request MTU exchange. The SoftDevice will negotiate with the central
    // and the result is available via conn->getMtu() after the exchange.
    // Bluefruit configures the SoftDevice to support BLE_MAX_MTU at init.
    // The actual negotiated MTU depends on the central's capability.
    // After requestMtu, the SoftDevice handles the L2CAP exchange;
    // we read the result immediately as Bluefruit applies it synchronously
    // for the Adafruit nRF52 stack.
    conn->requestMtuExchange(BLE_MAX_MTU);
    s_effectiveMtu = conn->getMtu();

    Serial.print("[ble] effective MTU=");
    Serial.print(s_effectiveMtu);
    Serial.print(" chunk_payload=");
    Serial.println(s_effectiveMtu - ATT_HEADER_SIZE - CHUNK_HEADER_SIZE);
}

static void onDisconnect(uint16_t connHandle, uint8_t reason) {
    s_connHandle = BLE_CONN_HANDLE_INVALID;
    s_connected = false;
    s_effectiveMtu = BLE_DEFAULT_MTU;

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

    // Configure maximum MTU the SoftDevice will accept during negotiation.
    // ADR-013: device supports up to 247 bytes. The central initiates the
    // MTU exchange and the SoftDevice responds with min(central_mtu, our_max).
    // Must be called BEFORE Bluefruit.begin() — it sets SoftDevice config
    // params that begin() applies when enabling the SoftDevice.
    Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);

    // Initialize Bluefruit with max connections: 1 peripheral, 0 central.
    // PomoFocus device is a peripheral only — the phone is the central.
    Bluefruit.begin(1, 0);

    // Set device name (appears in nRF Connect scan results).
    Bluefruit.setName(BLE_DEVICE_NAME);

    // Set TX power level.
    Bluefruit.setTxPower(ADV_TX_POWER);

    // Set connection supervision timeout. This determines how long the BLE
    // stack waits without receiving packets before declaring the connection
    // lost. 10 seconds is long enough to keep idle connections alive
    // indefinitely (the BLE stack sends empty PDUs as keep-alive within
    // the supervision window). This ensures the connection survives 10+
    // minutes idle as required by ADR-013.
    Bluefruit.Periph.setConnSupervisionTimeout(CONN_SUPERVISION_TIMEOUT);

    // ── Security configuration (ADR-012) ──
    // Initialize LESC key pair (uses nRF52840 CryptoCell-310 hardware).
    Bluefruit.Security.begin();

    // IO capability = Display Only. The device has an e-ink screen but
    // no keyboard or yes/no buttons. This tells the SoftDevice to use
    // Passkey Entry: it generates a 6-digit code, we display it, and
    // the phone (with keyboard) enters it.
    Bluefruit.Security.setIOCaps(true, false, false);

    // Enable Man-In-The-Middle protection. Required for Passkey Entry
    // pairing — without MITM, the SoftDevice falls back to Just Works.
    Bluefruit.Security.setMITM(true);

    // Register security callbacks.
    Bluefruit.Security.setPairPasskeyCallback(onPasskeyDisplay);
    Bluefruit.Security.setPairCompleteCallback(onPairComplete);
    Bluefruit.Security.setSecuredCallback(onSecuredConnection);

    Serial.println("[ble] security configured (LESC + Passkey Entry + bonding)");

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

bool ble_isConnected() {
    return s_connected;
}

uint16_t ble_getEffectiveMtu() {
    return s_effectiveMtu;
}

uint16_t ble_getChunkPayloadSize() {
    return s_effectiveMtu - ATT_HEADER_SIZE - CHUNK_HEADER_SIZE;
}
