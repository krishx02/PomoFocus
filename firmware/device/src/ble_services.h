// PomoFocus Device Firmware — BLE GATT Service Definitions
// Timer Service: Timer State (Read+Notify) and Timer Command (Write).
// Session Sync Service: Sync Status (Read+Notify), Session Data (Notify),
//   and Sync Control (Write).
// Standard services: Device Information (0x180A) and Battery (0x180F).
// Protobuf-encoded payloads per ADR-013 GATT protocol design.
// See ADR-013 for UUIDs, properties, and behavior spec.

#ifndef POMOFOCUS_BLE_SERVICES_H
#define POMOFOCUS_BLE_SERVICES_H

#include "ble_uuids.h"

#include <cstdint>

// Forward declaration — avoids pulling timer.h into the header.
struct TimerState;
enum class TimerEvent : uint8_t;

// ── Callback type ──
// Called when a valid Timer Command is received over BLE.
// The handler should apply the event to the timer FSM and call
// ble_timer_notify_state() after the transition.
using BleTimerCommandCallback = void (*)(TimerEvent event);

// ── Device identity strings ──

constexpr const char* DIS_MANUFACTURER_NAME = "PomoFocus";
constexpr const char* DIS_MODEL_NUMBER      = "PF-001";
constexpr const char* DIS_FIRMWARE_REVISION  = "0.1.0";

// ── Public API ──

// Initialize all BLE GATT services (Timer, Session Sync, Device Info, Battery)
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

// Update the battery level characteristic (0x2A19).
// level: 0-100 percent. Values >100 are clamped to 100.
// Sends a BLE notification to connected clients if notify is enabled.
void ble_services_set_battery_level(uint8_t level);

#endif // POMOFOCUS_BLE_SERVICES_H
