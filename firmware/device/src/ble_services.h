// PomoFocus Device Firmware — BLE GATT Service Definitions
// Timer Service: Timer State (Read+Notify) and Timer Command (Write).
// Goal Service: Goal List (Write) and Selected Goal (Read+Notify).
// Session Sync Service: Sync Status (Read+Notify), Session Data (Notify),
//   and Sync Control (Write).
// Standard services: Device Information (0x180A) and Battery (0x180F).
// Protobuf-encoded payloads per ADR-013 GATT protocol design.
// See ADR-013 for UUIDs, properties, and behavior spec.

#ifndef POMOFOCUS_BLE_SERVICES_H
#define POMOFOCUS_BLE_SERVICES_H

#include "ble_uuids.h"
#include "display.h"

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

// Maximum encoded size for SelectedGoal Protobuf (goal_id = 16 bytes UUID).
// From pomofocus.pb.h: pomofocus_ble_SelectedGoal_size = 18
constexpr uint16_t SELECTED_GOAL_MAX_SIZE = 18;

// ── Public API ──

// Initialize all BLE GATT services (Timer, Goal, Session Sync, Device Info, Battery)
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

// ── Goal Service API ──

// Returns the number of goals currently stored.
uint8_t goal_service_goal_count();

// Returns a pointer to the stored goals array (Display::GoalInfo format).
// Array has up to Display::MAX_GOALS entries; use goal_service_goal_count()
// for the valid count.
const Display::GoalInfo* goal_service_goals();

// Returns the index of the currently selected goal.
uint8_t goal_service_selected_index();

// Update the selected goal index (called when user selects via encoder).
// Sends a BLE notification to the connected phone if notifications are enabled.
void goal_service_set_selected(uint8_t index);

// Returns true if the goal list was updated via BLE since the last call.
// Resets the dirty flag on read. Use in main loop to trigger display refresh
// when in GOAL_SELECT mode without the BLE callback controlling the display.
bool goal_service_goals_dirty();

// Poll the chunked transfer state machine. If a transfer is active,
// prepares and sends the next chunk via Session Data (0302) notification.
// Call once per loop() iteration. Safe to call when no transfer is active.
void ble_services_poll_transfer();

#endif // POMOFOCUS_BLE_SERVICES_H
