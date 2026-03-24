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

// ---------- Layout constants ----------
// Adafruit GFX default font: 5x7 px per character at size 1.
// Character width at scale S = 6*S px (5px glyph + 1px spacing).
// Character height at scale S = 8*S px (7px glyph + 1px spacing).
constexpr int16_t CHAR_W_BASE = 6;
constexpr int16_t CHAR_H_BASE = 8;

// Margins and padding
constexpr int16_t MARGIN_X = 40;
constexpr int16_t MARGIN_TOP = 40;

// Goal list layout
constexpr int16_t GOAL_ROW_HEIGHT = 52;
constexpr int16_t GOAL_ROW_PAD_X = 12;
constexpr int16_t GOAL_ROW_PAD_Y = 10;

// Maximum characters that fit in the goal list area at text size 2.
// Usable width = 800 - 2*40(margin) - 2*12(row padding) - 160(progress) = 536px
// At size 2: 536 / 12 = 44 chars. Truncate at MAX_GOAL_TITLE_LEN (40) + ellipsis.
constexpr uint8_t GOAL_DISPLAY_MAX_CHARS = 38;

// ---------- Helpers ----------

// Copy src into dst, truncating with "..." if longer than maxChars.
// dst must have room for maxChars + 3 (ellipsis) + 1 (null).
static void truncateTitle(char* dst, uint8_t dstSize,
                          const char* src, uint8_t maxChars) {
    uint8_t len = static_cast<uint8_t>(strlen(src));
    if (len <= maxChars) {
        strncpy(dst, src, dstSize - 1);
        dst[dstSize - 1] = '\0';
    } else {
        // Truncate and append ellipsis
        uint8_t copyLen = (maxChars >= 3) ? (maxChars - 3) : 0;
        if (copyLen >= dstSize) {
            copyLen = dstSize - 4;
        }
        memcpy(dst, src, copyLen);
        dst[copyLen]     = '.';
        dst[copyLen + 1] = '.';
        dst[copyLen + 2] = '.';
        dst[copyLen + 3] = '\0';
    }
}

// Draw text centered horizontally at the given y coordinate.
static void drawCenteredText(const char* text, uint8_t textSize, int16_t y) {
    int16_t textLen = static_cast<int16_t>(strlen(text));
    int16_t textW = textLen * CHAR_W_BASE * textSize;
    int16_t x = (WIDTH - textW) / 2;
    display.setTextSize(textSize);
    display.setCursor(x, y);
    display.print(text);
}

void showIdleScreen(uint8_t sessionsToday, const char* currentGoalTitle) {
    // Layout (centered vertically on 480px):
    //   "PomoFocus" at size 3            — branding
    //   "Ready to focus" at size 4       — main message
    //   "N sessions today" at size 2     — counter
    //   "[goal title]" at size 2         — current goal

    // Vertical centering: total content height ~200px, start at ~120px
    constexpr int16_t Y_BRAND   = 120;
    constexpr int16_t Y_HEADING = 180;
    constexpr int16_t Y_COUNTER = 260;
    constexpr int16_t Y_GOAL    = 310;

    // Format session count string (fixed buffer, NAT-F01)
    char counterBuf[32];
    snprintf(counterBuf, sizeof(counterBuf), "%u session%s today",
             sessionsToday, (sessionsToday == 1) ? "" : "s");

    // Truncate goal title for display
    char goalBuf[MAX_GOAL_TITLE_LEN + 4];
    if (currentGoalTitle != nullptr && currentGoalTitle[0] != '\0') {
        truncateTitle(goalBuf, sizeof(goalBuf), currentGoalTitle,
                      GOAL_DISPLAY_MAX_CHARS);
    } else {
        strncpy(goalBuf, "No goal selected", sizeof(goalBuf) - 1);
        goalBuf[sizeof(goalBuf) - 1] = '\0';
    }

    display.setTextColor(GxEPD_BLACK);
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);

        drawCenteredText("PomoFocus", 3, Y_BRAND);
        drawCenteredText("Ready to focus", 4, Y_HEADING);
        drawCenteredText(counterBuf, 2, Y_COUNTER);
        drawCenteredText(goalBuf, 2, Y_GOAL);
    } while (display.nextPage());

    Serial.println("Idle screen displayed");
}

void showGoalScreen(const GoalInfo* goals, uint8_t goalCount,
                    uint8_t selectedIndex) {
    // Layout:
    //   "Select Goal" heading at size 3 — top
    //   List of goals with progress — scrollable area
    //   Selected goal: inverted (white text on black background)
    //   Each row: "[title]    N/M" with progress fraction right-aligned

    constexpr int16_t HEADING_Y = MARGIN_TOP;
    constexpr int16_t LIST_START_Y = HEADING_Y + CHAR_H_BASE * 3 + 30;
    constexpr int16_t LIST_WIDTH = WIDTH - 2 * MARGIN_X;

    // Maximum visible rows that fit in the remaining screen height
    constexpr int16_t AVAILABLE_HEIGHT = HEIGHT - LIST_START_Y - 20;
    constexpr uint8_t MAX_VISIBLE_ROWS =
        static_cast<uint8_t>(AVAILABLE_HEIGHT / GOAL_ROW_HEIGHT);

    // Scroll offset: keep selected item visible
    uint8_t scrollOffset = 0;
    if (selectedIndex >= MAX_VISIBLE_ROWS) {
        scrollOffset = selectedIndex - MAX_VISIBLE_ROWS + 1;
    }

    display.setTextColor(GxEPD_BLACK);
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);

        // Heading
        drawCenteredText("Select Goal", 3, HEADING_Y);

        // Divider line under heading
        int16_t divY = LIST_START_Y - 8;
        display.drawLine(MARGIN_X, divY, WIDTH - MARGIN_X, divY, GxEPD_BLACK);

        // Goal list
        uint8_t visibleCount = goalCount - scrollOffset;
        if (visibleCount > MAX_VISIBLE_ROWS) {
            visibleCount = MAX_VISIBLE_ROWS;
        }

        for (uint8_t i = 0; i < visibleCount; i++) {
            uint8_t goalIdx = scrollOffset + i;
            int16_t rowY = LIST_START_Y + i * GOAL_ROW_HEIGHT;
            bool isSelected = (goalIdx == selectedIndex);

            // Row background: inverted for selected
            if (isSelected) {
                display.fillRect(MARGIN_X, rowY,
                                 LIST_WIDTH, GOAL_ROW_HEIGHT - 4,
                                 GxEPD_BLACK);
                display.setTextColor(GxEPD_WHITE);
            } else {
                display.setTextColor(GxEPD_BLACK);
            }

            // Truncated goal title
            char titleBuf[MAX_GOAL_TITLE_LEN + 4];
            truncateTitle(titleBuf, sizeof(titleBuf),
                          goals[goalIdx].title, GOAL_DISPLAY_MAX_CHARS);

            display.setTextSize(2);
            display.setCursor(MARGIN_X + GOAL_ROW_PAD_X,
                              rowY + GOAL_ROW_PAD_Y);
            display.print(titleBuf);

            // Progress fraction right-aligned: "N/M"
            char progressBuf[8];
            snprintf(progressBuf, sizeof(progressBuf), "%u/%u",
                     goals[goalIdx].completedSessions,
                     goals[goalIdx].targetSessions);
            int16_t progW = static_cast<int16_t>(strlen(progressBuf))
                            * CHAR_W_BASE * 2;
            display.setCursor(WIDTH - MARGIN_X - GOAL_ROW_PAD_X - progW,
                              rowY + GOAL_ROW_PAD_Y);
            display.print(progressBuf);

            // Reset text color for next row
            display.setTextColor(GxEPD_BLACK);
        }

        // Scroll indicators if list overflows
        if (scrollOffset > 0) {
            // Up arrow hint
            drawCenteredText("^", 2, LIST_START_Y - 20);
        }
        if (scrollOffset + visibleCount < goalCount) {
            // Down arrow hint
            int16_t arrowY = LIST_START_Y + visibleCount * GOAL_ROW_HEIGHT + 4;
            drawCenteredText("v", 2, arrowY);
        }
    } while (display.nextPage());

    Serial.println("Goal screen displayed");
}

void showSessionComplete(const SessionSummary& summary) {
    // Layout (centered):
    //   "Session Complete" at size 4     — heading
    //   "Session #N" at size 2           — session number
    //   "MM:SS focus time" at size 3     — duration
    //   "[goal title]" at size 2         — which goal

    constexpr int16_t Y_HEADING  = 100;
    constexpr int16_t Y_SESSION  = 190;
    constexpr int16_t Y_DURATION = 250;
    constexpr int16_t Y_GOAL     = 330;

    // Format session number
    char sessionBuf[24];
    snprintf(sessionBuf, sizeof(sessionBuf), "Session #%u",
             summary.sessionNumber);

    // Format duration as MM:SS
    uint32_t minutes = summary.focusDurationSec / 60;
    uint32_t seconds = summary.focusDurationSec % 60;
    char durationBuf[24];
    snprintf(durationBuf, sizeof(durationBuf), "%lu:%02lu focus",
             static_cast<unsigned long>(minutes),
             static_cast<unsigned long>(seconds));

    // Truncate goal title
    char goalBuf[MAX_GOAL_TITLE_LEN + 4];
    if (summary.goalTitle[0] != '\0') {
        truncateTitle(goalBuf, sizeof(goalBuf), summary.goalTitle,
                      GOAL_DISPLAY_MAX_CHARS);
    } else {
        strncpy(goalBuf, "No goal", sizeof(goalBuf) - 1);
        goalBuf[sizeof(goalBuf) - 1] = '\0';
    }

    display.setTextColor(GxEPD_BLACK);
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);

        // Decorative line above heading
        constexpr int16_t LINE_Y = Y_HEADING - 20;
        constexpr int16_t LINE_W = 200;
        display.drawLine((WIDTH - LINE_W) / 2, LINE_Y,
                         (WIDTH + LINE_W) / 2, LINE_Y, GxEPD_BLACK);

        drawCenteredText("Session Complete", 4, Y_HEADING);

        // Decorative line below heading
        constexpr int16_t LINE2_Y = Y_HEADING + CHAR_H_BASE * 4 + 12;
        display.drawLine((WIDTH - LINE_W) / 2, LINE2_Y,
                         (WIDTH + LINE_W) / 2, LINE2_Y, GxEPD_BLACK);

        drawCenteredText(sessionBuf, 2, Y_SESSION);
        drawCenteredText(durationBuf, 3, Y_DURATION);
        drawCenteredText(goalBuf, 2, Y_GOAL);
    } while (display.nextPage());

    Serial.println("Session complete screen displayed");
}

} // namespace Display
