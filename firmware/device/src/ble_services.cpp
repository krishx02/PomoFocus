// PomoFocus Device Firmware — BLE GATT Service Implementations
// See ble_services.h for interface documentation.
// See ADR-013 (GATT protocol) for characteristic specs.
//
// Timer Service (0001):
//   Timer State  (0101): Read + Notify — Protobuf-encoded TimerState
//   Timer Command (0102): Write — Protobuf-encoded TimerCommand
//
// Encoding uses Nanopb (static buffers only, NAT-F01).
// Notifications use BLE NOTIFY (not INDICATE) per NAT-F07.

#include "ble_services.h"
#include "ble_manager.h"
#include "timer.h"

#include <bluefruit.h>
#include <pb_encode.h>
#include <pb_decode.h>
#include "pomofocus.pb.h"

// ── Static encode buffer ──
// Max encoded size of TimerState is 38 bytes (from pomofocus.pb.h).
// Use a fixed buffer to avoid dynamic allocation (NAT-F01).
static uint8_t s_stateBuffer[pomofocus_ble_TimerState_size];

// ── BLE objects ──
// Static instances — Bluefruit requires persistent objects.
static BLEService s_timerService(TIMER_SERVICE_UUID);
static BLECharacteristic s_timerStateChr(TIMER_STATE_CHR_UUID);
static BLECharacteristic s_timerCommandChr(TIMER_COMMAND_CHR_UUID);

// ── Command callback ──
static BleTimerCommandCallback s_commandCallback = nullptr;

// ── Helper: map Protobuf TimerAction to firmware TimerEvent ──
// Returns true if mapping succeeded, false for unknown actions.
static bool mapActionToEvent(pomofocus_ble_TimerAction action, TimerEvent& out) {
  switch (action) {
    case pomofocus_ble_TimerAction_TIMER_ACTION_START:
      out = TimerEvent::START;
      return true;
    case pomofocus_ble_TimerAction_TIMER_ACTION_PAUSE:
      out = TimerEvent::PAUSE;
      return true;
    case pomofocus_ble_TimerAction_TIMER_ACTION_RESUME:
      out = TimerEvent::RESUME;
      return true;
    case pomofocus_ble_TimerAction_TIMER_ACTION_ABANDON:
      out = TimerEvent::ABANDON;
      return true;
    case pomofocus_ble_TimerAction_TIMER_ACTION_SKIP_BREAK:
      out = TimerEvent::SKIP_BREAK;
      return true;
    case pomofocus_ble_TimerAction_TIMER_ACTION_RATE_SESSION:
      // RATE_SESSION maps to SUBMIT (reflection submission).
      out = TimerEvent::SUBMIT;
      return true;
    default:
      return false;
  }
}

// ── Helper: map firmware TimerPhase to Protobuf TimerPhase ──
static pomofocus_ble_TimerPhase mapPhaseToProto(TimerPhase phase) {
  switch (phase) {
    case TimerPhase::idle:         return pomofocus_ble_TimerPhase_TIMER_PHASE_IDLE;
    case TimerPhase::focusing:     return pomofocus_ble_TimerPhase_TIMER_PHASE_FOCUSING;
    case TimerPhase::paused:       return pomofocus_ble_TimerPhase_TIMER_PHASE_PAUSED;
    case TimerPhase::short_break:  return pomofocus_ble_TimerPhase_TIMER_PHASE_SHORT_BREAK;
    case TimerPhase::long_break:   return pomofocus_ble_TimerPhase_TIMER_PHASE_LONG_BREAK;
    case TimerPhase::break_paused: return pomofocus_ble_TimerPhase_TIMER_PHASE_BREAK_PAUSED;
    case TimerPhase::reflection:   return pomofocus_ble_TimerPhase_TIMER_PHASE_REFLECTION;
    case TimerPhase::completed:    return pomofocus_ble_TimerPhase_TIMER_PHASE_COMPLETED;
    case TimerPhase::abandoned:    return pomofocus_ble_TimerPhase_TIMER_PHASE_ABANDONED;
  }
  return pomofocus_ble_TimerPhase_TIMER_PHASE_IDLE;
}

// ── Helper: encode TimerState to Protobuf bytes ──
// Returns encoded size, or 0 on failure.
static size_t encodeTimerState(const TimerState& state, uint8_t* buf, size_t bufSize) {
  pomofocus_ble_TimerState pbState = pomofocus_ble_TimerState_init_zero;
  pbState.phase = mapPhaseToProto(state.phase);
  pbState.remaining_seconds = state.timeRemaining;

  // elapsed_seconds: compute from config duration minus remaining.
  // For phases with a countdown, elapsed = total - remaining.
  // For non-countdown phases (idle, reflection, completed, abandoned), elapsed = 0.
  switch (state.phase) {
    case TimerPhase::focusing:
    case TimerPhase::paused:
      pbState.elapsed_seconds = state.config.focusDuration - state.timeRemaining;
      break;
    case TimerPhase::short_break:
      pbState.elapsed_seconds = state.config.shortBreakDuration - state.timeRemaining;
      break;
    case TimerPhase::long_break:
      pbState.elapsed_seconds = state.config.longBreakDuration - state.timeRemaining;
      break;
    case TimerPhase::break_paused:
      if (state.breakType == BreakType::short_break) {
        pbState.elapsed_seconds = state.config.shortBreakDuration - state.timeRemaining;
      } else {
        pbState.elapsed_seconds = state.config.longBreakDuration - state.timeRemaining;
      }
      break;
    default:
      pbState.elapsed_seconds = 0;
      break;
  }

  // goal_id: not tracked on device side yet — leave empty (size = 0).
  pbState.goal_id.size = 0;

  pbState.session_count = state.sessionNumber;

  pb_ostream_t stream = pb_ostream_from_buffer(buf, bufSize);
  if (!pb_encode(&stream, pomofocus_ble_TimerState_fields, &pbState)) {
    Serial.print("[ble_svc] encode failed: ");
    Serial.println(PB_GET_ERROR(&stream));
    return 0;
  }
  return stream.bytes_written;
}

// ── Timer State read callback ──
// Called by Bluefruit when the phone reads the Timer State characteristic.
// We do NOT use this callback to set data — instead the characteristic
// value is kept updated via ble_timer_notify_state(). Bluefruit returns
// the last-written value automatically on read.

// ── Timer Command write callback ──
// Called by Bluefruit when the phone writes to the Timer Command characteristic.
static void onTimerCommandWrite(uint16_t connHandle, BLECharacteristic* chr,
                                uint8_t* data, uint16_t len) {
  (void)connHandle;
  (void)chr;

  // Decode the Protobuf TimerCommand
  pomofocus_ble_TimerCommand pbCmd = pomofocus_ble_TimerCommand_init_zero;
  pb_istream_t stream = pb_istream_from_buffer(data, len);
  if (!pb_decode(&stream, pomofocus_ble_TimerCommand_fields, &pbCmd)) {
    Serial.print("[ble_svc] decode failed: ");
    Serial.println(PB_GET_ERROR(&stream));
    return;  // Silently ignore malformed commands
  }

  // Map Protobuf action to firmware TimerEvent
  TimerEvent event = TimerEvent::START;  // placeholder
  if (!mapActionToEvent(pbCmd.action, event)) {
    Serial.print("[ble_svc] unknown action: ");
    Serial.println(static_cast<int>(pbCmd.action));
    return;  // Silently ignore unknown actions
  }

  Serial.print("[ble_svc] command received: action=");
  Serial.println(static_cast<int>(pbCmd.action));

  // Dispatch to the registered callback (main.cpp applies to FSM)
  if (s_commandCallback != nullptr) {
    s_commandCallback(event);
  }
}

// ── Public API ──

void ble_services_init() {
  // Begin the Timer Service
  s_timerService.begin();

  // Timer State characteristic: Read + Notify
  s_timerStateChr.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  s_timerStateChr.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  s_timerStateChr.setMaxLen(pomofocus_ble_TimerState_size);
  s_timerStateChr.setFixedLen(0);  // Variable length (Protobuf is variable)
  s_timerStateChr.begin();

  // Write initial idle state to the characteristic so reads work immediately.
  TimerState idle = createIdleState(DEFAULT_TIMER_CONFIG);
  size_t len = encodeTimerState(idle, s_stateBuffer, sizeof(s_stateBuffer));
  if (len > 0) {
    s_timerStateChr.write(s_stateBuffer, static_cast<uint16_t>(len));
  }

  // Timer Command characteristic: Write
  s_timerCommandChr.setProperties(CHR_PROPS_WRITE);
  s_timerCommandChr.setPermission(SECMODE_NO_ACCESS, SECMODE_OPEN);
  s_timerCommandChr.setMaxLen(pomofocus_ble_TimerCommand_size);
  s_timerCommandChr.setFixedLen(0);  // Variable length (Protobuf is variable)
  s_timerCommandChr.setWriteCallback(onTimerCommandWrite);
  s_timerCommandChr.begin();

  Serial.println("[ble_svc] Timer Service initialized");
}

void ble_set_timer_command_callback(BleTimerCommandCallback cb) {
  s_commandCallback = cb;
}

void ble_timer_notify_state(const TimerState& state) {
  size_t len = encodeTimerState(state, s_stateBuffer, sizeof(s_stateBuffer));
  if (len == 0) {
    return;  // Encode failed — logged in encodeTimerState
  }

  // Update the characteristic value (for subsequent reads).
  s_timerStateChr.write(s_stateBuffer, static_cast<uint16_t>(len));

  // Send notification if a client is subscribed.
  // notify() is a no-op if CCCD is not enabled — safe to call always.
  s_timerStateChr.notify(s_stateBuffer, static_cast<uint16_t>(len));

  Serial.print("[ble_svc] state notified: phase=");
  Serial.print(static_cast<int>(state.phase));
  Serial.print(" remaining=");
  Serial.println(state.timeRemaining);
}
