// PomoFocus Device Firmware — E-ink Display Manager
// GxEPD2 driver for GDEQ0426T82 (SSD1677, 800x480, 219 PPI)
// connected via EN04 board 24-pin FPC connector.
// See ADR-010 for hardware details.

#ifndef POMOFOCUS_DISPLAY_H
#define POMOFOCUS_DISPLAY_H

#include <cstdint>
#include "timer.h"

namespace Display {

// Display dimensions (GDEQ0426T82)
constexpr uint16_t WIDTH = 800;
constexpr uint16_t HEIGHT = 480;

// Maximum title length for a goal (fits ~26 chars at text size 3 on 800px).
// Titles longer than this are truncated with ellipsis by rendering functions.
constexpr uint8_t MAX_GOAL_TITLE_LEN = 40;

// Maximum number of goals the device can hold at once.
// Synced from phone via BLE Goal Service (ADR-013).
constexpr uint8_t MAX_GOALS = 10;

// Goal data synced from phone. Fixed-size for zero dynamic allocation (NAT-F01).
struct GoalInfo {
    char title[MAX_GOAL_TITLE_LEN + 1];  // null-terminated
    uint8_t targetSessions;               // daily target
    uint8_t completedSessions;            // completed today
};

// Session summary shown on the completion screen.
struct SessionSummary {
    uint32_t focusDurationSec;            // actual focus time in seconds
    uint8_t sessionNumber;                // which session this was (1-based)
    char goalTitle[MAX_GOAL_TITLE_LEN + 1]; // goal this session was for
};

// Initialize display hardware: configures SPI pins for EN04 FPC
// connector, resets the display controller, and powers on.
// Call once from setup().
void init();

// Clear the entire screen to white using a full refresh.
void clear();

// Put the display controller into deep sleep for minimum power use.
// Requires a hardware reset (via init()) to wake.
void hibernate();

// Draw centered "PomoFocus" test pattern for hardware validation.
void showTestPattern();

// Idle screen: "Ready to focus" with today's session count and current goal.
void showIdleScreen(uint8_t sessionsToday, const char* currentGoalTitle);

// Goal selection menu: scrollable list with highlighted selection.
// goals: array of GoalInfo structs.
// goalCount: number of valid entries in goals (0..MAX_GOALS).
// selectedIndex: index of the currently highlighted goal.
void showGoalScreen(const GoalInfo* goals, uint8_t goalCount,
                    uint8_t selectedIndex);

// Session complete screen: summary of the finished session.
void showSessionComplete(const SessionSummary& summary);

// Render the timer screen: large MM:SS countdown, phase indicator,
// session number, and optional goal name. Full refresh.
//
//   minutes       — minutes remaining (0–99)
//   seconds       — seconds remaining (0–59)
//   phase         — current timer phase (from TimerPhase enum)
//   sessionNumber — current focus session number (1-based, 0 = not started)
//   goalName      — optional goal text (nullptr if none); truncated to fit
void showTimerScreen(uint32_t minutes, uint32_t seconds, TimerPhase phase,
                     uint32_t sessionNumber, const char* goalName);

} // namespace Display

#endif // POMOFOCUS_DISPLAY_H
