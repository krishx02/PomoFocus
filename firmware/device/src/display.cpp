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

// Tracks whether the display controller is in deep sleep mode.
// Set true by hibernate(), cleared by wake().
static bool displayHibernating = false;

// SSD1677 deep sleep command (0x10) with mode byte 0x01.
// GxEPD2's hibernate() skips this when rst < 0, but we manage RST
// manually via the nRF GPIO HAL, so we send the command directly.
// Protocol: DC low = command byte, DC high = data byte.
static void sendDeepSleepCommand() {
    SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));

    // Send command byte 0x10 (Deep Sleep Mode)
    digitalWrite(EPD_DC_PIN, LOW);
    digitalWrite(EPD_CS_PIN, LOW);
    SPI.transfer(0x10);
    digitalWrite(EPD_CS_PIN, HIGH);
    digitalWrite(EPD_DC_PIN, HIGH);

    // Send data byte 0x01 (enter deep sleep)
    digitalWrite(EPD_CS_PIN, LOW);
    SPI.transfer(0x01);
    digitalWrite(EPD_CS_PIN, HIGH);

    SPI.endTransaction();
}

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
    // Put the SSD1677 controller into deep sleep mode. Two-step process:
    // 1. powerOff() — turns off panel driving voltages via GxEPD2
    // 2. sendDeepSleepCommand() — sends SSD1677 deep sleep command (0x10)
    //
    // GxEPD2's own hibernate() skips step 2 when rst < 0 because it
    // assumes it cannot wake the controller. Since we manage RST via
    // the nRF GPIO HAL, we send the command directly.
    //
    // After deep sleep, SSD1677 draws near-zero current. The e-ink
    // panel retains its last image (bistable). A hardware reset is
    // required before any further SPI commands — call wake().
    display.powerOff();
    sendDeepSleepCommand();
    displayHibernating = true;
    Serial.println("Display hibernating (deep sleep)");
}

void wake() {
    if (!displayHibernating) {
        return;
    }

    // Hardware reset wakes the SSD1677 from deep sleep. The nRF GPIO
    // HAL toggles RST (P1.13) since GxEPD2 cannot reach this pin.
    hardwareReset();

    // Reinitialize the GxEPD2 driver. initial=false tells the driver
    // this is a wake-from-sleep, not a cold start — it skips the
    // initial full-screen buffer clear, preserving the e-ink image.
    display.init(115200, /*initial=*/false);
    display.setRotation(0);

    displayHibernating = false;
    Serial.println("Display awake");
}

bool isHibernating() {
    return displayHibernating;
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

// ---------- Partial refresh state ----------
// Tracks the number of partial refreshes since the last full refresh.
// When this reaches FULL_REFRESH_INTERVAL, the next update does a full
// refresh to clear accumulated e-ink ghosting, then resets to zero.
static uint8_t partialRefreshCount = 0;

// Cached timer screen context from the last showTimerScreen call.
// When updateTimerPartial needs to do a full refresh (ghosting clear
// or terminal state), it redraws the complete timer layout using these
// cached values so session number, phase label, and goal are preserved.
static uint32_t cachedSessionNumber = 0;
static TimerPhase cachedPhase = TimerPhase::idle;
static char cachedGoalBuf[GOAL_MAX_CHARS + 1] = {};
static int16_t cachedGoalX = 0;
static bool cachedHasGoal = false;

// Partial refresh window: bounding box around the MM:SS time region.
// Includes a small vertical margin above and below for e-ink pixel
// alignment and to prevent visual clipping at scaled text boundaries.
constexpr int16_t  PARTIAL_Y_MARGIN = 4;
constexpr int16_t  PARTIAL_X        = TIME_X;
constexpr int16_t  PARTIAL_Y        = TIME_Y - PARTIAL_Y_MARGIN;
constexpr int16_t  PARTIAL_W        = TIME_STR_W;
constexpr int16_t  PARTIAL_H        = TIME_CHAR_H + 2 * PARTIAL_Y_MARGIN;

// Helper: draw the full timer layout into the current paged-drawing
// iteration. Factored out so both showTimerScreen and the full-refresh
// path in updateTimerPartial can reuse the same rendering logic.
static void renderTimerLayout(const char* timeBuf, const char* phaseLbl,
                              int16_t phaseX, const char* sessionBuf,
                              int16_t sessionX, uint32_t sessionNumber,
                              const char* goalBuf, int16_t goalX,
                              bool hasGoal) {
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
}

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

    // Cache context for updateTimerPartial full-refresh redraws.
    cachedSessionNumber = sessionNumber;
    cachedPhase = phase;
    cachedHasGoal = hasGoal;
    if (hasGoal) {
        memcpy(cachedGoalBuf, goalBuf, sizeof(cachedGoalBuf));
        cachedGoalX = goalX;
    } else {
        cachedGoalBuf[0] = '\0';
    }

    // Render using paged drawing (low RAM usage, same pattern as showTestPattern).
    display.setTextColor(GxEPD_BLACK);
    display.setFont(nullptr);  // default Adafruit GFX 5x7 font
    display.setFullWindow();
    display.firstPage();
    do {
        renderTimerLayout(timeBuf, phaseLbl, phaseX, sessionBuf, sessionX,
                          sessionNumber, goalBuf, goalX, hasGoal);
    } while (display.nextPage());

    partialRefreshCount = 0;
    Serial.println("Timer screen displayed");
}

void updateTimerPartial(uint32_t minutes, uint32_t seconds, TimerPhase phase) {
    // Timer completion or abandonment: force a full-screen refresh as a
    // visual "done" signal (the black-white flash is intentional per ADR-010).
    bool isTerminal = (phase == TimerPhase::completed ||
                       phase == TimerPhase::abandoned);

    // Force full refresh when phase changes (e.g. focusing → paused) so
    // the phase label is redrawn immediately, not stale for N partials.
    bool phaseChanged = (phase != cachedPhase);
    if (phaseChanged) {
        cachedPhase = phase;
    }

    // Determine if this update should be a full refresh for ghosting
    // management. Every FULL_REFRESH_INTERVAL partials we do a full
    // refresh, or when the timer reaches a terminal state, or when the
    // phase changes.
    bool doFullRefresh = isTerminal || phaseChanged ||
                         (partialRefreshCount >= FULL_REFRESH_INTERVAL - 1);

    // Format time string into a fixed stack buffer (NAT-F01).
    char timeBuf[TIME_BUF_LEN];
    snprintf(timeBuf, TIME_BUF_LEN, "%02lu:%02lu",
             static_cast<unsigned long>(minutes),
             static_cast<unsigned long>(seconds));

    display.setTextColor(GxEPD_BLACK);
    display.setFont(nullptr);

    if (doFullRefresh) {
        // Full refresh: redraw entire timer screen layout using cached
        // context from the last showTimerScreen call. This preserves
        // session number, phase label, and goal name on screen.
        const char* phaseLbl = phaseLabel(phase);
        uint16_t phaseLblLen = static_cast<uint16_t>(strlen(phaseLbl));
        int16_t phaseStrW = static_cast<int16_t>(phaseLblLen) * PHASE_CHAR_W;
        int16_t phaseX = (Display::WIDTH - phaseStrW) / 2;

        char sessionBuf[SESSION_BUF_LEN];
        snprintf(sessionBuf, SESSION_BUF_LEN, "Session %lu",
                 static_cast<unsigned long>(cachedSessionNumber));
        uint16_t sessionLblLen = static_cast<uint16_t>(strlen(sessionBuf));
        int16_t sessionStrW = static_cast<int16_t>(sessionLblLen) * SESSION_CHAR_W;
        int16_t sessionX = (Display::WIDTH - sessionStrW) / 2;

        display.setFullWindow();
        display.firstPage();
        do {
            renderTimerLayout(timeBuf, phaseLbl, phaseX, sessionBuf,
                              sessionX, cachedSessionNumber,
                              cachedGoalBuf, cachedGoalX, cachedHasGoal);
        } while (display.nextPage());

        partialRefreshCount = 0;
        Serial.println("Timer partial update (full refresh for ghosting clear)");
    } else {
        // Partial refresh: update only the time region bounding box.
        // GxEPD2 setPartialWindow clips drawing to the specified rect
        // and uses the panel's partial update waveform (~0.42s).
        display.setPartialWindow(PARTIAL_X, PARTIAL_Y,
                                 PARTIAL_W, PARTIAL_H);
        display.firstPage();
        do {
            display.fillScreen(GxEPD_WHITE);

            display.setTextSize(TIME_TEXT_SIZE);
            display.setCursor(TIME_X, TIME_Y);
            display.print(timeBuf);
        } while (display.nextPage());

        partialRefreshCount++;
        Serial.println("Timer partial update (partial refresh)");
    }
}

void resetPartialRefreshCount() {
    partialRefreshCount = 0;
}

} // namespace Display
