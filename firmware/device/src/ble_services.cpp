// PomoFocus Device Firmware — BLE GATT Service Implementations
// See ble_services.h for interface documentation.
// See ADR-013 (GATT protocol) for characteristic specs.
//
// Timer Service (0001):
//   Timer State  (0101): Read + Notify — Protobuf-encoded TimerState
//   Timer Command (0102): Write — Protobuf-encoded TimerCommand
//
// Goal Service (0002):
//   Goal List (0201): Write — phone pushes GoalList Protobuf (full replace).
//   Selected Goal (0202): Read + Notify — device reports current selection.
//
// Session Sync Service (0003):
//   Sync Status  (0301): Read + Notify — reports pending sessions and sync state
//   Session Data (0302): Notify — device-to-phone bulk transfer (chunked protocol in 7A.7)
//   Sync Control (0303): Write — phone sends sync commands (START, ACK, etc.)
//
// Standard services:
//   Device Information (0x180A): read-only, set once at boot.
//   Battery (0x180F): Read + Notify. Placeholder (100%) until ADC in 7A.8.
//
// Encoding uses Nanopb (static buffers only, NAT-F01).
// Notifications use BLE NOTIFY (not INDICATE) per NAT-F07.
// Full chunked transfer protocol is deferred to issue 7A.7.
// This file registers characteristics and provides a stub Sync Control write handler.

#include "ble_services.h"
#include "ble_manager.h"
#include "timer.h"
#include "display.h"

#include <bluefruit.h>
#include <pb_encode.h>
#include <pb_decode.h>
#include "pomofocus.pb.h"

// ── Static encode buffers ──
// Max encoded size of TimerState is 38 bytes (from pomofocus.pb.h).
// Use a fixed buffer to avoid dynamic allocation (NAT-F01).
static uint8_t s_stateBuffer[pomofocus_ble_TimerState_size];

// pomofocus_ble_SyncStatus_size is 32 bytes (from pomofocus.pb.h).
// No dynamic allocation (NAT-F01).
static uint8_t s_syncStatusBuf[pomofocus_ble_SyncStatus_size];

// ── BLE objects — Timer Service ──
// Static instances — Bluefruit requires persistent objects.
static BLEService s_timerService(UUID_TIMER_SERVICE);
static BLECharacteristic s_timerStateChr(UUID_TIMER_STATE_CHAR);
static BLECharacteristic s_timerCommandChr(UUID_TIMER_COMMAND_CHAR);

// ── BLE objects — Goal Service ──
static BLEService s_goalService(UUID_GOAL_SERVICE);
static BLECharacteristic s_goalListChar(UUID_GOAL_LIST_CHAR);
static BLECharacteristic s_selectedGoalChar(UUID_GOAL_SELECTED_CHAR);

// ── BLE objects — Session Sync Service ──
static BLEService       s_syncService(UUID_SESSION_SYNC_SERVICE);
static BLECharacteristic s_syncStatusChar(UUID_SYNC_STATUS_CHAR);
static BLECharacteristic s_sessionDataChar(UUID_SESSION_DATA_CHAR);
static BLECharacteristic s_syncControlChar(UUID_SYNC_CONTROL_CHAR);

// ── Standard service instances ──
// Static module-level objects — zero dynamic allocation (NAT-F01).
static BLEDis s_deviceInfo;
static BLEBas s_battery;

// ── Command callback ──
static BleTimerCommandCallback s_commandCallback = nullptr;

// ── Goal Service static state ──

// Raw goal data from phone (Protobuf-decoded).
static pomofocus_ble_GoalList s_goalList = pomofocus_ble_GoalList_init_zero;

// Display-friendly copy of goals (for e-ink rendering).
static Display::GoalInfo s_displayGoals[Display::MAX_GOALS] = {};
static uint8_t s_goalCount = 0;

// Currently selected goal index.
static uint8_t s_selectedIndex = 0;

// Dirty flag: set when goals are updated via BLE, cleared by goal_service_goals_dirty().
static bool s_goalsDirty = false;

// ── Forward declarations ──
static void updateSelectedGoalValue();

// ══════════════════════════════════════════════════════════════════════
// Timer Service helpers
// ══════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════
// Goal Service helpers
// ══════════════════════════════════════════════════════════════════════

// Copy decoded Protobuf goals into Display::GoalInfo array.
static void syncGoalsToDisplay() {
    s_goalCount = static_cast<uint8_t>(s_goalList.goals_count);
    if (s_goalCount > Display::MAX_GOALS) {
        s_goalCount = Display::MAX_GOALS;
    }

    for (uint8_t i = 0; i < s_goalCount; i++) {
        const pomofocus_ble_Goal& src = s_goalList.goals[i];
        Display::GoalInfo& dst = s_displayGoals[i];

        // Copy title, truncating to MAX_GOAL_TITLE_LEN.
        strncpy(dst.title, src.title, Display::MAX_GOAL_TITLE_LEN);
        dst.title[Display::MAX_GOAL_TITLE_LEN] = '\0';

        dst.targetSessions = static_cast<uint8_t>(src.target_sessions);
        dst.completedSessions = static_cast<uint8_t>(src.completed_today);
    }

    // Clamp selected index to valid range.
    if (s_goalCount > 0 && s_selectedIndex >= s_goalCount) {
        s_selectedIndex = s_goalCount - 1;
    }
}

// Encode the current SelectedGoal into a static buffer and return
// the encoded size. Returns 0 on encode failure.
static uint8_t encodeSelectedGoal(uint8_t* buf, uint16_t bufSize) {
    pomofocus_ble_SelectedGoal msg = pomofocus_ble_SelectedGoal_init_zero;

    // Copy the goal_id from the selected goal (if any goals exist).
    if (s_goalCount > 0 && s_selectedIndex < s_goalCount) {
        const pomofocus_ble_Goal& goal = s_goalList.goals[s_selectedIndex];
        msg.goal_id.size = goal.id.size;
        memcpy(msg.goal_id.bytes, goal.id.bytes, goal.id.size);
    }
    // If no goals, goal_id stays zeroed (empty).

    pb_ostream_t stream = pb_ostream_from_buffer(buf, bufSize);
    if (!pb_encode(&stream, pomofocus_ble_SelectedGoal_fields, &msg)) {
        Serial.print("[goal] encode SelectedGoal failed: ");
        Serial.println(PB_GET_ERROR(&stream));
        return 0;
    }

    return static_cast<uint8_t>(stream.bytes_written);
}

// ── Goal Service BLE callbacks ──

// Called when the phone writes to the Goal List characteristic.
static void onGoalListWrite(uint16_t connHandle, BLECharacteristic* chr,
                            uint8_t* data, uint16_t len) {
    (void)connHandle;
    (void)chr;

    Serial.print("[goal] GoalList write received, len=");
    Serial.println(len);

    // Decode the GoalList Protobuf message.
    // Cannot use brace-init macro in assignment; zero the struct with memset.
    memset(&s_goalList, 0, sizeof(s_goalList));
    pb_istream_t stream = pb_istream_from_buffer(data, len);
    if (!pb_decode(&stream, pomofocus_ble_GoalList_fields, &s_goalList)) {
        Serial.print("[goal] decode GoalList failed: ");
        Serial.println(PB_GET_ERROR(&stream));
        return;
    }

    Serial.print("[goal] decoded ");
    Serial.print(s_goalList.goals_count);
    Serial.println(" goals");

    // Sync to display format.
    syncGoalsToDisplay();

    // Update the Selected Goal characteristic value (selection may have
    // been clamped if the new list is shorter).
    updateSelectedGoalValue();

    // Signal that goals were updated. main.cpp checks this flag and sets
    // g_displayDirty when appropriate (e.g. only in GOAL_SELECT mode).
    // We do NOT call Display::showGoalScreen() here — the BLE callback
    // must not override the current screen (user may be mid-focus-session).
    s_goalsDirty = true;
}

// Update the SelectedGoal characteristic value so BLE reads return
// the current selection. Called after goal list changes or selection changes.
static void updateSelectedGoalValue() {
    uint8_t buf[SELECTED_GOAL_MAX_SIZE] = {};
    uint8_t encoded = encodeSelectedGoal(buf, sizeof(buf));
    if (encoded > 0) {
        s_selectedGoalChar.write(buf, encoded);
    }
}

// ══════════════════════════════════════════════════════════════════════
// Session Sync Service helpers
// ══════════════════════════════════════════════════════════════════════

// ── Sync Control write callback ──
// Called when the phone writes a SyncControl Protobuf to characteristic 0303.
// Decodes the command and logs it. Full command handling deferred to 7A.7.

static void onSyncControlWrite(uint16_t connHandle, BLECharacteristic* chr,
                               uint8_t* data, uint16_t len) {
    (void)connHandle;
    (void)chr;

    pomofocus_ble_SyncControl ctrl = pomofocus_ble_SyncControl_init_zero;
    pb_istream_t stream = pb_istream_from_buffer(data, len);

    if (!pb_decode(&stream, pomofocus_ble_SyncControl_fields, &ctrl)) {
        Serial.print("[sync] decode error: ");
        Serial.println(PB_GET_ERROR(&stream));
        return;
    }

    Serial.print("[sync] control cmd=");
    Serial.print(static_cast<int>(ctrl.command));
    Serial.print(" ack_count=");
    Serial.println(ctrl.ack_count);
}

// ══════════════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════════════

void ble_services_init() {
  // ── Device Information Service (0x180A) ──
  // BLEDis::begin() registers the service with the SoftDevice.
  // Characteristics are set before begin() — Bluefruit copies the strings.
  s_deviceInfo.setManufacturer(DIS_MANUFACTURER_NAME);
  s_deviceInfo.setModel(DIS_MODEL_NUMBER);
  s_deviceInfo.setFirmwareRev(DIS_FIRMWARE_REVISION);
  s_deviceInfo.begin();

  Serial.println("[ble_svc] Device Info Service 0x180A registered");

  // ── Battery Service (0x180F) ──
  // BLEBas::begin() registers the service and Battery Level characteristic
  // (0x2A19) with Read + Notify permissions.
  s_battery.begin();

  // Set initial battery level to 100% (placeholder until ADC in 7A.8).
  s_battery.write(100);

  Serial.println("[ble_svc] Battery Service 0x180F registered (level=100%)");

  // ── Timer Service ──
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

  // ── Goal Service ──
  s_goalService.begin();

  // Goal List characteristic: Write.
  s_goalListChar.setProperties(CHR_PROPS_WRITE);
  s_goalListChar.setPermission(SECMODE_ENC_NO_MITM, SECMODE_ENC_NO_MITM);
  // Max size is the full GoalList Protobuf (up to 10 goals).
  s_goalListChar.setMaxLen(pomofocus_ble_GoalList_size);
  s_goalListChar.setWriteCallback(onGoalListWrite);
  s_goalListChar.begin();

  // Selected Goal characteristic: Read + Notify.
  // Bluefruit serves reads from the internal buffer -- no read callback needed.
  // We update the value via updateSelectedGoalValue() when selection changes.
  s_selectedGoalChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  s_selectedGoalChar.setPermission(SECMODE_ENC_NO_MITM, SECMODE_NO_ACCESS);
  s_selectedGoalChar.setMaxLen(SELECTED_GOAL_MAX_SIZE);
  s_selectedGoalChar.begin();

  // Set initial value (empty selection).
  updateSelectedGoalValue();

  Serial.println("[ble_svc] Goal Service initialized");

  // ── Session Sync Service ──
  // Begin the Session Sync Service.
  s_syncService.begin();

  // Sync Status (0301): Read + Notify.
  // Phone reads on connection to check pending sessions.
  // Device notifies on state changes during sync.
  s_syncStatusChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  s_syncStatusChar.setPermission(SECMODE_ENC_NO_MITM, SECMODE_NO_ACCESS);
  s_syncStatusChar.setMaxLen(pomofocus_ble_SyncStatus_size);
  s_syncStatusChar.begin();

  // Set initial sync status: idle, 0 pending, 0 total.
  ble_services_update_sync_status(0, 0,
      static_cast<uint8_t>(pomofocus_ble_SyncState_SYNC_STATE_IDLE));

  // Session Data (0302): Notify only.
  // Device sends session records to phone during bulk transfer.
  // No read property — data is streamed via notifications only.
  s_sessionDataChar.setProperties(CHR_PROPS_NOTIFY);
  s_sessionDataChar.setPermission(SECMODE_ENC_NO_MITM, SECMODE_NO_ACCESS);
  s_sessionDataChar.setMaxLen(pomofocus_ble_SessionRecord_size);
  s_sessionDataChar.begin();

  // Sync Control (0303): Write.
  // Phone writes sync commands (START, ACK, NACK, ABORT, CURSOR_UPDATE).
  s_syncControlChar.setProperties(CHR_PROPS_WRITE);
  s_syncControlChar.setPermission(SECMODE_NO_ACCESS, SECMODE_ENC_NO_MITM);
  s_syncControlChar.setMaxLen(pomofocus_ble_SyncControl_size);
  s_syncControlChar.setWriteCallback(onSyncControlWrite);
  s_syncControlChar.begin();

  Serial.println("[sync] session sync service registered");
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

void ble_services_update_sync_status(uint32_t pending, uint32_t total,
                                     uint8_t state) {
    pomofocus_ble_SyncStatus status = pomofocus_ble_SyncStatus_init_zero;
    status.pending_sessions = pending;
    status.total_stored = total;
    status.state = static_cast<pomofocus_ble_SyncState>(state);

    pb_ostream_t stream = pb_ostream_from_buffer(s_syncStatusBuf,
                                                  sizeof(s_syncStatusBuf));
    if (!pb_encode(&stream, pomofocus_ble_SyncStatus_fields, &status)) {
        Serial.print("[sync] encode error: ");
        Serial.println(PB_GET_ERROR(&stream));
        return;
    }

    s_syncStatusChar.write(s_syncStatusBuf,
                           static_cast<uint16_t>(stream.bytes_written));

    // If a central is subscribed, Bluefruit sends a notification automatically
    // when the characteristic value is updated via write().
    // Explicit notify() call is not needed — Bluefruit handles CCCD internally.
}

void ble_services_set_battery_level(uint8_t level) {
  uint8_t clamped = level > 100 ? 100 : level;
  s_battery.write(clamped);
  s_battery.notify(clamped);
}

// ── Goal Service public API ──

uint8_t goal_service_goal_count() {
    return s_goalCount;
}

const Display::GoalInfo* goal_service_goals() {
    return s_displayGoals;
}

uint8_t goal_service_selected_index() {
    return s_selectedIndex;
}

void goal_service_set_selected(uint8_t index) {
    if (index >= s_goalCount && s_goalCount > 0) {
        index = s_goalCount - 1;
    }
    s_selectedIndex = index;

    // Encode and send notification to connected phone.
    uint8_t buf[SELECTED_GOAL_MAX_SIZE] = {};
    uint8_t encoded = encodeSelectedGoal(buf, sizeof(buf));
    if (encoded > 0) {
        s_selectedGoalChar.write(buf, encoded);
        if (s_selectedGoalChar.notifyEnabled()) {
            s_selectedGoalChar.notify(buf, encoded);
            Serial.print("[goal] SelectedGoal notify sent, idx=");
            Serial.println(s_selectedIndex);
        }
    }
}

bool goal_service_goals_dirty() {
    bool dirty = s_goalsDirty;
    s_goalsDirty = false;
    return dirty;
}
