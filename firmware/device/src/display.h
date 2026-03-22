// PomoFocus Device Firmware — E-ink Display Manager
// GxEPD2 driver for GDEQ0426T82 (SSD1677, 800x480, 219 PPI)
// connected via EN04 board 24-pin FPC connector.
// See ADR-010 for hardware details.

#ifndef POMOFOCUS_DISPLAY_H
#define POMOFOCUS_DISPLAY_H

#include <cstdint>

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

} // namespace Display

#endif // POMOFOCUS_DISPLAY_H
