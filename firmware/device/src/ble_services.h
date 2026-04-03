// PomoFocus Device Firmware — BLE GATT Service Definitions
// Timer Service: Timer State (Read+Notify) and Timer Command (Write).
// Protobuf-encoded payloads per ADR-013 GATT protocol design.
// See ADR-013 for UUIDs, properties, and behavior spec.

#ifndef POMOFOCUS_BLE_SERVICES_H
#define POMOFOCUS_BLE_SERVICES_H

#include <cstdint>

// Forward declaration — avoids pulling timer.h into the header.
struct TimerState;
enum class TimerEvent : uint8_t;

// ── Characteristic UUIDs (ADR-013 UUID scheme) ──
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

// ── Callback type ──
// Called when a valid Timer Command is received over BLE.
// The handler should apply the event to the timer FSM and call
// ble_timer_notify_state() after the transition.
using BleTimerCommandCallback = void (*)(TimerEvent event);

// ── Public API ──

// Initialize the Timer Service GATT characteristics and register
// them with the Bluefruit SoftDevice. Must be called after
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

#endif // POMOFOCUS_BLE_SERVICES_H
