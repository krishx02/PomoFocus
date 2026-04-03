// PomoFocus Device Firmware — BLE GATT Service Definitions
// Timer Service: Timer State (Read+Notify) and Timer Command (Write).
// Session Sync Service: Sync Status (Read+Notify), Session Data (Notify),
//   and Sync Control (Write).
// Protobuf-encoded payloads per ADR-013 GATT protocol design.
// See ADR-013 for UUIDs, properties, and behavior spec.

#ifndef POMOFOCUS_BLE_SERVICES_H
#define POMOFOCUS_BLE_SERVICES_H

#include <cstdint>

// Forward declaration — avoids pulling timer.h into the header.
struct TimerState;
enum class TimerEvent : uint8_t;

// ── Timer Service Characteristic UUIDs (ADR-013 UUID scheme) ──
// Timer State: 504D4643-0101-CAFE-FACE-DEAD00000000
// Timer Command: 504D4643-0102-CAFE-FACE-DEAD00000000
// Byte arrays in little-endian order for Bluefruit API.

constexpr uint8_t TIMER_STATE_CHR_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x01, 0x43, 0x46, 0x4D, 0x50
};

constexpr uint8_t TIMER_COMMAND_CHR_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x01, 0x43, 0x46, 0x4D, 0x50
};

// ── Session Sync Service UUIDs ──
// Service UUID: 504D4643-0003-CAFE-FACE-DEAD00000000
// Byte arrays in little-endian order for Bluefruit API.

constexpr uint8_t SESSION_SYNC_SERVICE_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x03, 0x00, 0x43, 0x46, 0x4D, 0x50
};

// Sync Status characteristic (0301): Read + Notify
// Returns SyncStatus Protobuf (pending_sessions, total_stored, last_synced_id, state).
constexpr uint8_t SYNC_STATUS_CHAR_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x03, 0x43, 0x46, 0x4D, 0x50
};

// Session Data characteristic (0302): Notify
// Device-to-phone bulk session transfer. Chunked protocol in 7A.7.
constexpr uint8_t SESSION_DATA_CHAR_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x03, 0x43, 0x46, 0x4D, 0x50
};

// Sync Control characteristic (0303): Write
// Accepts SyncControl Protobuf from phone (START, ACK, NACK, ABORT, CURSOR_UPDATE).
constexpr uint8_t SYNC_CONTROL_CHAR_UUID[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x03, 0x03, 0x43, 0x46, 0x4D, 0x50
};

// ── Callback type ──
// Called when a valid Timer Command is received over BLE.
// The handler should apply the event to the timer FSM and call
// ble_timer_notify_state() after the transition.
using BleTimerCommandCallback = void (*)(TimerEvent event);

// ── Public API ──

// Initialize all BLE GATT services (Timer Service, Session Sync Service)
// and register them with the Bluefruit SoftDevice. Must be called after
// Bluefruit.begin() and before Bluefruit.Advertising.start().
void ble_services_init();

// Register a callback for incoming Timer Command writes.
// The callback receives the mapped TimerEvent. Pass nullptr to clear.
void ble_set_timer_command_callback(BleTimerCommandCallback cb);

// Encode the current timer state as a Protobuf TimerState message
// and send it as a BLE notification on the Timer State characteristic.
// Also updates the characteristic value so subsequent reads return
// the latest state. No-op if no client is subscribed to notifications.
void ble_timer_notify_state(const TimerState& state);

// Encode the current sync status as a SyncStatus Protobuf and update
// the Sync Status characteristic value. If a central is subscribed,
// a notification is sent automatically by the Bluefruit stack.
// pending: number of sessions waiting to sync.
// total: total sessions stored in flash.
// state: current SyncState enum value (from pomofocus.pb.h).
void ble_services_update_sync_status(uint32_t pending, uint32_t total,
                                     uint8_t state);

#endif // POMOFOCUS_BLE_SERVICES_H
