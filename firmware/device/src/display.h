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
