// PomoFocus Device Firmware — EN04 (nRF52840 Plus)
// Arduino setup/loop skeleton. See ADR-010 and ADR-015.
// Input-to-timer event mapping wired in loop() (issue #221).

#include <Arduino.h>
#include "ble_manager.h"
#include "ble_services.h"
#include "display.h"
#include "input.h"
#include "timer.h"
#include "feedback.h"

// Serial baud rate for debug output (matches monitor_speed in platformio.ini)
constexpr uint32_t SERIAL_BAUD = 115200;

// LED blink duration in milliseconds
constexpr uint32_t LED_BLINK_MS = 500;

// Timer tick interval: 1 second (matches timer FSM expectation of 1 TICK per second)
constexpr uint32_t TICK_INTERVAL_MS = 1000;

// ---------- Application state ----------
// All static, zero dynamic allocation (NAT-F01).

static TimerState g_timerState = createIdleState(DEFAULT_TIMER_CONFIG);
static ScreenMode g_screenMode = ScreenMode::TIMER;
static uint8_t g_selectedGoal = 0;
static uint8_t g_sessionsToday = 0;
static unsigned long g_lastTickMs = 0;
static bool g_displayDirty = true;  // Force initial display update

// Goal data — synced from phone via BLE (stub for now).
static Display::GoalInfo g_goals[Display::MAX_GOALS] = {};
static uint8_t g_goalCount = 0;

// Feedback driver
static Feedback g_feedback;

// ---------- Display helpers ----------

// Map TimerPhase to feedback TimerStatus (separate enums due to different modules).
static TimerStatus phaseToStatus(TimerPhase phase) {
  switch (phase) {
    case TimerPhase::idle:         return TimerStatus::IDLE;
    case TimerPhase::focusing:     return TimerStatus::FOCUSING;
    case TimerPhase::paused:       return TimerStatus::PAUSED;
    case TimerPhase::short_break:  return TimerStatus::SHORT_BREAK;
    case TimerPhase::long_break:   return TimerStatus::LONG_BREAK;
    case TimerPhase::break_paused: return TimerStatus::BREAK_PAUSED;
    case TimerPhase::reflection:   return TimerStatus::REFLECTION;
    case TimerPhase::completed:    return TimerStatus::COMPLETED;
    case TimerPhase::abandoned:    return TimerStatus::ABANDONED;
  }
  return TimerStatus::IDLE;
}

// Get the title of the currently selected goal, or nullptr if none.
static const char* currentGoalTitle() {
  if (g_goalCount == 0 || g_selectedGoal >= g_goalCount) {
    return nullptr;
  }
  return g_goals[g_selectedGoal].title;
}

// Refresh the display based on current screen mode and timer state.
static void refreshDisplay() {
  if (g_screenMode == ScreenMode::GOAL_SELECT) {
    Display::showGoalScreen(g_goals, g_goalCount, g_selectedGoal);
    return;
  }

  // TIMER mode: choose screen based on phase
  switch (g_timerState.phase) {
    case TimerPhase::idle:
      Display::showIdleScreen(g_sessionsToday, currentGoalTitle());
      break;

    case TimerPhase::focusing:
    case TimerPhase::paused:
    case TimerPhase::short_break:
    case TimerPhase::long_break:
    case TimerPhase::break_paused: {
      uint32_t mins = g_timerState.timeRemaining / 60;
      uint32_t secs = g_timerState.timeRemaining % 60;
      Display::showTimerScreen(mins, secs, g_timerState.phase,
                               g_timerState.sessionNumber, currentGoalTitle());
      break;
    }

    case TimerPhase::reflection:
      Display::showTimerScreen(0, 0, TimerPhase::reflection,
                               g_timerState.sessionNumber, currentGoalTitle());
      break;

    case TimerPhase::completed: {
      Display::SessionSummary summary = {};
      summary.focusDurationSec = g_timerState.config.focusDuration;
      summary.sessionNumber = static_cast<uint8_t>(g_timerState.sessionNumber);
      const char* goal = currentGoalTitle();
      if (goal != nullptr) {
        strncpy(summary.goalTitle, goal, Display::MAX_GOAL_TITLE_LEN);
        summary.goalTitle[Display::MAX_GOAL_TITLE_LEN] = '\0';
      } else {
        summary.goalTitle[0] = '\0';
      }
      Display::showSessionComplete(summary);
      break;
    }

    case TimerPhase::abandoned:
      Display::showIdleScreen(g_sessionsToday, currentGoalTitle());
      break;
  }
}

// Apply a timer event: run the FSM transition and mark display dirty if state changed.
// Sends BLE notification on phase transitions (not per-tick countdown per ADR-013).
static void applyTimerEvent(TimerEvent event) {
  TimerPhase prevPhase = g_timerState.phase;
  uint32_t prevTime = g_timerState.timeRemaining;

  g_timerState = transition(g_timerState, event, millis());

  if (g_timerState.phase != prevPhase || g_timerState.timeRemaining != prevTime) {
    g_displayDirty = true;
  }

  // Send BLE notification only on phase transitions — no per-second countdown
  // notifications. Phone calculates countdown from remaining_seconds + local clock.
  if (g_timerState.phase != prevPhase) {
    ble_timer_notify_state(g_timerState);
  }

  // Track completed sessions
  if (prevPhase != TimerPhase::completed && g_timerState.phase == TimerPhase::completed) {
    g_sessionsToday++;
  }
}

// ---------- Input callbacks ----------

static void onRotation(RotationDir direction, int32_t /* step_count */) {
  if (g_screenMode == ScreenMode::GOAL_SELECT) {
    int8_t delta = input_map_rotation_to_goal_delta(direction);
    if (delta == 0) {
      return;
    }
    int16_t newIdx = static_cast<int16_t>(g_selectedGoal) + delta;
    if (newIdx < 0) {
      newIdx = 0;
    }
    if (newIdx >= g_goalCount) {
      newIdx = g_goalCount > 0 ? g_goalCount - 1 : 0;
    }
    if (static_cast<uint8_t>(newIdx) != g_selectedGoal) {
      g_selectedGoal = static_cast<uint8_t>(newIdx);
      g_displayDirty = true;
      Serial.print("[main] goal select idx=");
      Serial.println(g_selectedGoal);
    }
    return;
  }

  // In idle/timer mode, rotation while idle enters goal selection
  if (g_timerState.phase == TimerPhase::idle && g_goalCount > 0) {
    g_screenMode = ScreenMode::GOAL_SELECT;
    g_displayDirty = true;
    Serial.println("[main] entering goal select");
  }
}

static void onPress(PressEvent press) {
  // Goal select mode: press = select goal and return to timer
  if (g_screenMode == ScreenMode::GOAL_SELECT) {
    if (press == PressEvent::SHORT_PRESS) {
      g_screenMode = ScreenMode::TIMER;
      g_displayDirty = true;
      Serial.print("[main] goal selected idx=");
      Serial.println(g_selectedGoal);
    }
    return;
  }

  // Timer mode: map press to timer FSM event
  MappedEvent mapped = input_map_press(g_timerState.phase, press);
  if (mapped.valid) {
    Serial.print("[main] timer event from press: ");
    Serial.println(static_cast<uint8_t>(mapped.event));
    applyTimerEvent(mapped.event);

    // Haptic feedback on user-initiated actions
    if (press == PressEvent::LONG_PRESS) {
      g_feedback.vibratePattern(VibrationPattern::LONG_BUZZ);
    } else {
      g_feedback.vibratePattern(VibrationPattern::SHORT_BUZZ);
    }
  }
}

// ---------- BLE command handler ----------

// Called when a Timer Command is received over BLE.
// Applies the event to the timer FSM — applyTimerEvent handles
// the state transition, display dirty flag, and BLE notification.
static void onBleTimerCommand(TimerEvent event) {
  Serial.print("[main] BLE timer event: ");
  Serial.println(static_cast<uint8_t>(event));
  applyTimerEvent(event);
}

// ---------- Arduino entry points ----------

void setup() {
  Serial.begin(SERIAL_BAUD);

  // Wait briefly for serial connection on USB-native boards
  delay(1000);

  Serial.println("PomoFocus booting");

  // Blink built-in LED once to confirm firmware is running.
  // XIAO nRF52840 LED is active LOW: LOW = on, HIGH = off.
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  delay(LED_BLINK_MS);
  digitalWrite(LED_BUILTIN, HIGH);

  // Initialize BLE SoftDevice and start advertising.
  ble_init();

  // Register BLE timer command handler — receives events from phone.
  ble_set_timer_command_callback(onBleTimerCommand);

  // Initialize e-ink display and show idle screen.
  Display::init();

  // Initialize rotary encoder input (rotation + press).
  input_init();
  input_on_rotation(onRotation);
  input_set_press_callback(onPress);

  // Initialize feedback drivers.
  initLed();
  g_feedback.begin();

  // Initialize timer tick baseline.
  g_lastTickMs = millis();

  Serial.println("Setup complete");
}

void loop() {
  unsigned long now = millis();

  // Poll rotary encoder for rotation and press events.
  input_poll();

  // Timer tick: send TICK event every second while timer is running.
  if (now - g_lastTickMs >= TICK_INTERVAL_MS) {
    g_lastTickMs = now;

    TimerPhase phase = g_timerState.phase;
    if (phase == TimerPhase::focusing ||
        phase == TimerPhase::short_break ||
        phase == TimerPhase::long_break) {
      applyTimerEvent(TimerEvent::TICK);

      // Check if time ran out — fire TIMER_DONE
      if (g_timerState.timeRemaining == 0) {
        g_feedback.vibratePattern(VibrationPattern::TIMER_END);
        applyTimerEvent(TimerEvent::TIMER_DONE);
      }
    }
  }

  // Update LED based on current timer state.
  updateLed(phaseToStatus(g_timerState.phase));

  // Update vibration motor (non-blocking pattern playback).
  g_feedback.update();

  // Refresh display only when state changes (e-ink is slow).
  if (g_displayDirty) {
    g_displayDirty = false;
    refreshDisplay();
  }
}
