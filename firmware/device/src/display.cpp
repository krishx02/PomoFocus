// PomoFocus Device Firmware — E-ink Display Manager
// See display.h for interface documentation.
// See ADR-010 for hardware platform details.
//
// Pin mapping notes:
// The EN04 board routes XIAO nRF52840 pins to the 24-pin FPC e-ink connector.
// Since the PlatformIO board definition uses the Feather nRF52840 Express
// variant (no official XIAO variant exists in the Adafruit BSP), Arduino pin
// numbers do not match XIAO Dx labels. We map through nRF52840 GPIO numbers:
//
//   Function   XIAO pin   nRF52840 GPIO   Feather Arduino pin
//   --------   --------   -------------   -------------------
//   SPI MOSI   D1         P0.03           19 (A5)
//   SPI SCK    D2         P0.28           17 (A3)
//   EPD CS     D3         P0.29           20 (A6)
//   EPD DC     D0         P0.02           18 (A4)
//   EPD RST    D8         P1.13           — (not in Feather map)
//   EPD BUSY   D10        P0.15           24 (SPI MISO)
//
// EPD_RST (P1.13) is absent from the Feather variant's g_ADigitalPinMap,
// so GxEPD2 cannot use digitalWrite on it. We toggle RST manually via the
// nRF GPIO HAL before init, and pass rst=-1 to GxEPD2.

#include "display.h"

#include <GxEPD2_BW.h>
#include <gdeq/GxEPD2_426_GDEQ0426T82.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <nrf_gpio.h>
#include <cstring>
#include <cstdio>

// ---------- Pin definitions (Feather variant Arduino pin numbers) ----------
// These are indices into g_ADigitalPinMap that resolve to the correct
// nRF52840 GPIOs used by the EN04 board's FPC connector.

constexpr int16_t EPD_CS_PIN   = 20;  // Feather D20/A6 → P0.29 → XIAO D3
constexpr int16_t EPD_DC_PIN   = 18;  // Feather D18/A4 → P0.02 → XIAO D0
constexpr int16_t EPD_BUSY_PIN = 24;  // Feather D24/MISO → P0.15 → XIAO D10

// EPD RST is on P1.13 (XIAO D8), not in Feather variant map.
// Managed via nrf_gpio HAL — not passed to GxEPD2.
constexpr uint32_t EPD_RST_GPIO = NRF_GPIO_PIN_MAP(1, 13);

// SPI pin remapping (Feather variant Arduino pin numbers)
constexpr uint8_t SPI_MISO_PIN = 24;  // Feather D24 → P0.15 (shared with BUSY, unused by SPI)
constexpr uint8_t SPI_SCK_PIN  = 17;  // Feather D17/A3 → P0.28 → XIAO D2
constexpr uint8_t SPI_MOSI_PIN = 19;  // Feather D19/A5 → P0.03 → XIAO D1

// ---------- Display buffer sizing ----------
// GxEPD2_BW uses paged drawing. Page height determines RAM usage:
// buffer = WIDTH/8 * page_height = 100 * page_height bytes.
// 20 rows → 2000 bytes. 24 pages for full 480-row screen.
constexpr uint16_t PAGE_HEIGHT = 20;

// ---------- Display instance ----------
// GxEPD2_BW wraps the panel driver with Adafruit_GFX for text/graphics.
// rst=-1 because we handle RST manually (P1.13 not in variant map).
static GxEPD2_BW<GxEPD2_426_GDEQ0426T82, PAGE_HEIGHT> display(
    GxEPD2_426_GDEQ0426T82(EPD_CS_PIN, EPD_DC_PIN, /*rst=*/-1, EPD_BUSY_PIN));

// Hardware reset of the display controller via nRF GPIO HAL.
// Pulse RST low for 10ms, then wait 10ms for controller startup.
static void hardwareReset() {
    nrf_gpio_cfg_output(EPD_RST_GPIO);
    nrf_gpio_pin_set(EPD_RST_GPIO);
    delay(10);
    nrf_gpio_pin_clear(EPD_RST_GPIO);
    delay(10);
    nrf_gpio_pin_set(EPD_RST_GPIO);
    delay(10);
}

namespace Display {

void init() {
    // Remap SPI to the EN04 board's FPC-connected pins before GxEPD2
    // calls SPI.begin(). The Feather variant defaults (P0.13/P0.14/P0.15)
    // do not match the EN04's internal routing.
    SPI.setPins(SPI_MISO_PIN, SPI_SCK_PIN, SPI_MOSI_PIN);

    // Toggle RST manually since GxEPD2 cannot reach P1.13.
    hardwareReset();

    // Initialize the GxEPD2 driver. The second parameter (initial=true)
    // tells the driver this is a cold start — it will do a full
    // controller init rather than a partial wake-from-sleep.
    display.init(115200, true);

    // Landscape orientation: rotation 0 is default (800 wide x 480 tall).
    display.setRotation(0);

    Serial.println("Display initialized");
}

void clear() {
    // Full refresh to blank white. clearScreen writes 0xFF (white) to the
    // entire controller memory and triggers a full refresh cycle (~1.6s).
    display.clearScreen(0xFF);
    Serial.println("Display cleared");
}

void hibernate() {
    // Put the SSD1677 controller into deep sleep. Current draw drops to
    // near zero. Requires a hardware reset to wake — call init() again.
    // Note: GxEPD2 hibernate() is a no-op when rst < 0, so we call
    // powerOff() instead which turns off panel driving voltages.
    display.powerOff();
    Serial.println("Display powered off");
}

void showTestPattern() {
    // Use paged drawing to render centered "PomoFocus" text.
    // Paged drawing keeps RAM usage low: only PAGE_HEIGHT rows buffered.
    display.setTextColor(GxEPD_BLACK);
    display.setFont(nullptr);  // default Adafruit GFX 5x7 font
    display.setTextSize(5);    // 5x scale → 25x35 pixel characters

    // "PomoFocus" = 9 characters × 30px wide (5×5 + 5px spacing) = ~270px
    // Centered on 800×480: x = (800 - 270) / 2 ≈ 265, y = (480 - 35) / 2 ≈ 222
    constexpr int16_t TEXT_X = 265;
    constexpr int16_t TEXT_Y = 222;

    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.setCursor(TEXT_X, TEXT_Y);
        display.print("PomoFocus");
    } while (display.nextPage());

    Serial.println("Test pattern displayed");
}

// ---------- Timer screen ----------

// Map TimerPhase enum to a human-readable label for the display.
static const char* phaseLabel(TimerPhase phase) {
    switch (phase) {
        case TimerPhase::idle:         return "IDLE";
        case TimerPhase::focusing:     return "FOCUSING";
        case TimerPhase::paused:       return "PAUSED";
        case TimerPhase::short_break:  return "SHORT BREAK";
        case TimerPhase::long_break:   return "LONG BREAK";
        case TimerPhase::break_paused: return "BREAK PAUSED";
        case TimerPhase::reflection:   return "REFLECTION";
        case TimerPhase::completed:    return "COMPLETED";
        case TimerPhase::abandoned:    return "ABANDONED";
    }
    return "UNKNOWN";
}

// Text size scale factors (Adafruit GFX default 5x7 font):
//   Character pixel size = (5 * scale) wide x (7 * scale) tall
//   Horizontal spacing   = (6 * scale) per character (5 + 1 pixel gap)

// Large countdown text: scale 14 → 84x98 per char, readable from ~1m.
// "00:00" = 5 chars × (6*14) = 420px wide. Centered on 800: x=(800-420)/2=190.
constexpr uint8_t  TIME_TEXT_SIZE   = 14;
constexpr int16_t  TIME_CHAR_W      = 6 * TIME_TEXT_SIZE;  // 84px per char
constexpr int16_t  TIME_CHAR_H      = 7 * TIME_TEXT_SIZE;  // 98px tall
constexpr int16_t  TIME_STR_W       = 5 * TIME_CHAR_W;     // 420px for "MM:SS"
constexpr int16_t  TIME_X           = (Display::WIDTH - TIME_STR_W) / 2;
constexpr int16_t  TIME_Y           = (Display::HEIGHT - TIME_CHAR_H) / 2 - 20;

// Phase label: scale 3 → 18x21 per char, positioned below the countdown.
constexpr uint8_t  PHASE_TEXT_SIZE  = 3;
constexpr int16_t  PHASE_CHAR_W     = 6 * PHASE_TEXT_SIZE;  // 18px per char
constexpr int16_t  PHASE_Y          = TIME_Y + TIME_CHAR_H + 20;

// Session number: scale 2 → 12x14 per char, above the countdown.
constexpr uint8_t  SESSION_TEXT_SIZE = 2;
constexpr int16_t  SESSION_CHAR_W    = 6 * SESSION_TEXT_SIZE; // 12px per char
constexpr int16_t  SESSION_CHAR_H    = 7 * SESSION_TEXT_SIZE; // 14px tall
constexpr int16_t  SESSION_Y         = TIME_Y - SESSION_CHAR_H - 16;

// Goal name: scale 2 → 12x14 per char, near the bottom of the screen.
constexpr uint8_t  GOAL_TEXT_SIZE   = 2;
constexpr int16_t  GOAL_CHAR_W      = 6 * GOAL_TEXT_SIZE;    // 12px per char
constexpr int16_t  GOAL_Y           = Display::HEIGHT - 50;

// Maximum characters that fit on screen at goal text size.
// Screen width 800 / 12px per char = 66 chars. Leave small margin.
constexpr uint8_t  GOAL_MAX_CHARS   = 64;

// Fixed buffer for formatted time string "MM:SS\0" (6 bytes).
constexpr uint8_t  TIME_BUF_LEN     = 6;

// Fixed buffer for session label "Session NN\0" (max 11 bytes).
constexpr uint8_t  SESSION_BUF_LEN  = 12;

void showTimerScreen(uint32_t minutes, uint32_t seconds, TimerPhase phase,
                     uint32_t sessionNumber, const char* goalName) {
    // Format time as "MM:SS" into a stack buffer (NAT-F01: no dynamic alloc).
    char timeBuf[TIME_BUF_LEN];
    snprintf(timeBuf, TIME_BUF_LEN, "%02lu:%02lu",
             static_cast<unsigned long>(minutes),
             static_cast<unsigned long>(seconds));

    // Format session label into a stack buffer.
    char sessionBuf[SESSION_BUF_LEN];
    snprintf(sessionBuf, SESSION_BUF_LEN, "Session %lu",
             static_cast<unsigned long>(sessionNumber));

    // Get phase label string.
    const char* phaseLbl = phaseLabel(phase);
    uint16_t phaseLblLen = static_cast<uint16_t>(strlen(phaseLbl));

    // Calculate centered X position for the phase label.
    int16_t phaseStrW = static_cast<int16_t>(phaseLblLen) * PHASE_CHAR_W;
    int16_t phaseX = (Display::WIDTH - phaseStrW) / 2;

    // Calculate centered X position for the session label.
    uint16_t sessionLblLen = static_cast<uint16_t>(strlen(sessionBuf));
    int16_t sessionStrW = static_cast<int16_t>(sessionLblLen) * SESSION_CHAR_W;
    int16_t sessionX = (Display::WIDTH - sessionStrW) / 2;

    // Truncate goal name to fit screen width. Use a stack-allocated copy.
    char goalBuf[GOAL_MAX_CHARS + 1] = {};
    int16_t goalX = 0;
    bool hasGoal = (goalName != nullptr && goalName[0] != '\0');
    if (hasGoal) {
        uint16_t goalLen = static_cast<uint16_t>(strlen(goalName));
        if (goalLen > GOAL_MAX_CHARS) {
            // Truncate and add ellipsis: copy (max-3) chars then "..."
            memcpy(goalBuf, goalName, GOAL_MAX_CHARS - 3);
            goalBuf[GOAL_MAX_CHARS - 3] = '.';
            goalBuf[GOAL_MAX_CHARS - 2] = '.';
            goalBuf[GOAL_MAX_CHARS - 1] = '.';
            goalBuf[GOAL_MAX_CHARS] = '\0';
            goalLen = GOAL_MAX_CHARS;
        } else {
            memcpy(goalBuf, goalName, goalLen);
            goalBuf[goalLen] = '\0';
        }
        int16_t goalStrW = static_cast<int16_t>(goalLen) * GOAL_CHAR_W;
        goalX = (Display::WIDTH - goalStrW) / 2;
    }

    // Render using paged drawing (low RAM usage, same pattern as showTestPattern).
    display.setTextColor(GxEPD_BLACK);
    display.setFont(nullptr);  // default Adafruit GFX 5x7 font
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);

        // Session number (above time)
        if (sessionNumber > 0) {
            display.setTextSize(SESSION_TEXT_SIZE);
            display.setCursor(sessionX, SESSION_Y);
            display.print(sessionBuf);
        }

        // Large MM:SS countdown (center)
        display.setTextSize(TIME_TEXT_SIZE);
        display.setCursor(TIME_X, TIME_Y);
        display.print(timeBuf);

        // Phase indicator (below time)
        display.setTextSize(PHASE_TEXT_SIZE);
        display.setCursor(phaseX, PHASE_Y);
        display.print(phaseLbl);

        // Goal name (near bottom, if set)
        if (hasGoal) {
            display.setTextSize(GOAL_TEXT_SIZE);
            display.setCursor(goalX, GOAL_Y);
            display.print(goalBuf);
        }
    } while (display.nextPage());

    Serial.println("Timer screen displayed");
}

} // namespace Display
